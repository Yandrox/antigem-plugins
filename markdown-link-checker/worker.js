'use strict';

// markdown-link-checker — comprobador offline de enlaces Markdown locales.
// Sin red: solo chrome.antigem (antigemFiles) y JS puro.
// Comprueba rutas relativas, imágenes, anclas GitHub-style y mayúsculas.

const MAX_FILES = 200;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_FINDINGS = 200;
const DEFAULT_IGNORE = ['/.git/', '/node_modules/', '/dist/'];

function asText(value) {
  return value == null ? '' : String(value);
}

function both(es, en) {
  return `${es} / ${en}`;
}

function fail(es, en) {
  throw new Error(both(es, en));
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(Math.min(max, Math.max(min, number)));
}

function normalizePath(value, labelEs, labelEn, extension) {
  const raw = asText(value).trim();
  if (!raw) fail(`Falta ${labelEs}`, `${labelEn} is required`);
  if (raw.includes('..')) {
    fail(`${labelEs} no puede contener ..`, `${labelEn} cannot contain ..`);
  }
  if (!/^(~\/|\/sdcard\/|\/data\/)/.test(raw)) {
    fail(`${labelEs} debe empezar por ~/, /sdcard/ o /data/`,
      `${labelEn} must start with ~/, /sdcard/ or /data/`);
  }
  if (extension && !raw.toLowerCase().endsWith(extension)) {
    fail(`${labelEs} debe terminar en ${extension}`, `${labelEn} must end in ${extension}`);
  }
  return raw;
}

function dirname(path) {
  const value = asText(path);
  const index = value.lastIndexOf('/');
  return index <= 0 ? (value.startsWith('/') ? '/' : '~') : value.slice(0, index);
}

function normalizeJoin(base, relative) {
  const text = asText(base);
  const isRoot = text.startsWith('/');
  const isHome = text.startsWith('~/');
  const cleanBase = isHome ? text.slice(2) : (isRoot ? text.slice(1) : text);
  const parts = `${cleanBase}/${relative}`.split('/');
  const out = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (out.length) out.pop();
      continue;
    }
    out.push(part);
  }
  const result = out.join('/');
  if (isRoot) return `/${result}`;
  if (isHome) return `~/${result}`;
  return result || '.';
}

function decodeSafe(value) {
  try {
    return decodeURIComponent(asText(value));
  } catch (_) {
    return asText(value);
  }
}

function foldAnchor(value) {
  return decodeSafe(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isExternal(target) {
  return /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|\/\/)/.test(asText(target).trim());
}

function cleanInline(text) {
  return asText(text)
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/[*_~]/g, '');
}

function slugify(text) {
  return cleanInline(text).normalize('NFKC').toLowerCase().trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-');
}

// Devuelve solo las líneas que son contenido Markdown (sin frontmatter,
// comentarios HTML ni bloques de código).
function contentLines(lines) {
  const output = [];
  let fence = null;
  let inComment = false;
  let frontmatter = lines.length && lines[0].trim() === '---';
  for (let index = 0; index < lines.length; index++) {
    let line = lines[index];
    if (frontmatter) {
      if (index > 0 && line.trim() === '---') frontmatter = false;
      continue;
    }
    if (inComment) {
      const end = line.indexOf('-->');
      if (end < 0) continue;
      inComment = false;
      line = line.slice(end + 3);
    }
    const commentStart = line.indexOf('<!--');
    if (commentStart >= 0) {
      const end = line.indexOf('-->', commentStart + 4);
      if (end < 0) {
        inComment = true;
        line = line.slice(0, commentStart);
      } else {
        line = line.slice(0, commentStart) + line.slice(end + 3);
      }
    }
    const trimmed = line.trim();
    if (fence) {
      const closing = new RegExp(`^\\s{0,3}${fence.charAt(0)}{${fence.length},}\\s*$`);
      if (closing.test(line)) fence = null;
      continue;
    }
    const opener = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (opener) {
      fence = opener[1];
      continue;
    }
    output.push({number: index + 1, text: line, trimmed});
  }
  return output;
}

function parseAnchors(text) {
  const lines = asText(text).split(/\r?\n/);
  const anchors = [];
  const counts = new Map();
  for (const item of contentLines(lines)) {
    const heading = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(item.text);
    if (heading) {
      const raw = heading[2];
      let slug = slugify(raw);
      const seen = counts.get(slug) || 0;
      counts.set(slug, seen + 1);
      if (seen) slug = `${slug}-${seen}`;
      anchors.push({slug, text: cleanInline(raw), line: item.number});
    }
    const htmlRe = /<a\b[^>]*?(?:id|name)\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = htmlRe.exec(item.text)) !== null) {
      anchors.push({slug: decodeSafe(match[1]), text: match[1], line: item.number});
    }
  }
  return anchors;
}

function collectLinks(text) {
  const lines = asText(text).split(/\r?\n/);
  const content = contentLines(lines);
  const definitions = new Map();
  for (const item of content) {
    const match = /^\s{0,3}\[([^\]]+)\]:\s*(\S+)/.exec(item.text);
    if (match) definitions.set(match[1].trim().toLowerCase(), match[2]);
  }

  const links = [];
  for (const item of content) {
    const definition = /^\s{0,3}\[([^\]]+)\]:\s*(\S+)/.exec(item.text);
    if (definition) {
      links.push({target: definition[2], line: item.number, text: definition[1], image: false, definition: true});
      continue;
    }
    const maskedCode = item.text.replace(/`[^`\n]*`/g, match => ' '.repeat(match.length));
    const inlineRe = /!?\[([^\]]*)\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
    const ranges = [];
    let match;
    while ((match = inlineRe.exec(maskedCode)) !== null) {
      let target = match[2].trim();
      if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
      ranges.push({start: match.index, end: match.index + match[0].length});
      links.push({target, line: item.number, text: cleanInline(match[1]), image: match[0].startsWith('!')});
    }
    let masked = maskedCode;
    for (let index = ranges.length - 1; index >= 0; index--) {
      const range = ranges[index];
      masked = masked.slice(0, range.start) + ' '.repeat(range.end - range.start) + masked.slice(range.end);
    }
    const refRe = /!?\[([^\]]*)\]\[([^\]]*)\]/g;
    while ((match = refRe.exec(masked)) !== null) {
      const key = (match[2] || match[1]).trim().toLowerCase();
      if (definitions.has(key)) {
        links.push({target: definitions.get(key), line: item.number, text: cleanInline(match[1]), image: match[0].startsWith('!')});
      }
    }
    const shortcutRe = /(!?)\[([^\]]+)\]/g;
    while ((match = shortcutRe.exec(masked)) !== null) {
      const key = match[2].trim().toLowerCase();
      if (definitions.has(key)) {
        links.push({target: definitions.get(key), line: item.number, text: cleanInline(match[2]), image: Boolean(match[1])});
      }
    }
  }
  return links;
}

function resolveTarget(sourceFile, target, root) {
  const decoded = decodeSafe(target).trim();
  const hashIndex = decoded.indexOf('#');
  const pathPart = hashIndex < 0 ? decoded : decoded.slice(0, hashIndex);
  const anchor = hashIndex < 0 ? '' : decoded.slice(hashIndex + 1);
  if (!pathPart) return {path: sourceFile, anchor, external: false, sameFile: true};
  if (isExternal(pathPart)) return {path: null, anchor, external: true, sameFile: false};
  if (pathPart.startsWith('/')) return {path: normalizeJoin(root, pathPart.slice(1)), anchor, external: false, sameFile: false};
  return {path: normalizeJoin(dirname(sourceFile), pathPart), anchor, external: false, sameFile: false};
}

function isIgnored(path, ignore) {
  const patterns = Array.isArray(ignore) ? ignore.map(asText).filter(Boolean) : DEFAULT_IGNORE;
  return patterns.some(pattern => path.toLowerCase().includes(pattern.toLowerCase()));
}

async function analyze(args) {
  const root = args.directory ? normalizePath(args.directory, 'la carpeta', 'directory') : null;
  const explicit = Array.isArray(args.files) ? args.files.map(asText).filter(Boolean) : [];
  if (!root && !explicit.length) {
    fail('Indica una carpeta o una lista de archivos .md', 'Provide a directory or a list of .md files');
  }
  const candidates = [];
  if (root) {
    const entries = await chrome.antigem.listFiles({
      path: root,
      recursive: args.recursive !== false,
      limit: 2000
    });
    for (const entry of entries) {
      if (entry.isFile && /\.md$/i.test(entry.path) && !isIgnored(entry.path, args.ignore)) {
        candidates.push(entry.path);
      }
    }
  }
  for (const file of explicit) {
    const safe = normalizePath(file, 'la ruta del archivo', 'file path');
    if (!/\.md$/i.test(safe)) {
      fail(`El archivo debe ser .md: ${safe}`, `File must be .md: ${safe}`);
    }
    candidates.push(safe);
  }
  const unique = [];
  const seen = new Set();
  for (const path of candidates) {
    if (seen.has(path)) continue;
    seen.add(path);
    unique.push(path);
  }
  const limit = clampInt(args.limit, 1, MAX_FILES, MAX_FILES);
  const files = unique.slice(0, limit);
  if (!files.length) fail('No hay archivos Markdown que revisar', 'No Markdown files to check');

  const statCache = new Map();
  async function statCached(path) {
    if (statCache.has(path)) return statCache.get(path);
    let result = null;
    try {
      result = await chrome.antigem.stat({path});
    } catch (_) {
      result = null;
    }
    statCache.set(path, result);
    return result;
  }

  const warnings = [];
  const docs = [];
  for (const path of files) {
    const stat = await statCached(path);
    if (!stat || !stat.isFile) {
      warnings.push(`No es un archivo: ${path}`);
      continue;
    }
    if (Number(stat.size || 0) > MAX_FILE_BYTES) {
      warnings.push(`Archivo omitido por tamaño: ${path}`);
      continue;
    }
    try {
      const text = await chrome.antigem.readFile({path, encoding: 'utf8'});
      docs.push({path, links: collectLinks(text)});
    } catch (error) {
      warnings.push(`No se pudo leer ${path}: ${error.message}`);
    }
  }
  if (!docs.length) fail('No se pudieron leer archivos Markdown', 'Could not read any Markdown file');

  const baseRoot = root || dirname(docs[0].path);
  const findings = [];
  const anchorCache = new Map();
  async function anchorsFor(path) {
    if (anchorCache.has(path)) return anchorCache.get(path);
    let slugs = [];
    const stat = await statCached(path);
    if (stat && stat.isFile && Number(stat.size || 0) <= MAX_FILE_BYTES) {
      try {
        slugs = parseAnchors(await chrome.antigem.readFile({path, encoding: 'utf8'})).map(item => item.slug);
      } catch (_) {
        slugs = [];
      }
    }
    anchorCache.set(path, slugs);
    return slugs;
  }

  const caseMap = new Map();
  try {
    const allEntries = await chrome.antigem.listFiles({path: baseRoot, recursive: true, limit: 2000});
    for (const entry of allEntries) {
      const key = entry.path.toLowerCase();
      if (!caseMap.has(key)) caseMap.set(key, entry.path);
    }
  } catch (_) {
    // Sin índice de rutas: la detección de mayúsculas queda desactivada.
  }
  function caseVariant(path) {
    return caseMap.get(path.toLowerCase()) || null;
  }

  function add(severity, kind, file, line, target, es, en, suggestion) {
    if (findings.length >= MAX_FINDINGS) return;
    findings.push({severity, kind, file, line, target: target || null, detail: both(es, en), suggestion: suggestion || null});
  }

  let linkCount = 0;
  let externalCount = 0;
  let anchorCount = 0;
  for (const doc of docs) {
    for (const link of doc.links) {
      linkCount++;
      const resolved = resolveTarget(doc.path, link.target, baseRoot);
      if (resolved.external) {
        externalCount++;
        continue;
      }
      const path = resolved.path;
      const stat = await statCached(path);
      if (!stat) {
        const variant = await caseVariant(path);
        if (variant && args.case_sensitive !== false) {
          add('warning', 'case_mismatch', doc.path, link.line, link.target,
            `Mayúsculas incorrectas: ${path}`, `Wrong casing: ${path}`, variant);
        } else if (!variant) {
          add('error', 'broken_link', doc.path, link.line, link.target,
            `Destino inexistente: ${path}`, `Missing target: ${path}`);
        }
        continue;
      }
      if (!stat.isFile) {
        const index = normalizeJoin(path, 'README.md');
        if (!await statCached(index)) {
          add('info', 'directory_without_index', doc.path, link.line, link.target,
            `La carpeta no tiene README.md: ${path}`, `Directory has no README.md: ${path}`);
        }
        continue;
      }
      if (resolved.anchor) {
        anchorCount++;
        const slugs = await anchorsFor(path);
        const needle = foldAnchor(resolved.anchor);
        if (!slugs.some(slug => foldAnchor(slug) === needle)) {
          add('error', 'broken_anchor', doc.path, link.line, link.target,
            `Ancla no encontrada: #${resolved.anchor} en ${path}`,
            `Anchor not found: #${resolved.anchor} in ${path}`);
        }
      }
    }
  }

  return {
    root: baseRoot,
    files: docs.length,
    links: linkCount,
    external: externalCount,
    anchors: anchorCount,
    warnings,
    findings: findings.slice(0, MAX_FINDINGS),
    summary: {
      files: docs.length,
      links: linkCount,
      external: externalCount,
      anchors: anchorCount,
      error: findings.filter(item => item.severity === 'error').length,
      warning: findings.filter(item => item.severity === 'warning').length,
      info: findings.filter(item => item.severity === 'info').length,
      truncated: findings.length > MAX_FINDINGS
    }
  };
}

function tableRow(cells) {
  return `| ${cells.map(cell => asText(cell).replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`;
}

function renderReport(result, output) {
  const lines = ['# Markdown Link Checker', '', '## ES', '',
    `- Archivos: ${result.summary.files} | Enlaces: ${result.summary.links} | Externos ignorados: ${result.summary.external} | Anclas: ${result.summary.anchors}`,
    `- Errores: ${result.summary.error} | Avisos: ${result.summary.warning} | Notas: ${result.summary.info}`,
    ''];
  for (const warning of result.warnings) lines.push(`> Aviso: ${warning}`);
  if (result.warnings.length) lines.push('');
  lines.push(tableRow(['Gravedad', 'Tipo', 'Archivo', 'Línea', 'Destino', 'Detalle']),
    tableRow(['---', '---', '---', '---', '---', '---']));
  for (const item of result.findings) {
    lines.push(tableRow([item.severity, item.kind, item.file, item.line, item.target, item.detail]));
  }
  if (!result.findings.length) lines.push('', 'Sin enlaces rotos.');
  lines.push('', '> Los enlaces externos no se comprueban: este plugin nunca usa la red.', '');
  lines.push('## EN', '',
    `- Files: ${result.summary.files} | Links: ${result.summary.links} | External skipped: ${result.summary.external} | Anchors: ${result.summary.anchors}`,
    `- Errors: ${result.summary.error} | Warnings: ${result.summary.warning} | Info: ${result.summary.info}`, '');
  for (const warning of result.warnings) lines.push(`> Warning: ${warning}`);
  if (result.warnings.length) lines.push('');
  lines.push(tableRow(['Severity', 'Kind', 'File', 'Line', 'Target', 'Detail']),
    tableRow(['---', '---', '---', '---', '---', '---']));
  for (const item of result.findings) {
    lines.push(tableRow([item.severity, item.kind, item.file, item.line, item.target, item.detail]));
  }
  if (!result.findings.length) lines.push('', 'No broken links.');
  lines.push('', '> External links are not checked: this plugin never uses the network.', '');
  if (output) lines.push(`Report: \`${output}\``, '');
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

async function mdlinkCheck(args) {
  const result = await analyze(args);
  return {ok: true, ...result,
    message: both(`${result.summary.error} errores y ${result.summary.warning} avisos en ${result.summary.links} enlaces.`,
      `${result.summary.error} errors and ${result.summary.warning} warnings across ${result.summary.links} links.`)};
}

async function mdlinkAnchors(args) {
  const path = normalizePath(args.path, 'la ruta del Markdown', 'Markdown path', '.md');
  const stat = await chrome.antigem.stat({path});
  if (!stat.isFile) fail('La ruta debe ser un archivo', 'Path must be a file');
  if (Number(stat.size || 0) > MAX_FILE_BYTES) {
    fail('El archivo supera el límite de 2 MiB', 'File exceeds the 2 MiB limit');
  }
  const anchors = parseAnchors(await chrome.antigem.readFile({path, encoding: 'utf8'}));
  return {ok: true, path, count: anchors.length, anchors,
    message: both(`${anchors.length} anclas encontradas.`, `${anchors.length} anchors found.`)};
}

async function mdlinkReport(args) {
  const result = await analyze(args);
  const output = args.output == null ? '' : normalizePath(args.output, 'la ruta del informe', 'report path', '.md');
  const markdown = renderReport(result, output);
  const dryRun = args.dry_run !== false;
  let written = false;
  if (output && !dryRun) {
    try {
      await chrome.antigem.writeFile({path: output, data: markdown, encoding: 'utf8'});
      written = true;
    } catch (error) {
      fail(`No se pudo escribir el informe: ${error.message}`, `Could not write the report: ${error.message}`);
    }
  }
  return {ok: true, output: output || null, dry_run: dryRun, written,
    summary: result.summary, markdown,
    message: both('Informe de enlaces listo.', 'Link report ready.')};
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    const args = message.args || {};
    if (message.tool === 'mdlink_check') return await mdlinkCheck(args);
    if (message.tool === 'mdlink_anchors') return await mdlinkAnchors(args);
    if (message.tool === 'mdlink_report') return await mdlinkReport(args);
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: error && error.message ? error.message : String(error)}]
  }));
  return true;
});
