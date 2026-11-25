'use strict';

// Theme Audit — solo lectura. Nunca escribe temas, archivos ni llama a la red.

const DEFAULT_SEEDS = [
  'background', 'surface', 'card', 'surface_variant', 'on_background',
  'on_surface_variant', 'primary', 'secondary', 'tertiary', 'success',
  'warning', 'danger', 'info', 'code_bg', 'syntax_keyword', 'syntax_type',
  'syntax_string', 'syntax_number', 'syntax_comment', 'syntax_function',
  'syntax_annotation', 'syntax_punctuation'
];

const PAIRS = [
  {fg: 'on_background', bg: 'background', min: 4.5, group: 'ui', es: 'Texto principal sobre fondo', en: 'Main text on background'},
  {fg: 'on_surface', bg: 'surface', min: 4.5, group: 'ui', es: 'Texto principal sobre superficie', en: 'Main text on surface'},
  {fg: 'on_surface', bg: 'card', min: 4.5, group: 'ui', es: 'Texto principal sobre tarjeta', en: 'Main text on card'},
  {fg: 'on_surface_variant', bg: 'surface_variant', min: 4.5, group: 'ui', es: 'Texto secundario sobre superficie variante', en: 'Secondary text on variant surface'},
  {fg: 'text_secondary', bg: 'surface', min: 4.5, group: 'ui', es: 'Texto secundario sobre superficie', en: 'Secondary text on surface'},
  {fg: 'on_primary', bg: 'primary', min: 4.5, group: 'ui', es: 'Texto sobre acento primario', en: 'Text on primary accent'},
  {fg: 'on_secondary', bg: 'secondary', min: 4.5, group: 'ui', es: 'Texto sobre acento secundario', en: 'Text on secondary accent'},
  {fg: 'on_tertiary', bg: 'tertiary', min: 4.5, group: 'ui', es: 'Texto sobre acento terciario', en: 'Text on tertiary accent'},
  {fg: 'on_primary_container', bg: 'primary_container', min: 4.5, group: 'ui', es: 'Texto sobre contenedor primario', en: 'Text on primary container'},
  {fg: 'on_secondary_container', bg: 'secondary_container', min: 4.5, group: 'ui', es: 'Texto sobre contenedor secundario', en: 'Text on secondary container'},
  {fg: 'on_tertiary_container', bg: 'tertiary_container', min: 4.5, group: 'ui', es: 'Texto sobre contenedor terciario', en: 'Text on tertiary container'},
  {fg: 'on_error', bg: 'error', min: 4.5, group: 'status', es: 'Texto sobre error', en: 'Text on error'},
  {fg: 'on_error_container', bg: 'error_container', min: 4.5, group: 'status', es: 'Texto sobre contenedor de error', en: 'Text on error container'},
  {fg: 'inverse_on_surface', bg: 'inverse_surface', min: 4.5, group: 'ui', es: 'Texto invertido (snackbars)', en: 'Inverse text (snackbars)'},
  {fg: 'outline', bg: 'surface', min: 3, group: 'ui', es: 'Bordes fuertes', en: 'Strong borders'},
  {fg: 'outline_variant', bg: 'surface_variant', min: 3, group: 'ui', es: 'Divisores y bordes suaves', en: 'Subtle dividers'},
  {fg: 'border', bg: 'card', min: 3, group: 'ui', es: 'Bordes de tarjetas y campos', en: 'Card and input borders'},
  {fg: 'success', bg: 'surface', min: 4.5, group: 'status', es: 'Color de éxito como texto', en: 'Success color as text'},
  {fg: 'warning', bg: 'surface', min: 4.5, group: 'status', es: 'Color de aviso como texto', en: 'Warning color as text'},
  {fg: 'danger', bg: 'surface', min: 4.5, group: 'status', es: 'Color de peligro como texto', en: 'Danger color as text'},
  {fg: 'info', bg: 'surface', min: 4.5, group: 'status', es: 'Color de información como texto', en: 'Info color as text'},
  {fg: 'code_text', bg: 'code_bg', min: 4.5, group: 'code', es: 'Texto de código', en: 'Plain code text'},
  {fg: 'syntax_keyword', bg: 'code_bg', min: 4.5, group: 'code', es: 'Palabras clave', en: 'Keywords'},
  {fg: 'syntax_type', bg: 'code_bg', min: 4.5, group: 'code', es: 'Tipos y clases', en: 'Types and classes'},
  {fg: 'syntax_string', bg: 'code_bg', min: 4.5, group: 'code', es: 'Cadenas', en: 'Strings'},
  {fg: 'syntax_number', bg: 'code_bg', min: 4.5, group: 'code', es: 'Números', en: 'Numbers'},
  {fg: 'syntax_comment', bg: 'code_bg', min: 4.5, group: 'code', es: 'Comentarios', en: 'Comments'},
  {fg: 'syntax_function', bg: 'code_bg', min: 4.5, group: 'code', es: 'Funciones', en: 'Functions'},
  {fg: 'syntax_annotation', bg: 'code_bg', min: 4.5, group: 'code', es: 'Anotaciones', en: 'Annotations'},
  {fg: 'syntax_punctuation', bg: 'code_bg', min: 4.5, group: 'code', es: 'Puntuación', en: 'Punctuation'},
  {fg: 'syntax_control', bg: 'code_bg', min: 4.5, group: 'code', es: 'Control de flujo', en: 'Control flow'},
  {fg: 'syntax_tag', bg: 'code_bg', min: 4.5, group: 'code', es: 'Etiquetas HTML/XML', en: 'HTML/XML tags'},
  {fg: 'syntax_attribute', bg: 'code_bg', min: 4.5, group: 'code', es: 'Atributos', en: 'Attributes'},
  {fg: 'editor_text', bg: 'editor_bg', min: 4.5, group: 'editor', es: 'Texto del editor', en: 'Editor text'},
  {fg: 'editor_muted', bg: 'editor_panel', min: 4.5, group: 'editor', es: 'Números de línea y pistas', en: 'Line numbers and hints'},
  {fg: 'editor_border', bg: 'editor_panel', min: 3, group: 'editor', es: 'Bordes del editor', en: 'Editor borders'},
  {fg: 'editor_added_text', bg: 'editor_added_bg', min: 4.5, group: 'editor', es: 'Diff: líneas añadidas', en: 'Diff: added lines'},
  {fg: 'editor_removed_text', bg: 'editor_removed_bg', min: 4.5, group: 'editor', es: 'Diff: líneas eliminadas', en: 'Diff: removed lines'},
  {fg: 'editor_info_text', bg: 'editor_info_bg', min: 4.5, group: 'editor', es: 'Diff: cabecera de bloque', en: 'Diff: hunk header'},
  {fg: 'editor_text', bg: 'editor_selection', min: 4.5, group: 'editor', es: 'Texto sobre selección', en: 'Text on selection'},
  {fg: 'terminal_fg', bg: 'terminal_bg', min: 4.5, group: 'terminal', es: 'Texto del terminal', en: 'Terminal text'},
  {fg: 'terminal_cursor', bg: 'terminal_bg', min: 3, group: 'terminal', es: 'Cursor del terminal', en: 'Terminal cursor'}
];

for (let i = 0; i < 16; i++) {
  PAIRS.push({
    fg: `ansi_${i}`, bg: 'terminal_bg', min: 3, group: 'terminal',
    es: `Color ANSI ${i} sobre terminal`, en: `ANSI color ${i} on terminal`
  });
}

const GROUP_LABEL = {
  ui: {es: 'Interfaz', en: 'Interface'},
  status: {es: 'Estados', en: 'Status'},
  code: {es: 'Código', en: 'Code'},
  editor: {es: 'Editor', en: 'Editor'},
  terminal: {es: 'Terminal', en: 'Terminal'}
};

const SEVERITY_RANK = {error: 3, warning: 2, info: 1, pass: 0};

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(Math.min(max, Math.max(min, number)));
}

function localText(language, es, en) {
  if (language === 'es') return es;
  if (language === 'en') return en;
  return `${es} / ${en}`;
}

function langOf(value) {
  return ['es', 'en', 'both'].includes(value) ? value : 'both';
}

function errorText(error) {
  return error && error.message ? error.message : String(error);
}

function short(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function cell(value) {
  return String(value === null || value === undefined ? '-' : value)
    .replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function parseColor(value) {
  const text = String(value || '').trim();
  let match = /^#([0-9a-f]+)$/i.exec(text);
  if (match) {
    const hex = match[1];
    if (hex.length === 3 || hex.length === 4) {
      const alpha = hex.length === 4 ? parseInt(hex[0] + hex[0], 16) / 255 : 1;
      return {
        r: parseInt(hex[hex.length - 3] + hex[hex.length - 3], 16),
        g: parseInt(hex[hex.length - 2] + hex[hex.length - 2], 16),
        b: parseInt(hex[hex.length - 1] + hex[hex.length - 1], 16),
        a: alpha
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      const alpha = hex.length === 8 ? parseInt(hex.slice(0, 2), 16) / 255 : 1;
      const rgb = hex.length === 8 ? hex.slice(2) : hex;
      return {
        r: parseInt(rgb.slice(0, 2), 16),
        g: parseInt(rgb.slice(2, 4), 16),
        b: parseInt(rgb.slice(4, 6), 16),
        a: alpha
      };
    }
    return null;
  }
  match = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+))?\s*\)$/i.exec(text);
  if (match) {
    return {
      r: Math.min(255, Number(match[1])),
      g: Math.min(255, Number(match[2])),
      b: Math.min(255, Number(match[3])),
      a: match[4] === undefined ? 1 : Number(match[4])
    };
  }
  return null;
}

function toHex(color) {
  const part = value => Math.max(0, Math.min(255, Math.round(value)))
    .toString(16).padStart(2, '0').toUpperCase();
  return `#${part(color.r)}${part(color.g)}${part(color.b)}`;
}

function luminance(color) {
  const channel = value => {
    const c = Math.max(0, Math.min(255, value)) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const high = Math.max(la, lb);
  const low = Math.min(la, lb);
  return (high + 0.05) / (low + 0.05);
}

function ratioOf(value) {
  return Math.round(Number(value) * 100) / 100;
}

function suggestColor(foreground, background, target) {
  const toward = luminance(background) < 0.18 ? 255 : 0;
  for (let step = 0; step <= 100; step += 2) {
    const t = step / 100;
    const candidate = {
      r: foreground.r + (toward - foreground.r) * t,
      g: foreground.g + (toward - foreground.g) * t,
      b: foreground.b + (toward - foreground.b) * t
    };
    if (contrast(candidate, background) >= target + 0.15) return toHex(candidate);
  }
  return null;
}

function makeFinding(severity, code, themeId, token, es, en, fixEs, fixEn, data) {
  return Object.assign({
    severity, code, theme: themeId || '', token: token || '',
    es, en, fix_es: fixEs || '', fix_en: fixEn || ''
  }, data || {});
}

/* ------------------------------------------------------------------ */
/* Entrada                                                             */
/* ------------------------------------------------------------------ */

function normalizeTheme(value, index) {
  let candidate = value;
  if (typeof candidate === 'string') {
    try { candidate = JSON.parse(candidate); }
    catch (error) { throw new Error(`JSON inválido / invalid JSON (#${index + 1}): ${errorText(error)}`); }
  }
  if (Array.isArray(candidate)) {
    return candidate.map((item, i) => normalizeTheme(item, index + i));
  }
  if (!candidate || typeof candidate !== 'object') {
    throw new Error(`Tema inválido / invalid theme (#${index + 1})`);
  }
  let colors = candidate.colors;
  if (!colors && Object.values(candidate).every(item => typeof item === 'string')) {
    colors = candidate;
  }
  if (!colors || typeof colors !== 'object' || Array.isArray(colors)) {
    throw new Error(`El tema #${index + 1} no tiene un objeto colors / has no colors object`);
  }
  const id = String(candidate.id || candidate.name || `theme-${index + 1}`);
  return [{
    id,
    name: String(candidate.name || candidate.id || id),
    dark: candidate.dark === true,
    built_in: candidate.built_in === true,
    about: String(candidate.about || ''),
    colors
  }];
}

async function readJsonFile(path) {
  const value = String(path || '').trim();
  if (!/^(~\/|\/sdcard\/|\/data\/)/.test(value)) {
    throw new Error('path debe ser una ruta local / path must be a local path');
  }
  let info;
  try { info = await chrome.antigem.stat({path: value}); }
  catch (error) { throw new Error(`No se pudo leer el JSON / could not read JSON: ${errorText(error)}`); }
  if (!info.isFile) throw new Error('path debe ser un archivo / path must be a file');
  if (info.size > 1048576) throw new Error('JSON demasiado grande / JSON too large (1 MB max)');
  return await chrome.antigem.readFile({path: value, encoding: 'utf8'});
}

async function collectThemes(args) {
  const raw = [];
  if (args.json) raw.push(args.json);
  if (args.path) raw.push(await readJsonFile(args.path));
  if (args.theme) raw.push(args.theme);
  if (Array.isArray(args.themes)) raw.push(...args.themes);
  if (!raw.length) {
    throw new Error('Pasa theme, themes, json o path / pass theme, themes, json or path');
  }
  const themes = [];
  raw.forEach((item, index) => {
    for (const theme of normalizeTheme(item, index)) themes.push(theme);
  });
  return themes;
}

function collectSeeds(args) {
  const tokens = args.tokens && typeof args.tokens === 'object' ? args.tokens : {};
  if (Array.isArray(tokens.seeds)) return tokens.seeds.map(String);
  if (Array.isArray(args.seeds)) return args.seeds.map(String);
  return DEFAULT_SEEDS;
}

/* ------------------------------------------------------------------ */
/* Auditoría                                                           */
/* ------------------------------------------------------------------ */

function auditOne(theme, seeds, options, globalFindings) {
  const colors = theme.colors;
  const findings = [];
  const pairs = [];
  const suggestedColors = {};
  const suggestedReasons = [];
  const seedSet = new Set(seeds);
  const parsed = {};

  for (const [token, value] of Object.entries(colors)) {
    const color = parseColor(value);
    if (!color) {
      const finding = makeFinding('warning', 'INVALID_COLOR', theme.id, token,
        `Color no válido: ${short(value, 40)}.`,
        `Invalid color: ${short(value, 40)}.`,
        'Usa #RRGGBB o #AARRGGBB.', 'Use #RRGGBB or #AARRGGBB.');
      findings.push(finding);
      globalFindings.push(finding);
      continue;
    }
    parsed[token] = color;
    if (color.a < 0.99) {
      const finding = makeFinding('warning', 'LOW_ALPHA', theme.id, token,
        `Alfa ${ratioOf(color.a)}: el contraste se calcula ignorando la transparencia.`,
        `Alpha ${ratioOf(color.a)}: contrast is computed ignoring transparency.`,
        'Usa un color opaco para garantizar el contraste.',
        'Use an opaque color to guarantee contrast.');
      findings.push(finding);
      globalFindings.push(finding);
    }
  }

  for (const pair of PAIRS) {
    if (pair.group === 'terminal' && pair.fg.startsWith('ansi_') && !options.includeAnsi) continue;
    const fg = parsed[pair.fg];
    const bg = parsed[pair.bg];
    if (!fg || !bg) continue;
    const ratio = ratioOf(contrast(fg, bg));
    const passes = ratio + 0.001 >= pair.min;
    const largeOnly = !passes && pair.min === 4.5 && ratio >= 3;
    const severity = passes ? 'pass' : largeOnly ? 'warning' : pair.min === 3 ? 'warning' : 'error';
    const code = passes ? 'PASS' : largeOnly ? 'LARGE_TEXT_ONLY' : pair.min === 3 ? 'WEAK_UI' : 'FAIL_CONTRAST';
    const entry = {
      group: pair.group, fg: pair.fg, bg: pair.bg, min: pair.min,
      ratio, severity, code,
      label_es: pair.es, label_en: pair.en
    };
    pairs.push(entry);
    if (passes) continue;

    const description = localText(options.language,
      `${pair.es} (${pair.fg} sobre ${pair.bg}): ${ratio}:1, mínimo ${pair.min}:1.`,
      `${pair.en} (${pair.fg} on ${pair.bg}): ${ratio}:1, minimum ${pair.min}:1.`);
    const fixText = largeOnly
      ? localText(options.language,
        'Cumple AA para texto grande, pero no para texto normal. Aclara o oscurece el color.',
        'Passes AA for large text only. Lighten or darken the color.')
      : localText(options.language,
        'Aclara u oscurece el color de texto hasta alcanzar el mínimo.',
        'Lighten or darken the text color until it reaches the minimum.');
    const finding = makeFinding(severity, code, theme.id, pair.fg, description, description,
      fixText, fixText, {bg: pair.bg, ratio, min: pair.min, group: pair.group});
    findings.push(finding);
    globalFindings.push(finding);

    if (Object.keys(suggestedColors).length < options.maxFixes && !seedSet.has(pair.fg)) {
      const suggestion = suggestColor(fg, bg, pair.min);
      if (suggestion) {
        suggestedColors[pair.fg] = suggestion;
        suggestedReasons.push({token: pair.fg, ratio, min: pair.min});
      }
    }
  }

  // Seed fixes are offered only after non-seed fixes, because changing a seed
  // regenerates derived colors and invalidates the rest of the audit.
  if (Object.keys(suggestedColors).length < options.maxFixes) {
    for (const pair of pairs) {
      if (!seedSet.has(pair.fg) || pair.severity === 'pass') continue;
      if (suggestedColors[pair.fg]) continue;
      if (Object.keys(suggestedColors).length >= options.maxFixes) break;
      const suggestion = suggestColor(parsed[pair.fg], parsed[pair.bg], pair.min);
      if (suggestion) {
        suggestedColors[pair.fg] = suggestion;
        suggestedReasons.push({token: pair.fg, ratio: pair.ratio, min: pair.min, seed: true});
      }
    }
  }

  const coherence = [];
  const backgrounds = ['code_bg', 'editor_bg', 'terminal_bg'].filter(token => parsed[token]);
  const distinctBackgrounds = [...new Set(backgrounds.map(token => toHex(parsed[token])))];
  if (distinctBackgrounds.length > 1) {
    const text = localText(options.language,
      `Fondos de código/editor/terminal distintos: ${distinctBackgrounds.join(', ')}. Puede ser intencionado.`,
      `Code/editor/terminal backgrounds differ: ${distinctBackgrounds.join(', ')}. This may be intentional.`);
    const finding = makeFinding('info', 'BG_COHERENCE', theme.id, 'code_bg', text, text, '', '',
      {values: distinctBackgrounds});
    findings.push(finding);
    globalFindings.push(finding);
    coherence.push({aspect: 'background', values: distinctBackgrounds});
  }
  const foregrounds = ['code_text', 'editor_text', 'terminal_fg'].filter(token => parsed[token]);
  const distinctForegrounds = [...new Set(foregrounds.map(token => toHex(parsed[token])))];
  if (distinctForegrounds.length > 1) {
    const text = localText(options.language,
      `Textos de código/editor/terminal distintos: ${distinctForegrounds.join(', ')}. Revisa la coherencia visual.`,
      `Code/editor/terminal text colors differ: ${distinctForegrounds.join(', ')}. Check visual coherence.`);
    const finding = makeFinding('info', 'FG_COHERENCE', theme.id, 'editor_text', text, text, '', '',
      {values: distinctForegrounds});
    findings.push(finding);
    globalFindings.push(finding);
    coherence.push({aspect: 'foreground', values: distinctForegrounds});
  }
  for (const group of ['editor', 'terminal']) {
    if (!Object.keys(colors).some(token => token.startsWith(group + '_'))) {
      const text = localText(options.language,
        `El tema no define tokens ${group}_*; no se pudo auditar esa zona.`,
        `The theme defines no ${group}_* tokens; that area could not be audited.`);
      const finding = makeFinding('info', 'GROUP_MISSING', theme.id, `${group}_*`, text, text);
      findings.push(finding);
      globalFindings.push(finding);
    }
  }
  if (theme.built_in) {
    const text = localText(options.language,
      'Tema integrado: theme_update no puede cambiarlo. Usa theme_duplicate y audita la copia.',
      'Built-in theme: theme_update cannot change it. Use theme_duplicate and audit the copy.');
    const finding = makeFinding('info', 'BUILTIN_THEME', theme.id, '', text, text,
      'Duplica el tema antes de aplicar cambios.', 'Duplicate the theme before applying changes.');
    findings.push(finding);
    globalFindings.push(finding);
  }

  const counts = {error: 0, warning: 0, info: 0, pass: 0};
  for (const finding of findings) counts[finding.severity]++;
  counts.pass = pairs.filter(pair => pair.severity === 'pass').length;
  const failing = pairs.filter(pair => pair.severity !== 'pass')
    .sort((a, b) => (b.min - b.ratio) - (a.min - a.ratio));
  const worst = failing.length ? failing[0] : null;

  return {
    id: theme.id, name: theme.name, dark: theme.dark, built_in: theme.built_in,
    colors_seen: Object.keys(colors).length,
    summary: {
      pairs: pairs.length, pass: counts.pass, errors: counts.error,
      warnings: counts.warning, info: counts.info,
      worst: worst ? {fg: worst.fg, bg: worst.bg, ratio: worst.ratio, min: worst.min} : null
    },
    pairs, findings, coherence,
    suggested_update: {
      id: theme.id,
      colors: suggestedColors,
      reasons: suggestedReasons,
      note_es: 'Aplica solo con theme_update tras confirmar el usuario; si el tema es integrado, duplícalo primero.',
      note_en: 'Apply only with theme_update after user confirmation; duplicate built-in themes first.'
    }
  };
}

/* ------------------------------------------------------------------ */
/* Informe                                                             */
/* ------------------------------------------------------------------ */

function renderMarkdown(result) {
  const t = (es, en) => localText(result.language, es, en);
  const s = result.summary;
  const lines = [
    `# ${t('Auditoría de tema', 'Theme audit')}`, '',
    `- ${t('Generado', 'Generated')}: ${new Date(result.createdAt).toISOString()}`,
    `- ${t('Modo', 'Mode')}: **${t('solo lectura', 'read-only')}** — ` +
      t('ningún tema fue modificado', 'no theme was modified'),
    `- ${t('Temas', 'Themes')}: ${s.themes} · ${t('Parejas', 'Pairs')}: ${s.pairs} · ` +
      `${t('Correctas', 'Pass')}: ${s.pass} · ${t('Errores / avisos / notas', 'Errors / warnings / notes')}: ` +
      `${s.errors} / ${s.warnings} / ${s.info}`,
    `- ${t('Estado', 'Status')}: **${s.status}** (${s.score}/100)`,
    ''
  ];

  for (const theme of result.themes) {
    const side = theme.dark ? t('oscuro', 'dark') : t('claro', 'light');
    lines.push(`## \`${theme.name}\` (\`${theme.id}\`) — ${side}`, '');
    lines.push(`- ${t('Parejas', 'Pairs')}: ${theme.summary.pairs} · ` +
      `${t('Correctas', 'Pass')}: ${theme.summary.pass} · ` +
      `${t('Errores', 'Errors')}: ${theme.summary.errors} · ` +
      `${t('Avisos', 'Warnings')}: ${theme.summary.warnings}`);
    if (theme.summary.worst) {
      const w = theme.summary.worst;
      lines.push(`- ${t('Peor ratio', 'Worst ratio')}: \`${w.fg} / ${w.bg}\` = **${w.ratio}:1** ` +
        `(${t('mínimo', 'minimum')} ${w.min}:1)`);
    }
    lines.push('');
    const bad = theme.pairs.filter(pair => pair.severity !== 'pass');
    if (bad.length) {
      lines.push(`| ${t('Par', 'Pair')} | ${t('Ratio', 'Ratio')} | ${t('Mínimo', 'Min')} | ${t('Estado', 'Status')} |`);
      lines.push('| --- | --- | --- | --- |');
      for (const pair of bad) {
        lines.push(`| \`${cell(pair.fg)} → ${cell(pair.bg)}\` | ${pair.ratio}:1 | ${pair.min}:1 | ` +
          `${pair.severity.toUpperCase()} |`);
      }
      lines.push('');
    } else {
      lines.push(t('Todas las parejas disponibles superan el mínimo.', 'All available pairs meet the minimum.'), '');
    }
    if (Object.keys(theme.suggested_update.colors).length) {
      lines.push(`### ${t('Propuesta de theme_update', 'Proposed theme_update')}`, '');
      lines.push('```json');
      lines.push(JSON.stringify(theme.suggested_update.colors, null, 2));
      lines.push('```', '');
      lines.push(`\`theme_update({id: '${theme.id}', colors: {...}, apply: false})\``);
      lines.push('');
      lines.push(theme.suggested_update.note_es + ' / ' + theme.suggested_update.note_en);
      lines.push('');
    }
  }

  lines.push(`## ${t('Hallazgos', 'Findings')}`, '');
  if (!result.findings.length) {
    lines.push(t('Sin hallazgos.', 'No findings.'));
  } else {
    for (const finding of result.findings) {
      const message = localText(result.language, finding.es, finding.en);
      const fix = localText(result.language, finding.fix_es, finding.fix_en);
      const where = finding.token ? `\`${cell(finding.theme)}:${cell(finding.token)}\`` : `\`${cell(finding.theme)}\``;
      lines.push(`- **${finding.severity.toUpperCase()}** [\`${finding.code}\`] ${where} — ${cell(message)}` +
        (fix ? ` → ${cell(fix)}` : ''));
    }
  }
  lines.push('', `## ${t('Límites', 'Limits')}`, '');
  lines.push(
    `- ${t('WCAG 2.1: AA normal 4.5:1, AA texto grande y UI 3:1, AAA 7:1.', 'WCAG 2.1: AA normal 4.5:1, AA large text and UI 3:1, AAA 7:1.')}`,
    `- ${t('No se conocen tamaños de fuente: 3–4.5:1 se marca como aviso, no como error.',
      'Font sizes are unknown: 3–4.5:1 is a warning, not an error.')}`,
    `- ${t('Los colores propuestos conservan el tono acercándolo a blanco o negro; vuelve a auditar tras aplicarlos.',
      'Proposed colors keep the hue by moving toward white or black; audit again after applying.')}`,
    `- ${t('Cambiar un seed regenera colores derivados: la auditoría posterior puede diferir.',
      'Changing a seed regenerates derived colors: the next audit may differ.')}`
  );
  return `${lines.join('\n')}\n`;
}

/* ------------------------------------------------------------------ */
/* Entrada principal                                                   */
/* ------------------------------------------------------------------ */

async function auditTheme(args) {
  const themes = await collectThemes(args);
  const seeds = collectSeeds(args);
  const language = langOf(args.language);
  const options = {
    language,
    includeAnsi: args.include_ansi !== false,
    maxFixes: clamp(args.max_fixes, 1, 40, 12)
  };
  const allFindings = [];
  const audited = themes.map(theme => auditOne(theme, seeds, options, allFindings));

  const summary = {
    themes: audited.length,
    pairs: 0, pass: 0, errors: 0, warnings: 0, info: 0
  };
  for (const theme of audited) {
    summary.pairs += theme.summary.pairs;
    summary.pass += theme.summary.pass;
    summary.errors += theme.summary.errors;
    summary.warnings += theme.summary.warnings;
    summary.info += theme.summary.info;
  }
  const score = Math.max(0, Math.min(100, 100 - summary.errors * 12 - summary.warnings * 2));
  summary.status = summary.errors ? 'fail' : summary.warnings ? 'attention' : 'ok';
  summary.score = score;

  allFindings.sort((a, b) =>
    SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
    String(a.theme).localeCompare(String(b.theme)) ||
    String(a.token).localeCompare(String(b.token)));

  const result = {
    format: 'antigem-theme-audit',
    version: 1,
    createdAt: Date.now(),
    language,
    alwaysReadOnly: true,
    summary, themes: audited,
    findings: allFindings,
    seeds_used: seeds,
    warnings: [],
    markdown: ''
  };
  result.markdown = renderMarkdown(result);
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    if (message.tool === 'audit_theme') return await auditTheme(message.args || {});
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: errorText(error)}]
  }));
  return true;
});
