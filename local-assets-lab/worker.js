'use strict';

// Local Assets Lab - generación SVG 100% offline, sin dependencias externas.

const PRESET_PALETTES = Object.freeze({
  sunset: ['#FF6B6B', '#FFA94D', '#FFD43B', '#845EF7', '#3BC9DB'],
  ocean: ['#0B132B', '#1C2541', '#3A506B', '#5BC0BE', '#6FFFE9'],
  mint: ['#0B3D2E', '#1B7F5A', '#57CC99', '#C7F9CC', '#F0FFF4'],
  retro: ['#2B2D42', '#8D99AE', '#EDF2F4', '#EF233C', '#D90429'],
  candy: ['#FF477E', '#FF70A6', '#FF9E00', '#FFD166', '#8AC4FF'],
  noir: ['#0B0B0F', '#1F1F2E', '#4A4A6A', '#9D9DB2', '#F5F5F7'],
  forest: ['#1B4332', '#2D6A4F', '#40916C', '#74C69D', '#B7E4C7'],
  flow: ['#4361EE', '#3A0CA3', '#7209B7', '#F72585', '#4CC9F0']
});

const HARMONY_OFFSETS = Object.freeze({
  analogous: [-30, -15, 0, 15, 30, 45],
  complementary: [0, 180, 20, 200, -20, 160],
  triadic: [0, 120, 240, 20, 140, 260],
  tetradic: [0, 90, 180, 270, 30, 210],
  monochrome: [0, 0, 0, 0, 0, 0],
  split: [0, 150, 210, 20, 170, 230]
});

function clamp(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : min;
}

function normalizeHex(input, fallback = '#4361EE') {
  if (typeof input !== 'string') return fallback;
  let value = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(value)) value = value.split('').map(char => char + char).join('');
  return /^[0-9a-f]{6}$/i.test(value) ? `#${value.toLowerCase()}` : fallback;
}

function hexToRgb(hex) {
  const value = normalizeHex(hex).slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function rgbToHex(rgb) {
  return `#${[rgb.r, rgb.g, rgb.b]
    .map(value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function rgbToHsl(rgb) {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;
  return {h, s: s * 100, l: l * 100};
}

function hslToRgb(h, s, l) {
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const second = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = l - chroma / 2;
  let rgb;
  if (h < 60) rgb = [chroma, second, 0];
  else if (h < 120) rgb = [second, chroma, 0];
  else if (h < 180) rgb = [0, chroma, second];
  else if (h < 240) rgb = [0, second, chroma];
  else if (h < 300) rgb = [second, 0, chroma];
  else rgb = [chroma, 0, second];
  return {
    r: Math.round((rgb[0] + match) * 255),
    g: Math.round((rgb[1] + match) * 255),
    b: Math.round((rgb[2] + match) * 255)
  };
}

function mixColors(first, second, amount) {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  const t = clamp(amount, 0, 1);
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  });
}

function lighten(hex, amount) {
  return mixColors(hex, '#ffffff', amount);
}

function darken(hex, amount) {
  return mixColors(hex, '#000000', amount);
}

function contrastText(hex) {
  const rgb = hexToRgb(hex);
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.58 ? '#0f172a' : '#f8fafc';
}

function makeRandom(seed) {
  let state = (Number(seed) || 1) >>> 0;
  return function random() {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function escapeXml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function svgWrap(inner, width, height, defs = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}" role="img" aria-label="Local Assets Lab asset">` +
    `${defs}${inner}</svg>\n`;
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function dataUris(svg) {
  return {
    dataUri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    dataUriBase64: `data:image/svg+xml;base64,${toBase64(svg)}`
  };
}

async function emit(args, svg, meta) {
  const result = {...meta, svg, ...dataUris(svg)};
  if (typeof args.output === 'string' && args.output.trim()) {
    let path = args.output.trim();
    if (!/\.svg$/i.test(path)) path += '.svg';
    await chrome.antigem.writeFile({path, data: svg, encoding: 'utf8'});
    result.path = path;
  }
  return result;
}

function buildHarmony(base, harmony, count) {
  const offsets = HARMONY_OFFSETS[harmony] || HARMONY_OFFSETS.analogous;
  const source = rgbToHsl(hexToRgb(base));
  const colors = [];
  for (let index = 0; index < count; index++) {
    const offset = offsets[index % offsets.length] + Math.floor(index / offsets.length) * 8;
    const hue = ((source.h + offset) % 360 + 360) % 360;
    const saturation = harmony === 'monochrome' ? source.s : clamp(source.s + (index % 2 ? 6 : -4), 18, 96);
    const lightness = harmony === 'monochrome'
      ? 18 + index * (68 / Math.max(1, count - 1))
      : clamp(source.l + ((index % 3) - 1) * 8, 18, 88);
    colors.push(rgbToHex(hslToRgb(hue, saturation, lightness)));
  }
  return colors;
}

function formatColors(colors, format) {
  if (format === 'rgb') {
    return colors.map(hex => {
      const rgb = hexToRgb(hex);
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    });
  }
  if (format === 'hsl') {
    return colors.map(hex => {
      const hsl = rgbToHsl(hexToRgb(hex));
      return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;
    });
  }
  return colors;
}

function paletteSvg(colors, labels) {
  const showLabels = labels !== false;
  const width = Math.max(640, colors.length * 170);
  const height = showLabels ? 260 : 180;
  const slot = (width - 48) / colors.length;
  let inner = `<rect width="${width}" height="${height}" rx="28" fill="#0f172a"/>`;
  colors.forEach((color, index) => {
    const x = 24 + index * slot;
    const swatch = slot - 12;
    inner += `<rect x="${x.toFixed(1)}" y="24" width="${swatch.toFixed(1)}" ` +
      `height="${showLabels ? 140 : height - 48}" rx="18" fill="${color}"/>`;
    if (showLabels) {
      inner += `<text x="${(x + swatch / 2).toFixed(1)}" y="204" fill="#e2e8f0" ` +
        `font-family="monospace" font-size="24" text-anchor="middle">${escapeXml(color.toUpperCase())}</text>`;
    }
  });
  return svgWrap(inner, width, height);
}

function resolveColors(args, fallback) {
  if (Array.isArray(args.colors) && args.colors.length) {
    return args.colors.slice(0, 6).map(color => normalizeHex(color));
  }
  if (typeof args.palette === 'string' && PRESET_PALETTES[args.palette.toLowerCase()]) {
    return [...PRESET_PALETTES[args.palette.toLowerCase()]];
  }
  if (typeof args.base === 'string') {
    return buildHarmony(normalizeHex(args.base), args.harmony || 'analogous', 5);
  }
  return fallback;
}

function backgroundSvg(options) {
  const {style, width, height, colors, seed, spacing, angle, opacity} = options;
  const random = makeRandom(seed);
  const base = colors[0] || '#0B132B';
  const primary = colors[1] || '#4361EE';
  const secondary = colors[2] || '#F72585';
  const accent = colors[3] || '#4CC9F0';
  let defs = '';
  let inner = '';
  const step = clamp(spacing, 16, 400);

  if (style === 'gradient') {
    const radians = angle * Math.PI / 180;
    const x1 = (50 - Math.cos(radians) * 50).toFixed(1);
    const y1 = (50 - Math.sin(radians) * 50).toFixed(1);
    const x2 = (50 + Math.cos(radians) * 50).toFixed(1);
    const y2 = (50 + Math.sin(radians) * 50).toFixed(1);
    defs = `<linearGradient id="bg" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">` +
      `<stop offset="0%" stop-color="${base}"/>` +
      `<stop offset="55%" stop-color="${primary}"/>` +
      `<stop offset="100%" stop-color="${secondary}"/></linearGradient>`;
    inner = `<rect width="${width}" height="${height}" fill="url(#bg)"/>`;
  } else if (style === 'grid') {
    inner = `<rect width="${width}" height="${height}" fill="${base}"/>`;
    for (let x = 0; x <= width; x += step) {
      inner += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${primary}" ` +
        `stroke-width="1.5" opacity="${opacity}"/>`;
    }
    for (let y = 0; y <= height; y += step) {
      inner += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${primary}" ` +
        `stroke-width="1.5" opacity="${opacity}"/>`;
    }
    for (let x = step; x < width; x += step * 4) {
      for (let y = step; y < height; y += step * 4) {
        inner += `<circle cx="${x}" cy="${y}" r="${Math.max(3, step * 0.09).toFixed(1)}" ` +
          `fill="${accent}" opacity="${Math.min(1, opacity + 0.3)}"/>`;
      }
    }
  } else if (style === 'halftone') {
    inner = `<rect width="${width}" height="${height}" fill="${base}"/>`;
    for (let y = step / 2; y < height; y += step) {
      for (let x = step / 2; x < width; x += step) {
        const wave = 0.5 + 0.5 * Math.sin((x / width) * Math.PI * 3) * Math.cos((y / height) * Math.PI * 2);
        const radius = step * 0.44 * (0.25 + 0.75 * wave);
        inner += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" ` +
          `fill="${primary}" opacity="${opacity}"/>`;
      }
    }
  } else if (style === 'waves') {
    inner = `<rect width="${width}" height="${height}" fill="${base}"/>`;
    for (let layer = 0; layer < 6; layer++) {
      const y = height * (0.22 + layer * 0.12);
      const amplitude = height * 0.055 * (1 + layer * 0.12);
      let path = `M 0 ${y.toFixed(1)}`;
      for (let x = 0; x <= width; x += Math.max(24, step / 2)) {
        const offset = Math.sin((x / width) * Math.PI * 4 + layer * 0.8) * amplitude;
        path += ` L ${x} ${(y + offset).toFixed(1)}`;
      }
      path += ` L ${width} ${height} L 0 ${height} Z`;
      const color = colors[layer % colors.length] || accent;
      inner += `<path d="${path}" fill="${color}" opacity="${(0.14 + layer * 0.06).toFixed(2)}"/>`;
    }
  } else if (style === 'blobs') {
    inner = `<rect width="${width}" height="${height}" fill="${base}"/>`;
    for (let index = 0; index < 10; index++) {
      const cx = random() * width;
      const cy = random() * height;
      const rx = width * (0.08 + random() * 0.22);
      const ry = height * (0.08 + random() * 0.28);
      const color = colors[(index % Math.max(1, colors.length - 1)) + 1] || accent;
      inner += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ` +
        `ry="${ry.toFixed(1)}" fill="${color}" opacity="${(opacity * (0.45 + random() * 0.5)).toFixed(2)}"/>`;
    }
  } else if (style === 'stripes') {
    defs = `<pattern id="stripes" width="${step * 2}" height="${step * 2}" ` +
      `patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})">` +
      `<rect width="${step * 2}" height="${step * 2}" fill="${base}"/>` +
      `<rect width="${step}" height="${step * 2}" fill="${primary}" opacity="${opacity}"/>` +
      `<rect y="${step}" width="${step}" height="${step * 2}" fill="${secondary}" opacity="${opacity * 0.5}"/>` +
      `</pattern>`;
    inner = `<rect width="${width}" height="${height}" fill="url(#stripes)"/>`;
  } else {
    inner = `<rect width="${width}" height="${height}" fill="${base}"/>`;
    const grains = Math.min(900, Math.floor((width * height) / 2600));
    for (let index = 0; index < grains; index++) {
      const x = random() * width;
      const y = random() * height;
      const radius = 0.6 + random() * 2.2;
      const color = index % 3 === 0 ? accent : (index % 3 === 1 ? primary : secondary);
      inner += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" ` +
        `fill="${color}" opacity="${(opacity * 0.5).toFixed(2)}"/>`;
    }
  }
  return svgWrap(inner, width, height, defs);
}

async function assetPalette(args) {
  let colors;
  if (typeof args.name === 'string' && PRESET_PALETTES[args.name.toLowerCase()]) {
    colors = [...PRESET_PALETTES[args.name.toLowerCase()]];
  } else if (typeof args.base === 'string' && args.base.trim()) {
    colors = buildHarmony(normalizeHex(args.base), args.harmony || 'analogous', clamp(args.count || 5, 2, 12));
  } else {
    colors = [...PRESET_PALETTES.flow];
  }
  const format = ['hex', 'rgb', 'hsl'].includes(args.format) ? args.format : 'hex';
  const svg = paletteSvg(colors, args.labels);
  return await emit(args, svg, {
    palette: colors,
    formatted: formatColors(colors, format),
    cssVars: colors.map((color, index) => `  --color-${index + 1}: ${color};`).join('\n'),
    format,
    width: Math.max(640, colors.length * 170),
    height: args.labels === false ? 180 : 260
  });
}

async function assetBackground(args) {
  const styles = ['gradient', 'grid', 'halftone', 'waves', 'blobs', 'stripes', 'paper'];
  const style = styles.includes(args.style) ? args.style : 'gradient';
  const width = Math.round(clamp(args.width == null ? 1920 : args.width, 64, 4096));
  const height = Math.round(clamp(args.height == null ? 1080 : args.height, 64, 4096));
  const colors = resolveColors(args, [...PRESET_PALETTES.ocean]);
  const svg = backgroundSvg({
    style, width, height, colors,
    seed: args.seed == null ? 7 : args.seed,
    spacing: args.spacing == null ? 64 : args.spacing,
    angle: args.angle == null ? 135 : args.angle,
    opacity: clamp(args.opacity == null ? 0.45 : args.opacity, 0.05, 1)
  });
  return await emit(args, svg, {style, width, height, colors, seed: args.seed == null ? 7 : args.seed});
}

const ICON_SHAPES = Object.freeze({
  star: 'M50 8 L61 37 L92 39 L68 59 L76 90 L50 73 L24 90 L32 59 L8 39 L39 37 Z',
  heart: 'M50 88 C20 68 8 50 8 34 C8 20 19 12 31 12 C39 12 46 17 50 24 C54 17 61 12 69 12 C81 12 92 20 92 34 C92 50 80 68 50 88 Z',
  bolt: 'M56 6 L20 56 H44 L38 94 L80 40 H54 Z',
  check: 'M18 52 L40 74 L84 26',
  arrow: 'M20 50 H78 M78 50 L54 26 M78 50 L54 74',
  spark: 'M50 6 L58 38 L90 50 L58 62 L50 94 L42 62 L10 50 L42 38 Z',
  shield: 'M50 8 L86 22 V48 C86 70 70 86 50 92 C30 86 14 70 14 48 V22 Z',
  play: 'M30 18 L84 50 L30 82 Z',
  chat: 'M14 20 H86 V68 H44 L24 86 V68 H14 Z',
  home: 'M10 48 L50 12 L90 48 H76 V88 H24 V48 Z',
  plus: 'M50 16 V84 M16 50 H84'
});
const STROKE_ICONS = new Set(['check', 'arrow', 'plus']);

function iconSvg(options) {
  const {shape, color, accent, background, bgColor, size, stroke, filled, rotation} = options;
  let inner = '';
  if (background === 'rounded') {
    inner += `<rect x="2" y="2" width="96" height="96" rx="22" fill="${bgColor}"/>`;
  } else if (background === 'circle') {
    inner += `<circle cx="50" cy="50" r="48" fill="${bgColor}"/>`;
  }
  if (background !== 'none') {
    inner += `<circle cx="82" cy="18" r="7" fill="${accent}"/>`;
  }
  const path = ICON_SHAPES[shape] || ICON_SHAPES.star;
  let glyph;
  if (STROKE_ICONS.has(shape)) {
    glyph = `<path d="${path}" fill="none" stroke="${color}" stroke-width="${stroke}" ` +
      `stroke-linecap="round" stroke-linejoin="round"/>`;
  } else {
    glyph = `<path d="${path}" fill="${filled ? color : 'none'}" stroke="${filled ? darken(color, 0.22) : color}" ` +
      `stroke-width="${filled ? 3 : stroke}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  inner += `<g transform="rotate(${rotation} 50 50)">${glyph}</g>`;
  return svgWrap(inner, size, size);
}

async function assetIcon(args) {
  const shape = Object.prototype.hasOwnProperty.call(ICON_SHAPES, args.shape) ? args.shape : 'star';
  const color = normalizeHex(args.color, '#4361EE');
  const accent = normalizeHex(args.accent, '#F72585');
  const background = ['rounded', 'circle', 'none'].includes(args.background) ? args.background : 'rounded';
  const size = Math.round(clamp(args.size == null ? 256 : args.size, 64, 1024));
  const svg = iconSvg({
    shape, color, accent, background,
    bgColor: normalizeHex(args.bgColor, '#F8FAFC'),
    size,
    stroke: clamp(args.stroke == null ? 8 : args.stroke, 2, 20),
    filled: args.filled !== false,
    rotation: args.rotation == null ? 0 : args.rotation
  });
  return await emit(args, svg, {shape, color, accent, background, size});
}

const STICKER_SHAPES = ['burst', 'bubble', 'rounded', 'blob', 'star', 'hexagon'];

function polygonPoints(cx, cy, radius, count, innerRatio, startAngle = -Math.PI / 2) {
  const points = [];
  for (let index = 0; index < count; index++) {
    const angle = startAngle + (index / count) * Math.PI * 2;
    const current = index % 2 === 0 ? radius : radius * innerRatio;
    points.push(`${(cx + Math.cos(angle) * current).toFixed(1)},${(cy + Math.sin(angle) * current).toFixed(1)}`);
  }
  return points.join(' ');
}

function stickerParts(shape, cx, cy, radius) {
  if (shape === 'burst') {
    return [{kind: 'polygon', points: polygonPoints(cx, cy, radius, 32, 0.84)}];
  }
  if (shape === 'star') {
    return [{kind: 'polygon', points: polygonPoints(cx, cy, radius, 10, 0.46)}];
  }
  if (shape === 'hexagon') {
    return [{kind: 'polygon', points: polygonPoints(cx, cy, radius, 6, 1, -Math.PI / 2)}];
  }
  if (shape === 'rounded') {
    return [{kind: 'rect', x: cx - radius, y: cy - radius * 0.66,
      width: radius * 2, height: radius * 1.32, rx: radius * 0.26}];
  }
  if (shape === 'bubble') {
    return [
      {kind: 'rect', x: cx - radius, y: cy - radius * 0.68,
        width: radius * 2, height: radius * 1.32, rx: radius * 0.26},
      {kind: 'polygon', points: `${(cx - radius * 0.34).toFixed(1)},${(cy + radius * 0.52).toFixed(1)} ` +
        `${(cx - radius * 0.2).toFixed(1)},${(cy + radius).toFixed(1)} ` +
        `${(cx + radius * 0.16).toFixed(1)},${(cy + radius * 0.56).toFixed(1)}`}
    ];
  }
  const top = cy - radius;
  return [{
    kind: 'path',
    d: `M ${cx - radius} ${cy} C ${cx - radius} ${top - radius * 0.15}, ` +
      `${cx - radius * 0.35} ${top - radius * 0.05}, ${cx + radius * 0.1} ${top + radius * 0.1} ` +
      `C ${cx + radius * 0.75} ${top + radius * 0.2}, ${cx + radius} ${cy - radius * 0.35}, ` +
      `${cx + radius} ${cy + radius * 0.05} ` +
      `C ${cx + radius * 0.95} ${cy + radius * 0.65}, ${cx + radius * 0.4} ${cy + radius}, ` +
      `${cx - radius * 0.1} ${cy + radius * 0.9} ` +
      `C ${cx - radius * 0.75} ${cy + radius * 0.85}, ${cx - radius} ${cy + radius * 0.4}, ${cx - radius} ${cy} Z`
  }];
}

function renderStickerParts(parts, fill, stroke, strokeWidth, offsetX = 0, offsetY = 0, opacity = null) {
  return parts.map(part => {
    const common = `fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ` +
      `stroke-linejoin="round" stroke-linecap="round"` +
      (opacity == null ? '' : ` opacity="${opacity}"`);
    if (part.kind === 'polygon') {
      const points = part.points.split(' ').map(pair => {
        const [x, y] = pair.split(',').map(Number);
        return `${(x + offsetX).toFixed(1)},${(y + offsetY).toFixed(1)}`;
      }).join(' ');
      return `<polygon points="${points}" ${common}/>`;
    }
    if (part.kind === 'rect') {
      return `<rect x="${(part.x + offsetX).toFixed(1)}" y="${(part.y + offsetY).toFixed(1)}" ` +
        `width="${part.width.toFixed(1)}" height="${part.height.toFixed(1)}" rx="${part.rx.toFixed(1)}" ${common}/>`;
    }
    return `<path d="${part.d}" transform="translate(${offsetX} ${offsetY})" ${common}/>`;
  }).join('');
}

function stickerBackground(kind, width, height, seed) {
  const random = makeRandom(seed);
  if (kind === 'mat') {
    let inner = `<rect width="${width}" height="${height}" fill="#123C3A"/>`;
    const step = 48;
    for (let x = 0; x <= width; x += step) {
      inner += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="#2A6B64" stroke-width="1.5" opacity="0.65"/>`;
    }
    for (let y = 0; y <= height; y += step) {
      inner += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#2A6B64" stroke-width="1.5" opacity="0.65"/>`;
    }
    return inner;
  }
  if (kind === 'paper') {
    let inner = `<rect width="${width}" height="${height}" fill="#F1E9D8"/>`;
    for (let index = 0; index < 34; index++) {
      const x = random() * width;
      const y = random() * height;
      const length = 40 + random() * 160;
      inner += `<path d="M ${x.toFixed(1)} ${y.toFixed(1)} q ${(length / 2).toFixed(1)} ` +
        `${(random() * 16 - 8).toFixed(1)} ${length.toFixed(1)} ${(random() * 10 - 5).toFixed(1)}" ` +
        `fill="none" stroke="#D8CDB6" stroke-width="1.6" opacity="0.55"/>`;
    }
    return inner;
  }
  return '';
}

function stickerSvg(options) {
  const {shape, text, subtext, color, outline, outlineWidth, shadow, rotation,
    width, height, fontSize, background, seed, textColor} = options;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.34;
  const parts = stickerParts(shape, cx, cy, radius);
  let inner = stickerBackground(background, width, height, seed);
  inner += `<g transform="rotate(${rotation} ${cx} ${cy})">`;
  if (shadow) {
    inner += renderStickerParts(parts, '#0f172a', '#0f172a', 0, 9, 13, 0.16);
    inner += renderStickerParts(parts, '#0f172a', '#0f172a', 0, 4, 7, 0.24);
  }
  inner += renderStickerParts(parts, outline, outline, outlineWidth * 2);
  inner += renderStickerParts(parts, color, darken(color, 0.24), 3);
  const label = escapeXml(text);
  inner += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" ` +
    `font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${fontSize}" ` +
    `fill="${textColor}" stroke="${textColor}" stroke-width="1">${label}</text>`;
  if (subtext) {
    inner += `<text x="${cx}" y="${(cy + fontSize * 0.72).toFixed(1)}" text-anchor="middle" ` +
      `font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${Math.round(fontSize * 0.34)}" ` +
      `fill="${textColor}" opacity="0.85">${escapeXml(subtext)}</text>`;
  }
  inner += `<path d="M ${(cx - radius * 0.6).toFixed(1)} ${(cy - radius * 0.4).toFixed(1)} ` +
    `Q ${cx} ${(cy - radius * 0.72).toFixed(1)} ${(cx + radius * 0.55).toFixed(1)} ` +
    `${(cy - radius * 0.38).toFixed(1)}" fill="none" stroke="#ffffff" stroke-width="${Math.max(4, radius * 0.07).toFixed(1)}" ` +
    `stroke-linecap="round" opacity="0.28"/>`;
  inner += '</g>';
  return svgWrap(inner, width, height);
}

async function assetSticker(args) {
  const shape = STICKER_SHAPES.includes(args.shape) ? args.shape : 'burst';
  const width = Math.round(clamp(args.width == null ? 640 : args.width, 128, 2048));
  const height = Math.round(clamp(args.height == null ? 480 : args.height, 128, 2048));
  const color = normalizeHex(args.color, '#F72585');
  let text = typeof args.text === 'string' && args.text.trim() ? args.text.trim() : 'WOW';
  if (text.length > 32) text = `${text.slice(0, 31)}…`;
  const background = ['none', 'paper', 'mat'].includes(args.background) ? args.background : 'paper';
  const fontSize = Math.round(clamp(args.fontSize == null ? Math.min(width, height) * 0.2 : args.fontSize, 16, 320));
  const svg = stickerSvg({
    shape, text,
    subtext: typeof args.subtext === 'string' ? args.subtext.slice(0, 48) : '',
    color,
    outline: normalizeHex(args.outline, '#FFFFFF'),
    outlineWidth: clamp(args.outlineWidth == null ? 8 : args.outlineWidth, 2, 30),
    shadow: args.shadow !== false,
    rotation: args.rotation == null ? -6 : args.rotation,
    width, height, fontSize, background,
    seed: args.seed == null ? 7 : args.seed,
    textColor: normalizeHex(args.textColor, contrastText(color))
  });
  return await emit(args, svg, {shape, text, color, background, width, height});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    const args = message.args || {};
    if (message.tool === 'asset_palette') return await assetPalette(args);
    if (message.tool === 'asset_background') return await assetBackground(args);
    if (message.tool === 'asset_icon') return await assetIcon(args);
    if (message.tool === 'asset_sticker') return await assetSticker(args);
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: error && error.message ? error.message : String(error)}]
  }));
  return true;
});
