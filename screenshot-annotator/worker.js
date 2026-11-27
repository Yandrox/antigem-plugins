'use strict';

// screenshot-annotator — anotaciones no destructivas sobre capturas locales.
// JS puro dentro del worker: genera SVG, HTML y Markdown; nunca edita la imagen.

const MAX_IMAGE_BYTES = 24 * 1024 * 1024;
const MAX_SHAPES = 60;
const MAX_TEXT = 200;
const MAX_EMBED_BYTES = 8 * 1024 * 1024;

function asText(value) {
  return value == null ? '' : String(value);
}

function both(es, en) {
  return `${es} / ${en}`;
}

function fail(es, en) {
  throw new Error(both(es, en));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizePath(value, labelEs, labelEn) {
  const raw = asText(value).trim();
  if (!raw) fail(`Falta ${labelEs}`, `${labelEn} is required`);
  if (raw.includes('..')) fail(`${labelEs} no puede contener ..`, `${labelEn} cannot contain ..`);
  if (!/^(~\/|\/sdcard\/|\/data\/)/.test(raw)) {
    fail(`${labelEs} debe empezar por ~/, /sdcard/ o /data/`,
      `${labelEn} must start with ~/, /sdcard/ or /data/`);
  }
  return raw;
}

function optionalPath(value, labelEs, labelEn, extensions) {
  if (value == null || value === '') return null;
  const path = normalizePath(value, labelEs, labelEn);
  if (extensions && !extensions.some(ext => path.toLowerCase().endsWith(ext))) {
    fail(`${labelEs} debe terminar en ${extensions.join(' o ')}`,
      `${labelEn} must end with ${extensions.join(' or ')}`);
  }
  return path;
}

function escapeXml(value) {
  return asText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(value) {
  return escapeXml(value);
}

function escapeMd(value) {
  return asText(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

function safeColor(value, fallback) {
  const text = asText(value).trim();
  if (!text) return fallback;
  if (/^#[0-9a-fA-F]{6}$/.test(text) || /^#[0-9a-fA-F]{3}$/.test(text)) return text;
  const named = new Set(['red', 'orange', 'yellow', 'green', 'blue', 'navy', 'purple',
    'magenta', 'cyan', 'teal', 'black', 'white', 'gray', 'grey', 'pink', 'brown']);
  if (named.has(text.toLowerCase())) return text.toLowerCase();
  fail('Color no permitido: usa #RGB, #RRGGBB o un nombre básico',
    'Colour not allowed: use #RGB, #RRGGBB or a basic name');
}

function base64ToBytes(base64) {
  const clean = asText(base64).replace(/\s/g, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const output = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let cursor = 0;
  for (let index = 0; index < clean.length; index++) {
    const value = alphabet.indexOf(clean[index]);
    if (value < 0) break;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[cursor++] = (buffer >>> bits) & 0xff;
    }
  }
  return output.subarray(0, cursor);
}

function u16be(bytes, offset) {
  if (offset + 2 > bytes.length) return 0;
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function u32be(bytes, offset) {
  if (offset + 4 > bytes.length) return 0;
  return (bytes[offset] * 0x1000000 + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

function u16le(bytes, offset) {
  if (offset + 2 > bytes.length) return 0;
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function mimeFor(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (asText(String.fromCharCode(...bytes.subarray(0, 6))).indexOf('GIF8') === 0) return 'image/gif';
  if (asText(String.fromCharCode(...bytes.subarray(0, 4))) === 'RIFF') return 'image/webp';
  return 'application/octet-stream';
}

function detectDimensions(bytes) {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return {width: u32be(bytes, 16), height: u32be(bytes, 20)};
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let position = 2;
    while (position + 9 < bytes.length) {
      if (bytes[position] !== 0xff) {
        position++;
        continue;
      }
      let marker = bytes[position + 1];
      while (marker === 0xff) marker = bytes[++position + 1];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        position += 2;
        continue;
      }
      const length = u16be(bytes, position + 2);
      if (length < 2) break;
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return {width: u16be(bytes, position + 7), height: u16be(bytes, position + 5)};
      }
      position += 2 + length;
    }
  }
  if (bytes.length >= 10 && String.fromCharCode(...bytes.subarray(0, 6)).indexOf('GIF8') === 0) {
    return {width: u16le(bytes, 6), height: u16le(bytes, 8)};
  }
  return {width: 0, height: 0};
}

async function readBytes(path, limit) {
  const stat = await chrome.antigem.stat({path});
  if (!stat.isFile) fail('La ruta debe ser un archivo', 'Path must be a file');
  if (!stat.size) fail('El archivo está vacío', 'File is empty');
  if (stat.size > (limit || MAX_IMAGE_BYTES)) {
    fail('Archivo demasiado grande', 'File is too large');
  }
  const data = base64ToBytes(await chrome.antigem.readFile({path, encoding: 'base64'}));
  return {data, stat};
}

async function pathExists(path) {
  try {
    await chrome.antigem.stat({path});
    return true;
  } catch (_) {
    return false;
  }
}

async function writeNew(path, data, encoding) {
  if (await pathExists(path)) {
    fail(`Ya existe ${path}. Elige otra ruta.`, `${path} already exists. Choose another path.`);
  }
  await chrome.antigem.writeFile({path, data, encoding: encoding || 'utf8'});
}

function relativePath(fromFile, toFile) {
  const left = fromFile.split('/').filter(Boolean);
  const right = toFile.split('/').filter(Boolean);
  left.pop();
  let common = 0;
  while (common < left.length && common < right.length && left[common] === right[common]) common++;
  if (common === 0) return toFile;
  const parts = [];
  for (let index = common; index < left.length; index++) parts.push('..');
  for (let index = common; index < right.length; index++) parts.push(right[index]);
  return parts.join('/') || '.';
}

function numeric(value, fallback, max, name, index, warnings) {
  const number = Number(value);
  if (value == null || value === '' || !Number.isFinite(number)) {
    if (value != null && value !== '') {
      warnings.push(`Figura ${index}: ${name} no numérico, se usa ${fallback}.`);
    }
    return fallback;
  }
  const result = clamp(number, 0, max);
  if (result !== number) warnings.push(`Figura ${index}: ${name} fuera del lienzo, se ajusta a ${result}.`);
  return Math.round(result * 100) / 100;
}

function textOf(value, max, name, index, warnings) {
  const text = asText(value).trim();
  if (text.length > max) warnings.push(`Figura ${index}: ${name} recortado a ${max} caracteres.`);
  return escapeXml(text.slice(0, max));
}

function rectMarkup(shape, width, height, index, warnings) {
  const x = numeric(shape.x != null ? shape.x : shape.left, 0, width, 'x', index, warnings);
  const y = numeric(shape.y != null ? shape.y : shape.top, 0, height, 'y', index, warnings);
  const w = numeric(shape.width != null ? shape.width : shape.w, 40, width, 'width', index, warnings);
  const h = numeric(shape.height != null ? shape.height : shape.h, 40, height, 'height', index, warnings);
  const color = safeColor(shape.color || shape.stroke, '#EF4444');
  const stroke = clamp(Number(shape.stroke_width) || 3, 1, 12);
  const dash = shape.dash === true || shape.dash === 'true' ? ' stroke-dasharray="8 5"' : '';
  const radius = clamp(Number(shape.radius) || 0, 0, 40);
  const label = shape.label ? textOf(shape.label, MAX_TEXT, 'etiqueta', index, warnings) : '';
  const labelMarkup = label
    ? `<text x="${x}" y="${Math.max(12, y - 6)}" font-family="sans-serif" font-size="14" font-weight="bold" fill="${color}" stroke="#ffffff" stroke-width="3" paint-order="stroke fill">${label}</text>`
    : '';
  return {
    markup: `<g data-shape="${index}"><title>Rectángulo ${index}</title><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="none" stroke="${color}" stroke-width="${stroke}"${dash}/>${labelMarkup}</g>`,
    description: `Rectángulo ${Math.round(x)},${Math.round(y)} ${Math.round(w)}x${Math.round(h)}${shape.label ? ` — ${asText(shape.label)}` : ''}`,
    position: `${Math.round(x)},${Math.round(y)}`
  };
}

function arrowMarkup(shape, width, height, index, warnings) {
  const x1 = numeric(shape.x1, 0, width, 'x1', index, warnings);
  const y1 = numeric(shape.y1, 0, height, 'y1', index, warnings);
  const x2 = numeric(shape.x2 != null ? shape.x2 : shape.toX, width / 2, width, 'x2', index, warnings);
  const y2 = numeric(shape.y2 != null ? shape.y2 : shape.toY, height / 2, height, 'y2', index, warnings);
  const color = safeColor(shape.color || shape.stroke, '#F59E0B');
  const stroke = clamp(Number(shape.stroke_width) || 4, 1, 12);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const head = clamp(stroke * 3, 9, 26);
  const baseX = x2 - ux * head;
  const baseY = y2 - uy * head;
  const px = -uy * head * 0.45;
  const py = ux * head * 0.45;
  const label = shape.label ? textOf(shape.label, MAX_TEXT, 'etiqueta', index, warnings) : '';
  const labelMarkup = label
    ? `<text x="${(x1 + x2) / 2}" y="${Math.max(12, (y1 + y2) / 2 - 8)}" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="${color}" stroke="#ffffff" stroke-width="3" paint-order="stroke fill">${label}</text>`
    : '';
  return {
    markup: `<g data-shape="${index}"><title>Flecha ${index}</title><line x1="${x1}" y1="${y1}" x2="${baseX}" y2="${baseY}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"/><polygon points="${x2},${y2} ${baseX + px},${baseY + py} ${baseX - px},${baseY - py}" fill="${color}"/>${labelMarkup}</g>`,
    description: `Flecha ${Math.round(x1)},${Math.round(y1)} → ${Math.round(x2)},${Math.round(y2)}${shape.label ? ` — ${asText(shape.label)}` : ''}`,
    position: `${Math.round(x1)},${Math.round(y1)} → ${Math.round(x2)},${Math.round(y2)}`
  };
}

function numberMarkup(shape, width, height, index, warnings) {
  const x = numeric(shape.x, width / 2, width, 'x', index, warnings);
  const y = numeric(shape.y, height / 2, height, 'y', index, warnings);
  const color = safeColor(shape.color, '#DC2626');
  const size = clamp(Number(shape.size) || 16, 10, 48);
  const valueRaw = shape.value != null ? shape.value : index + 1;
  const value = clamp(Math.round(Number(valueRaw) || (index + 1)), 1, 99);
  if (String(value) !== asText(valueRaw)) warnings.push(`Figura ${index}: número no válido, se usa ${value}.`);
  return {
    markup: `<g data-shape="${index}"><title>Número ${value}</title><circle cx="${x}" cy="${y}" r="${size}" fill="${color}" stroke="#ffffff" stroke-width="2"/><text x="${x}" y="${y + size * 0.35}" font-family="sans-serif" font-size="${Math.round(size * 1.15)}" font-weight="bold" text-anchor="middle" fill="#ffffff">${value}</text></g>`,
    description: `Número ${value} en ${Math.round(x)},${Math.round(y)}`,
    position: `${Math.round(x)},${Math.round(y)}`
  };
}

function textMarkup(shape, width, height, index, warnings) {
  const x = numeric(shape.x, 0, width, 'x', index, warnings);
  const y = numeric(shape.y, 20, height, 'y', index, warnings);
  const color = safeColor(shape.color, '#1D4ED8');
  const size = clamp(Number(shape.size) || 16, 10, 48);
  const text = textOf(shape.text || shape.label, MAX_TEXT, 'texto', index, warnings);
  return {
    markup: `<g data-shape="${index}"><title>Texto ${index}</title><text x="${x}" y="${y}" font-family="sans-serif" font-size="${size}" font-weight="bold" fill="${color}" stroke="#ffffff" stroke-width="3" paint-order="stroke fill">${text}</text></g>`,
    description: `Texto "${asText(shape.text || shape.label).slice(0, MAX_TEXT)}" en ${Math.round(x)},${Math.round(y)}`,
    position: `${Math.round(x)},${Math.round(y)}`
  };
}

function ellipseMarkup(shape, width, height, index, warnings) {
  const x = numeric(shape.x, width / 2, width, 'x', index, warnings);
  const y = numeric(shape.y, height / 2, height, 'y', index, warnings);
  const rx = numeric(shape.rx != null ? shape.rx : shape.width, 40, width, 'rx', index, warnings);
  const ry = numeric(shape.ry != null ? shape.ry : shape.height, 40, height, 'ry', index, warnings);
  const color = safeColor(shape.color || shape.stroke, '#7C3AED');
  const stroke = clamp(Number(shape.stroke_width) || 3, 1, 12);
  return {
    markup: `<g data-shape="${index}"><title>Elipse ${index}</title><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="none" stroke="${color}" stroke-width="${stroke}"/></g>`,
    description: `Elipse ${Math.round(x)},${Math.round(y)} r=${Math.round(rx)}/${Math.round(ry)}`,
    position: `${Math.round(x)},${Math.round(y)}`
  };
}

const BUILDERS = {
  rect: rectMarkup,
  rectangle: rectMarkup,
  box: rectMarkup,
  arrow: arrowMarkup,
  number: numberMarkup,
  badge: numberMarkup,
  text: textMarkup,
  label: textMarkup,
  ellipse: ellipseMarkup,
  circle: ellipseMarkup
};

function buildOverlay(shapes, width, height, title) {
  if (!Array.isArray(shapes) || shapes.length === 0) {
    fail('La lista de anotaciones está vacía', 'The annotation list is empty');
  }
  if (shapes.length > MAX_SHAPES) {
    fail(`Demasiadas figuras (máximo ${MAX_SHAPES})`, `Too many shapes (maximum ${MAX_SHAPES})`);
  }
  const warnings = [];
  const annotations = [];
  const parts = [];
  for (let index = 0; index < shapes.length; index++) {
    const shape = shapes[index];
    if (!shape || typeof shape !== 'object' || Array.isArray(shape)) {
      warnings.push(`Figura ${index + 1}: objeto no válido, se ignora.`);
      continue;
    }
    const type = asText(shape.type || 'rect').toLowerCase();
    const builder = BUILDERS[type];
    if (!builder) {
      warnings.push(`Figura ${index + 1}: tipo "${type}" desconocido, se ignora.`);
      continue;
    }
    const built = builder(shape, width, height, index + 1, warnings);
    parts.push(built.markup);
    annotations.push({index: index + 1, type, ...built});
  }
  if (!annotations.length) fail('No hay figuras válidas para dibujar', 'No valid shapes to draw');
  const safeTitle = asText(title).trim() || 'Captura anotada / Annotated screenshot';
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(safeTitle)}">`,
    `<title>${escapeXml(safeTitle)}</title>`,
    ...parts,
    '</svg>'
  ].join('\n');
  return {svg, inner: parts.join('\n'), annotations, warnings, title: safeTitle};
}

async function canvasFromArgs(args) {
  const image = normalizePath(args.image || args.path, 'la ruta de la captura', 'screenshot path');
  let width = Number(args.width);
  let height = Number(args.height);
  let bytes = null;
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    const file = await readBytes(image);
    const size = detectDimensions(file.data);
    width = size.width;
    height = size.height;
    bytes = file.data;
    if (!width || !height) {
      fail('No se pudieron leer las dimensiones; indica width y height',
        'Could not read dimensions; provide width and height');
    }
  }
  width = clamp(Math.round(width), 1, 20000);
  height = clamp(Math.round(height), 1, 20000);
  return {image, width, height, bytes};
}

function buildHtml(imageRef, width, height, overlay, annotations, embed) {
  const title = escapeHtml(overlay.title);
  const rows = annotations.map(item =>
    `<tr><td>${item.index}</td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.description.replace(' → ', ' → '))}</td><td>${escapeHtml(item.position)}</td></tr>`
  ).join('\n');
  return [
    '<!doctype html>',
    '<html lang="es">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    '<style>',
    'body{font-family:system-ui,sans-serif;margin:24px;background:#f8fafc;color:#0f172a}',
    '.stage{position:relative;display:inline-block;line-height:0;border:1px solid #cbd5e1;background:#fff;overflow:auto;max-width:100%}',
    '.stage img{display:block;max-width:100%;height:auto}',
    '.stage svg{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}',
    '#toggle-overlay{position:absolute;opacity:0}',
    '#toggle-overlay:not(:checked)~main .overlay{display:none}',
    'label{cursor:pointer;display:inline-block;padding:6px 12px;border:1px solid #94a3b8;border-radius:6px;background:#fff}',
    'table{border-collapse:collapse;margin-top:16px;font-size:14px}',
    'th,td{border:1px solid #cbd5e1;padding:6px 10px;text-align:left}',
    'th{background:#e2e8f0}',
    '</style>',
    '</head>',
    '<body>',
    `<h1>${title}</h1>`,
    `<p>Original: <code>${escapeHtml(imageRef.startsWith('data:') ? 'imagen incrustada / embedded image' : imageRef)}</code> · ${width}×${height} · ${embed ? 'embebida / embedded' : 'por ruta / by path'}</p>`,
    '<input type="checkbox" id="toggle-overlay" checked>',
    '<label for="toggle-overlay">Mostrar u ocultar anotaciones / Toggle annotations</label>',
    '<main>',
    `<h2>Con anotaciones / With annotations</h2>`,
    `<div class="stage" style="width:${width}px"><img src="${escapeHtml(imageRef)}" alt="Captura original / Original screenshot" width="${width}" height="${height}"><svg class="overlay" viewBox="0 0 ${width} ${height}">${overlay.inner}</svg></div>`,
    `<h2>Sin anotaciones / Without annotations</h2>`,
    `<div class="stage" style="width:${width}px"><img src="${escapeHtml(imageRef)}" alt="Captura original / Original screenshot" width="${width}" height="${height}"></div>`,
    '</main>',
    '<h2>Anotaciones / Annotations</h2>',
    '<table><thead><tr><th>#</th><th>ES/EN</th><th>Descripción / Description</th><th>Posición / Position</th></tr></thead>',
    `<tbody>${rows}</tbody></table>`,
    '<p>Sin red, sin dependencias. La imagen original no se ha modificado. / No network, no dependencies. The original image was not modified.</p>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

function buildReport(input) {
  const {image, width, height, annotations, svgPath, htmlPath, notes, warnings, title} = input;
  const lines = [
    '# Captura anotada / Annotated screenshot',
    '',
    '## ES',
    '',
    `- Imagen original (sin modificar): \`${image}\``,
    `- Dimensiones: ${width}x${height}`,
    `- Anotaciones: ${annotations.length}`,
    `- SVG: ${svgPath ? `\`${svgPath}\`` : 'en línea / inline'}`,
    `- Visor HTML: ${htmlPath ? `\`${htmlPath}\`` : 'no generado / not generated'}`,
    ''
  ];
  if (notes) {
    lines.push('### Notas del informe', '');
    for (const line of asText(notes).split(/\r?\n/).map(item => item.trim()).filter(Boolean)) {
      lines.push(`- ${escapeMd(line).slice(0, MAX_TEXT)}`);
    }
    lines.push('');
  }
  lines.push('### Anotaciones', '',
    '| # | Tipo | Descripción | Posición |',
    '| --- | --- | --- | --- |');
  for (const item of annotations) {
    lines.push(`| ${item.index} | ${escapeMd(item.type)} | ${escapeMd(item.description)} | ${escapeMd(item.position)} |`);
  }
  lines.push('', '### Verificación', '',
    '- [ ] La imagen original no se ha modificado.',
    '- [ ] La capa SVG se ve alineada con la captura.',
    '- [ ] Los datos sensibles de la captura están revisados.',
    '- [ ] El informe incluye pasos para reproducir el problema.', '');
  for (const warning of warnings) lines.push(`> Aviso: ${escapeMd(warning)}`);
  if (warnings.length) lines.push('');

  lines.push('## EN', '',
    `- Original image (unmodified): \`${image}\``,
    `- Dimensions: ${width}x${height}`,
    `- Annotations: ${annotations.length}`,
    `- SVG: ${svgPath ? `\`${svgPath}\`` : 'inline'}`,
    `- HTML viewer: ${htmlPath ? `\`${htmlPath}\`` : 'not generated'}`, '');
  if (notes) {
    lines.push('### Report notes', '');
    for (const line of asText(notes).split(/\r?\n/).map(item => item.trim()).filter(Boolean)) {
      lines.push(`- ${escapeMd(line).slice(0, MAX_TEXT)}`);
    }
    lines.push('');
  }
  lines.push('### Annotations', '',
    '| # | Type | Description | Position |',
    '| --- | --- | --- | --- |');
  for (const item of annotations) {
    lines.push(`| ${item.index} | ${escapeMd(item.type)} | ${escapeMd(item.description)} | ${escapeMd(item.position)} |`);
  }
  lines.push('', '### Verification', '',
    '- [ ] The original image was not modified.',
    '- [ ] The SVG layer is aligned with the screenshot.',
    '- [ ] Sensitive data in the screenshot has been reviewed.',
    '- [ ] The report includes steps to reproduce the issue.', '');
  for (const warning of warnings) lines.push(`> Warning: ${escapeMd(warning)}`);
  if (warnings.length) lines.push('');
  lines.push(`> ${title} · Generado offline por screenshot-annotator / Generated offline by screenshot-annotator.`);
  return `${lines.join('\n')}\n`;
}

async function annotationSvg(args) {
  const {image, width, height} = await canvasFromArgs(args);
  const overlay = buildOverlay(args.shapes, width, height, args.title);
  const output = optionalPath(args.output, 'la ruta del SVG', 'SVG path', ['.svg']);
  const dryRun = args.dry_run !== false;
  let written = false;
  if (output && !dryRun) {
    await writeNew(output, overlay.svg, 'utf8');
    written = true;
  }
  return {
    ok: true, image, width, height, shapeCount: overlay.annotations.length,
    svg: overlay.svg, annotations: overlay.annotations, warnings: overlay.warnings,
    output, written, dry_run: dryRun,
    message: both(`SVG con ${overlay.annotations.length} anotaciones listo.`, `SVG with ${overlay.annotations.length} annotations ready.`)
  };
}

async function annotationPage(args) {
  const canvas = await canvasFromArgs(args);
  const overlay = buildOverlay(args.shapes, canvas.width, canvas.height, args.title);
  const output = optionalPath(args.output, 'la ruta del HTML', 'HTML path', ['.html', '.htm']);
  if (!output) fail('Falta la ruta del HTML de salida', 'Output HTML path is required');
  const embed = args.embed_image === true;
  let bytes = canvas.bytes;
  if (embed && !bytes) bytes = (await readBytes(canvas.image, MAX_EMBED_BYTES)).data;
  const imageRef = embed
    ? `data:${mimeFor(bytes)};base64,${await chrome.antigem.readFile({path: canvas.image, encoding: 'base64'})}`
    : relativePath(output, canvas.image);
  const html = buildHtml(imageRef, canvas.width, canvas.height, overlay, overlay.annotations, embed);
  const dryRun = args.dry_run !== false;
  let written = false;
  if (!dryRun) {
    await writeNew(output, html, 'utf8');
    written = true;
  }
  return {
    ok: true, image: canvas.image, width: canvas.width, height: canvas.height,
    image_ref: embed ? `data:${mimeFor(bytes)};base64,…` : imageRef,
    embed_image: embed, html, shapeCount: overlay.annotations.length,
    warnings: overlay.warnings, output, written, dry_run: dryRun,
    message: both('Visor HTML sin dependencias listo.', 'Dependency-free HTML viewer ready.')
  };
}

async function annotationReport(args) {
  const canvas = await canvasFromArgs(args);
  const overlay = buildOverlay(args.shapes, canvas.width, canvas.height, args.title);
  const output = optionalPath(args.output, 'la ruta del informe', 'report path', ['.md']);
  const svgPath = optionalPath(args.svg_path, 'la ruta del SVG', 'SVG path', ['.svg']);
  const htmlPath = optionalPath(args.html_path, 'la ruta del HTML', 'HTML path', ['.html', '.htm']);
  const markdown = buildReport({
    image: canvas.image, width: canvas.width, height: canvas.height,
    annotations: overlay.annotations, svgPath, htmlPath, notes: args.notes,
    warnings: overlay.warnings, title: overlay.title
  });
  const dryRun = args.dry_run !== false;
  let written = false;
  if (output && !dryRun) {
    await writeNew(output, markdown, 'utf8');
    written = true;
  }
  return {
    ok: true, image: canvas.image, width: canvas.width, height: canvas.height,
    shapeCount: overlay.annotations.length, markdown, warnings: overlay.warnings,
    output, written, dry_run: dryRun,
    message: both('Informe bilingüe de la captura listo.', 'Bilingual screenshot report ready.')
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    const args = message.args || {};
    if (message.tool === 'annotation_svg') return await annotationSvg(args);
    if (message.tool === 'annotation_page') return await annotationPage(args);
    if (message.tool === 'annotation_report') return await annotationReport(args);
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: error && error.message ? error.message : String(error)}]
  }));
  return true;
});
