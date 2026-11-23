'use strict';

// Config Backup & Diff - copias y comparaciones de configuración local, sin red.

const PROFILE_SOURCES = [
  {
    profile: 'skills',
    root: '~/extensions',
    extensions: ['.md', '.skill'],
    maxDepth: 4
  },
  {
    profile: 'skills',
    root: '~/extension-projects',
    extensions: ['.md', '.skill'],
    maxDepth: 5
  },
  {
    profile: 'skills',
    root: '~/.codex/skills',
    extensions: ['.md'],
    maxDepth: 5
  },
  {
    profile: 'mcp',
    root: '~/.antigem_bridge/opencode',
    extensions: ['.json'],
    maxDepth: 2
  },
  {
    profile: 'mcp',
    root: '~/.gemini/config',
    extensions: ['.json'],
    maxDepth: 2
  },
  {
    profile: 'mcp',
    root: '~/.config/antigem',
    extensions: ['.json'],
    maxDepth: 3
  },
  {
    profile: 'themes',
    root: '~/.antigem',
    extensions: ['.json'],
    nameMatch: /theme|tema/i,
    maxDepth: 2
  },
  {
    profile: 'themes',
    root: '~/.config',
    extensions: ['.json'],
    nameMatch: /theme|tema/i,
    maxDepth: 3
  },
  {
    profile: 'notes',
    root: '~/notes',
    extensions: ['.md', '.txt', '.json'],
    maxDepth: 3
  },
  {
    profile: 'notes',
    root: '/sdcard/AntiGem/notes',
    extensions: ['.md', '.txt', '.json'],
    maxDepth: 3
  }
];

const PROFILE_LABELS = {
  all: {es: 'Todos', en: 'All'},
  skills: {es: 'Skills', en: 'Skills'},
  mcp: {es: 'Ajustes de MCP', en: 'MCP settings'},
  themes: {es: 'Temas accesibles', en: 'Reachable themes'},
  notes: {es: 'Notas exportadas', en: 'Exported notes'},
  custom: {es: 'Archivos elegidos', en: 'Chosen files'}
};

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(Math.min(max, Math.max(min, number)));
}

function numberInRange(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function localText(language, es, en) {
  if (language === 'es') return es;
  if (language === 'en') return en;
  return `${es} / ${en}`;
}

function profileLabel(profile, language) {
  const label = PROFILE_LABELS[profile] || PROFILE_LABELS.all;
  return localText(language, label.es, label.en);
}

function allowedPath(path) {
  const value = String(path || '').trim();
  return /^~\//.test(value) || /^\/sdcard\//.test(value);
}

function joinPath(base, relative) {
  const clean = String(relative || '').replace(/^\/+/, '');
  return clean ? `${String(base).replace(/\/+$/, '')}/${clean}` : String(base).replace(/\/+$/, '');
}

function relativePath(root, path) {
  const cleanRoot = String(root).replace(/\/+$/, '');
  const cleanPath = String(path);
  if (cleanPath === cleanRoot) return '';
  if (cleanPath.startsWith(`${cleanRoot}/`)) return cleanPath.slice(cleanRoot.length + 1);
  const parts = cleanPath.split('/');
  return parts[parts.length - 1] || cleanPath;
}

function lightHash(text) {
  let hash = 0x811c9dc5;
  const value = String(text == null ? '' : text);
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  const units = ['KiB', 'MiB', 'GiB'];
  let current = value / 1024;
  let unit = 0;
  while (current >= 1024 && unit < units.length - 1) {
    current /= 1024;
    unit++;
  }
  return `${current.toFixed(current >= 10 ? 0 : 1)} ${units[unit]}`;
}

function addWarning(warnings, code, es, en, path = '') {
  warnings.push({code, severity: 'warning', path: String(path || ''), message: en, message_es: es});
}

async function loadStored(key) {
  const values = await chrome.storage.local.get(key);
  return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
}

function matchesSource(entry, source) {
  const name = entry.path.split('/').pop().toLowerCase();
  if (source.extensions && source.extensions.length &&
      !source.extensions.some(ext => name.endsWith(ext))) return false;
  if (source.nameMatch && !source.nameMatch.test(name)) return false;
  return true;
}

async function walkSource(source, options, state) {
  const sourceCap = Math.min(options.maxFiles, Math.max(1, Number(source.cap) || options.maxFiles));
  let localCount = 0;
  let resolvedRoot = String(source.root);
  try {
    const rootStat = await chrome.antigm.stat({path: source.root});
    resolvedRoot = String(rootStat.path || source.root).replace(/\/+$/, '');
  } catch (_) {
    resolvedRoot = String(source.root).replace(/\/+$/, '');
  }
  const queue = [{path: source.root, depth: 0}];
  let expandedRoot = null;
  while (queue.length && localCount < sourceCap && state.files.length < options.maxFiles &&
         state.totalBytes < options.maxTotalBytes) {
    const current = queue.shift();
    let entries;
    try {
      entries = await chrome.antigem.listFiles({path: current.path, limit: 2000});
    } catch (error) {
      addWarning(state.warnings, 'ROOT_UNREADABLE',
        `No se pudo leer ${current.path}: ${error.message}`,
        `Could not read ${current.path}: ${error.message}`, current.path);
      continue;
    }
    if (current.depth === 0 && expandedRoot === null && entries.length && entries[0].path) {
      const parts = String(entries[0].path).split('/');
      parts.pop();
      expandedRoot = parts.join('/');
    }
    for (const entry of entries) {
      if (entry.isDirectory) {
        if (current.depth + 1 <= source.maxDepth) {
          queue.push({path: entry.path || joinPath(current.path, entry.name), depth: current.depth + 1});
        }
        continue;
      }
      if (!entry.isFile || !matchesSource(entry, source)) continue;
      const size = Number(entry.size || 0);
      if (size > options.maxFileBytes) {
        addWarning(state.warnings, 'FILE_TOO_LARGE',
          `Se omitió ${entry.path} por tamaño (${formatBytes(size)}).`,
          `Skipped ${entry.path} due to size (${formatBytes(size)}).`, entry.path);
        continue;
      }
      if (state.totalBytes + size > options.maxTotalBytes) {
        addWarning(state.warnings, 'TOTAL_CAP',
          'Se alcanzó el límite total de bytes; el snapshot puede ser parcial.',
          'Reached the total byte cap; the snapshot may be partial.', current.path);
        return;
      }
      let content;
      try {
        content = String(await chrome.antigem.readFile({path: entry.path, encoding: 'utf8'}));
      } catch (error) {
        addWarning(state.warnings, 'READ_FAILED',
          `No se pudo leer ${entry.path}: ${error.message}`,
          `Could not read ${entry.path}: ${error.message}`, entry.path);
        continue;
      }
      const relative = relativePath(expandedRoot || resolvedRoot, entry.path);
      state.files.push({
        path: String(entry.path),
        writablePath: joinPath(source.root, relative),
        relative,
        size: size || content.length,
        modified: Number(entry.modified || 0),
        hash: lightHash(content),
        content
      });
      state.totalBytes += size || content.length;
      localCount++;
      if (state.files.length >= options.maxFiles) {
        addWarning(state.warnings, 'FILE_CAP',
          `Se alcanzó el límite de ${options.maxFiles} archivos.`,
          `Reached the ${options.maxFiles} file cap.`, current.path);
        return;
      }
    }
  }
  if (localCount >= sourceCap && sourceCap < options.maxFiles) {
    addWarning(state.warnings, 'SOURCE_CAP',
      `Se limitó ${source.root} a ${sourceCap} archivos para repartir el cupo.`,
      `Limited ${source.root} to ${sourceCap} files to share the cap.`, source.root);
  }
}

async function addExplicitFile(path, state) {
  const target = String(path).trim();
  if (!allowedPath(target)) {
    addWarning(state.warnings, 'PATH_REJECTED',
      `Ruta no permitida: ${target}. Usa ~/ o /sdcard/.`,
      `Path not allowed: ${target}. Use ~/ or /sdcard/.`, target);
    return;
  }
  let stat;
  try {
    stat = await chrome.antigem.stat({path: target});
  } catch (error) {
    addWarning(state.warnings, 'FILE_MISSING',
      `No existe ${target}: ${error.message}`,
      `Missing ${target}: ${error.message}`, target);
    return;
  }
  if (!stat.isFile) {
    addWarning(state.warnings, 'NOT_A_FILE', `${target} no es un archivo.`, `${target} is not a file.`, target);
    return;
  }
  const size = Number(stat.size || 0);
  if (size > state.options.maxFileBytes || state.totalBytes + size > state.options.maxTotalBytes) {
    addWarning(state.warnings, 'FILE_TOO_LARGE',
      `Se omitió ${target} por tamaño.`, `Skipped ${target} due to size.`, target);
    return;
  }
  if (state.files.some(file => file.path === String(stat.path || target))) return;
  let content;
  try {
    content = String(await chrome.antigem.readFile({path: target, encoding: 'utf8'}));
  } catch (error) {
    addWarning(state.warnings, 'READ_FAILED',
      `No se pudo leer ${target}: ${error.message}`,
      `Could not read ${target}: ${error.message}`, target);
    return;
  }
  state.files.push({
    path: String(stat.path || target),
    writablePath: target,
    relative: relativePath(target, String(stat.path || target)) || target.split('/').pop(),
    size: size || content.length,
    modified: Number(stat.modified || 0),
    hash: lightHash(content),
    content
  });
  state.totalBytes += size || content.length;
}

function renderSnapshotMarkdown(snapshot, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${t('Snapshot de configuración', 'Configuration snapshot')}`,
    '',
    `- ${t('ID', 'ID')}: \`${snapshot.snapshotId}\``,
    `- ${t('Perfil', 'Profile')}: ${profileLabel(snapshot.profile, language)}`,
    `- ${t('Archivos', 'Files')}: ${snapshot.totals.files}`,
    `- ${t('Tamaño total', 'Total size')}: ${formatBytes(snapshot.totals.bytes)}`,
    `- ${t('Guardado', 'Saved')}: ${snapshot.written ? t('sí', 'yes') : t('no (vista previa)', 'no (preview)')}`,
    '',
    '| ' + t('Ruta relativa', 'Relative path') + ' | ' + t('Tamaño', 'Size') + ' | Hash |',
    '| --- | --- | --- |'
  ];
  for (const file of snapshot.files) {
    lines.push(`| \`${file.relative}\` | ${formatBytes(file.size)} | \`${file.hash}\` |`);
  }
  if (snapshot.warnings.length) {
    lines.push('', `## ${t('Avisos', 'Warnings')}`, '');
    for (const warning of snapshot.warnings) {
      lines.push(`- **${warning.code}** ${localText(language, warning.message_es, warning.message)} ` +
        `${warning.path ? `\`${warning.path}\`` : ''}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function configSnapshot(args) {
  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  const profile = ['all', 'skills', 'mcp', 'themes', 'notes', 'custom'].includes(args.profile)
    ? args.profile : 'all';
  const options = {
    maxFiles: clamp(args.max_files, 1, 2000, 500),
    maxFileBytes: clamp(args.max_file_bytes, 1024, 8388608, 1048576),
    maxTotalBytes: clamp(args.max_total_bytes, 65536, 67108864, 16777216)
  };
  const state = {files: [], totalBytes: 0, warnings: [], options};
  const selected = profile === 'all' ? PROFILE_SOURCES :
    profile === 'custom' ? [] : PROFILE_SOURCES.filter(source => source.profile === profile);
  const perSource = profile === 'all'
    ? Math.max(5, Math.floor(options.maxFiles / Math.max(1, selected.length)))
    : options.maxFiles;
  const wanted = selected.map(source => ({...source, cap: perSource}));
  for (const source of wanted) await walkSource(source, options, state);

  for (const root of Array.isArray(args.roots) ? args.roots : []) {
    if (!allowedPath(root)) {
      addWarning(state.warnings, 'PATH_REJECTED',
        `Ruta no permitida: ${root}.`, `Path not allowed: ${root}.`, root);
      continue;
    }
    await walkSource({root: String(root).replace(/\/+$/, ''), extensions: null, maxDepth: 6}, options, state);
  }
  for (const file of Array.isArray(args.files) ? args.files : []) {
    await addExplicitFile(file, state);
  }

  if ((profile === 'all' || profile === 'notes') && state.files.length &&
      !state.files.some(file => file.path.toLowerCase().includes('/notes/'))) {
    addWarning(state.warnings, 'NOTES_PRIVATE_STORE',
      'Las notas de la app están en almacenamiento privado; exporta un .md/.txt a ~/notes o usa files.',
      'App notes live in private storage; export a .md/.txt to ~/notes or use files.');
  }
  if ((profile === 'all' || profile === 'themes') &&
      !state.files.some(file => /theme|tema/i.test(file.path))) {
    addWarning(state.warnings, 'THEMES_PRIVATE_STORE',
      'Los temas personalizados están en preferencias privadas; guarda un JSON de tema bajo ~/.antigem o usa files.',
      'Custom themes live in private preferences; save a theme JSON under ~/.antigem or use files.');
  }

  const snapshot = {
    format: 'antigem-config-snapshot',
    version: 1,
    snapshotId: `cfg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    profile,
    language,
    sources: wanted.map(source => ({root: source.root, profile: source.profile})),
    warnings: state.warnings,
    totals: {files: state.files.length, bytes: state.totalBytes},
    files: state.files,
    written: false,
    path: null
  };
  if (String(args.output || '').trim() && args.dry_run === false) {
    snapshot.path = String(args.output).trim();
    await chrome.antigem.writeFile({
      path: snapshot.path,
      data: JSON.stringify(snapshot, null, 2),
      encoding: 'utf8'
    });
    snapshot.written = true;
  }
  snapshot.markdown = renderSnapshotMarkdown(snapshot, language);
  await chrome.storage.local.set({
    [`snapshots.${snapshot.snapshotId}`]: snapshot,
    'lastSnapshot': snapshot.snapshotId
  });
  return snapshot;
}

function splitLines(text) {
  return String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
}

function simpleDiff(left, right) {
  const ops = [];
  for (const line of left) ops.push({type: 'remove', text: line, leftNo: ops.length + 1, rightNo: null});
  for (const line of right) ops.push({type: 'add', text: line, leftNo: null, rightNo: ops.length + 1});
  return ops;
}

function diffOps(left, right) {
  if (left.length * right.length > 1600000) return simpleDiff(left, right);
  const rows = left.length + 1;
  const cols = right.length + 1;
  const table = Array.from({length: rows}, () => new Uint16Array(cols));
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      table[i][j] = left[i] === right[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  let leftNo = 1;
  let rightNo = 1;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      ops.push({type: 'equal', text: left[i], leftNo: leftNo++, rightNo: rightNo++});
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      ops.push({type: 'remove', text: left[i], leftNo: leftNo++, rightNo: null});
      i++;
    } else {
      ops.push({type: 'add', text: right[j], leftNo: null, rightNo: rightNo++});
      j++;
    }
  }
  while (i < left.length) {
    ops.push({type: 'remove', text: left[i], leftNo: leftNo++, rightNo: null});
    i++;
  }
  while (j < right.length) {
    ops.push({type: 'add', text: right[j], leftNo: null, rightNo: rightNo++});
    j++;
  }
  return ops;
}

function unifiedDiff(leftText, rightText, context, maxLines) {
  const left = splitLines(leftText);
  const right = splitLines(rightText);
  const ops = diffOps(left, right);
  const changeIndexes = ops.map((op, index) => op.type === 'equal' ? -1 : index).filter(index => index >= 0);
  if (!changeIndexes.length) return {text: '', lines: 0, truncated: false};

  const blocks = [];
  let start = changeIndexes[0];
  let end = start;
  for (const index of changeIndexes.slice(1)) {
    if (index <= end + 1) {
      end = index;
    } else {
      blocks.push([start, end]);
      start = index;
      end = index;
    }
  }
  blocks.push([start, end]);

  const hunks = [];
  let truncated = false;
  let totalLines = 0;
  for (const [rawStart, rawEnd] of blocks) {
    const from = Math.max(0, rawStart - context);
    const to = Math.min(ops.length - 1, rawEnd + context);
    if (hunks.length && from <= hunks[hunks.length - 1].to + 1) {
      hunks[hunks.length - 1].to = to;
      continue;
    }
    hunks.push({from, to});
  }

  const chunks = [];
  for (const hunk of hunks) {
    const lines = ops.slice(hunk.from, hunk.to + 1);
    const leftStart = lines.find(op => op.leftNo !== null)?.leftNo || 0;
    const rightStart = lines.find(op => op.rightNo !== null)?.rightNo || 0;
    const leftCount = lines.filter(op => op.type !== 'add').length;
    const rightCount = lines.filter(op => op.type !== 'remove').length;
    const body = lines.map(op => {
      const prefix = op.type === 'add' ? '+' : op.type === 'remove' ? '-' : ' ';
      return `${prefix}${op.text}`;
    });
    if (totalLines + body.length + 1 > maxLines) {
      truncated = true;
      break;
    }
    totalLines += body.length + 1;
    chunks.push([
      `@@ -${leftStart},${leftCount} +${rightStart},${rightCount} @@`,
      ...body
    ].join('\n'));
  }
  if (truncated && !chunks.length) {
    chunks.push(`@@ -1,0 +1,0 @@\n+${localText('en', 'Diff truncado', 'Diff truncated')}`);
  }
  return {text: `${chunks.join('\n\n')}\n`, lines: totalLines, truncated};
}

async function resolveSnapshot(value, side, fallbackId) {
  if (value && typeof value === 'object' && Array.isArray(value.files)) return value;
  const ref = String(value || '').trim();
  if (!ref && fallbackId) {
    return await loadStored(`snapshots.${fallbackId}`);
  }
  if (!ref) return null;
  if (/^~\//.test(ref) || /^\/sdcard\//.test(ref)) {
    const raw = String(await chrome.antigem.readFile({path: ref, encoding: 'utf8'}));
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.files)) {
      throw new Error(`El archivo no es un snapshot válido: ${ref} / Not a valid snapshot: ${ref}`);
    }
    return parsed;
  }
  const stored = await loadStored(`snapshots.${ref}`);
  if (!stored) throw new Error(`No existe el snapshot ${side}: ${ref} / Snapshot ${side} not found: ${ref}`);
  return stored;
}

function renderDiffMarkdown(diff, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${t('Diferencias de configuración', 'Configuration diff')}`,
    '',
    `- ${t('Base', 'Base')}: \`${diff.base.snapshotId || 'inline'}\``,
    `- ${t('Destino', 'Target')}: \`${diff.target.snapshotId || 'inline'}\``,
    `- ${t('Añadidos', 'Added')}: ${diff.summary.added}`,
    `- ${t('Eliminados', 'Removed')}: ${diff.summary.removed}`,
    `- ${t('Modificados', 'Modified')}: ${diff.summary.modified}`,
    `- ${t('Sin cambios', 'Unchanged')}: ${diff.summary.unchanged}`,
    '',
    '| ' + t('Estado', 'Status') + ' | ' + t('Ruta', 'Path') + ' | ' + t('Tamaño', 'Size') + ' |',
    '| --- | --- | --- |'
  ];
  for (const change of diff.changes) {
    lines.push(`| ${change.status.toUpperCase()} | \`${change.path}\` | ` +
      `${formatBytes(change.sizeBefore)} → ${formatBytes(change.sizeAfter)} |`);
  }
  const withDiff = diff.changes.filter(change => change.diff).slice(0, 12);
  for (const change of withDiff) {
    lines.push('', `## ${change.status.toUpperCase()} \`${change.path}\``, '', '```diff', change.diff.trim(), '```');
  }
  if (diff.truncated) {
    lines.push('', t('Algunos diffs se recortaron por el límite de líneas.',
      'Some diffs were truncated by the line limit.'));
  }
  return `${lines.join('\n')}\n`;
}

async function configDiff(args) {
  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  const context = clamp(args.context, 0, 20, 3);
  const maxLines = clamp(args.max_lines, 50, 5000, 500);
  const lastId = await loadStored('lastSnapshot');
  const base = await resolveSnapshot(args.base_snapshot || args.base || null, 'base', lastId);
  const target = await resolveSnapshot(args.target_snapshot || args.target || null, 'target', null);
  if (!base || !target) {
    throw new Error('Faltan snapshots para comparar / Missing snapshots to compare');
  }

  const baseMap = new Map(base.files.map(file => [file.relative || file.path, file]));
  const targetMap = new Map(target.files.map(file => [file.relative || file.path, file]));
  const paths = [...new Set([...baseMap.keys(), ...targetMap.keys()])].sort();
  const changes = [];
  const summary = {added: 0, removed: 0, modified: 0, unchanged: 0};
  let truncated = false;

  for (const path of paths) {
    const before = baseMap.get(path) || null;
    const after = targetMap.get(path) || null;
    if (!before) {
      summary.added++;
      const result = unifiedDiff('', after.content, context, maxLines);
      truncated = truncated || result.truncated;
      changes.push({
        status: 'added', path,
        sizeBefore: 0, sizeAfter: after.size || 0,
        diff: result.text, lines: result.lines
      });
    } else if (!after) {
      summary.removed++;
      const result = unifiedDiff(before.content, '', context, maxLines);
      truncated = truncated || result.truncated;
      changes.push({
        status: 'removed', path,
        sizeBefore: before.size || 0, sizeAfter: 0,
        diff: result.text, lines: result.lines
      });
    } else if (before.hash !== after.hash) {
      summary.modified++;
      const result = unifiedDiff(before.content, after.content, context, maxLines);
      truncated = truncated || result.truncated;
      changes.push({
        status: 'modified', path,
        sizeBefore: before.size || 0, sizeAfter: after.size || 0,
        diff: result.text, lines: result.lines
      });
    } else {
      summary.unchanged++;
    }
  }

  const rank = {modified: 0, added: 1, removed: 2};
  changes.sort((a, b) => (rank[a.status] - rank[b.status]) || a.path.localeCompare(b.path));
  const diff = {
    diffId: `diff_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    language, context, maxLines,
    base: {snapshotId: base.snapshotId || null, profile: base.profile || null},
    target: {snapshotId: target.snapshotId || null, profile: target.profile || null},
    summary, changes, truncated,
    written: false,
    path: null
  };
  if (String(args.output || '').trim() && args.dry_run === false) {
    diff.path = String(args.output).trim();
    diff.markdown = renderDiffMarkdown(diff, language);
    await chrome.antigem.writeFile({path: diff.path, data: diff.markdown, encoding: 'utf8'});
    diff.written = true;
  }
  diff.markdown = renderDiffMarkdown(diff, language);
  await chrome.storage.local.set({
    [`diffs.${diff.diffId}`]: diff,
    lastDiff: diff.diffId
  });
  return diff;
}

function renderRestoreMarkdown(result, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${t('Restauración selectiva', 'Selective restore')}`,
    '',
    `- ${t('Snapshot', 'Snapshot')}: \`${result.snapshotId}\``,
    `- ${t('Modo', 'Mode')}: ${result.written ? t('escritura', 'write') : t('simulación', 'simulation')}`,
    `- ${t('Archivos', 'Files')}: ${result.summary.files}`,
    `- ${t('Copias .bak', '.bak copies')}: ${result.summary.backups}`,
    '',
    '| ' + t('Estado', 'Status') + ' | ' + t('Destino', 'Target') + ' | ' + t('Tamaño', 'Size') + ' |',
    '| --- | --- | --- |'
  ];
  for (const action of result.actions) {
    lines.push(`| ${action.status.toUpperCase()} | \`${action.path}\` | ${formatBytes(action.bytes)} |`);
    if (action.reason) lines.push(`|  |  ${action.reason} |  |`);
  }
  return `${lines.join('\n')}\n`;
}

async function configRestore(args) {
  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  const snapshotRef = String(args.snapshot || '').trim();
  const lastId = await loadStored('lastSnapshot');
  const snapshot = await resolveSnapshot(snapshotRef || lastId || null, 'snapshot', null);
  if (!snapshot) throw new Error('No hay un snapshot disponible / No snapshot available');

  const requested = Array.isArray(args.files) ? args.files.map(String) : [];
  const selected = requested.length
    ? snapshot.files.filter(file => requested.includes(file.relative) || requested.includes(file.path) ||
        requested.includes(file.writablePath))
    : snapshot.files.slice();
  if (!selected.length) throw new Error('No hay archivos para restaurar / No files to restore');

  const targetDir = String(args.target_dir || '').trim();
  if (targetDir && !allowedPath(targetDir)) {
    throw new Error('target_dir debe empezar por ~/ o /sdcard/ / target_dir must start with ~/ or /sdcard/');
  }
  const withBackup = args.backup !== false;
  const write = args.dry_run === false;
  const actions = [];
  let backups = 0;

  for (const file of selected) {
    const basePath = file.writablePath || file.path;
    const path = targetDir ? joinPath(targetDir, file.relative || basePath.split('/').pop()) : basePath;
    if (!allowedPath(path)) {
      actions.push({status: 'skipped', path, bytes: 0, reason: 'Ruta no permitida / Path not allowed'});
      continue;
    }
    const content = String(file.content == null ? '' : file.content);
    if (!write) {
      actions.push({status: 'preview', path, bytes: content.length, backup: withBackup});
      continue;
    }
    let backedUp = false;
    if (withBackup) {
      try {
        const current = await chrome.antigem.readFile({path, encoding: 'utf8'});
        if (String(current).length) {
          await chrome.antigem.writeFile({path: `${path}.bak`, data: current, encoding: 'utf8'});
          backedUp = true;
          backups++;
        }
      } catch (_) {
        backedUp = false;
      }
    }
    try {
      await chrome.antigem.writeFile({path, data: content, encoding: 'utf8'});
      actions.push({status: 'restored', path, bytes: content.length, backup: backedUp});
    } catch (error) {
      actions.push({status: 'failed', path, bytes: content.length, reason: error.message || String(error)});
    }
  }

  const result = {
    restoreId: `restore_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    language,
    snapshotId: snapshot.snapshotId || null,
    targetDir: targetDir || null,
    written: write,
    actions,
    summary: {
      files: selected.length,
      restored: actions.filter(action => action.status === 'restored').length,
      previews: actions.filter(action => action.status === 'preview').length,
      failed: actions.filter(action => action.status === 'failed').length,
      backups
    }
  };
  result.markdown = renderRestoreMarkdown(result, language);
  await chrome.storage.local.set({
    [`restores.${result.restoreId}`]: result,
    lastRestore: result.restoreId
  });
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    const args = message.args || {};
    if (message.tool === 'config_snapshot') return await configSnapshot(args);
    if (message.tool === 'config_diff') return await configDiff(args);
    if (message.tool === 'config_restore') return await configRestore(args);
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: error && error.message ? error.message : String(error)}]
  }));
  return true;
});
