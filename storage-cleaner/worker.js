'use strict';

// Storage Cleaner - análisis offline de almacenamiento. Nunca borra archivos.

const DEFAULT_EXCLUDES = [
  '/.git/', '/extensions/', '/extension-projects/', '/.antigem/',
  '/mini-apps/', '/Android/data/', '/Android/obb/'
];

const LEFTOVER_DIRS = new Set([
  'node_modules', 'dist', 'build', '__pycache__', 'tmp', 'temp',
  '.cache', '.gradle', 'coverage', '.next', '.nuxt', 'venv',
  '.venv', 'pods', 'bin', 'obj'
]);

const LEFTOVER_FILE_RE = /\.(zip|log|tmp|pyc|bak|old|crdownload)$/i;

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(Math.min(max, Math.max(min, number)));
}

function join(base, relative) {
  const clean = String(relative == null ? '' : relative).replace(/^\/+/, '');
  return clean ? `${base}/${clean}` : base;
}

function addIssue(issues, severity, code, es, en, path = '') {
  issues.push({severity, code, path: String(path || ''), message: en, message_es: es});
}

function textFor(language, es, en) {
  return language === 'es' ? es : language === 'en' ? en : `${es} / ${en}`;
}

function lightHash(value) {
  let hash = 0x811c9dc5;
  const input = String(value == null ? '' : value);
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let current = value / 1024;
  let unit = 0;
  while (current >= 1024 && unit < units.length - 1) {
    current /= 1024;
    unit++;
  }
  return `${current.toFixed(current >= 10 ? 0 : 1)} ${units[unit]}`;
}

async function resolveRoot(input, issues) {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) {
    addIssue(issues, 'error', 'ROOT_EMPTY', 'Ruta vacía.', 'Empty path.', raw);
    return null;
  }
  let stat;
  try {
    stat = await chrome.antigem.stat({path: raw});
  } catch (error) {
    addIssue(issues, 'error', 'ROOT_UNREADABLE', `No se pudo leer ${raw}: ${error.message}`,
      `Could not read ${raw}: ${error.message}`, raw);
    return null;
  }
  if (stat.isFile) {
    addIssue(issues, 'error', 'ROOT_NOT_DIR', `${raw} es un archivo.`, `${raw} is a file.`, raw);
    return null;
  }
  return String(stat.path || raw).replace(/\/+$/, '');
}

function isExcluded(path, patterns) {
  const lower = String(path).toLowerCase();
  return patterns.some(pattern => lower.includes(pattern.toLowerCase()));
}

async function walk(root, options, state, issues) {
  const queue = [{path: root, depth: 0}];
  while (queue.length) {
    if (state.files.length >= options.maxFiles) {
      addIssue(issues, 'warning', 'FILE_CAP',
        `Se alcanzó el límite de ${options.maxFiles} archivos; el informe puede ser parcial.`,
        `Reached the ${options.maxFiles} file cap; the report may be partial.`, root);
      break;
    }
    const current = queue.shift();
    let entries;
    try {
      entries = await chrome.antigem.listFiles({path: current.path, limit: 2000});
    } catch (error) {
      addIssue(issues, 'warning', 'LIST_FAILED', `No se pudo listar ${current.path}: ${error.message}`,
        `Could not list ${current.path}: ${error.message}`, current.path);
      continue;
    }
    if (entries.length >= 2000) {
      addIssue(issues, 'warning', 'LIST_TRUNCATED', `${current.path} tiene 2000+ entradas.`,
        `${current.path} has 2000+ entries.`, current.path);
    }
    for (const entry of entries) {
      const name = String(entry.name || '');
      const path = String(entry.path || join(current.path, name));
      if (isExcluded(path, options.exclude)) {
        state.excluded++;
        continue;
      }
      const lowerName = name.toLowerCase();
      const isLeftoverDir = Boolean(entry.isDirectory) && LEFTOVER_DIRS.has(lowerName);
      if (isLeftoverDir) {
        state.leftoverDirs.push({path, name, depth: current.depth + 1});
      }
      if (entry.isDirectory) {
        if (!isLeftoverDir && (name.startsWith('.') || lowerName === 'android')) {
          state.excluded++;
          continue;
        }
        if (current.depth + 1 > options.maxDepth) {
          state.depthSkipped++;
          continue;
        }
        state.dirs++;
        queue.push({path, depth: current.depth + 1});
      } else if (entry.isFile) {
        const file = {
          path,
          name,
          size: Number(entry.size || 0),
          modified: Number(entry.modified || 0)
        };
        state.files.push(file);
        if (LEFTOVER_FILE_RE.test(name)) {
          const extension = lowerName.slice(lowerName.lastIndexOf('.'));
          if (!state.leftoverFiles[extension]) {
            state.leftoverFiles[extension] = {extension, files: 0, bytes: 0};
          }
          state.leftoverFiles[extension].files++;
          state.leftoverFiles[extension].bytes += file.size;
        }
      }
    }
  }
}

async function findDuplicates(files, options, state, issues) {
  const bySize = new Map();
  for (const file of files) {
    if (file.size < options.minSizeBytes) continue;
    if (!bySize.has(file.size)) bySize.set(file.size, []);
    bySize.get(file.size).push(file);
  }

  const duplicates = [];
  for (const [size, candidates] of bySize) {
    if (candidates.length < 2) continue;
    const hashed = [];
    for (const file of candidates) {
      let hash = 'size-only';
      if (options.maxHashBytes > 0 && file.size <= options.maxHashBytes && state.hashed < options.maxHashes) {
        try {
          const data = await chrome.antigem.readFile({path: file.path, encoding: 'base64'});
          hash = lightHash(String(data).slice(0, 65536));
          state.hashed++;
        } catch (error) {
          hash = 'error';
          addIssue(issues, 'warning', 'HASH_FAILED', `No se pudo hashear ${file.path}: ${error.message}`,
            `Could not hash ${file.path}: ${error.message}`, file.path);
        }
      }
      hashed.push({...file, hash});
    }

    const byHash = new Map();
    for (const file of hashed) {
      if (file.hash === 'error' || file.hash === 'size-only') continue;
      if (!byHash.has(file.hash)) byHash.set(file.hash, []);
      byHash.get(file.hash).push(file);
    }
    for (const [hash, group] of byHash) {
      if (group.length < 2) continue;
      group.sort((a, b) => a.modified - b.modified || a.path.localeCompare(b.path));
      duplicates.push({
        size, hash, confirmed: true,
        wastedBytes: size * (group.length - 1),
        files: group.map(file => ({path: file.path, modified: file.modified}))
      });
    }

    const unknown = hashed.filter(file => file.hash === 'size-only' || file.hash === 'error');
    if (unknown.length >= 2) {
      unknown.sort((a, b) => a.path.localeCompare(b.path));
      duplicates.push({
        size, hash: null, confirmed: false,
        wastedBytes: size * (unknown.length - 1),
        files: unknown.map(file => ({path: file.path, modified: file.modified}))
      });
    }
  }
  duplicates.sort((a, b) => b.wastedBytes - a.wastedBytes);
  return duplicates.slice(0, 50);
}

function summarizeLeftovers(state, files) {
  const leftovers = [];
  for (const dir of state.leftoverDirs) {
    const prefix = `${dir.path}/`;
    const own = files.filter(file => file.path.startsWith(prefix));
    const bytes = own.reduce((total, file) => total + file.size, 0);
    if (bytes <= 0) continue;
    leftovers.push({path: dir.path, name: dir.name, kind: 'directory', files: own.length, bytes});
  }
  leftovers.sort((a, b) => b.bytes - a.bytes);
  const leftoverFiles = Object.values(state.leftoverFiles)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 20);
  return {leftovers: leftovers.slice(0, 30), leftoverFiles};
}

function renderScanMarkdown(scan, language) {
  const t = (es, en) => textFor(language, es, en);
  const lines = [
    `# ${t('Informe de almacenamiento', 'Storage report')}`,
    '',
    `- ${t('Raíces', 'Roots')}: ${scan.roots.map(root => `\`${root}\``).join(', ')}`,
    `- ${t('Archivos escaneados', 'Files scanned')}: ${scan.summary.files}`,
    `- ${t('Bytes analizados', 'Bytes analysed')}: ${formatBytes(scan.summary.bytes)}`,
    `- ${t('Recuperable estimado', 'Estimated reclaimable')}: **${formatBytes(scan.summary.reclaimableBytes)}**`,
    `- ${t('Estado', 'Status')}: **${scan.ok ? t('SIN ERRORES', 'NO ERRORS') : t('CON AVISOS', 'WITH WARNINGS')}**`,
    ''
  ];

  lines.push(`## ${t('Duplicados', 'Duplicates')}`, '');
  if (!scan.duplicates.length) lines.push(t('Sin duplicados.', 'No duplicates.'));
  else {
    for (const group of scan.duplicates) {
      lines.push(`- ${formatBytes(group.size)} × ${group.files.length} — ` +
        `${t('recuperable', 'reclaimable')}: ${formatBytes(group.wastedBytes)} ` +
        `(${group.confirmed ? t('hash confirmado', 'hash confirmed') : t('solo por tamaño', 'size only')})`);
      for (const file of group.files) lines.push(`  - \`${file.path}\``);
    }
  }
  lines.push('', `## ${t('Archivos grandes', 'Large files')}`, '');
  if (!scan.largeFiles.length) lines.push(t('Ninguno.', 'None.'));
  else for (const file of scan.largeFiles) {
    lines.push(`- ${formatBytes(file.size)} — \`${file.path}\``);
  }
  lines.push('', `## ${t('Restos de proyectos', 'Project leftovers')}`, '');
  if (!scan.leftovers.length) lines.push(t('Ninguno.', 'None.'));
  else for (const item of scan.leftovers) {
    lines.push(`- ${item.name}: ${formatBytes(item.bytes)} en ${item.files} ${t('archivos', 'files')} — \`${item.path}\``);
  }
  if (scan.leftoverFiles.length) {
    lines.push('');
    for (const item of scan.leftoverFiles) {
      lines.push(`- *.${item.extension}: ${formatBytes(item.bytes)} en ${item.files} ${t('archivos', 'files')}`);
    }
  }
  if (scan.issues.length) {
    lines.push('', `## ${t('Hallazgos', 'Findings')}`, '');
    for (const issue of scan.issues) {
      const body = language === 'es' ? issue.message_es : language === 'en' ? issue.message :
        `${issue.message_es} / ${issue.message}`;
      lines.push(`- **${issue.severity.toUpperCase()}** [\`${issue.code}\`] ${body}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function storageScan(args) {
  const issues = [];
  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  const rootsInput = Array.isArray(args.roots) && args.roots.length ? args.roots : ['~/', '/sdcard/'];
  const roots = [];
  for (const root of rootsInput) {
    const resolved = await resolveRoot(root, issues);
    if (resolved && !roots.includes(resolved)) roots.push(resolved);
  }
  if (!roots.length) throw new Error('No hay raíces válidas / No valid roots');

  const options = {
    minSizeBytes: clamp(args.min_size_bytes, 0, 1073741824, 1048576),
    maxFiles: clamp(args.max_files, 100, 20000, 5000),
    maxDepth: clamp(args.max_depth, 1, 20, 8),
    maxHashBytes: clamp(args.max_hash_bytes, 0, 67108864, 8388608),
    maxHashes: clamp(args.max_hashes, 0, 2000, 200),
    exclude: Array.isArray(args.exclude) && args.exclude.length
      ? args.exclude.map(String) : [...DEFAULT_EXCLUDES]
  };

  const state = {
    files: [], dirs: 0, excluded: 0, depthSkipped: 0, hashed: 0,
    leftoverDirs: [], leftoverFiles: {}
  };
  for (const root of roots) await walk(root, options, state, issues);

  const duplicates = await findDuplicates(state.files, options, state, issues);
  const largeFiles = [...state.files]
    .filter(file => file.size >= options.minSizeBytes)
    .sort((a, b) => b.size - a.size)
    .slice(0, 20)
    .map(file => ({path: file.path, size: file.size, modified: file.modified}));
  const {leftovers, leftoverFiles} = summarizeLeftovers(state, state.files);

  const bytes = state.files.reduce((total, file) => total + file.size, 0);
  const reclaimableBytes = duplicates.reduce((total, group) => total + group.wastedBytes, 0);
  const counts = {error: 0, warning: 0, info: 0};
  for (const issue of issues) counts[issue.severity] = (counts[issue.severity] || 0) + 1;

  const scan = {
    scanId: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    roots,
    options,
    ok: counts.error === 0,
    summary: {
      files: state.files.length,
      dirs: state.dirs,
      excluded: state.excluded,
      depthSkipped: state.depthSkipped,
      hashed: state.hashed,
      bytes,
      reclaimableBytes,
      duplicateGroups: duplicates.length,
      errors: counts.error,
      warnings: counts.warning
    },
    duplicates,
    largeFiles,
    leftovers,
    leftoverFiles,
    issues
  };
  scan.markdown = renderScanMarkdown(scan, language);
  await chrome.storage.local.set({[`scans.${scan.scanId}`]: scan, 'lastScan': scan.scanId});
  return scan;
}

async function loadStored(key) {
  const values = await chrome.storage.local.get(key);
  return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
}

function shellQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

function isProtectedPath(path, roots) {
  const lower = String(path).toLowerCase();
  if (roots.some(root => lower === root.toLowerCase() || lower === `${root.toLowerCase()}/`)) return true;
  return ['/extensions/', '/extension-projects/', '/.antigem/', '/mini-apps/', '/android/']
    .some(part => lower.includes(part));
}

function chooseKeep(files, strategy) {
  const sorted = [...files].sort((a, b) => {
    if (strategy === 'newest') return b.modified - a.modified;
    if (strategy === 'shortest') return a.path.length - b.path.length || a.path.localeCompare(b.path);
    return a.modified - b.modified || a.path.localeCompare(b.path);
  });
  return sorted[0];
}

function actionCommand(action) {
  if (action.type === 'review') return `REVIEW: ${action.path} — ${action.reason}`;
  return `${action.type} ${shellQuote(action.path)}`;
}

function renderPlanMarkdown(plan, language) {
  const t = (es, en) => textFor(language, es, en);
  const lines = [
    `# ${t('Plan de limpieza', 'Cleanup plan')}`,
    '',
    `- **Scan:** \`${plan.scanId}\``,
    `- ${t('Acciones', 'Actions')}: ${plan.actions.length}`,
    `- ${t('Recuperable estimado', 'Estimated reclaimable')}: **${formatBytes(plan.summary.reclaimableBytes)}**`,
    `- ${t('Ejecutado', 'Executed')}: **${plan.written ? t('solo se escribió el script', 'script written only') : t('no', 'no')}**`,
    '',
    t('Este plugin no puede borrar archivos: el plan es texto para que lo revises y lo ejecutes tú desde una terminal.',
      'This plugin cannot delete files: the plan is text for you to review and run yourself in a terminal.'),
    '',
    '## ' + t('Acciones', 'Actions'),
    ''
  ];
  if (!plan.actions.length) lines.push(t('Sin acciones.', 'No actions.'));
  else {
    for (const action of plan.actions) {
      lines.push(`- \`${action.type}\` ${formatBytes(action.bytes)} — ${action.reason}`);
      lines.push(`  - \`${action.path}\``);
    }
  }
  lines.push('', '## ' + t('Script', 'Script'), '', '```sh', plan.shellScript.trim(), '```');
  return `${lines.join('\n')}\n`;
}

async function storagePlan(args) {
  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  const scanId = args.scan || await loadStored('lastScan');
  if (!scanId) throw new Error('No hay un escaneo guardado / No saved scan');
  const scan = await loadStored(`scans.${scanId}`);
  if (!scan) throw new Error(`No existe el escaneo ${scanId} / Scan ${scanId} not found`);

  const categories = Array.isArray(args.categories) && args.categories.length
    ? args.categories.map(String) : ['duplicates', 'large', 'leftovers'];
  const strategy = ['oldest', 'newest', 'shortest'].includes(args.keep) ? args.keep : 'oldest';
  const maxActions = clamp(args.max_actions, 1, 500, 100);
  const actions = [];

  if (categories.includes('duplicates')) {
    for (const group of scan.duplicates || []) {
      if (!group.confirmed && args.include_unconfirmed !== true) continue;
      const files = (group.files || []).filter(file => !isProtectedPath(file.path, scan.roots));
      if (files.length < 2) continue;
      const keep = chooseKeep(files, strategy);
      for (const file of files) {
        if (file.path === keep.path) continue;
        actions.push({
          type: 'rm', path: file.path, bytes: group.size,
          reason: `${language === 'es' ? 'duplicado de' : 'duplicate of'} ${keep.path}`,
          confirmed: Boolean(group.confirmed)
        });
      }
    }
  }

  if (categories.includes('large')) {
    for (const file of scan.largeFiles || []) {
      if (isProtectedPath(file.path, scan.roots)) continue;
      actions.push({
        type: 'review', path: file.path, bytes: file.size,
        reason: language === 'es' ? 'archivo grande: revisar antes de borrar' : 'large file: review before deleting',
        confirmed: false
      });
    }
  }

  if (categories.includes('leftovers')) {
    for (const item of scan.leftovers || []) {
      if (isProtectedPath(item.path, scan.roots)) continue;
      actions.push({
        type: 'rm -rf', path: item.path, bytes: item.bytes,
        reason: language === 'es' ? `resto de proyecto: ${item.name}` : `project leftover: ${item.name}`,
        confirmed: true
      });
    }
    for (const item of scan.leftoverFiles || []) {
      actions.push({
        type: 'review', path: `*.${String(item.extension).replace(/^\./, '')}`, bytes: item.bytes,
        reason: language === 'es' ? 'archivos temporales: revisar' : 'temporary files: review',
        confirmed: false
      });
    }
  }

  const removalPaths = new Set(actions
    .filter(action => action.type !== 'review')
    .map(action => action.path));
  const deduped = actions.filter(action =>
    action.type !== 'review' || !removalPaths.has(action.path));
  deduped.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));
  const trimmed = deduped.slice(0, maxActions);
  const reclaimableBytes = trimmed
    .filter(action => action.type !== 'review')
    .reduce((total, action) => total + action.bytes, 0);

  const header = [
    '#!/bin/sh',
    '# Generado por Storage Cleaner. NO se ejecuta automáticamente.',
    '# Revisa cada ruta antes de quitar el # de las líneas rm.',
    'set -eu',
    ''
  ];
  const commands = trimmed.map(action =>
    `${action.type === 'review' ? '# ' : ''}${actionCommand(action)}`);
  const shellScript = `${[...header, ...commands].join('\n')}\n`;

  const plan = {
    planId: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    scanId, createdAt: Date.now(), language,
    strategy, categories,
    actions: trimmed,
    shellScript,
    summary: {
      actions: trimmed.length,
      removals: trimmed.filter(action => action.type !== 'review').length,
      reviews: trimmed.filter(action => action.type === 'review').length,
      reclaimableBytes,
      truncated: deduped.length > trimmed.length
    },
    written: false,
    path: null
  };
  plan.markdown = renderPlanMarkdown(plan, language);

  if (args.output && args.dry_run === false) {
    plan.path = String(args.output);
    await chrome.antigem.writeFile({path: plan.path, data: shellScript, encoding: 'utf8'});
    plan.written = true;
  }
  await chrome.storage.local.set({[`plans.${plan.planId}`]: plan, 'lastPlan': plan.planId});
  return plan;
}

function renderFullReport(scan, plan, language) {
  const t = (es, en) => textFor(language, es, en);
  const lines = [
    `# ${t('Informe de limpieza de almacenamiento', 'Storage cleanup report')}`,
    '',
    `- ${t('Escaneo', 'Scan')}: \`${scan.scanId}\``,
    plan ? `- ${t('Plan', 'Plan')}: \`${plan.planId}\`` : '',
    `- ${t('Recuperable estimado', 'Estimated reclaimable')}: **${formatBytes(plan ? plan.summary.reclaimableBytes : scan.summary.reclaimableBytes)}**`,
    '',
    t('No se ha borrado ningún archivo. Ejecuta las órdenes manualmente tras revisarlas.',
      'No files have been deleted. Run the commands manually after reviewing them.'),
    '',
    scan.markdown || ''
  ];
  if (plan) {
    lines.push('---', '', `## ${t('Plan de acciones', 'Action plan')}`, '');
    for (const action of plan.actions) {
      lines.push(`- \`${action.type}\` ${formatBytes(action.bytes)} — ${action.path} — ${action.reason}`);
    }
    lines.push('', '```sh', plan.shellScript.trim(), '```', '');
  }
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}

async function storageReport(args) {
  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  const scanId = args.scan || await loadStored('lastScan');
  const scan = scanId ? await loadStored(`scans.${scanId}`) : null;
  if (!scan) throw new Error('No hay un escaneo guardado / No saved scan');
  const planId = args.plan || await loadStored('lastPlan');
  const plan = args.includePlan === false ? null : (planId ? await loadStored(`plans.${planId}`) : null);
  const markdown = renderFullReport(scan, plan && plan.scanId === scan.scanId ? plan : null, language);
  let path = null;
  let written = false;
  if (args.output && args.dry_run === false) {
    path = String(args.output);
    await chrome.antigem.writeFile({path, data: markdown, encoding: 'utf8'});
    written = true;
  }
  return {ok: true, scanId, planId: plan ? plan.planId : null, path, written, markdown};
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    const args = message.args || {};
    if (message.tool === 'storage_scan') return await storageScan(args);
    if (message.tool === 'storage_plan') return await storagePlan(args);
    if (message.tool === 'storage_report') return await storageReport(args);
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: error && error.message ? error.message : String(error)}]
  }));
  return true;
});
