'use strict';

// snippet-forge — biblioteca offline de snippets con variables.
// Sin red: solo chrome.antigem (permiso antigemFiles) y JS puro.

const DEFAULT_LIBRARY = '~/snippet-forge/snippets.json';
const DEFAULT_EXPORT = '~/snippet-forge/snippets.md';
const LIBRARY_VERSION = 1;
const MAX_SNIPPETS = 500;
const MAX_BODY_CHARS = 64000;
const MAX_LIBRARY_BYTES = 4 * 1024 * 1024;
const MAX_RESULTS = 100;

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

function nowIso() {
  return new Date().toISOString();
}

function fold(text) {
  return asText(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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

function slug(text) {
  return fold(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'snippet';
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
  return raw.replace(/\/+$/, '') || raw;
}

const VARIABLE_RE = /\{\{\s*([A-Za-z_][A-Za-z0-9_-]*)\s*(?::\s*([^}]*?))?\s*\}\}/g;

function parseVariables(body) {
  const variables = [];
  const seen = new Set();
  const expression = new RegExp(VARIABLE_RE.source, 'g');
  let match;
  while ((match = expression.exec(body)) !== null) {
    const name = match[1].trim();
    if (seen.has(name)) continue;
    seen.add(name);
    variables.push({name, default: match[2] == null ? null : match[2].trim()});
  }
  return variables;
}

function renderBody(body, values, strict) {
  const missing = [];
  const defaultsUsed = [];
  const source = values && typeof values === 'object' && !Array.isArray(values) ? values : {};
  const text = asText(body).replace(new RegExp(VARIABLE_RE.source, 'g'), (full, rawName, rawDefault) => {
    const name = asText(rawName).trim();
    if (Object.prototype.hasOwnProperty.call(source, name) && source[name] != null) {
      return asText(source[name]);
    }
    if (rawDefault != null && asText(rawDefault).trim()) {
      defaultsUsed.push(name);
      return asText(rawDefault).trim();
    }
    missing.push(name);
    return strict ? '' : full;
  });
  return {text, missing, defaultsUsed};
}

function emptyLibrary() {
  return {version: LIBRARY_VERSION, updatedAt: nowIso(), snippets: []};
}

function normalizeSnippet(raw, index) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const title = asText(source.title).trim() || both('Sin título', 'Untitled');
  const language = asText(source.language).trim().toLowerCase() || 'text';
  const tags = Array.isArray(source.tags) ?
    source.tags.map(tag => asText(tag).trim()).filter(Boolean).slice(0, 20) : [];
  const body = asText(source.body);
  const id = asText(source.id).trim() || `${slug(title)}-${hash8(`${title}|${language}|${index}`)}`;
  return {
    id,
    title,
    language,
    tags,
    description: asText(source.description).trim(),
    body,
    variables: parseVariables(body),
    createdAt: asText(source.createdAt).trim() || nowIso(),
    updatedAt: asText(source.updatedAt).trim() || nowIso()
  };
}

function normalizeLibrary(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Array.isArray(raw.snippets)) {
    return emptyLibrary();
  }
  return {
    version: LIBRARY_VERSION,
    updatedAt: asText(raw.updatedAt).trim() || nowIso(),
    snippets: raw.snippets.slice(0, MAX_SNIPPETS).map(normalizeSnippet)
  };
}

async function readLibrary(path) {
  let stat;
  try {
    stat = await chrome.antigem.stat({path});
  } catch (_) {
    return {library: emptyLibrary(), exists: false};
  }
  if (!stat.isFile) {
    fail('La biblioteca debe ser un archivo', 'The library must be a file');
  }
  if (Number(stat.size || 0) > MAX_LIBRARY_BYTES) {
    fail('La biblioteca supera el límite de 4 MiB', 'The library exceeds the 4 MiB limit');
  }
  let parsed;
  try {
    parsed = JSON.parse(await chrome.antigem.readFile({path, encoding: 'utf8'}));
  } catch (error) {
    fail(`No se pudo leer la biblioteca: ${error.message}`, `Could not read the library: ${error.message}`);
  }
  return {library: normalizeLibrary(parsed), exists: true};
}

async function writeLibrary(path, library) {
  const data = `${JSON.stringify({
    version: LIBRARY_VERSION,
    updatedAt: nowIso(),
    snippets: library.snippets
  }, null, 2)}\n`;
  try {
    await chrome.antigem.copyFile({from: path, to: `${path}.bak`});
  } catch (_) {
    // No hay original que respaldar / Nothing to back up.
  }
  try {
    await chrome.antigem.writeFile({path, data, encoding: 'utf8'});
  } catch (error) {
    fail(`No se pudo escribir la biblioteca: ${error.message}`, `Could not write the library: ${error.message}`);
  }
  return `${path}.bak`;
}

function findSnippet(library, id) {
  const needle = fold(id);
  return library.snippets.find(snippet => snippet.id === id || fold(snippet.id) === needle) || null;
}

function summarize(snippet) {
  return {
    id: snippet.id,
    title: snippet.title,
    language: snippet.language,
    tags: snippet.tags,
    description: snippet.description,
    variables: snippet.variables,
    preview: snippet.body.slice(0, 180).replace(/\s+/g, ' ').trim()
  };
}

function matches(snippet, query, language, tag) {
  if (language && fold(snippet.language) !== fold(language)) return false;
  if (tag && !snippet.tags.some(item => fold(item) === fold(tag))) return false;
  if (!query) return true;
  const haystack = fold(`${snippet.title}\n${snippet.description}\n${snippet.language}\n${snippet.tags.join(' ')}\n${snippet.body}`);
  return fold(query).split(/\s+/).filter(Boolean).every(term => haystack.includes(term));
}

function exportMarkdown(library, language) {
  const selected = language ? library.snippets.filter(item => fold(item.language) === fold(language)) : library.snippets;
  const groups = new Map();
  for (const snippet of selected) {
    const key = snippet.language || 'text';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(snippet);
  }
  const lines = [
    '# Snippet Forge',
    '',
    both('Biblioteca de fragmentos exportada. No edites esta sección de encabezado.', 'Exported snippet library. Do not edit this header section.'),
    '',
    `- ${both('Snippets', 'Snippets')}: ${selected.length}`,
    `- ${both('Actualizado', 'Updated')}: ${library.updatedAt}`,
    ''
  ];
  for (const key of Array.from(groups.keys()).sort()) {
    lines.push(`## ${key}`, '');
    for (const snippet of groups.get(key).sort((a, b) => a.title.localeCompare(b.title))) {
      lines.push(`### ${snippet.title} (\`${snippet.id}\`)`, '');
      if (snippet.description) lines.push(snippet.description, '');
      if (snippet.tags.length) lines.push(`${both('Etiquetas', 'Tags')}: ${snippet.tags.join(', ')}`, '');
      if (snippet.variables.length) {
        lines.push(`${both('Variables', 'Variables')}: ${snippet.variables.map(item =>
          item.default == null ? `\`${item.name}\`` : `\`${item.name}\` = \`${item.default}\``).join(', ')}`, '');
      }
      lines.push(`\`\`\`${snippet.language}`, snippet.body, '```', '');
    }
  }
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

async function snippetSave(args) {
  const libraryPath = normalizePath(args.library || DEFAULT_LIBRARY,
    'la ruta de la biblioteca', 'library path', '.json');
  const title = asText(args.title).trim();
  if (!title) fail('Falta el título', 'Title is required');
  const body = asText(args.body);
  if (!body.trim()) fail('Falta el cuerpo del snippet', 'Snippet body is required');
  if (body.length > MAX_BODY_CHARS) {
    fail(`El snippet supera ${MAX_BODY_CHARS} caracteres`, `Snippet exceeds ${MAX_BODY_CHARS} characters`);
  }
  const language = asText(args.language).trim().toLowerCase() || 'text';
  const tags = Array.isArray(args.tags) ?
    args.tags.map(tag => asText(tag).trim()).filter(Boolean).slice(0, 20) : [];
  const {library} = await readLibrary(libraryPath);
  const existing = args.id ? findSnippet(library, asText(args.id)) :
    library.snippets.find(item => fold(item.title) === fold(title) && fold(item.language) === fold(language)) || null;
  const stamp = nowIso();
  const snippet = normalizeSnippet({
    id: existing ? existing.id : `${slug(title)}-${hash8(`${title}|${language}`)}`,
    title,
    language,
    tags,
    description: asText(args.description).trim(),
    body,
    createdAt: existing ? existing.createdAt : stamp,
    updatedAt: stamp
  }, library.snippets.length);
  const index = existing ? library.snippets.indexOf(existing) : -1;
  const next = {version: LIBRARY_VERSION, updatedAt: stamp, snippets: library.snippets.slice()};
  if (index >= 0) next.snippets[index] = snippet;
  else next.snippets.push(snippet);
  const dryRun = args.dry_run !== false;
  let backup = null;
  if (!dryRun) backup = await writeLibrary(libraryPath, next);
  return {
    ok: true,
    action: index >= 0 ? 'updated' : 'created',
    dry_run: dryRun,
    written: !dryRun,
    library: libraryPath,
    backup,
    snippet,
    message: both(
      `Snippet ${index >= 0 ? 'actualizado' : 'creado'}: ${snippet.id}.`,
      `Snippet ${index >= 0 ? 'updated' : 'created'}: ${snippet.id}.`
    )
  };
}

async function snippetGet(args) {
  const libraryPath = normalizePath(args.library || DEFAULT_LIBRARY,
    'la ruta de la biblioteca', 'library path', '.json');
  if (!asText(args.id).trim()) fail('Falta el id', 'id is required');
  const {library, exists} = await readLibrary(libraryPath);
  const snippet = findSnippet(library, asText(args.id).trim());
  return {
    ok: true,
    library: libraryPath,
    exists,
    found: Boolean(snippet),
    snippet,
    suggestions: snippet ? [] : library.snippets.slice(0, 5).map(item => item.id),
    message: snippet ? both('Snippet encontrado.', 'Snippet found.') :
      both('No existe ese id en la biblioteca.', 'No snippet with that id in the library.')
  };
}

async function snippetSearch(args) {
  const libraryPath = normalizePath(args.library || DEFAULT_LIBRARY,
    'la ruta de la biblioteca', 'library path', '.json');
  const limit = clampInt(args.limit, 1, MAX_RESULTS, 50);
  const {library, exists} = await readLibrary(libraryPath);
  const results = library.snippets
    .filter(item => matches(item, asText(args.query).trim(),
      asText(args.language).trim(), asText(args.tag).trim()))
    .slice(0, limit)
    .map(summarize);
  return {
    ok: true,
    library: libraryPath,
    exists,
    count: results.length,
    total: library.snippets.length,
    results,
    message: both(`${results.length} de ${library.snippets.length} snippets.`, `${results.length} of ${library.snippets.length} snippets.`)
  };
}

async function snippetRender(args) {
  const libraryPath = normalizePath(args.library || DEFAULT_LIBRARY,
    'la ruta de la biblioteca', 'library path', '.json');
  let source = asText(args.body);
  let snippet = null;
  if (asText(args.id).trim()) {
    const {library} = await readLibrary(libraryPath);
    snippet = findSnippet(library, asText(args.id).trim());
    if (!snippet) fail('No existe ese snippet en la biblioteca', 'Snippet not found in the library');
    source = snippet.body;
  }
  if (!source.trim()) fail('Falta el id o el cuerpo del snippet', 'Provide id or snippet body');
  const strict = args.strict === true;
  const rendered = renderBody(source, args.values, strict);
  if (strict && rendered.missing.length) {
    fail(`Faltan variables: ${rendered.missing.join(', ')}`, `Missing variables: ${rendered.missing.join(', ')}`);
  }
  const output = args.output == null ? '' : normalizePath(args.output,
    'la ruta de salida', 'output path');
  const dryRun = args.dry_run !== false;
  let written = false;
  if (output && !dryRun) {
    try {
      await chrome.antigem.writeFile({path: output, data: rendered.text, encoding: 'utf8'});
      written = true;
    } catch (error) {
      fail(`No se pudo escribir la salida: ${error.message}`, `Could not write the output: ${error.message}`);
    }
  }
  return {
    ok: true,
    id: snippet ? snippet.id : null,
    language: snippet ? snippet.language : 'text',
    rendered: rendered.text,
    missing: rendered.missing,
    defaultsUsed: rendered.defaultsUsed,
    output: output || null,
    dry_run: dryRun,
    written,
    warnings: rendered.missing.length ? [
      both(`Variables sin valor: ${rendered.missing.join(', ')}`, `Variables without a value: ${rendered.missing.join(', ')}`)
    ] : [],
    message: both('Snippet renderizado.', 'Snippet rendered.')
  };
}

async function snippetDelete(args) {
  const libraryPath = normalizePath(args.library || DEFAULT_LIBRARY,
    'la ruta de la biblioteca', 'library path', '.json');
  if (!asText(args.id).trim()) fail('Falta el id', 'id is required');
  const {library} = await readLibrary(libraryPath);
  const snippet = findSnippet(library, asText(args.id).trim());
  if (!snippet) return {
    ok: true, found: false, written: false, library: libraryPath,
    message: both('No existe ese snippet.', 'Snippet not found.')
  };
  const next = {
    version: LIBRARY_VERSION,
    updatedAt: nowIso(),
    snippets: library.snippets.filter(item => item.id !== snippet.id)
  };
  const dryRun = args.dry_run !== false;
  let backup = null;
  if (!dryRun) backup = await writeLibrary(libraryPath, next);
  return {
    ok: true, found: true, dry_run: dryRun, written: !dryRun,
    library: libraryPath, backup, removed: snippet.id, remaining: next.snippets.length,
    message: both(`Snippet ${snippet.id} eliminado.`, `Snippet ${snippet.id} deleted.`)
  };
}

async function snippetExport(args) {
  const libraryPath = normalizePath(args.library || DEFAULT_LIBRARY,
    'la ruta de la biblioteca', 'library path', '.json');
  const output = normalizePath(args.output || DEFAULT_EXPORT, 'la ruta de salida', 'output path', '.md');
  const language = asText(args.language).trim();
  const {library} = await readLibrary(libraryPath);
  const markdown = exportMarkdown(library, language);
  const dryRun = args.dry_run !== false;
  let written = false;
  if (!dryRun) {
    try {
      await chrome.antigem.writeFile({path: output, data: markdown, encoding: 'utf8'});
      written = true;
    } catch (error) {
      fail(`No se pudo escribir el Markdown: ${error.message}`, `Could not write the Markdown: ${error.message}`);
    }
  }
  return {
    ok: true, library: libraryPath, output, dry_run: dryRun, written,
    snippets: language ? library.snippets.filter(item => fold(item.language) === fold(language)).length : library.snippets.length,
    markdown,
    message: both('Exportación Markdown lista.', 'Markdown export ready.')
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    const args = message.args || {};
    if (message.tool === 'snippet_save') return await snippetSave(args);
    if (message.tool === 'snippet_get') return await snippetGet(args);
    if (message.tool === 'snippet_search') return await snippetSearch(args);
    if (message.tool === 'snippet_render') return await snippetRender(args);
    if (message.tool === 'snippet_delete') return await snippetDelete(args);
    if (message.tool === 'snippet_export') return await snippetExport(args);
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: error && error.message ? error.message : String(error)}]
  }));
  return true;
});
