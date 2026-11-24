'use strict';

// Chart Craft - gráficos SVG offline para mini apps, sin CDNs ni dependencias.

const THEMES = {
  contrast: {bg: '#0B1020', text: '#F8FAFC', grid: '#334155', axis: '#94A3B8', muted: '#CBD5E1'},
  light: {bg: '#FFFFFF', text: '#0F172A', grid: '#E2E8F0', axis: '#475569', muted: '#64748B'},
  dark: {bg: '#111827', text: '#F9FAFB', grid: '#374151', axis: '#9CA3AF', muted: '#D1D5DB'}
};

const PALETTES = {
  contrast: ['#22D3EE', '#F472B6', '#FACC15', '#4ADE80', '#A78BFA', '#FB923C',
    '#60A5FA', '#F87171', '#2DD4BF', '#E879F9', '#A3E635', '#FBBF24'],
  categorical: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899',
    '#06B6D4', '#84CC16', '#F97316', '#6366F1', '#14B8A6', '#E11D48'],
  warm: ['#F97316', '#EF4444', '#F59E0B', '#FBBF24', '#FB7185', '#FDBA74',
    '#FCA5A5', '#FDE68A', '#EA580C', '#DC2626', '#D97706', '#B45309'],
  cool: ['#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6', '#06B6D4', '#14B8A6',
    '#2563EB', '#4F46E5', '#0891B2', '#0D9488', '#4338CA', '#7C3AED'],
  mono: ['#F8FAFC', '#CBD5E1', '#94A3B8', '#64748B', '#475569', '#334155',
    '#E2E8F0', '#BDC5D1', '#7C8A9E', '#4A5A70', '#29364A', '#131C2B'],
  accessible: ['#FFFFFF', '#FACC15', '#67E8F9', '#86EFAC', '#FCA5A5', '#C4B5FD',
    '#FDE68A', '#A5F3FC', '#BBF7D0', '#FECACA', '#DDD6FE', '#FEF08A']
};

const CHART_TYPES = ['bar', 'line', 'area', 'donut', 'scatter', 'sparkline'];
const SCHEMES = ['contrast', 'categorical', 'warm', 'cool', 'mono', 'accessible'];

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(Math.min(max, Math.max(min, number)));
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function localText(language, es, en) {
  if (language === 'es') return es;
  if (language === 'en') return en;
  return `${es} / ${en}`;
}

function escapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function hexToRgb(hex) {
  const raw = String(hex || '').replace(/^#/, '').trim();
  const full = raw.length === 3 ? raw.split('').map(char => char + char).join('') : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16)
  ];
}

function normalizeHex(value, fallback) {
  const rgb = hexToRgb(value);
  return rgb ? `#${rgb.map(channel => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}` : fallback;
}

function relativeLuminance(rgb) {
  const channels = rgb.map(channel => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  if (!a || !b) return 0;
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function formatNumber(value, format, unit) {
  let number = numberOr(value, 0);
  if (format === 'compact') {
    const absolute = Math.abs(number);
    if (absolute >= 1e9) number = `${(number / 1e9).toFixed(1)}B`;
    else if (absolute >= 1e6) number = `${(number / 1e6).toFixed(1)}M`;
    else if (absolute >= 1e3) number = `${(number / 1e3).toFixed(1)}k`;
    else number = String(Math.round(number));
  } else if (format === 'percent') {
    number = `${Math.round(number * 10) / 10}%`;
  } else if (format === 'currency') {
    number = `$${Math.round(number * 100) / 100}`;
  } else {
    number = String(Math.round(number * 100) / 100);
  }
  if (!unit) return String(number);
  const separator = /^[\s%€$£¢]/.test(unit) ? '' : ' ';
  return `${number}${separator}${unit}`;
}

function normalizeData(raw) {
  const list = Array.isArray(raw) ? raw.slice(0, 500) : [];
  return list.map((item, index) => {
    if (typeof item === 'number') {
      return {label: String(index + 1), value: item, x: index + 1, y: item, series: '', color: null};
    }
    if (!item || typeof item !== 'object') {
      return {label: String(index + 1), value: 0, x: index + 1, y: 0, series: '', color: null};
    }
    const value = numberOr(item.value != null ? item.value : (item.y != null ? item.y : item.x), 0);
    const x = numberOr(item.x != null ? item.x : index + 1, index + 1);
    const y = numberOr(item.y != null ? item.y : value, value);
    return {
      label: String(item.label != null ? item.label : index + 1),
      value, x, y,
      series: String(item.series || ''),
      color: item.color || null
    };
  });
}

function summarize(points) {
  const values = points.map(point => point.value);
  if (!values.length) return {count: 0, min: 0, max: 0, mean: 0, total: 0};
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    mean: Math.round((total / values.length) * 100) / 100,
    total: Math.round(total * 100) / 100
  };
}

function domainFor(points, useY) {
  const values = points.map(point => numberOr(useY ? point.y : point.value, 0));
  if (!values.length) return {min: 0, max: 1};
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  } else if (min > 0) {
    min = 0;
  }
  return {min, max};
}

function scaleY(value, domain, top, bottom) {
  const ratio = (numberOr(value, 0) - domain.min) / (domain.max - domain.min);
  return bottom - ratio * (bottom - top);
}

function scaleX(value, domain, left, right) {
  const ratio = (numberOr(value, 0) - domain.min) / (domain.max - domain.min || 1);
  return left + ratio * (right - left);
}

function groupedSeries(points) {
  const names = [];
  for (const point of points) {
    const name = point.series || 'series';
    if (!names.includes(name)) names.push(name);
  }
  const categories = [];
  for (const point of points) {
    if (!categories.includes(point.label)) categories.push(point.label);
  }
  const matrix = categories.map(label => names.map(name =>
    points.filter(point => point.label === label && (point.series || 'series') === name)
      .reduce((sum, point) => sum + point.value, 0)));
  return {names, categories, matrix};
}

function fmt(value, options) {
  return formatNumber(value, options.format, options.unit);
}

function renderGrid(domain, pad, plot, options, text) {
  if (!options.showGrid) return '';
  const lines = [];
  for (let step = 0; step <= 4; step++) {
    const y = pad.top + (plot.height * step) / 4;
    const value = domain.max - ((domain.max - domain.min) * step) / 4;
    lines.push(`<line x1="${pad.left}" y1="${y.toFixed(2)}" x2="${pad.left + plot.width}" ` +
      `y2="${y.toFixed(2)}" stroke="${text.grid}" stroke-width="1" stroke-dasharray="4 5" opacity="0.7"/>`);
    if (options.showAxes) {
      lines.push(`<text x="${pad.left - 8}" y="${(y + 4).toFixed(2)}" text-anchor="end" ` +
        `font-size="11" fill="${text.axis}">${escapeXml(fmt(value, options))}</text>`);
    }
  }
  return lines.join('');
}

function renderAxes(categories, pad, plot, options, text) {
  if (!options.showAxes) return '';
  const parts = [`<line x1="${pad.left}" y1="${pad.top + plot.height}" ` +
    `x2="${pad.left + plot.width}" y2="${pad.top + plot.height}" stroke="${text.axis}" stroke-width="1"/>`];
  if (options.showLabels && categories.length) {
    const step = categories.length > 12 ? Math.ceil(categories.length / 12) : 1;
    for (let index = 0; index < categories.length; index += step) {
      const x = pad.left + (plot.width * (index + 0.5)) / categories.length;
      parts.push(`<text x="${x.toFixed(2)}" y="${pad.top + plot.height + 18}" text-anchor="middle" ` +
        `font-size="11" fill="${text.axis}">${escapeXml(categories[index])}</text>`);
    }
  }
  return parts.join('');
}

function tooltip(label, value, options) {
  if (!options.accessible) return '';
  return `<title>${escapeXml(`${label}: ${fmt(value, options)}`)}</title>`;
}

function renderBar(points, pad, plot, domain, colors, options) {
  const group = groupedSeries(points);
  const band = plot.width / Math.max(1, group.categories.length);
  const inner = (band * 0.82) / Math.max(1, group.names.length);
  const parts = [];
  for (let catIndex = 0; catIndex < group.categories.length; catIndex++) {
    for (let seriesIndex = 0; seriesIndex < group.names.length; seriesIndex++) {
      const value = group.matrix[catIndex][seriesIndex];
      const x = pad.left + catIndex * band + band * 0.09 + seriesIndex * inner;
      const y = scaleY(value, domain, pad.top, pad.top + plot.height);
      const height = Math.max(1, pad.top + plot.height - y);
      const color = colors[seriesIndex % colors.length];
      parts.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(inner * 0.9).toFixed(2)}" ` +
        `height="${height.toFixed(2)}" rx="3" fill="${color}">${tooltip(group.categories[catIndex], value, options)}</rect>`);
      if (options.showLabels && group.names.length > 1 && inner > 26) {
        parts.push(`<text x="${(x + inner * 0.45).toFixed(2)}" y="${(y - 5).toFixed(2)}" ` +
          `text-anchor="middle" font-size="9" fill="${options.themeColor.muted}">${escapeXml(fmt(value, options))}</text>`);
      }
    }
  }
  return {body: parts.join(''), categories: group.categories, names: group.names};
}

function renderLine(points, pad, plot, domain, colors, options, fillArea) {
  const group = groupedSeries(points);
  const parts = [];
  for (let seriesIndex = 0; seriesIndex < group.names.length; seriesIndex++) {
    const coords = group.matrix.map((row, index) => ({
      x: pad.left + (plot.width * (index + 0.5)) / Math.max(1, group.categories.length),
      y: scaleY(row[seriesIndex], domain, pad.top, pad.top + plot.height),
      value: row[seriesIndex],
      label: group.categories[index]
    }));
    if (!coords.length) continue;
    const line = coords.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
    const color = colors[seriesIndex % colors.length];
    if (fillArea) {
      const area = `${line} L${coords[coords.length - 1].x.toFixed(2)},${(pad.top + plot.height).toFixed(2)} ` +
        `L${coords[0].x.toFixed(2)},${(pad.top + plot.height).toFixed(2)} Z`;
      parts.push(`<path d="${area}" fill="${color}" opacity="0.18"/>`);
    }
    parts.push(`<path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" ` +
      `stroke-linecap="round" stroke-linejoin="round"/>`);
    for (const point of coords) {
      parts.push(`<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3.5" fill="${color}">` +
        `${tooltip(point.label, point.value, options)}</circle>`);
    }
  }
  return {body: parts.join(''), categories: group.categories, names: group.names};
}

function arcPath(cx, cy, radius, startAngle, endAngle) {
  const toPoint = angle => ({
    x: cx + radius * Math.cos(angle - Math.PI / 2),
    y: cy + radius * Math.sin(angle - Math.PI / 2)
  });
  const start = toPoint(startAngle);
  const end = toPoint(endAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M${cx},${cy} L${start.x.toFixed(2)},${start.y.toFixed(2)} ` +
    `A${radius},${radius} 0 ${large} 1 ${end.x.toFixed(2)},${end.y.toFixed(2)} Z`;
}

function renderDonut(points, pad, plot, colors, options) {
  const values = points.map(point => Math.max(0, point.value));
  const total = values.reduce((sum, value) => sum + value, 0);
  const cx = pad.left + plot.width / 2;
  const cy = pad.top + plot.height / 2;
  const radius = Math.max(10, Math.min(plot.width, plot.height) / 2 - 12);
  const inner = radius * 0.58;
  const parts = [];
  if (!total) {
    return {
      body: `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${options.themeColor.grid}" stroke-width="2"/>`,
      names: []
    };
  }
  let angle = 0;
  const names = [];
  for (let index = 0; index < points.length; index++) {
    const share = values[index] / total;
    const end = angle + share * Math.PI * 2;
    const color = normalizeHex(points[index].color, colors[index % colors.length]);
    if (share >= 0.9999) {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}">` +
        `${tooltip(points[index].label, points[index].value, options)}</circle>`);
    } else {
      parts.push(`<path d="${arcPath(cx, cy, radius, angle, end)}" fill="${color}">` +
        `${tooltip(points[index].label, points[index].value, options)}</path>`);
    }
    angle = end;
    if (!names.includes(points[index].label)) names.push(points[index].label);
  }
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${inner.toFixed(2)}" fill="${options.themeColor.bg}"/>`);
  parts.push(`<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="16" ` +
    `font-weight="700" fill="${options.themeColor.text}">${escapeXml(fmt(total, options))}</text>`);
  parts.push(`<text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="10" ` +
    `fill="${options.themeColor.axis}">${escapeXml(localText(options.language, 'Total', 'Total'))}</text>`);
  return {body: parts.join(''), names};
}

function renderScatter(points, pad, plot, colors, options) {
  const xDomain = domainFor(points.map(point => ({value: point.x})), false);
  const yDomain = domainFor(points.map(point => ({value: point.y})), true);
  const parts = [];
  for (const point of points) {
    const cx = scaleX(point.x, xDomain, pad.left, pad.left + plot.width);
    const cy = scaleY(point.y, yDomain, pad.top, pad.top + plot.height);
    const color = normalizeHex(point.color, colors[0]);
    parts.push(`<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="5" fill="${color}" ` +
      `fill-opacity="0.85" stroke="${options.themeColor.bg}" stroke-width="1">` +
      `${tooltip(point.label || `x=${point.x}`, point.y, options)}</circle>`);
  }
  if (options.showAxes) {
    parts.push(`<line x1="${pad.left}" y1="${pad.top + plot.height}" x2="${pad.left + plot.width}" ` +
      `y2="${pad.top + plot.height}" stroke="${options.themeColor.axis}"/>`);
    parts.push(`<text x="${pad.left + plot.width}" y="${pad.top + plot.height + 18}" text-anchor="end" ` +
      `font-size="10" fill="${options.themeColor.axis}">x: ${escapeXml(fmt(xDomain.min, options))} – ` +
      `${escapeXml(fmt(xDomain.max, options))}</text>`);
  }
  return {body: parts.join(''), categories: [], names: []};
}

function renderSparkline(points, colors, options) {
  if (!points.length) return {body: '', categories: [], names: []};
  const domain = domainFor(points, false);
  const top = 4;
  const bottom = options.height - 4;
  const coords = points.map((point, index) => ({
    x: (options.width * index) / Math.max(1, points.length - 1),
    y: scaleY(point.value, domain, top, bottom),
    value: point.value,
    label: point.label
  }));
  const line = coords.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
  const area = `${line} L${coords[coords.length - 1].x.toFixed(2)},${bottom} L0,${bottom} Z`;
  const color = colors[0];
  const parts = [
    `<path d="${area}" fill="${color}" opacity="0.16"/>`,
    `<path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`
  ];
  const last = coords[coords.length - 1];
  parts.push(`<circle cx="${last.x.toFixed(2)}" cy="${last.y.toFixed(2)}" r="3" fill="${color}">` +
    `${tooltip(last.label || 'Último / Last', last.value, options)}</circle>`);
  return {body: parts.join(''), categories: [], names: []};
}

function renderLegend(names, colors, pad, options) {
  if (!options.accessible || names.length < 2) return '';
  const parts = [];
  let x = pad.left;
  const y = 18;
  for (let index = 0; index < names.length; index++) {
    const color = colors[index % colors.length];
    parts.push(`<rect x="${x}" y="${y - 8}" width="10" height="10" rx="2" fill="${color}"/>`);
    parts.push(`<text x="${x + 15}" y="${y}" font-size="10" fill="${options.themeColor.muted}">` +
      `${escapeXml(names[index])}</text>`);
    x += 24 + names[index].length * 6;
    if (x > options.width - 80) break;
  }
  return parts.join('');
}

function buildSvg(result, options) {
  const theme = options.themeColor;
  const a11yAttrs = options.accessible
    ? ` role="img" aria-label="${escapeXml(options.ariaLabel)}"` : '';
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${options.width}" ` +
    `height="${options.height}" viewBox="0 0 ${options.width} ${options.height}"${a11yAttrs}>`];
  if (options.accessible) {
    parts.push(`<title>${escapeXml(options.ariaTitle)}</title>`);
    parts.push(`<desc>${escapeXml(options.ariaDescription)}</desc>`);
  }
  parts.push(`<rect width="${options.width}" height="${options.height}" fill="${theme.bg}" rx="8"/>`);
  if (options.title && options.type !== 'sparkline') {
    parts.push(`<text x="${options.pad.left}" y="${options.pad.top - 16}" font-size="14" ` +
      `font-weight="700" fill="${theme.text}">${escapeXml(options.title)}</text>`);
  }
  parts.push(result.grid || '');
  parts.push(result.body || '');
  parts.push(result.axes || '');
  parts.push(result.legend || '');
  parts.push('</svg>');
  return parts.join('');
}

function renderMarkdown(result, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${t('Gráfico SVG', 'SVG chart')}`,
    '',
    `- ${t('Tipo', 'Type')}: \`${result.type}\``,
    `- ${t('Tamaño', 'Size')}: ${result.width}×${result.height}`,
    `- ${t('Tema', 'Theme')}: \`${result.theme}\``,
    `- ${t('Puntos', 'Points')}: ${result.stats.count}`,
    `- ${t('Rango', 'Range')}: ${result.stats.min} – ${result.stats.max}`,
    `- ${t('Total', 'Total')}: ${result.stats.total}`,
    `- ${t('Serie', 'Series')}: ${result.series.length ? result.series.join(', ') : '-'}`,
    `- ${t('Guardado', 'Saved')}: ${result.written ? t('sí', 'yes') : t('no', 'no')}`,
    '',
    `## ${t('Uso', 'Usage')}`,
    '',
    '```html',
    `<img src="${result.dataUri.slice(0, 96)}..." alt="${result.title || result.type}">`,
    '```',
    '',
    t('El campo `svg` contiene el documento completo y `dataUri` la versión lista para CSS.',
      'The `svg` field holds the full document and `dataUri` is ready for CSS.')
  ];
  if (result.warnings.length) {
    lines.push('', `## ${t('Avisos', 'Warnings')}`, '');
    for (const warning of result.warnings) lines.push(`- ${warning}`);
  }
  return `${lines.join('\n')}\n`;
}

async function chartRender(args) {
  let language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  const type = CHART_TYPES.includes(args.type) ? args.type : 'bar';
  const themeKey = ['contrast', 'light', 'dark'].includes(args.theme) ? args.theme : 'contrast';
  const themeColor = {...THEMES[themeKey]};
  if (String(args.background || '').trim()) {
    themeColor.bg = normalizeHex(args.background, themeColor.bg);
  }
  const isSpark = type === 'sparkline';
  const width = clamp(args.width, 80, 1600, isSpark ? 240 : 640);
  const height = clamp(args.height, 60, 1000, isSpark ? 72 : 360);
  const format = ['number', 'percent', 'currency', 'compact'].includes(args.value_format)
    ? args.value_format : 'number';
  const unit = String(args.unit || '').trim();
  const options = {
    type, width, height, theme: themeKey, themeColor, language,
    format, unit,
    title: String(args.title || '').trim(),
    showAxes: args.show_axes !== false,
    showGrid: args.show_grid !== false,
    showLabels: args.show_labels !== false,
    accessible: args.accessible !== false,
    pad: null,
    ariaLabel: '', ariaTitle: '', ariaDescription: ''
  };

  const points = normalizeData(args.data);
  const warnings = [];
  if (Array.isArray(args.data) && args.data.length > 500) {
    warnings.push(localText(language, 'Se recortaron los datos a 500 puntos.', 'Data was truncated to 500 points.'));
  }
  if (!points.length) {
    warnings.push(localText(language, 'No se recibieron datos; se dibujó un marcador vacío.',
      'No data received; an empty placeholder was drawn.'));
  }

  const colors = (Array.isArray(args.colors) && args.colors.length
    ? args.colors : PALETTES[themeKey === 'light' ? 'categorical' : 'contrast'])
    .map((color, index) => normalizeHex(color, PALETTES.contrast[index % PALETTES.contrast.length]));
  if (!colors.length) colors.push(...PALETTES.contrast);

  const pad = isSpark
    ? {top: 4, right: 4, bottom: 4, left: 4}
    : {
      top: options.title ? 46 : 26,
      right: 20,
      bottom: options.showLabels ? 54 : 32,
      left: options.showAxes ? 62 : 18
    };
  const plot = {
    width: Math.max(10, width - pad.left - pad.right),
    height: Math.max(10, height - pad.top - pad.bottom)
  };
  options.pad = pad;

  const domain = domainFor(points, type === 'scatter');
  const grid = isSpark ? '' : renderGrid(domain, pad, plot,
    {showGrid: options.showGrid, showAxes: options.showAxes, format, unit}, themeColor);

  let rendered;
  let axes = '';
  let legend = '';
  if (type === 'bar') {
    rendered = renderBar(points, pad, plot, domain, colors, {...options, themeColor});
    axes = renderAxes(rendered.categories, pad, plot, options, themeColor);
    legend = renderLegend(rendered.names, colors, pad, options);
  } else if (type === 'line' || type === 'area') {
    rendered = renderLine(points, pad, plot, domain, colors, {...options, themeColor}, type === 'area');
    axes = renderAxes(rendered.categories, pad, plot, options, themeColor);
    legend = renderLegend(rendered.names, colors, pad, options);
  } else if (type === 'donut') {
    rendered = renderDonut(points, pad, plot, colors, {...options, themeColor});
    legend = renderLegend(rendered.names, colors, pad, options);
  } else if (type === 'scatter') {
    rendered = renderScatter(points, pad, plot, colors, {...options, themeColor});
  } else {
    rendered = renderSparkline(points, colors, {...options, themeColor});
  }

  const stats = summarize(points);
  options.ariaTitle = options.title || localText(language, `Gráfico de ${type}`, `${type} chart`);
  options.ariaLabel = `${options.ariaTitle}. ${localText(language,
    `${stats.count} puntos, rango ${stats.min} a ${stats.max}`,
    `${stats.count} points, range ${stats.min} to ${stats.max}`)}`;
  options.ariaDescription = localText(language,
    `Gráfico ${type} generado offline. Total ${stats.total}.`,
    `Offline ${type} chart. Total ${stats.total}.`);

  const svg = buildSvg({grid, body: rendered.body, axes, legend}, options);
  const result = {
    format: 'antigem-chart-svg',
    version: 1,
    chartId: `chart_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
    language, type, width, height, theme: themeKey,
    title: options.title,
    colors: colors.slice(0, Math.max(1, rendered.names.length || 1)),
    series: rendered.names || [],
    stats,
    svg,
    dataUri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    warnings,
    written: false,
    path: null
  };

  if (String(args.output || '').trim() && args.dry_run === false) {
    result.path = String(args.output).trim();
    await chrome.antigem.writeFile({path: result.path, data: svg, encoding: 'utf8'});
    result.written = true;
  }
  result.markdown = renderMarkdown(result, language);
  return result;
}

function paletteMarkdown(result, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${t('Paleta para gráficos', 'Chart palette')}`,
    '',
    `- ${t('Esquema', 'Scheme')}: \`${result.scheme}\``,
    `- ${t('Fondo', 'Background')}: \`${result.background}\``,
    `- ${t('Colores', 'Colours')}: ${result.colors.length}`,
    '',
    '| ' + t('Color', 'Colour') + ' | WCAG | ' + t('Uso', 'Use') + ' |',
    '| --- | --- | --- |'
  ];
  for (const item of result.colors) {
    lines.push(`| \`${item.hex}\` | ${item.ratio}:1 | ${item.usage} |`);
  }
  if (result.warnings.length) {
    lines.push('', `## ${t('Avisos', 'Warnings')}`, '');
    for (const warning of result.warnings) lines.push(`- ${warning}`);
  }
  return `${lines.join('\n')}\n`;
}

async function chartPalette(args) {
  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  const scheme = SCHEMES.includes(args.scheme) ? args.scheme : 'contrast';
  const count = clamp(args.count, 2, 12, 5);
  const background = normalizeHex(args.background, '#0B1020');
  const source = PALETTES[scheme];
  const colors = source.slice(0, count);
  const items = colors.map(hex => {
    const ratio = Math.round(contrastRatio(hex, background) * 100) / 100;
    const usage = ratio >= 4.5
      ? localText(language, 'texto y gráfico', 'text and graphic')
      : ratio >= 3
        ? localText(language, 'solo gráfico', 'graphic only')
        : localText(language, 'bajo contraste', 'low contrast');
    return {hex, ratio, usage};
  });
  const warnings = items.filter(item => item.ratio < 3).map(item =>
    localText(language, `${item.hex} tiene ${item.ratio}:1 sobre ${background}; úsalo solo como relleno decorativo.`,
      `${item.hex} is ${item.ratio}:1 on ${background}; use it only as decorative fill.`));

  const swatchParts = items.map((item, index) => {
    const x = 8 + index * 46;
    return `<rect x="${x}" y="8" width="38" height="38" rx="6" fill="${item.hex}"/>` +
      `<text x="${x + 19}" y="60" text-anchor="middle" font-size="8" fill="#F8FAFC">${item.hex}</text>`;
  });
  const swatch = `<svg xmlns="http://www.w3.org/2000/svg" width="${8 + items.length * 46}" height="72" ` +
    `viewBox="0 0 ${8 + items.length * 46} 72"><rect width="100%" height="100%" fill="${background}"/>` +
    `${swatchParts.join('')}</svg>`;

  const result = {
    format: 'antigem-chart-palette',
    version: 1,
    paletteId: `pal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
    language, scheme, count, background,
    colors: items,
    cssVariables: `:root {\n${items.map((item, index) =>
      `  --chart-color-${index + 1}: ${item.hex};`).join('\n')}\n  --chart-bg: ${background};\n}\n`,
    swatch,
    warnings,
    written: false,
    path: null
  };
  result.markdown = paletteMarkdown(result, language);
  if (String(args.output || '').trim() && args.dry_run === false) {
    result.path = String(args.output).trim();
    await chrome.antigem.writeFile({path: result.path, data: result.cssVariables, encoding: 'utf8'});
    result.written = true;
  }
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    const args = message.args || {};
    if (message.tool === 'chart_render') return await chartRender(args);
    if (message.tool === 'chart_palette') return await chartPalette(args);
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: error && error.message ? error.message : String(error)}]
  }));
  return true;
});
