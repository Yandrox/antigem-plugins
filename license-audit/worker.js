'use strict';

// License Audit — revisión de licencias de terceros, sin red y sin firma legal.

const DEFAULT_SKIP = ['.git', '.hg', '.svn', '.cache', '__pycache__', '.gradle', '.idea'];
const SOURCE_EXT = new Set([
  'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'kt', 'kts', 'java', 'py', 'dart',
  'c', 'cc', 'cpp', 'cxx', 'h', 'hpp', 'm', 'mm', 'go', 'rs', 'rb', 'php',
  'swift', 'cs', 'sh', 'html', 'css', 'vue', 'svelte', 'json', 'yaml', 'yml'
]);
const LICENSE_NAME = /^(license|licence|copying|notice)(\.[a-z0-9]+)?$/i;
const LIST_LIMIT = 500;

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

function isLocalPath(value) {
  // The native API accepts ~/..., /sdcard/... and absolute paths inside the
  // terminal home; it rejects anything else itself.
  return /^(~\/|\/)/.test(String(value || '').trim());
}

function errorText(error) {
  return error && error.message ? error.message : String(error);
}

function joinPath(base, name) {
  return String(base).replace(/\/+$/, '') + '/' + name;
}

function relPath(root, dir) {
  if (dir === root) return '.';
  const prefix = String(root).replace(/\/+$/, '') + '/';
  return String(dir).startsWith(prefix) ? String(dir).slice(prefix.length) : String(dir);
}

/* ------------------------------------------------------------------ */
/* Licencias                                                           */
/* ------------------------------------------------------------------ */

function familyOf(value) {
  const id = String(value || '');
  if (/AGPL|SSPL|BUSL/i.test(id)) return 'copyleft';
  if (/LGPL/i.test(id)) return 'weak';
  if (/MPL|EPL|CDDL/i.test(id)) return 'weak';
  if (/GPL/i.test(id)) return 'copyleft';
  if (/CC-BY-NC|Proprietary|All.?Rights.?Reserved/i.test(id)) return 'restricted';
  if (/MIT|Apache|BSD|ISC|Unlicense|CC0|Zlib|0BSD/i.test(id)) return 'permissive';
  return 'unknown';
}

function statusOf(family, hasLicense) {
  if (!hasLicense) return 'missing';
  if (family === 'permissive') return 'compatible';
  if (family === 'weak') return 'review';
  if (family === 'copyleft' || family === 'restricted') return 'incompatible';
  return 'unknown';
}

function detectLicense(text) {
  if (!text) return null;
  const head = String(text).slice(0, 24000);
  const spdx = head.match(/SPDX-License-Identifier:\s*([A-Za-z0-9.+*-]+)/i);
  if (spdx) {
    const id = spdx[1].replace(/^(only|or-later)$/i, '') || spdx[1];
    return {id, family: familyOf(id), source: 'SPDX'};
  }
  const has = regex => regex.test(head);
  if (has(/affero general public license/i)) {
    const id = /version\s*1(?:\.0)?/i.test(head) ? 'AGPL-1.0' : 'AGPL-3.0';
    return {id, family: 'copyleft', source: 'header'};
  }
  if (has(/server side public license|\bSSPL\b/i)) {
    return {id: 'SSPL-1.0', family: 'copyleft', source: 'header'};
  }
  if (has(/business source license|\dBUSL\b/i)) {
    return {id: 'BUSL-1.1', family: 'copyleft', source: 'header'};
  }
  if (has(/lesser general public license|library general public license/i)) {
    let id = 'LGPL-2.1';
    if (/version\s*3/i.test(head)) id = 'LGPL-3.0';
    else if (/version\s*2\.1/i.test(head)) id = 'LGPL-2.1';
    else if (/version\s*2/i.test(head)) id = 'LGPL-2.0';
    return {id, family: 'weak', source: 'header'};
  }
  if (has(/mozilla public license/i)) {
    return {id: 'MPL-2.0', family: 'weak', source: 'header'};
  }
  if (has(/eclipse public license/i)) {
    return {id: /version\s*2/i.test(head) ? 'EPL-2.0' : 'EPL-1.0', family: 'weak', source: 'header'};
  }
  if (has(/common development and distribution license/i)) {
    return {id: 'CDDL-1.0', family: 'weak', source: 'header'};
  }
  if (has(/gnu general public license/i)) {
    let id = 'GPL-3.0';
    if (/version\s*2/i.test(head)) id = 'GPL-2.0';
    else if (/version\s*3/i.test(head)) id = 'GPL-3.0';
    return {id, family: 'copyleft', source: 'header'};
  }
  if (has(/apache license/i)) {
    return {id: /version\s*2/i.test(head) ? 'Apache-2.0' : 'Apache', family: 'permissive', source: 'header'};
  }
  if (has(/mit license|permission is hereby granted, free of charge/i)) {
    return {id: 'MIT', family: 'permissive', source: 'header'};
  }
  if (has(/redistribution and use in source and binary forms/i)) {
    return {id: /neither the name/i.test(head) ? 'BSD-3-Clause' : 'BSD-2-Clause',
      family: 'permissive', source: 'header'};
  }
  if (has(/\bISC license\b/i)) return {id: 'ISC', family: 'permissive', source: 'header'};
  if (has(/unlicense|this is free and unencumbered software/i)) {
    return {id: 'Unlicense', family: 'permissive', source: 'header'};
  }
  if (has(/creative commons zero|\bCC0\b/i)) {
    return {id: 'CC0-1.0', family: 'permissive', source: 'header'};
  }
  if (has(/zlib license/i)) return {id: 'Zlib', family: 'permissive', source: 'header'};
  if (has(/creative commons attribution-noncommercial/i)) {
    return {id: 'CC-BY-NC', family: 'restricted', source: 'header'};
  }
  if (has(/\bproprietary\b|all rights reserved/i)) {
    return {id: 'Proprietary', family: 'restricted', source: 'header'};
  }
  return null;
}

function normalizeSpdx(value) {
  if (!value) return null;
  if (typeof value === 'object') return value.type ? String(value.type) : null;
  const raw = String(value).trim().replace(/[()]/g, '');
  const first = raw.split(/\s+OR\s+/i)[0].trim();
  return first || null;
}

function parsePackage(text) {
  let json;
  try { json = JSON.parse(text); } catch (error) { return null; }
  if (!json || typeof json !== 'object') return null;
  const repo = typeof json.repository === 'string'
    ? json.repository
    : (json.repository && json.repository.url) || null;
  const author = typeof json.author === 'string'
    ? json.author
    : (json.author && json.author.name) || null;
  return {
    name: typeof json.name === 'string' ? json.name : null,
    version: typeof json.version === 'string' ? json.version : null,
    license: json.license || (Array.isArray(json.licenses) ? json.licenses[0] : null),
    repository: repo,
    author
  };
}

/* ------------------------------------------------------------------ */
/* Lectura acotada                                                     */
/* ------------------------------------------------------------------ */

async function readHead(path, maxBytes) {
  let info;
  try { info = await chrome.antigem.stat({path}); }
  catch (error) { return {text: null, error: errorText(error)}; }
  if (!info.isFile) return {text: null, error: 'not a file'};
  if (info.size > maxBytes) return {text: null, skipped: true, size: info.size};
  try {
    return {text: await chrome.antigem.readFile({path, encoding: 'utf8'}), size: info.size};
  } catch (error) {
    return {text: null, error: errorText(error)};
  }
}

function sourceMarkers(text) {
  const head = String(text).slice(0, 24000);
  const copied = head.match(/\b(copied|adapted|taken|ported|based)\s+from\b[^\n]{0,180}/i);
  const source = head.match(/\bsource:\s*https?:\/\/\S+/i);
  return {
    copyright: /\bcopyright\b/i.test(head),
    copiedFrom: copied ? copied[0].trim() : (source ? source[0].trim() : null)
  };
}

/* ------------------------------------------------------------------ */
/* Escaneo                                                             */
/* ------------------------------------------------------------------ */

async function scan(args) {
  const root = String(args.root || '').trim();
  if (!isLocalPath(root)) {
    throw new Error('root debe empezar por ~/ o /sdcard/ / root must start with ~/ or /sdcard/');
  }
  let rootStat;
  try { rootStat = await chrome.antigem.stat({path: root}); }
  catch (error) { throw new Error(`root no encontrado / root not found: ${root} — ${errorText(error)}`); }
  if (rootStat.isFile) throw new Error('root debe ser un directorio / root must be a directory');

  const language = langOf(args.language);
  const target = ['MIT', 'Apache-2.0', 'BSD', 'any'].includes(args.target_license) ? args.target_license : 'MIT';
  const maxFiles = clamp(args.max_files, 1, 2000, 400);
  const maxDirs = clamp(args.max_dirs, 1, 2000, 300);
  const maxDepth = clamp(args.max_depth, 1, 20, 6);
  const maxBytes = clamp(args.max_bytes_per_file, 1024, 8388608, 131072);
  const skip = Array.isArray(args.exclude_dirs)
    ? args.exclude_dirs.map(name => String(name).toLowerCase())
    : DEFAULT_SKIP.slice();

  const components = new Map();
  const stats = {dirs: 0, filesRead: 0, filesSkipped: 0, dirsSkipped: 0, entriesTruncated: 0};
  const warnings = [];
  const getComponent = dir => {
    if (!components.has(dir)) {
      components.set(dir, {
        dir, rel: relPath(root, dir), package: null, licenseFiles: [], sources: [], filesRead: 0
      });
    }
    return components.get(dir);
  };

  const queue = [{path: root, depth: 0}];
  const visited = new Set();

  while (queue.length && stats.dirs < maxDirs && stats.filesRead < maxFiles) {
    const current = queue.shift();
    if (visited.has(current.path)) continue;
    visited.add(current.path);
    stats.dirs++;

    let entries;
    try {
      entries = await chrome.antigem.listFiles({path: current.path, limit: LIST_LIMIT});
    } catch (error) {
      warnings.push(`No se pudo listar / could not list ${current.path}: ${errorText(error)}`);
      continue;
    }
    if (entries.length >= LIST_LIMIT) {
      stats.entriesTruncated++;
      warnings.push(`Listado recortado en ${current.path} (${LIST_LIMIT} entradas) / listing truncated`);
    }

    const childDirs = [];
    for (const entry of entries) {
      if (entry.isDirectory) {
        if (skip.includes(String(entry.name).toLowerCase())) {
          stats.dirsSkipped++;
          continue;
        }
        if (current.depth < maxDepth) childDirs.push({path: entry.path, depth: current.depth + 1});
        continue;
      }
      if (!entry.isFile || stats.filesRead >= maxFiles) continue;

      const name = String(entry.name || '');
      const lower = name.toLowerCase();
      const ext = lower.includes('.') ? lower.split('.').pop() : '';
      const isPackage = lower === 'package.json';
      const isLicense = LICENSE_NAME.test(name);
      if (!isPackage && !isLicense && !SOURCE_EXT.has(ext)) continue;

      const component = getComponent(current.path);
      const read = await readHead(entry.path, maxBytes);
      if (read.skipped) {
        stats.filesSkipped++;
        continue;
      }
      if (read.error) {
        warnings.push(`No se pudo leer / could not read ${entry.path}: ${read.error}`);
        continue;
      }
      if (!read.text) continue;
      stats.filesRead++;
      component.filesRead++;

      if (isPackage) {
        const parsed = parsePackage(read.text);
        if (parsed) component.package = parsed;
        else warnings.push(`package.json inválido / invalid package.json en ${entry.path}`);
      } else if (isLicense) {
        const detected = detectLicense(read.text);
        component.licenseFiles.push({
          name, path: entry.path, license: detected ? detected.id : null,
          family: detected ? detected.family : 'unknown'
        });
      } else {
        const markers = sourceMarkers(read.text);
        const detected = detectLicense(read.text);
        if (detected || markers.copyright || markers.copiedFrom) {
          component.sources.push({
            path: entry.path,
            license: detected ? detected.id : null,
            family: detected ? detected.family : 'unknown',
            copyright: markers.copyright,
            copiedFrom: markers.copiedFrom
          });
        }
      }
    }
    for (const dir of childDirs) queue.push(dir);
  }

  if (stats.dirs >= maxDirs) warnings.push(`Límite de directorios alcanzado (${maxDirs}) / directory limit reached`);
  if (stats.filesRead >= maxFiles) warnings.push(`Límite de archivos alcanzado (${maxFiles}) / file limit reached`);

  const order = {incompatible: 0, review: 1, missing: 2, unknown: 3, compatible: 4};
  const results = [];
  for (const component of components.values()) {
    const packageLicense = component.package ? normalizeSpdx(component.package.license) : null;
    let licenseId = null;
    let licenseSource = null;
    let family = 'missing';

    if (packageLicense) {
      licenseId = packageLicense;
      licenseSource = 'package.json';
      family = familyOf(licenseId);
    } else {
      const licenseFile = component.licenseFiles.find(item => item.license);
      if (licenseFile) {
        licenseId = licenseFile.license;
        licenseSource = licenseFile.name;
        family = licenseFile.family;
      } else {
        const sourceHit = component.sources.find(item => item.license);
        if (sourceHit) {
          licenseId = sourceHit.license;
          licenseSource = sourceHit.path;
          family = sourceHit.family;
        }
      }
    }

    const attributionRisks = [];
    if (!licenseId) {
      const withCopyright = component.sources.filter(item => item.copyright);
      if (withCopyright.length) {
        attributionRisks.push({
          type: 'copyright_without_license', count: withCopyright.length,
          example: withCopyright[0].path
        });
      }
    }
    for (const item of component.sources.filter(source => source.copiedFrom)) {
      attributionRisks.push({type: 'copied_from_without_attribution',
        path: item.path, evidence: item.copiedFrom});
    }

    const conflicts = [];
    if (packageLicense) {
      for (const file of component.licenseFiles.filter(item => item.license)) {
        if (normalizeSpdx(file.license) !== packageLicense) {
          conflicts.push({package: packageLicense, file: file.license, path: file.path});
        }
      }
    }

    results.push({
      path: component.rel,
      name: component.package && component.package.name ? component.package.name : component.rel,
      version: component.package && component.package.version ? component.package.version : null,
      repository: component.package ? component.package.repository : null,
      author: component.package ? component.package.author : null,
      license: licenseId,
      licenseSource,
      family,
      status: statusOf(family, Boolean(licenseId)),
      filesRead: component.filesRead,
      attributionRisks,
      conflicts
    });
  }
  results.sort((a, b) => (order[a.status] - order[b.status]) || String(a.path).localeCompare(String(b.path)));

  const summary = {
    components: results.length,
    compatible: results.filter(item => item.status === 'compatible').length,
    review: results.filter(item => item.status === 'review').length,
    incompatible: results.filter(item => item.status === 'incompatible').length,
    unknown: results.filter(item => item.status === 'unknown').length,
    missing: results.filter(item => item.status === 'missing').length,
    attributionRisks: results.reduce((total, item) => total + item.attributionRisks.length, 0),
    conflicts: results.reduce((total, item) => total + item.conflicts.length, 0)
  };

  return {
    format: 'antigem-license-audit',
    version: 1,
    createdAt: Date.now(),
    language, root, target_license: target,
    stats, summary, warnings, components: results,
    written: false, output: null, markdown: ''
  };
}

/* ------------------------------------------------------------------ */
/* Informe                                                             */
/* ------------------------------------------------------------------ */

function cell(value) {
  return String(value === null || value === undefined ? '-' : value)
    .replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function renderMarkdown(result) {
  const t = (es, en) => localText(result.language, es, en);
  const lines = [
    `# ${t('Avisos de terceros', 'Third-party notices')}`, '',
    `- ${t('Raíz', 'Root')}: \`${result.root}\``,
    `- ${t('Licencia objetivo', 'Target licence')}: **${result.target_license}**`,
    `- ${t('Generado', 'Generated')}: ${new Date(result.createdAt).toISOString()}`,
    `- ${t('Modo', 'Mode')}: ${result.written ? t('escrito', 'written') : t('previsualización', 'preview')}`,
    '',
    `## ${t('Resumen', 'Summary')}`, '',
    `- ${t('Componentes', 'Components')}: ${result.summary.components}`,
    `- ${t('Compatibles', 'Compatible')}: ${result.summary.compatible} · ` +
      `${t('Revisión', 'Review')}: ${result.summary.review} · ` +
      `${t('Incompatibles', 'Incompatible')}: ${result.summary.incompatible}`,
    `- ${t('Desconocidas', 'Unknown')}: ${result.summary.unknown} · ` +
      `${t('Sin licencia', 'Missing')}: ${result.summary.missing}`,
    `- ${t('Riesgos de atribución', 'Attribution risks')}: ${result.summary.attributionRisks} · ` +
      `${t('Conflictos', 'Conflicts')}: ${result.summary.conflicts}`,
    `- ${t('Archivos leídos', 'Files read')}: ${result.stats.filesRead} · ` +
      `${t('Directorios', 'Directories')}: ${result.stats.dirs} · ` +
      `${t('Omitidos por tamaño', 'Skipped by size')}: ${result.stats.filesSkipped}`,
    '',
    `## ${t('Componentes', 'Components')}`, '',
    '| ' + t('Componente', 'Component') + ' | ' + t('Versión', 'Version') + ' | ' +
      t('Licencia', 'Licence') + ' | ' + t('Estado', 'Status') + ' | ' +
      t('Evidencia', 'Evidence') + ' |',
    '| --- | --- | --- | --- | --- |'
  ];
  for (const item of result.components) {
    lines.push(`| ${cell(item.name)} | ${cell(item.version)} | ${cell(item.license)} | ` +
      `${cell(item.status)} | ${cell(item.licenseSource)} |`);
  }

  const section = (status, titleEs, titleEn, noteEs, noteEn) => {
    const list = result.components.filter(item => item.status === status);
    lines.push('', `## ${t(titleEs, titleEn)} (${list.length})`, '');
    if (!list.length) { lines.push(t(noteEs, noteEn)); return; }
    for (const item of list) {
      lines.push(`- **${item.name}** ${item.version || ''} · \`${item.path}\` · ` +
        `${cell(item.license)} · ${t('origen', 'source')}: ${cell(item.licenseSource)}`);
      if (item.repository) lines.push(`  - ${t('Repositorio', 'Repository')}: ${item.repository}`);
    }
  };
  section('incompatible', 'Incompatibles con la licencia objetivo',
    'Incompatible with the target licence', 'Ninguno. / None.');
  section('review', 'Requieren revisión (copyleft débil)',
    'Need review (weak copyleft)', 'Ninguno. / None.');
  section('missing', 'Sin licencia declarada', 'No licence declared', 'Ninguno. / None.');
  section('unknown', 'Licencia no reconocida', 'Unrecognised licence', 'Ninguno. / None.');

  lines.push('', `## ${t('Riesgos de atribución', 'Attribution risks')} (${result.summary.attributionRisks})`, '');
  let riskCount = 0;
  for (const item of result.components) {
    for (const risk of item.attributionRisks) {
      riskCount++;
      if (risk.type === 'copyright_without_license') {
        lines.push(`- [${item.path}] ${t('Copyright sin licencia', 'Copyright without licence')}: ` +
          `${risk.count} ${t('archivos, p. ej.', 'files, e.g.')} \`${risk.example}\``);
      } else {
        lines.push(`- [${item.path}] ${t('Copiado sin atribución', 'Copied without attribution')}: ` +
          `\`${risk.path}\` — ${risk.evidence}`);
      }
    }
  }
  if (!riskCount) lines.push('Ninguno. / None.');

  lines.push('', `## ${t('Conflictos de licencia', 'Licence conflicts')} (${result.summary.conflicts})`, '');
  let conflictCount = 0;
  for (const item of result.components) {
    for (const conflict of item.conflicts) {
      conflictCount++;
      lines.push(`- [${item.path}] package.json: **${conflict.package}** vs ` +
        `\`${conflict.file}\` en \`${conflict.path}\``);
    }
  }
  if (!conflictCount) lines.push('Ninguno. / None.');

  lines.push('', `## ${t('Avisos y límites', 'Warnings and limits')}`, '');
  if (!result.warnings.length) lines.push(t('Sin avisos. / No warnings.', 'Sin avisos. / No warnings.'));
  for (const warning of result.warnings) lines.push(`- ${warning}`);
  lines.push(
    `- ${t('Escaneo heurístico: no es asesoría legal.', 'Heuristic scan: not legal advice.')}`,
    `- ${t('Sin red: no se han resuelto URLs ni verificado firmas.', 'No network: URLs were not resolved or signatures verified.')}`,
    `- ${t('Los archivos grandes se omiten; una licencia puede estar en la parte no leída.', 'Large files are skipped; a licence may be in the unread part.')}`,
    `- ${t('Revisa siempre el archivo LICENSE original antes de publicar.', 'Always review the original LICENSE file before publishing.')}`
  );
  return `${lines.join('\n')}\n`;
}

/* ------------------------------------------------------------------ */
/* Herramienta                                                         */
/* ------------------------------------------------------------------ */

async function licenseScan(args) {
  const result = await scan(args);
  const output = String(args.output || '').trim();
  if (output && args.dry_run === false) {
    if (!isLocalPath(output)) {
      throw new Error('output debe empezar por ~/ o /sdcard/ / output must start with ~/ or /sdcard/');
    }
    result.written = true;
    result.output = output;
    result.markdown = renderMarkdown(result);
    await chrome.antigem.writeFile({path: output, data: result.markdown, encoding: 'utf8'});
  } else {
    result.markdown = renderMarkdown(result);
  }
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    if (message.tool === 'license_scan') return await licenseScan(message.args || {});
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: errorText(error)}]
  }));
  return true;
});
