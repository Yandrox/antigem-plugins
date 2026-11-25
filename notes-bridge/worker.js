'use strict';

// notes-bridge — puente offline entre notes_mcp y Markdown local.
// Sin red: solo chrome.antigem (antigemFiles), Web Crypto y JS puro.
// El worker no llama a notes_mcp: procesa los datos que el agente le pasa
// y devuelve un plan de tool calls para que el agente aplique.

const DEFAULT_ROOT = '~/notes-bridge';
const DEFAULT_EXPORT = `${DEFAULT_ROOT}/export`;
const MAX_NOTES = 2000;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_READ_CHARS = 2 * 1024 * 1024;

function asText(value) {
  return value == null ? '' : String(value);
}
function both(es, en) {
  return `${es} / ${en}`;
}
function localText(language, es, en) {
  if (language === 'es') return es;
  if (language === 'en') return en;
  return both(es, en);
}
function fail(es, en) {
  throw new Error(both(es, en));
}
function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(Math.min(max, Math.max(min, number)));
}
function clampNum(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
function languageOf(value) {
  return value === 'es' || value === 'en' ? value : 'both';
}
function hex(buffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  return hex(await crypto.subtle.digest('SHA-256', bytes));
}
function hash8(text) {
  let hash = 0x811c9dc5;
  const value = asText(text);
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
function cell(value) {
  return asText(value).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}
function cleanUndefined(object) {
  for (const key of Object.keys(object)) {
    if (object[key] === undefined || object[key] === null || object[key] === '') delete object[key];
  }
  return object;
}
function normalizePath(value, kind) {
  const raw = asText(value).trim();
  if (!raw) fail('Falta la ruta', 'Path is required');
  if (raw.includes('..')) fail('La ruta no puede contener ..', 'Path cannot contain ..');
  if (!/^(~\/|\/sdcard\/|\/data\/)/.test(raw)) {
    fail('La ruta debe empezar por ~/, /sdcard/ o /data/', 'Path must start with ~/, /sdcard/ or /data/');
  }
  if (kind === 'md' && !/\.md$/i.test(raw)) fail('La ruta debe terminar en .md', 'Path must end in .md');
  return raw.replace(/\/+$/, '') || raw;
}
function fold(text) {
  return asText(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function normalizeKey(text) {
  return fold(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
function slug(text) {
  const value = normalizeKey(text).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '');
  return value || 'nota';
}
function tokens(text) {
  return new Set(normalizeKey(text).split(' ').filter(token => token.length > 1));
}
function jaccard(left, right) {
  if (!left.size || !right.size) return left.size === right.size ? 1 : 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection++;
  return intersection / (left.size + right.size - intersection);
}
function makeSnippet(text, query, radius) {
  const source = asText(text);
  const needle = fold(query);
  const index = needle ? fold(source).indexOf(needle) : -1;
  const safeRadius = Math.max(20, Number(radius) || 70);
  if (index < 0) return source.slice(0, safeRadius * 2).replace(/\s+/g, ' ').trim();
  const start = Math.max(0, index - safeRadius);
  const end = Math.min(source.length, index + needle.length + safeRadius);
  return (start > 0 ? '…' : '') + source.slice(start, end).replace(/\s+/g, ' ').trim() + (end < source.length ? '…' : '');
}

function noteContent(note) {
  return {
    kind: note.kind,
    title: note.title,
    text: note.text,
    items: note.items.map(item => ({text: item.text, done: !!item.done})),
    pinned: !!note.pinned
  };
}
function noteContentKey(note) {
  return JSON.stringify(noteContent(note));
}
function normalizeNote(raw, index) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const kind = source.kind === 'todo' || source.kind === 'list' ? 'todo' : 'note';
  let text = asText(source.text != null ? source.text : (source.body != null ? source.body : source.content));
  let previewUsed = false;
  if (!text && source.preview) {
    text = asText(source.preview);
    previewUsed = true;
  }
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const items = rawItems.map((item, itemIndex) => {
    if (item && typeof item === 'object') {
      return {
        text: asText(item.text != null ? item.text : (item.title != null ? item.title : item.value)).trim(),
        done: !!(item.done != null ? item.done : item.checked),
        item_id: asText(item.item_id || item.id).trim() || null,
        index: Number.isInteger(item.index) ? item.index : itemIndex
      };
    }
    return {text: asText(item).trim(), done: false, item_id: null, index: itemIndex};
  }).filter(item => item.text);
  let title = asText(source.title).trim();
  if (!title) title = (text.split('\n')[0] || '').slice(0, 80) || both('Sin título', 'Untitled');
  const note = {
    id: asText(source.id || source._id || source.note_id).trim() || `local_${slug(title)}_${hash8(`${kind}|${title}|${index}`)}`,
    kind,
    title,
    text,
    items,
    pinned: !!source.pinned,
    createdAt: asText(source.createdAt || source.created_at || source.created || ''),
    updatedAt: asText(source.updatedAt || source.updated_at || source.updated || ''),
    previewUsed,
    path: asText(source.path).trim() || null
  };
  note.hash8 = hash8(noteContentKey(note));
  return note;
}
function noteList(value, labelEs, labelEn) {
  if (Array.isArray(value)) return value.slice(0, MAX_NOTES);
  if (value && typeof value === 'object') return [value];
  fail(labelEs, labelEn);
}

function yamlValue(value) {
  if (Array.isArray(value)) return `[${value.map(item => JSON.stringify(asText(item))).join(', ')}]`;
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  return JSON.stringify(asText(value));
}
function parseYamlValue(raw) {
  const value = asText(raw).trim();
  if (!value) return '';
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\[.*\]$/.test(value)) {
    try { return JSON.parse(value); } catch (_) { return value.slice(1, -1).split(',').map(item => item.trim()); }
  }
  if (/^".*"$/.test(value)) {
    try { return JSON.parse(value); } catch (_) { return value.slice(1, -1); }
  }
  if (/^'.*'$/.test(value)) return value.slice(1, -1);
  return value;
}
function noteMarkdown(note) {
  const lines = [
    '---',
    `id: ${yamlValue(note.id)}`,
    `kind: ${yamlValue(note.kind)}`,
    `title: ${yamlValue(note.title)}`,
    `pinned: ${yamlValue(!!note.pinned)}`,
    `created: ${yamlValue(note.createdAt)}`,
    `updated: ${yamlValue(note.updatedAt)}`,
    `source: ${yamlValue('notes_mcp')}`,
    `content_hash: ${yamlValue(note.hash8)}`,
    '---',
    '',
    `# ${note.title}`,
    ''
  ];
  if (note.text) lines.push(note.text, '');
  if (note.kind === 'todo' && note.items.length) {
    lines.push('## Tareas / To-dos', '');
    for (const item of note.items) lines.push(`- [${item.done ? 'x' : ' '}] ${item.text.replace(/\r?\n/g, ' ')}`);
    lines.push('');
  }
  return lines.join('\n').replace(/\n+$/, '') + '\n';
}
function parseNoteMarkdown(markdown, pathFallback) {
  const lines = asText(markdown).replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines[0].trim() !== '---') return null;
  const meta = {};
  let index = 1;
  while (index < lines.length && lines[index].trim() !== '---') {
    const match = lines[index].match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (match) meta[match[1]] = parseYamlValue(match[2]);
    index++;
  }
  if (index >= lines.length || lines[index].trim() !== '---') return null;
  const body = lines.slice(index + 1).join('\n').replace(/^\s*#\s+.*(?:\n|$)/, '');
  const items = [];
  const kept = [];
  for (const line of body.split('\n')) {
    const task = line.match(/^\s*-\s*\[([ xX])\]\s*(.*)$/);
    if (task) items.push({text: task[2].trim(), done: task[1].toLowerCase() === 'x'});
    else kept.push(line);
  }
  const text = kept.join('\n').replace(/^\s*##\s+(Tareas|To-dos).*$/m, '').replace(/\n{3,}/g, '\n\n').trim();
  const note = normalizeNote({
    id: meta.id,
    kind: meta.kind,
    title: meta.title,
    text,
    items,
    pinned: meta.pinned,
    createdAt: meta.created,
    updatedAt: meta.updated
  }, 0);
  if (!asText(meta.id).trim() && pathFallback) {
    const base = String(pathFallback).split('/').pop().replace(/\.md$/i, '');
    note.id = base;
    note.hash8 = hash8(noteContentKey(note));
  }
  note.path = pathFallback || null;
  note.frontmatter = meta;
  return note;
}

async function listMarkdown(path, maxFiles, warnings, language) {
  let entries;
  try {
    entries = await chrome.antigem.listFiles({path, limit: 2000});
  } catch (error) {
    fail(`No se pudo leer ${path}: ${error.message}`, `Could not read ${path}: ${error.message}`);
  }
  const files = (Array.isArray(entries) ? entries : []).filter(entry =>
    entry && entry.isFile && /\.md$/i.test(asText(entry.name || entry.path))
  ).slice(0, maxFiles);
  const notes = [];
  for (const entry of files) {
    const filePath = asText(entry.path || `${path}/${entry.name}`);
    try {
      const raw = asText(await chrome.antigem.readFile({path: filePath, encoding: 'utf8'}));
      if (raw.length > MAX_READ_CHARS) {
        warnings.push(both(`Archivo demasiado grande: ${filePath}`, `File too large: ${filePath}`));
        continue;
      }
      const note = parseNoteMarkdown(raw, filePath);
      if (!note) warnings.push(both(`Sin frontmatter válido: ${filePath}`, `No valid frontmatter: ${filePath}`));
      else if (!notes.some(item => item.id === note.id)) notes.push(note);
    } catch (error) {
      warnings.push(both(`No se pudo leer ${filePath}: ${error.message}`, `Could not read ${filePath}: ${error.message}`));
    }
  }
  return notes;
}

function noteInfo(note, includePath) {
  const info = {
    id: note.id,
    title: note.title,
    kind: note.kind,
    updatedAt: note.updatedAt || null,
    itemCount: note.items.length,
    hash8: note.hash8
  };
  if (includePath) info.path = note.path;
  return info;
}
function pickKeep(members) {
  return members.slice().sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt) || 0;
    const rightTime = Date.parse(right.updatedAt) || 0;
    if (rightTime !== leftTime) return rightTime - leftTime;
    return right.text.length - left.text.length;
  })[0];
}
function findByTitleKind(notes, note) {
  return notes.find(item => item.kind === note.kind && fold(item.title) === fold(note.title)) || null;
}
function todoOps(existing, desired, language) {
  const operations = [];
  const currentTexts = existing.items.map(item => fold(item.text));
  const wantedTexts = desired.items.map(item => fold(item.text));
  const sameTexts = currentTexts.length === wantedTexts.length && currentTexts.every((text, index) => text === wantedTexts[index]);
  const sameDone = existing.items.every((item, index) => !!item.done === !!desired.items[index].done);
  if (sameTexts && sameDone) return operations;
  operations.push({
    tool: 'notes_update',
    args: {id: existing.id, items: desired.items.map(item => item.text)},
    destructive: true,
    reason: localText(language, 'Reemplaza la lista de tareas con la del archivo', 'Replace the to-do list with the file version')
  });
  desired.items.forEach((item, index) => {
    if (item.done) operations.push({
      tool: 'notes_todo_set_item',
      args: {id: existing.id, index, done: true},
      reason: localText(language, 'Marca la tarea como completada', 'Mark the item as done')
    });
  });
  return operations;
}

async function notesExport(args) {
  const notesRaw = noteList(args.notes,
    'No hay notas para exportar. Pasa notes desde notes_list(include_body:true) o notes_get.',
    'No notes to export. Pass notes from notes_list(include_body:true) or notes_get.');
  if (!notesRaw.length) fail('La lista de notas está vacía', 'The notes list is empty');
  const language = languageOf(args.language);
  const root = normalizePath(args.output || DEFAULT_EXPORT, 'dir');
  const dryRun = args.dry_run !== false;
  const overwrite = args.overwrite !== false;
  const notes = notesRaw.map((raw, index) => normalizeNote(raw, index));
  const warnings = [];
  notes.forEach(note => {
    if (note.previewUsed) warnings.push(both(`Nota ${note.title}: solo había preview; usa notes_list(include_body:true) para el texto completo`,
      `Note ${note.title}: only a preview was available; use notes_list(include_body:true) for full text`));
  });
  const existingPaths = new Set();
  if (!dryRun) {
    try {
      const entries = await chrome.antigem.listFiles({path: root, limit: 2000});
      for (const entry of (Array.isArray(entries) ? entries : [])) {
        if (entry && entry.isFile) existingPaths.add(asText(entry.path || `${root}/${entry.name}`));
      }
    } catch (_) {}
  }
  const files = [];
  for (const note of notes) {
    const filename = `${slug(note.title)}-${hash8(`${note.id}|${noteContentKey(note)}`).slice(0, 8)}.md`;
    const path = `${root.replace(/\/+$/, '')}/${filename}`;
    const markdown = noteMarkdown(note);
    let status = dryRun ? 'preview' : 'created';
    if (!dryRun && existingPaths.has(path)) {
      let previous = '';
      try { previous = asText(await chrome.antigem.readFile({path, encoding: 'utf8'})); } catch (_) {}
      if (fold(previous).replace(/\s+/g, '') === fold(markdown).replace(/\s+/g, '')) status = 'unchanged';
      else if (overwrite) status = 'updated';
      else status = 'skipped';
    }
    if (!dryRun && (status === 'created' || status === 'updated')) {
      await chrome.antigem.writeFile({path, data: markdown, encoding: 'utf8'});
    }
    files.push({
      id: note.id,
      kind: note.kind,
      title: note.title,
      path,
      sha256: await sha256(markdown),
      bytes: markdown.length,
      status,
      pinned: !!note.pinned,
      itemCount: note.items.length
    });
  }
  const summary = {
    total: files.length,
    created: files.filter(file => file.status === 'created').length,
    updated: files.filter(file => file.status === 'updated').length,
    unchanged: files.filter(file => file.status === 'unchanged').length,
    skipped: files.filter(file => file.status === 'skipped').length,
    preview: files.filter(file => file.status === 'preview').length
  };
  let index = null;
  if (!dryRun) {
    index = {
      format: 'notes-bridge-index',
      version: 1,
      exportedAt: Date.now(),
      root,
      count: notes.length,
      files: files.map(file => ({id: file.id, title: file.title, path: file.path, sha256: file.sha256, status: file.status}))
    };
    await chrome.antigem.writeFile({
      path: `${root.replace(/\/+$/, '')}/_index.json`,
      data: JSON.stringify(index, null, 2),
      encoding: 'utf8'
    });
  }
  return {
    ok: true,
    tool: 'notes_export',
    language,
    dryRun,
    root,
    files,
    summary,
    index: index ? {path: `${root.replace(/\/+$/, '')}/_index.json`, count: notes.length} : null,
    warnings
  };
}

async function notesImport(args) {
  const language = languageOf(args.language);
  const root = normalizePath(args.path || DEFAULT_EXPORT, 'dir');
  const dryRun = args.dry_run !== false;
  const maxFiles = clampInt(args.maxFiles, 1, 500, 500);
  const warnings = [];
  const desired = await listMarkdown(root, maxFiles, warnings, language);
  if (!desired.length) fail(`No hay notas exportadas con frontmatter en ${root}`, `No exported notes with frontmatter in ${root}`);
  const currentRaw = noteList(args.notes || [], 'Pasa notes con el inventario actual de notes_list(include_body:true)',
    'Pass notes with the current inventory from notes_list(include_body:true)');
  const current = currentRaw.map((raw, index) => normalizeNote(raw, index));
  const currentById = new Map(current.map(note => [note.id, note]));
  const matched = new Set();
  const plan = [];
  const summary = {create: 0, update: 0, unchanged: 0, todoOperations: 0, destructive: 0};
  for (const note of desired) {
    const existing = currentById.get(note.id) || findByTitleKind(current, note);
    if (!existing) {
      const callArgs = cleanUndefined({
        kind: note.kind,
        title: note.title,
        text: note.text,
        items: note.kind === 'todo' && note.items.length ? note.items.map(item => item.text) : undefined,
        pinned: !!note.pinned
      });
      plan.push({tool: 'notes_create', args: callArgs, destructive: false,
        reason: localText(language, 'No existe; crear', 'Missing; create')});
      summary.create++;
      continue;
    }
    matched.add(existing.id);
    const changes = [];
    const updateArgs = {id: existing.id};
    if (existing.title !== note.title) { updateArgs.title = note.title; changes.push('title'); }
    if (existing.text !== note.text) { updateArgs.text = note.text; changes.push('text'); }
    if (!!existing.pinned !== !!note.pinned) { updateArgs.pinned = !!note.pinned; changes.push('pinned'); }
    if (changes.length) {
      plan.push({tool: 'notes_update', args: updateArgs, changes, destructive: false,
        reason: localText(language, `Cambian: ${changes.join(', ')}`, `Changed: ${changes.join(', ')}`)});
      summary.update++;
    }
    if (note.kind === 'todo') {
      const operations = todoOps(existing, note, language);
      for (const operation of operations) {
        plan.push(operation);
        summary.todoOperations++;
        if (operation.destructive) summary.destructive++;
      }
    }
    if (!changes.length && !(note.kind === 'todo' && todoOps(existing, note, language).length)) summary.unchanged++;
  }
  plan.forEach((step, index) => { step.sequence = index + 1; });
  const notInExport = current.filter(note => !matched.has(note.id) && !desired.some(item => item.id === note.id))
    .map(note => ({id: note.id, title: note.title, kind: note.kind}));
  return {
    ok: true,
    tool: 'notes_import',
    language,
    dryRun,
    root,
    scanned: desired.length,
    currentCount: current.length,
    plan,
    summary,
    notInExport,
    warnings,
    note: localText(language,
      'El agente aplica este plan con las tools de notes_mcp; el worker no escribe en Notes. Revisa las acciones destructive antes de aplicarlas.',
      'The agent applies this plan with notes_mcp tools; the worker never writes to Notes. Review destructive actions before applying.')
  };
}

async function notesSearch(args) {
  const query = asText(args.query).trim();
  if (!query) fail('Falta query', 'Query is required');
  const language = languageOf(args.language);
  const limit = clampInt(args.limit, 1, 200, 50);
  const caseSensitive = !!args.case_sensitive;
  const useRegex = !!args.regex;
  const fields = Array.isArray(args.fields) && args.fields.length ? args.fields : ['title', 'text', 'items'];
  const warnings = [];
  const notes = noteList(args.notes || [], 'Pasa notes o path para buscar', 'Pass notes or path to search')
    .map((raw, index) => normalizeNote(raw, index));
  if (args.path) {
    const path = normalizePath(args.path, 'dir');
    const fromFiles = await listMarkdown(path, 1000, warnings, language);
    for (const note of fromFiles) if (!notes.some(item => item.id === note.id)) notes.push(note);
  }
  if (!notes.length) fail('No hay notas donde buscar. Pasa notes o path.', 'No notes to search. Pass notes or path.');
  let matcher;
  if (useRegex) {
    let regex;
    try { regex = new RegExp(query, caseSensitive ? '' : 'i'); }
    catch (error) { fail(`Regex inválido: ${error.message}`, `Invalid regex: ${error.message}`); }
    matcher = text => regex.test(text);
  } else {
    const terms = query.split(/\s+/).filter(Boolean).map(term => caseSensitive ? term : fold(term));
    matcher = text => {
      const value = caseSensitive ? text : fold(text);
      return terms.every(term => value.includes(term));
    };
  }
  const matches = [];
  for (const note of notes) {
    const haystack = {
      title: note.title,
      text: note.text,
      items: note.items.map(item => item.text).join('\n')
    };
    const snippets = [];
    const matchedFields = [];
    let score = 0;
    for (const field of fields) {
      const value = haystack[field] || '';
      if (value && matcher(value)) {
        matchedFields.push(field);
        score += field === 'title' ? 3 : 1;
        snippets.push({field, text: makeSnippet(value, query, 70)});
      }
    }
    if (matchedFields.length) matches.push({
      id: note.id,
      kind: note.kind,
      title: note.title,
      path: note.path,
      pinned: !!note.pinned,
      score,
      matchedFields,
      snippets
    });
  }
  matches.sort((left, right) => right.score - left.score || fold(left.title).localeCompare(fold(right.title)));
  return {
    ok: true,
    tool: 'notes_search',
    language,
    query,
    source: args.path ? normalizePath(args.path, 'dir') : 'notes',
    regex: useRegex,
    scanned: notes.length,
    total: matches.length,
    count: Math.min(matches.length, limit),
    matches: matches.slice(0, limit),
    warnings
  };
}

async function notesDedupe(args) {
  const language = languageOf(args.language);
  const threshold = clampNum(args.threshold, 0.5, 1, 0.9);
  const exactOnly = !!args.exact_only;
  const warnings = [];
  const notes = noteList(args.notes || [], 'Pasa notes o path para buscar duplicados', 'Pass notes or path to find duplicates')
    .map((raw, index) => normalizeNote(raw, index));
  if (args.path) {
    const path = normalizePath(args.path, 'dir');
    for (const note of await listMarkdown(path, 1000, warnings, language)) {
      if (!notes.some(item => item.id === note.id)) notes.push(note);
    }
  }
  if (notes.length < 2) fail('Hacen falta al menos dos notas', 'At least two notes are required');
  const byHash = new Map();
  for (const note of notes) {
    const key = `${normalizeKey(note.title)}||${normalizeKey(note.text)}||${note.items.map(item => `${normalizeKey(item.text)}${item.done ? '+' : '-'}`).join('|')}`;
    const hash = `h${hash8(key)}`;
    if (!byHash.has(hash)) byHash.set(hash, []);
    byHash.get(hash).push(note);
  }
  const groups = [];
  for (const [key, members] of byHash.entries()) {
    if (members.length > 1) groups.push({
      type: 'exact',
      key,
      members: members.map(note => noteInfo(note, !!args.path)),
      suggestedKeep: pickKeep(members).id
    });
  }
  if (!exactOnly) {
    const groupedIds = new Set(groups.reduce((all, group) => all.concat(group.members.map(member => member.id)), []));
    const pool = notes.filter(note => !groupedIds.has(note.id));
    const tokenCache = new Map(pool.map(note => [note.id, tokens(`${note.title} ${note.text} ${note.items.map(item => item.text).join(' ')}`)]));
    const used = new Set();
    for (let index = 0; index < pool.length; index++) {
      if (used.has(pool[index].id)) continue;
      const cluster = [pool[index]];
      used.add(pool[index].id);
      let lowest = 1;
      for (let other = index + 1; other < pool.length; other++) {
        if (used.has(pool[other].id)) continue;
        const similarity = jaccard(tokenCache.get(pool[index].id), tokenCache.get(pool[other].id));
        if (similarity >= threshold) {
          cluster.push(pool[other]);
          used.add(pool[other].id);
          lowest = Math.min(lowest, similarity);
        }
      }
      if (cluster.length > 1) groups.push({
        type: 'near',
        threshold,
        minSimilarity: Number(lowest.toFixed(3)),
        members: cluster.map(note => noteInfo(note, !!args.path)),
        suggestedKeep: pickKeep(cluster).id
      });
    }
  }
  const suggestions = groups.map((group, groupIndex) => {
    const keep = group.members.find(member => member.id === group.suggestedKeep);
    const others = group.members.filter(member => member.id !== group.suggestedKeep);
    return {
      group: groupIndex + 1,
      requiresReview: true,
      keep: {id: keep.id, title: keep.title},
      mergeCandidates: others.map(note => ({id: note.id, title: note.title})),
      suggestedActions: [
        {
          tool: 'notes_update',
          args: {
            id: keep.id,
            append_text: true,
            text: `\n\n---\nDuplicados detectados / Duplicates detected\n${others.map(note => `- ${note.title}: ${note.id}`).join('\n')}`
          },
          destructive: false,
          note: localText(language, 'Copia el contenido útil antes de borrar', 'Copy useful content before deleting')
        },
        ...others.map(note => ({
          tool: 'notes_delete',
          args: {id: note.id},
          destructive: true,
          note: localText(language, 'Solo tras revisar la fusión', 'Only after reviewing the merge')
        }))
      ]
    };
  });
  return {
    ok: true,
    tool: 'notes_dedupe',
    language,
    source: args.path ? normalizePath(args.path, 'dir') : 'notes',
    scanned: notes.length,
    threshold,
    exactOnly,
    groupCount: groups.length,
    groups,
    suggestions,
    warnings,
    note: localText(language, 'Sugerencias únicamente: no se elimina ni se modifica nada automáticamente.',
      'Suggestions only: nothing is deleted or modified automatically.')
  };
}

async function notesReport(args) {
  const language = languageOf(args.language);
  const title = asText(args.title).trim() || both('Informe de notas', 'Notes report');
  const operations = Array.isArray(args.operations) ? args.operations : [];
  const summary = args.summary && typeof args.summary === 'object' ? args.summary : {};
  const findings = Array.isArray(args.findings) ? args.findings : [];
  const warnings = Array.isArray(args.warnings) ? args.warnings : [];
  const dryRun = args.dry_run !== false;
  const lines = [
    `# ${title}`,
    '',
    `> ${both('Generado por notes-bridge con datos locales. No consulta servicios externos.',
      'Generated by notes-bridge from local data. No external services are consulted.')}`,
    '',
    `- **${both('Fecha', 'Date')}:** ${new Date().toISOString()}`,
    ''
  ];
  if (operations.length) {
    lines.push(`## ${both('Operaciones', 'Operations')}`, '',
      `| # | Tool | ${both('Resumen', 'Summary')} |`, '| --- | --- | --- |');
    for (const [index, operation] of operations.entries()) {
      lines.push(`| ${index + 1} | ${cell(operation.tool || operation.name || '—')} | ${cell(operation.summary || operation.detail || '—')} |`);
    }
    lines.push('');
  }
  const keys = Object.keys(summary);
  if (keys.length) {
    lines.push(`## ${both('Resumen', 'Summary')}`, '',
      `| ${both('Métrica', 'Metric')} | ${both('Valor', 'Value')} |`, '| --- | --- |');
    for (const key of keys) lines.push(`| ${cell(key)} | ${cell(summary[key])} |`);
    lines.push('');
  }
  if (findings.length) {
    lines.push(`## ${both('Hallazgos', 'Findings')}`, '');
    for (const finding of findings) {
      if (finding && typeof finding === 'object') lines.push(`- ${asText(finding.es || finding.text)} / ${asText(finding.en || finding.text)}`);
      else lines.push(`- ${asText(finding)}`);
    }
    lines.push('');
  }
  if (warnings.length) {
    lines.push(`## ${both('Avisos', 'Warnings')}`, '');
    for (const warning of warnings) lines.push(`- ${asText(warning)}`);
    lines.push('');
  }
  lines.push(`## ${both('Siguientes pasos', 'Next steps')}`, '');
  lines.push(`- ${both('Aplica el plan con notes_update, notes_create y notes_todo_*; nada se aplica automáticamente.',
    'Apply the plan with notes_update, notes_create and notes_todo_*; nothing is applied automatically.')}`);
  lines.push(`- ${both('Revisa los duplicados antes de borrar cualquier nota.', 'Review duplicates before deleting any note.')}`);
  lines.push(`- ${both('No subas notas con datos personales a un repositorio público.', 'Do not commit notes with personal data to a public repo.')}`);
  const markdown = lines.join('\n').replace(/\n+$/, '') + '\n';
  let written = false;
  let path = null;
  if (dryRun === false && asText(args.output).trim()) {
    path = normalizePath(args.output, 'md');
    await chrome.antigem.writeFile({path, data: markdown, encoding: 'utf8'});
    written = true;
  }
  return {
    ok: true,
    tool: 'notes_report',
    language,
    dryRun,
    written,
    path,
    markdown,
    bytes: markdown.length
  };
}

const tools = {notes_export: notesExport, notes_import: notesImport, notes_search: notesSearch, notes_dedupe: notesDedupe, notes_report: notesReport};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  const handler = tools[message.tool];
  if (!handler) return false;
  (async () => handler(message.args || {}))().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: error && error.message ? error.message : String(error)}]
  }));
  return true;
});
