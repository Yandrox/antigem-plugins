'use strict';

// Plugin Doctor - validación offline de repositorios de plugins de AntiGem.
// Sin dependencias externas: solo chrome.antigem (permiso antigemFiles).

const LIMITS = Object.freeze({
  maxFiles: 5000,
  maxFileBytes: 32 * 1024 * 1024,
  maxTotalBytes: 128 * 1024 * 1024
});

const SKILL_NAME_RE = /^[A-Za-z0-9_.-]+$/;
const ID_RE = /^[A-Za-z0-9_-]+$/;
const VERSION_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', '.gradle', '.idea', '.vscode']);
const ALLOWED_PERMISSIONS = new Set([
  'storage', 'scripting', 'debugger', 'downloads', 'alarms',
  'cookies', 'antigemFiles', 'activeTab', 'tabs'
]);

function addIssue(issues, severity, code, es, en, path = '') {
  issues.push({severity, code, path: String(path || ''), message: en, message_es: es});
}
const fail = (issues, code, es, en, path = '') => addIssue(issues, 'error', code, es, en, path);
const warn = (issues, code, es, en, path = '') => addIssue(issues, 'warning', code, es, en, path);
const info = (issues, code, es, en, path = '') => addIssue(issues, 'info', code, es, en, path);

function join(base, rel) {
  const clean = String(rel == null ? '' : rel).replace(/^\/+/, '').replace(/\/+$/, '');
  return clean ? `${base}/${clean}` : base;
}

function relFrom(root, path) {
  const p = String(path || '');
  return p.startsWith(`${root}/`) ? p.slice(root.length + 1) : p;
}

function isUnsafeRel(rel) {
  return rel.startsWith('/') || rel.includes('\\') || rel.split('/').includes('..');
}

function safeRel(value, issues, where) {
  if (typeof value !== 'string' || !value.trim()) {
    fail(issues, 'PATH_MISSING', `Falta "path" en ${where}.`, `Missing "path" in ${where}.`, where);
    return null;
  }
  const rel = value.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (!rel || isUnsafeRel(rel)) {
    fail(issues, 'PATH_UNSAFE', `Ruta no segura en ${where}: ${value}`, `Unsafe path in ${where}: ${value}`, where);
    return null;
  }
  return rel;
}

async function resolveRoot(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw new Error('root es obligatorio / root is required');
  }
  let stat;
  try {
    stat = await chrome.antigem.stat({path: input.trim()});
  } catch (error) {
    throw new Error(`No se pudo acceder a root / Cannot access root: ${error.message}`);
  }
  if (stat.isFile) {
    throw new Error('root debe ser una carpeta / root must be a directory');
  }
  return String(stat.path || input.trim()).replace(/\/+$/, '');
}

async function listDir(path) {
  return await chrome.antigem.listFiles({path, limit: 2000});
}

async function existsFile(path) {
  try {
    const stat = await chrome.antigem.stat({path});
    return Boolean(stat.isFile);
  } catch (_) {
    return false;
  }
}

async function existsDir(path) {
  try {
    await listDir(path);
    return true;
  } catch (_) {
    return false;
  }
}

async function readText(path) {
  return await chrome.antigem.readFile({path, encoding: 'utf8'});
}

async function readJson(path, issues, label) {
  try {
    const parsed = JSON.parse(await readText(path));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('the JSON root must be an object');
    }
    return parsed;
  } catch (error) {
    fail(issues, 'JSON_INVALID', `${label}: JSON inválido (${error.message}).`,
      `${label}: invalid JSON (${error.message}).`, path);
    return null;
  }
}

async function walk(root, issues) {
  const files = [];
  const dirs = [];

  async function visit(dir, depth) {
    let entries;
    try {
      entries = await listDir(dir);
    } catch (error) {
      fail(issues, 'LIST_FAILED', `No se pudo listar ${relFrom(root, dir)}: ${error.message}`,
        `Could not list ${relFrom(root, dir)}: ${error.message}`, dir);
      return;
    }
    if (entries.length >= 2000) {
      warn(issues, 'LIST_TRUNCATED',
        `${relFrom(root, dir)} tiene 2000+ entradas; la lista podría estar truncada.`,
        `${relFrom(root, dir)} has 2000+ entries; the listing may be truncated.`, dir);
    }
    for (const entry of entries) {
      const name = String(entry.name || '');
      if (entry.isDirectory) {
        if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
        const child = String(entry.path || join(dir, name));
        dirs.push(child);
        if (depth >= 40) {
          warn(issues, 'DEPTH_LIMIT', `Profundidad máxima alcanzada en ${relFrom(root, child)}.`,
            `Maximum depth reached at ${relFrom(root, child)}.`, child);
          continue;
        }
        await visit(child, depth + 1);
      } else if (entry.isFile) {
        files.push({
          path: String(entry.path || join(dir, name)),
          name,
          size: Number(entry.size || 0)
        });
      }
    }
  }

  await visit(root, 0);
  return {files, dirs};
}

function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) return null;
  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(line.trim());
    if (field) {
      result[field[1]] = field[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return result;
}

function checkLinks(text, filePath, issues, filesSet, dirsSet, root) {
  const pattern = /\[[^\]\n]*\]\(([^)\n]+)\)/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    let target = match[1].trim().split(/\s+/)[0].replace(/^<|>$/g, '');
    if (!target || /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target)) continue;
    target = target.split('#')[0].split('?')[0];
    if (!target) continue;
    let decoded;
    try {
      decoded = decodeURIComponent(target);
    } catch (_) {
      decoded = target;
    }
    if (decoded.startsWith('/') || decoded.split('/').includes('..')) {
      warn(issues, 'LINK_UNSAFE', `Enlace no seguro en ${relFrom(root, filePath)}: ${target}`,
        `Unsafe link in ${relFrom(root, filePath)}: ${target}`, filePath);
      continue;
    }
    const dir = filePath.slice(0, filePath.lastIndexOf('/'));
    const resolved = join(dir, decoded);
    if (!filesSet.has(resolved) && !dirsSet.has(resolved)) {
      warn(issues, 'BROKEN_LINK', `Enlace roto en ${relFrom(root, filePath)}: ${target}`,
        `Broken link in ${relFrom(root, filePath)}: ${target}`, filePath);
    }
  }
}

async function checkIcon(manifest, pluginDir, rel, issues, filesSet) {
  const refs = [];
  if (typeof manifest.icon === 'string') refs.push(manifest.icon);
  if (manifest.icons && typeof manifest.icons === 'object' && !Array.isArray(manifest.icons)) {
    for (const key of Object.keys(manifest.icons)) refs.push(manifest.icons[key]);
  }
  if (!refs.length) {
    warn(issues, 'ICON_MISSING', `${rel}: no declara icono.`, `${rel}: no icon declared.`, pluginDir);
    return;
  }
  for (const ref of refs) {
    if (typeof ref !== 'string' || !ref.trim()) {
      fail(issues, 'ICON_INVALID', `${rel}: referencia de icono inválida.`,
        `${rel}: invalid icon reference.`, pluginDir);
      continue;
    }
    const clean = ref.trim();
    if (isUnsafeRel(clean)) {
      fail(issues, 'ICON_UNSAFE', `${rel}: ruta de icono no segura: ${clean}`,
        `${rel}: unsafe icon path: ${clean}`, pluginDir);
      continue;
    }
    const absolute = join(pluginDir, clean);
    if (!filesSet.has(absolute)) {
      fail(issues, 'ICON_NOT_FOUND', `${rel}: no existe el icono ${clean}.`,
        `${rel}: icon not found: ${clean}`, pluginDir);
    } else if (!/\.(png|jpe?g|webp|svg)$/i.test(clean)) {
      warn(issues, 'ICON_FORMAT', `${rel}: formato de icono no recomendado: ${clean}`,
        `${rel}: unsupported icon format: ${clean}`, absolute);
    }
  }
}

async function validateSkills(pluginDir, rel, issues, filesSet, dirsSet, root) {
  const skillsDir = join(pluginDir, 'skills');
  let entries;
  try {
    entries = await listDir(skillsDir);
  } catch (_) {
    return {present: false, names: []};
  }

  const names = [];
  const detailDirs = [];
  for (const entry of entries) {
    const name = String(entry.name || '');
    if (entry.isFile && /\.md$/i.test(name)) {
      const skillName = name.replace(/\.md$/i, '');
      if (!SKILL_NAME_RE.test(skillName)) {
        fail(issues, 'SKILL_NAME_INVALID', `${rel}: nombre de skill inválido: ${name}`,
          `${rel}: invalid skill name: ${name}`, join(skillsDir, name));
      }
      names.push(skillName);
      const filePath = String(entry.path || join(skillsDir, name));
      let text;
      try {
        text = await readText(filePath);
      } catch (error) {
        fail(issues, 'SKILL_READ_FAILED', `${rel}: no se pudo leer ${name} (${error.message}).`,
          `${rel}: could not read ${name} (${error.message}).`, filePath);
        continue;
      }
      const frontmatter = parseFrontmatter(text);
      if (!frontmatter) {
        warn(issues, 'SKILL_FRONTMISSING', `${name}: falta frontmatter name/description.`,
          `${name}: missing name/description frontmatter.`, filePath);
      } else {
        if (!frontmatter.name) warn(issues, 'SKILL_FM_NAME', `${name}: falta "name" en el frontmatter.`,
          `${name}: missing "name" in frontmatter.`, filePath);
        if (!frontmatter.description) {
          warn(issues, 'SKILL_FM_DESCRIPTION', `${name}: falta "description" en el frontmatter.`,
            `${name}: missing "description" in frontmatter.`, filePath);
        }
      }
      checkLinks(text, filePath, issues, filesSet, dirsSet, root);
    } else if (entry.isDirectory) {
      detailDirs.push(name);
    }
  }
  for (const dir of detailDirs) {
    if (!SKILL_NAME_RE.test(dir)) {
      warn(issues, 'SKILL_DETAIL_NAME', `${rel}: carpeta de detalle con nombre inválido: ${dir}`,
        `${rel}: invalid detail folder name: ${dir}`, join(skillsDir, dir));
    }
    if (!names.includes(dir)) {
      warn(issues, 'SKILL_ORPHAN_DETAIL', `${rel}: carpeta de detalle sin skill ${dir}.md`,
        `${rel}: detail folder without a ${dir}.md skill`, join(skillsDir, dir));
    }
  }
  return {present: true, names};
}

async function validateManifest(pluginDir, rel, issues, filesSet, dirsSet, root) {
  const manifestPath = join(pluginDir, 'manifest.json');
  if (!filesSet.has(manifestPath)) {
    fail(issues, 'MANIFEST_MISSING', `${rel}: falta manifest.json.`,
      `${rel}: manifest.json is missing.`, pluginDir);
    return null;
  }
  const manifest = await readJson(manifestPath, issues, `${rel}/manifest.json`);
  if (!manifest) return null;

  if (manifest.manifest_version !== 3) {
    if (manifest.manifest_version === 2) {
      warn(issues, 'MV2', `${rel}: manifest_version 2 es compatible pero se prefiere 3.`,
        `${rel}: manifest_version 2 works but 3 is preferred.`, manifestPath);
    } else {
      fail(issues, 'MV_INVALID', `${rel}: manifest_version debe ser 3 (o 2).`,
        `${rel}: manifest_version must be 3 (or 2).`, manifestPath);
    }
  }
  if (typeof manifest.name !== 'string' || !manifest.name.trim()) {
    fail(issues, 'NAME_INVALID', `${rel}: falta "name".`, `${rel}: missing "name".`, manifestPath);
  }
  if (typeof manifest.version !== 'string' || !VERSION_RE.test(manifest.version)) {
    fail(issues, 'VERSION_INVALID', `${rel}: versión inválida: ${manifest.version}`,
      `${rel}: invalid version: ${manifest.version}`, manifestPath);
  }
  if (manifest.id == null) {
    warn(issues, 'ID_MISSING', `${rel}: manifest sin "id" (recomendado).`,
      `${rel}: manifest has no "id" (recommended).`, manifestPath);
  } else if (typeof manifest.id !== 'string' || !ID_RE.test(manifest.id)) {
    fail(issues, 'ID_INVALID', `${rel}: id inválido: ${manifest.id}`,
      `${rel}: invalid id: ${manifest.id}`, manifestPath);
  }
  if (typeof manifest.description !== 'string' || !manifest.description.trim()) {
    warn(issues, 'DESCRIPTION_MISSING', `${rel}: falta "description".`,
      `${rel}: missing "description".`, manifestPath);
  }

  let toolCount = 0;
  if (manifest.mcp_tools !== undefined) {
    if (!Array.isArray(manifest.mcp_tools) || manifest.mcp_tools.length === 0) {
      fail(issues, 'TOOLS_EMPTY', `${rel}: mcp_tools debe ser un array no vacío.`,
        `${rel}: mcp_tools must be a non-empty array.`, manifestPath);
    } else {
      toolCount = manifest.mcp_tools.length;
      const seen = new Set();
      manifest.mcp_tools.forEach((tool, index) => {
        const where = `${rel}/mcp_tools[${index}]`;
        if (!tool || typeof tool !== 'object' || Array.isArray(tool)) {
          fail(issues, 'TOOL_INVALID', `${where}: herramienta inválida.`,
            `${where}: invalid tool entry.`, manifestPath);
          return;
        }
        if (typeof tool.name !== 'string' || !/^[A-Za-z0-9_-]+$/.test(tool.name)) {
          fail(issues, 'TOOL_NAME_INVALID', `${where}: nombre de herramienta inválido.`,
            `${where}: invalid tool name.`, manifestPath);
        } else if (seen.has(tool.name)) {
          fail(issues, 'TOOL_DUPLICATE', `${where}: herramienta duplicada ${tool.name}.`,
            `${where}: duplicate tool ${tool.name}.`, manifestPath);
        } else {
          seen.add(tool.name);
        }
        if (typeof tool.description !== 'string' || !tool.description.trim()) {
          fail(issues, 'TOOL_DESCRIPTION_MISSING', `${where}: falta "description".`,
            `${where}: missing "description".`, manifestPath);
        }
        const schema = tool.inputSchema;
        if (!schema || typeof schema !== 'object' || schema.type !== 'object' ||
            !schema.properties || typeof schema.properties !== 'object' ||
            Array.isArray(schema.properties)) {
          fail(issues, 'TOOL_SCHEMA_INVALID', `${where}: inputSchema debe ser un objeto con properties.`,
            `${where}: inputSchema must be an object with properties.`, manifestPath);
        } else {
          if (schema.required !== undefined &&
              (!Array.isArray(schema.required) || schema.required.some(key =>
                typeof key !== 'string' || !(key in schema.properties)))) {
            fail(issues, 'TOOL_SCHEMA_REQUIRED', `${where}: "required" no coincide con properties.`,
              `${where}: "required" does not match properties.`, manifestPath);
          }
          if (schema.additionalProperties !== false) {
            warn(issues, 'TOOL_SCHEMA_ADDITIONAL', `${where}: falta additionalProperties: false.`,
              `${where}: missing additionalProperties: false.`, manifestPath);
          }
        }
      });
    }
  }

  const background = manifest.background;
  const workerRefs = [];
  if (background && typeof background === 'object' && !Array.isArray(background)) {
    if (typeof background.service_worker === 'string') workerRefs.push(background.service_worker);
    if (Array.isArray(background.scripts)) {
      for (const script of background.scripts) {
        if (typeof script === 'string') workerRefs.push(script);
      }
    }
  }
  if (toolCount > 0 && workerRefs.length === 0) {
    fail(issues, 'WORKER_MISSING', `${rel}: mcp_tools sin background worker.`,
      `${rel}: mcp_tools declared without a background worker.`, manifestPath);
  }
  for (const ref of workerRefs) {
    if (isUnsafeRel(ref)) {
      fail(issues, 'WORKER_UNSAFE', `${rel}: ruta de worker no segura: ${ref}`,
        `${rel}: unsafe worker path: ${ref}`, manifestPath);
    } else if (!filesSet.has(join(pluginDir, ref))) {
      fail(issues, 'WORKER_NOT_FOUND', `${rel}: no existe el worker ${ref}.`,
        `${rel}: worker not found: ${ref}`, manifestPath);
    }
  }

  const skills = await validateSkills(pluginDir, rel, issues, filesSet, dirsSet, root);
  if (toolCount === 0 && skills.names.length === 0) {
    fail(issues, 'EMPTY_PLUGIN', `${rel}: necesita mcp_tools o skills/*.md.`,
      `${rel}: it needs mcp_tools or skills/*.md.`, manifestPath);
  }
  await checkIcon(manifest, pluginDir, rel, issues, filesSet);

  if (manifest.permissions !== undefined) {
    if (!Array.isArray(manifest.permissions)) {
      warn(issues, 'PERMISSIONS_INVALID', `${rel}: "permissions" debe ser un array.`,
        `${rel}: "permissions" must be an array.`, manifestPath);
    } else {
      const unknown = manifest.permissions.filter(permission =>
        typeof permission === 'string' && !ALLOWED_PERMISSIONS.has(permission) &&
        !/^https?:\/\//.test(permission) && !permission.includes('*'));
      if (unknown.length) {
        warn(issues, 'PERMISSION_UNKNOWN', `${rel}: permisos no reconocidos: ${unknown.join(', ')}`,
          `${rel}: unrecognized permissions: ${unknown.join(', ')}`, manifestPath);
      }
    }
  }

  return {
    path: rel,
    id: typeof manifest.id === 'string' ? manifest.id : null,
    name: typeof manifest.name === 'string' ? manifest.name : null,
    version: typeof manifest.version === 'string' ? manifest.version : null,
    tools: toolCount,
    skills: skills.names.length
  };
}

function checkSizeLimits(root, files, pluginPaths, issues, checked) {
  for (const rel of pluginPaths) {
    const prefix = `${join(root, rel)}/`;
    const own = files.filter(file => file.path.startsWith(prefix));
    let total = 0;
    let largest = 0;
    for (const file of own) {
      total += file.size;
      largest = Math.max(largest, file.size);
      if (file.size > LIMITS.maxFileBytes) {
        fail(issues, 'FILE_TOO_LARGE', `${rel}: ${relFrom(root, file.path)} supera 32 MiB.`,
          `${rel}: ${relFrom(root, file.path)} exceeds 32 MiB.`, file.path);
      }
    }
    if (own.length > LIMITS.maxFiles) {
      fail(issues, 'TOO_MANY_FILES', `${rel}: ${own.length} archivos (máximo 5000).`,
        `${rel}: ${own.length} files (max 5000).`, join(root, rel));
    }
    if (total > LIMITS.maxTotalBytes) {
      fail(issues, 'PACKAGE_TOO_LARGE', `${rel}: ${(total / 1048576).toFixed(1)} MiB (máximo 128 MiB).`,
        `${rel}: ${(total / 1048576).toFixed(1)} MiB (max 128 MiB).`, join(root, rel));
    }
    const entry = checked.find(item => item.path === rel);
    if (entry) Object.assign(entry, {files: own.length, bytes: total, largestFileBytes: largest});
  }
}

async function doctorValidate(args) {
  const issues = [];
  const root = await resolveRoot(args.root);
  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  const {files, dirs} = await walk(root, issues);
  const filesSet = new Set(files.map(file => file.path));
  const dirsSet = new Set(dirs);
  const checked = [];
  const cache = new Map();

  async function validateOne(rel, pluginDir) {
    if (cache.has(rel)) return cache.get(rel);
    const result = await validateManifest(pluginDir, rel, issues, filesSet, dirsSet, root);
    cache.set(rel, result);
    if (result) checked.push(result);
    return result;
  }

  const top = await listDir(root);
  const pluginDirs = top.filter(entry => entry.isDirectory)
    .map(entry => String(entry.path || join(root, entry.name)));
  const discovered = [];
  for (const dir of pluginDirs) {
    if (filesSet.has(join(dir, 'manifest.json'))) discovered.push(relFrom(root, dir));
  }

  const indexPath = join(root, 'antigem-plugins.json');
  const indexed = new Set();
  const seenIds = new Set();
  if (!filesSet.has(indexPath)) {
    warn(issues, 'INDEX_MISSING', 'Falta antigem-plugins.json en la raíz.',
      'antigem-plugins.json is missing at the repository root.', indexPath);
  } else {
    const index = await readJson(indexPath, issues, 'antigem-plugins.json');
    if (index) {
      if (typeof index.name !== 'string') {
        warn(issues, 'INDEX_NAME_MISSING', 'Índice sin "name" (opcional).',
          'Index has no "name" (optional).', indexPath);
      }
      if (!Array.isArray(index.plugins)) {
        fail(issues, 'INDEX_PLUGINS_INVALID', 'Índice sin array "plugins".',
          'Index has no "plugins" array.', indexPath);
      } else {
        for (let position = 0; position < index.plugins.length; position++) {
          const entry = index.plugins[position];
          const where = `antigem-plugins.json plugins[${position}]`;
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            fail(issues, 'INDEX_ENTRY_INVALID', `${where}: entrada inválida.`,
              `${where}: invalid entry.`, indexPath);
            continue;
          }
          const rel = safeRel(entry.path, issues, where);
          if (!rel) continue;
          if (indexed.has(rel)) {
            fail(issues, 'INDEX_DUPLICATE_PATH', `${where}: ruta duplicada ${rel}.`,
              `${where}: duplicate path ${rel}.`, indexPath);
          }
          indexed.add(rel);
          const pluginDir = join(root, rel);
          if (!dirsSet.has(pluginDir) && !(await existsDir(pluginDir))) {
            fail(issues, 'INDEX_PATH_MISSING', `${where}: no existe la carpeta ${rel}.`,
              `${where}: folder not found: ${rel}.`, pluginDir);
          }
          const info = await validateOne(rel, pluginDir);
          if (info) {
            if (entry.id === undefined) {
              warn(issues, 'INDEX_ID_MISSING', `${where}: falta "id" (recomendado).`,
                `${where}: missing "id" (recommended).`, indexPath);
            } else if (typeof entry.id !== 'string') {
              fail(issues, 'INDEX_ID_INVALID', `${where}: "id" debe ser texto.`,
                `${where}: "id" must be a string.`, indexPath);
            } else if (info.id && entry.id !== info.id) {
              fail(issues, 'ID_MISMATCH', `${where}: id ${entry.id} ≠ manifest ${info.id}.`,
                `${where}: index id ${entry.id} ≠ manifest id ${info.id}.`, indexPath);
            }
            if (entry.version === undefined) {
              warn(issues, 'INDEX_VERSION_MISSING', `${where}: falta "version" (recomendado).`,
                `${where}: missing "version" (recommended).`, indexPath);
            } else if (entry.version !== info.version) {
              fail(issues, 'VERSION_MISMATCH',
                `${where}: versión ${entry.version} ≠ manifest ${info.version}.`,
                `${where}: index version ${entry.version} ≠ manifest version ${info.version}.`, indexPath);
            }
            if (entry.icon !== undefined) {
              if (typeof entry.icon !== 'string' || isUnsafeRel(entry.icon)) {
                fail(issues, 'INDEX_ICON_INVALID', `${where}: icono inválido.`,
                  `${where}: invalid icon reference.`, indexPath);
              } else if (!filesSet.has(join(pluginDir, entry.icon))) {
                fail(issues, 'INDEX_ICON_NOT_FOUND', `${where}: no existe el icono ${entry.icon}.`,
                  `${where}: icon not found: ${entry.icon}.`, indexPath);
              }
            }
          }
          const effectiveId = typeof entry.id === 'string' ? entry.id : (info && info.id);
          if (effectiveId) {
            if (seenIds.has(effectiveId)) {
              fail(issues, 'DUPLICATE_ID', `${where}: id duplicado ${effectiveId}.`,
                `${where}: duplicate id ${effectiveId}.`, indexPath);
            }
            seenIds.add(effectiveId);
          }
          if (entry.name !== undefined && typeof entry.name !== 'string') {
            fail(issues, 'INDEX_NAME_INVALID', `${where}: "name" debe ser texto.`,
              `${where}: "name" must be a string.`, indexPath);
          }
          if (entry.description !== undefined && typeof entry.description !== 'string') {
            fail(issues, 'INDEX_DESCRIPTION_INVALID', `${where}: "description" debe ser texto.`,
              `${where}: "description" must be a string.`, indexPath);
          }
        }
      }
    }
  }

  for (const rel of discovered) {
    if (!indexed.has(rel)) {
      warn(issues, 'UNLISTED_PLUGIN', `${rel}: plugin no listado en el índice.`,
        `${rel}: plugin not listed in the index.`, join(root, rel));
      await validateOne(rel, join(root, rel));
    }
  }

  for (const rel of indexed) {
    if (!discovered.includes(rel) && !filesSet.has(join(root, rel, 'manifest.json'))) {
      fail(issues, 'INDEX_NO_MANIFEST', `${rel}: entrada en el índice sin manifest.json.`,
        `${rel}: index entry has no manifest.json.`, join(root, rel));
    }
  }

  checkSizeLimits(root, files, Array.from(new Set([...discovered, ...indexed])), issues, checked);

  if (!filesSet.has(join(root, 'README.md'))) {
    info(issues, 'README_MISSING', 'Falta README.md (doctor_generate_readme puede crearlo).',
      'README.md is missing (doctor_generate_readme can create it).', join(root, 'README.md'));
  }

  const counts = {errors: 0, warnings: 0, info: 0};
  for (const issue of issues) {
    const key = issue.severity === 'error' ? 'errors' :
      issue.severity === 'warning' ? 'warnings' : 'info';
    counts[key] += 1;
  }
  const report = {
    ok: counts.errors === 0,
    root,
    language,
    summary: {...counts, plugins: checked.length, indexed: indexed.size},
    plugins: checked.sort((a, b) => a.path.localeCompare(b.path)),
    issues
  };
  report.markdown = renderReport(report, language);
  return report;
}

function renderReport(report, language) {
  const text = (es, en) => language === 'es' ? es : language === 'en' ? en : `${es} / ${en}`;
  const lines = [
    `# ${text('Informe de Plugin Doctor', 'Plugin Doctor report')}`,
    '',
    `- ${text('Raíz', 'Root')}: \`${report.root}\``,
    `- ${text('Estado', 'Status')}: **${report.ok ? text('CORRECTO', 'PASS') : text('CON ERRORES', 'FAIL')}**`,
    `- ${text('Plugins', 'Plugins')}: ${report.summary.plugins}`,
    `- ${text('Errores / avisos / notas', 'Errors / warnings / notes')}: ` +
      `${report.summary.errors} / ${report.summary.warnings} / ${report.summary.info}`,
    ''
  ];
  if (report.plugins.length) {
    lines.push(`## ${text('Plugins revisados', 'Plugins checked')}`, '');
    for (const plugin of report.plugins) {
      lines.push(`- **${plugin.name || plugin.path}** (\`${plugin.path}\`) · ` +
        `${plugin.version || '?'} · ${plugin.tools} tools · ${plugin.skills} skills · ` +
        `${plugin.files == null ? '?' : plugin.files} files`);
    }
    lines.push('');
  }
  lines.push(`## ${text('Hallazgos', 'Findings')}`, '');
  if (!report.issues.length) {
    lines.push(text('Sin hallazgos.', 'No findings.'));
  } else {
    for (const issue of report.issues) {
      const body = language === 'es' ? issue.message_es : language === 'en' ? issue.message :
        `${issue.message_es} / ${issue.message}`;
      const location = issue.path ? `\`${relFrom(report.root, issue.path)}\` — ` : '';
      lines.push(`- **${issue.severity.toUpperCase()}** [\`${issue.code}\`] ${location}${body}`);
    }
  }
  return lines.join('\n');
}

function indexIcon(manifest) {
  if (typeof manifest.icon === 'string' && manifest.icon.trim()) return manifest.icon.trim();
  if (manifest.icons && typeof manifest.icons === 'object' && !Array.isArray(manifest.icons)) {
    const keys = Object.keys(manifest.icons).sort((a, b) => Number(b) - Number(a));
    for (const key of keys) {
      if (typeof manifest.icons[key] === 'string' && manifest.icons[key].trim()) {
        return manifest.icons[key].trim();
      }
    }
  }
  return null;
}

function indexChanges(before, after) {
  const changes = [];
  const previous = before && Array.isArray(before.plugins) ? before.plugins : [];
  const byPath = new Map(previous.map(entry => [entry.path, entry]));
  if (!before) changes.push('+ antigem-plugins.json');
  for (const entry of after.plugins) {
    const old = byPath.get(entry.path);
    if (!old) {
      changes.push(`+ ${entry.path} (${entry.id || '?'} ${entry.version || '?'})`);
      continue;
    }
    for (const key of ['id', 'name', 'version', 'description', 'icon']) {
      const a = old[key] == null ? '' : String(old[key]);
      const b = entry[key] == null ? '' : String(entry[key]);
      if (a !== b) changes.push(`~ ${entry.path}.${key}: ${a || '(none)'} → ${b || '(none)'}`);
    }
  }
  for (const old of previous) {
    if (!after.plugins.some(entry => entry.path === old.path)) changes.push(`- ${old.path}`);
  }
  return changes;
}

async function doctorFixIndex(args) {
  const issues = [];
  const root = await resolveRoot(args.root);
  const dryRun = args.dry_run !== false;
  const indexPath = join(root, 'antigem-plugins.json');
  const {files} = await walk(root, issues);
  const filesSet = new Set(files.map(file => file.path));

  let before = null;
  let originalText = null;
  if (filesSet.has(indexPath)) {
    before = await readJson(indexPath, issues, 'antigem-plugins.json');
    try {
      originalText = await readText(indexPath);
    } catch (_) {
      originalText = null;
    }
  }

  const entries = [];
  for (const file of files) {
    if (file.name !== 'manifest.json') continue;
    const pluginDir = file.path.slice(0, file.path.lastIndexOf('/'));
    const rel = relFrom(root, pluginDir);
    if (!rel || rel === pluginDir) continue;
    let manifest;
    try {
      manifest = JSON.parse(await readText(file.path));
    } catch (error) {
      warn(issues, 'MANIFEST_SKIPPED', `No se pudo leer ${rel}/manifest.json: ${error.message}`,
        `Could not read ${rel}/manifest.json: ${error.message}`, file.path);
      continue;
    }
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      warn(issues, 'MANIFEST_SKIPPED', `${rel}/manifest.json no es un objeto.`,
        `${rel}/manifest.json is not an object.`, file.path);
      continue;
    }
    const entry = {path: rel};
    for (const key of ['id', 'name', 'version', 'description']) {
      if (typeof manifest[key] === 'string' && manifest[key].trim()) entry[key] = manifest[key].trim();
    }
    const icon = indexIcon(manifest);
    if (icon) entry.icon = icon;
    entries.push(entry);
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));

  const defaultName = 'Plugins comunitarios para AntiGem / AntiGem community plugins';
  const name = typeof args.name === 'string' && args.name.trim() ? args.name.trim() :
    (before && typeof before.name === 'string' ? before.name : defaultName);
  const index = {name, plugins: entries};
  const proposedText = `${JSON.stringify(index, null, 2)}\n`;
  const changes = indexChanges(before, index);
  const changed = originalText == null || originalText !== proposedText;

  let written = false;
  let backupPath = null;
  if (!dryRun && changed) {
    if (originalText != null && args.backup !== false) {
      backupPath = `${indexPath}.bak`;
      await chrome.antigem.writeFile({path: backupPath, data: originalText, encoding: 'utf8'});
    }
    await chrome.antigem.writeFile({path: indexPath, data: proposedText, encoding: 'utf8'});
    written = true;
  }

  const lines = [
    '# Plugin Doctor · fix index',
    '',
    `- Root: \`${root}\``,
    `- Mode: **${dryRun ? 'preview (dry_run)' : 'write'}**`,
    `- Plugins found: ${entries.length}`,
    `- Changed: **${changed ? 'yes' : 'no'}**`,
    `- Written: **${written ? 'yes' : 'no'}**`,
    backupPath ? `- Backup: \`${backupPath}\`` : '',
    '',
    '## Changes',
    ''
  ];
  if (!changes.length) lines.push('(none)');
  else for (const change of changes) lines.push(`- \`${change}\``);
  lines.push('', '## Proposed index', '', '```json', proposedText.trim(), '```');

  const errors = issues.filter(item => item.severity === 'error').length;
  return {
    ok: errors === 0, root, path: indexPath, written, changed, changes,
    index, issues, markdown: lines.join('\n')
  };
}

function escapeCell(value) {
  return String(value == null ? '' : value).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

function buildReadme(plugins, repository, language) {
  const buildTable = (versionLabel, descriptionLabel) => plugins.length ? [
    `| Plugin | ID | ${versionLabel} | ${descriptionLabel} |`,
    '| --- | --- | --- | --- |',
    ...plugins.map(plugin => {
      const label = escapeCell(plugin.name || plugin.path);
      const link = plugin.path ? `[${label}](./${String(plugin.path).replace(/^\/+/, '')}/)` : label;
      return `| ${link} | \`${escapeCell(plugin.id || '')}\` | ${escapeCell(plugin.version || '')} | ` +
        `${escapeCell(plugin.description || '')} |`;
    })
  ].join('\n') : '(no plugins yet)';
  const esTable = buildTable('Versión', 'Descripción');
  const enTable = buildTable('Version', 'Description');

  const es = [
    '# Plugins comunitarios para AntiGem',
    '',
    'Repositorio público con plugins y skills para AntiGem. Todo funciona offline: JavaScript incluido en cada plugin, sin CDNs ni servicios remotos.',
    '',
    '## Instalar',
    '',
    `En AntiGem: **Ajustes → Custom AntiGem Plugins → Repositories** y añade \`${repository}\`.`,
    '',
    '## Plugins',
    '',
    esTable,
    '',
    '## Mantenimiento con Plugin Doctor',
    '',
    '- `doctor_validate`: revisa manifiestos, skills, índice, enlaces y límites de tamaño.',
    '- `doctor_fix_index`: regenera `antigem-plugins.json` desde los `manifest.json`.',
    '- `doctor_generate_readme`: genera este README en español e inglés.',
    '',
    '## Límites por plugin',
    '',
    '- Máximo 5000 archivos.',
    '- Máximo 32 MiB por archivo y 128 MiB por plugin.',
    '- Sube la versión en el `manifest.json` y en el índice al publicar cambios.'
  ].join('\n');

  const en = [
    '# AntiGem community plugins',
    '',
    'Public repository with plugins and skills for AntiGem. Everything works offline: JavaScript is bundled in each plugin, with no CDNs or remote services.',
    '',
    '## Install',
    '',
    `In AntiGem: **Settings → Custom AntiGem Plugins → Repositories** and add \`${repository}\`.`,
    '',
    '## Plugins',
    '',
    enTable,
    '',
    '## Maintenance with Plugin Doctor',
    '',
    '- `doctor_validate`: check manifests, skills, index, links and size limits.',
    '- `doctor_fix_index`: rebuild `antigem-plugins.json` from every `manifest.json`.',
    '- `doctor_generate_readme`: generate this bilingual README (Spanish and English).',
    '',
    '## Per-plugin limits',
    '',
    '- 5000 files maximum.',
    '- 32 MiB per file and 128 MiB per plugin maximum.',
    '- Raise the version in both `manifest.json` and the index when publishing changes.'
  ].join('\n');

  if (language === 'es') return `${es}\n`;
  if (language === 'en') return `${en}\n`;
  return `${es}\n\n---\n\n${en}\n`;
}

async function doctorGenerateReadme(args) {
  const issues = [];
  const root = await resolveRoot(args.root);
  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  const dryRun = args.dry_run !== false;
  const output = safeRel(args.output || 'README.md', issues, 'output');
  if (!output) throw new Error('Invalid output path / Ruta de salida inválida');

  let plugins = [];
  const indexPath = join(root, 'antigem-plugins.json');
  if (await existsFile(indexPath)) {
    const index = await readJson(indexPath, issues, 'antigem-plugins.json');
    if (index && Array.isArray(index.plugins)) {
      plugins = index.plugins.filter(entry => entry && typeof entry === 'object')
        .map(entry => ({
          path: typeof entry.path === 'string' ? entry.path : '',
          id: typeof entry.id === 'string' ? entry.id : '',
          name: typeof entry.name === 'string' ? entry.name : '',
          version: typeof entry.version === 'string' ? entry.version : '',
          description: typeof entry.description === 'string' ? entry.description : ''
        }));
    }
  }
  if (!plugins.length) {
    const {files} = await walk(root, issues);
    for (const file of files) {
      if (file.name !== 'manifest.json') continue;
      let manifest;
      try {
        manifest = JSON.parse(await readText(file.path));
      } catch (_) {
        continue;
      }
      if (!manifest || typeof manifest !== 'object') continue;
      plugins.push({
        path: relFrom(root, file.path.slice(0, file.path.lastIndexOf('/'))),
        id: typeof manifest.id === 'string' ? manifest.id : '',
        name: typeof manifest.name === 'string' ? manifest.name : '',
        version: typeof manifest.version === 'string' ? manifest.version : '',
        description: typeof manifest.description === 'string' ? manifest.description : ''
      });
    }
    plugins.sort((a, b) => a.path.localeCompare(b.path));
  }

  const repository = typeof args.repository === 'string' && args.repository.trim() ?
    args.repository.trim() : 'TU_USUARIO/antigem-plugins';
  const markdown = buildReadme(plugins, repository, language);
  const path = join(root, output);
  let written = false;
  if (!dryRun) {
    await chrome.antigem.writeFile({path, data: markdown, encoding: 'utf8'});
    written = true;
  }
  const errors = issues.filter(item => item.severity === 'error').length;
  return {ok: errors === 0, root, path, written, language, plugins, markdown, issues};
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    const args = message.args || {};
    if (message.tool === 'doctor_validate') return await doctorValidate(args);
    if (message.tool === 'doctor_fix_index') return await doctorFixIndex(args);
    if (message.tool === 'doctor_generate_readme') return await doctorGenerateReadme(args);
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: error && error.message ? error.message : String(error)}]
  }));
  return true;
});
