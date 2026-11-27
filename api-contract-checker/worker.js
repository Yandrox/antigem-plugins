'use strict';

// api-contract-checker — detector de deriva de contratos API, 100% offline.
// Solo chrome.antigem (antigemFiles) y JS puro: ni red, ni parser externo.
// El análisis de código es heurístico (regex), no un AST: puede tener falsos positivos.

const MAX_CONTRACT_BYTES = 4 * 1024 * 1024;
const MAX_FILES = 60;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_FIELDS = 120;
const MAX_SCHEMAS = 60;
const MAX_OPERATIONS = 100;
const MAX_FINDINGS = 150;
const MAX_DEPTH = 6;
const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];
const EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.py', '.go', '.java',
  '.kt', '.rb', '.php', '.cs', '.dart', '.rs', '.sql'];
const STOP_WORDS = new Set([
  'http', 'https', 'ftp', 'default', 'case', 'switch', 'return', 'import', 'from',
  'class', 'extends', 'new', 'this', 'self', 'else', 'try', 'catch', 'then',
  'async', 'await', 'const', 'let', 'var', 'function', 'if', 'for', 'while',
  'props', 'children'
]);

function asText(value) {
  return value == null ? '' : String(value);
}

function both(es, en) {
  return `${es} / ${en}`;
}

function fail(es, en) {
  throw new Error(both(es, en));
}

function pushOnce(list, text) {
  if (!list.includes(text)) list.push(text);
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

function extOf(path) {
  const match = /\.([A-Za-z0-9]+)$/.exec(asText(path));
  return match ? `.${match[1].toLowerCase()}` : '';
}

function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

function leaf(name) {
  return asText(name).split('.').pop().replace(/\[\]$/, '');
}

function basicType(type) {
  const value = asText(type).toLowerCase();
  if (value.startsWith('array')) return 'array';
  if (value.includes('|') || value === 'any') return 'any';
  if (value === 'integer') return 'number';
  if (['string', 'number', 'boolean', 'object', 'array'].includes(value)) return value;
  return 'any';
}

function resolvePointer(ref, root) {
  if (asText(ref).slice(0, 2) !== '#/') return null;
  let node = root;
  for (const raw of asText(ref).slice(2).split('/')) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!node || typeof node !== 'object' || !Object.prototype.hasOwnProperty.call(node, key)) {
      return null;
    }
    node = node[key];
  }
  return node;
}

function deref(node, root, warnings) {
  let current = node;
  const seen = new Set();
  let hops = 0;
  while (current && typeof current === 'object' && typeof current.$ref === 'string') {
    const ref = current.$ref;
    if (hops++ > 20 || seen.has(ref)) {
      if (warnings) pushOnce(warnings, both('Referencia circular o excesiva', 'Circular or excessive $ref'));
      return {};
    }
    seen.add(ref);
    const target = resolvePointer(ref, root);
    if (!target) {
      if (warnings) pushOnce(warnings, `No se pudo resolver $ref: ${ref}`);
      return {};
    }
    current = target;
  }
  return current && typeof current === 'object' ? current : {};
}

function typeOf(schema, root, warnings, depth) {
  const node = deref(schema, root, warnings);
  if (depth > MAX_DEPTH) return 'any';
  if (node.type) {
    if (Array.isArray(node.type)) {
      return node.type.map(item => item === 'integer' ? 'number' : asText(item)).join('|');
    }
    const value = asText(node.type);
    return value === 'integer' ? 'number' : value;
  }
  if (node.properties && typeof node.properties === 'object') return 'object';
  if (node.items) return `array<${typeOf(node.items, root, warnings, depth + 1)}>`;
  if (Array.isArray(node.allOf) && node.allOf.length) {
    return typeOf(node.allOf[0], root, warnings, depth + 1);
  }
  if (Array.isArray(node.oneOf) && node.oneOf.length) {
    return node.oneOf.map(item => typeOf(item, root, warnings, depth + 1)).join('|');
  }
  if (Array.isArray(node.anyOf) && node.anyOf.length) {
    return node.anyOf.map(item => typeOf(item, root, warnings, depth + 1)).join('|');
  }
  if (node.enum) return 'string';
  return 'any';
}

function flattenSchema(schema, root, warnings, label) {
  const fields = [];
  const localWarnings = [];
  const note = label ? ` (${label})` : '';

  function walk(node, prefix, depth, activeRefs) {
    if (fields.length >= MAX_FIELDS) {
      pushOnce(localWarnings, `Campos truncados a ${MAX_FIELDS}${note}`);
      return;
    }
    if (depth > MAX_DEPTH) {
      pushOnce(localWarnings, `Profundidad máxima ${MAX_DEPTH} alcanzada${note}`);
      return;
    }
    const current = deref(node, root, localWarnings);
    if (current.$ref && activeRefs.has(current.$ref)) return;

    if (Array.isArray(current.allOf)) {
      for (const sub of current.allOf) walk(sub, prefix, depth + 1, activeRefs);
    }
    for (const union of [current.oneOf, current.anyOf]) {
      if (Array.isArray(union)) {
        pushOnce(localWarnings, `Unión oneOf/anyOf aplanada${note}`);
        for (const sub of union) walk(sub, prefix, depth + 1, activeRefs);
      }
    }

    const required = Array.isArray(current.required) ? new Set(current.required) : null;
    const props = current.properties && typeof current.properties === 'object' ? current.properties : null;
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        const name = prefix ? `${prefix}.${key}` : key;
        fields.push({
          name,
          type: typeOf(value, root, localWarnings, 0),
          required: required ? required.has(key) : false
        });
        walk(value, name, depth + 1, activeRefs);
      }
    }
    if (current.items) {
      const itemPrefix = prefix ? `${prefix}[]` : 'items[]';
      if (!props) {
        fields.push({name: itemPrefix, type: typeOf(current.items, root, localWarnings, 0), required: false});
      }
      walk(current.items, itemPrefix, depth + 1, activeRefs);
    }
  }

  walk(schema, '', 0, new Set());
  const seen = new Set();
  const unique = fields.filter(field => {
    const key = `${field.name}|${field.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (localWarnings.length) warnings.push(...localWarnings);
  return unique;
}

function detectKind(parsed) {
  const version = asText(parsed.openapi || parsed.swagger);
  if (/^3\./.test(version) || (parsed.components && typeof parsed.components === 'object')) return 'openapi3';
  if (version === '2.0') return 'swagger2';
  if (parsed.$schema || parsed.properties || parsed.definitions || parsed.$defs || parsed.allOf) return 'jsonschema';
  fail('El archivo no parece OpenAPI 3, Swagger 2 ni JSON Schema',
    'File does not look like OpenAPI 3, Swagger 2 or JSON Schema');
}

async function readJson(path) {
  const stat = await chrome.antigem.stat({path});
  if (!stat.isFile) fail('La ruta debe ser un archivo', 'Path must be a file');
  if (Number(stat.size || 0) > MAX_CONTRACT_BYTES) {
    fail('El contrato supera el límite de 4 MiB', 'Contract exceeds the 4 MiB limit');
  }
  const text = await chrome.antigem.readFile({path, encoding: 'utf8'});
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`JSON inválido en ${path}: ${error.message}`, `Invalid JSON in ${path}: ${error.message}`);
  }
}

function jsonContentSchema(content) {
  if (!content || typeof content !== 'object') return null;
  for (const key of ['application/json', 'application/*+json', '*/*']) {
    if (content[key] && content[key].schema) return content[key].schema;
  }
  const first = Object.values(content).find(item => item && item.schema);
  return first ? first.schema : null;
}

function parameterList(common, own, root, warnings) {
  const map = new Map();
  for (const raw of [...common, ...own]) {
    const item = deref(raw, root, warnings);
    if (!item || !item.name) continue;
    const location = asText(item.in || 'query');
    const key = `${location}:${asText(item.name)}`;
    map.set(key, {
      name: asText(item.name),
      in: location,
      required: item.required === true,
      type: typeOf(item.schema || item, root, warnings, 0)
    });
  }
  return Array.from(map.values());
}

function prefixedFields(fields, prefix) {
  return fields.map(field => ({...field, name: `${prefix}.${field.name}`}));
}

async function loadModel(path) {
  const parsed = await readJson(path);
  const kind = detectKind(parsed);
  const root = parsed;
  const warnings = [];
  const defs = (kind === 'openapi3' && parsed.components && parsed.components.schemas) ||
    parsed.definitions || parsed.$defs || {};

  const schemas = [];
  if (kind === 'jsonschema' && (parsed.properties || parsed.allOf || parsed.oneOf || parsed.anyOf)) {
    schemas.push({
      name: 'Root',
      type: typeOf(parsed, root, warnings, 0),
      fields: flattenSchema(parsed, root, warnings, 'Root')
    });
  }
  for (const [name, schema] of Object.entries(defs).slice(0, MAX_SCHEMAS)) {
    schemas.push({
      name,
      type: typeOf(schema, root, warnings, 0),
      fields: flattenSchema(schema, root, warnings, name)
    });
  }

  const operations = [];
  const paths = parsed.paths && typeof parsed.paths === 'object' ? parsed.paths : {};
  for (const [route, item] of Object.entries(paths).slice(0, MAX_OPERATIONS)) {
    if (!item || typeof item !== 'object') continue;
    const common = Array.isArray(item.parameters) ? item.parameters : [];
    for (const method of METHODS) {
      const op = item[method];
      if (!op || typeof op !== 'object') continue;
      const own = Array.isArray(op.parameters) ? op.parameters : [];
      const parameters = parameterList(common, own, root, warnings);
      const bodySchema = kind === 'openapi3' ?
        jsonContentSchema(op.requestBody && op.requestBody.content) :
        (own.map(raw => deref(raw, root, warnings)).find(raw => raw && raw.in === 'body') || {}).schema;
      const requestFields = bodySchema ? prefixedFields(flattenSchema(bodySchema, root, warnings, `${method} ${route} body`), 'body') : [];
      const codes = Object.keys(op.responses && typeof op.responses === 'object' ? op.responses : {})
        .filter(code => /^2\d\d$/.test(code)).sort();
      let responseFields = [];
      if (codes.length) {
        const response = deref(op.responses[codes[0]], root, warnings);
        const schema = kind === 'openapi3' ? jsonContentSchema(response.content) : response.schema;
        if (schema) {
          responseFields = prefixedFields(flattenSchema(schema, root, warnings, `${method} ${route} response`), 'response');
        }
      }
      operations.push({
        id: `${method.toUpperCase()} ${route}`,
        method: method.toUpperCase(),
        path: route,
        summary: asText(op.summary || op.operationId),
        parameters,
        requestFields,
        responseFields
      });
    }
  }

  return {
    path,
    kind,
    version: asText(parsed.openapi || parsed.swagger || parsed.$schema || '1'),
    title: asText((parsed.info && parsed.info.title) || parsed.title || asText(path).split('/').pop()),
    schemas,
    operations,
    warnings
  };
}

function contractSummary(model) {
  const fieldCount = model.schemas.reduce((total, schema) => total + schema.fields.length, 0);
  return {
    kind: model.kind,
    version: model.version,
    title: model.title,
    operations: model.operations.length,
    schemas: model.schemas.length,
    fields: fieldCount,
    warnings: model.warnings
  };
}

function change(severity, kind, location, es, en) {
  return {severity, kind, location, detail: both(es, en)};
}

function compareFields(oldFields, newFields, location, responseMode) {
  const changes = [];
  const oldMap = new Map(oldFields.map(field => [field.name, field]));
  const newMap = new Map(newFields.map(field => [field.name, field]));
  for (const [name, field] of oldMap) {
    if (!newMap.has(name)) {
      changes.push(change(responseMode ? 'breaking' : 'warning',
        responseMode ? 'response_field_removed' : 'request_field_removed', location,
        `Campo eliminado: ${name}`, `Field removed: ${name}`));
    }
  }
  for (const [name, field] of newMap) {
    const before = oldMap.get(name);
    if (!before) {
      changes.push(change(field.required && !responseMode ? 'breaking' : 'info',
        'field_added', location,
        `Campo añadido: ${name}${field.required ? ' (obligatorio)' : ''}`,
        `Field added: ${name}${field.required ? ' (required)' : ''}`));
      continue;
    }
    if (basicType(before.type) !== basicType(field.type)) {
      changes.push(change('breaking', 'field_type_changed', location,
        `Tipo cambiado en ${name}: ${before.type} → ${field.type}`,
        `Type changed on ${name}: ${before.type} → ${field.type}`));
    }
    if (!before.required && field.required) {
      changes.push(change('breaking' , 'field_now_required', location,
        `${name} pasa a obligatorio`, `${name} is now required`));
    } else if (before.required && !field.required) {
      changes.push(change('info', 'field_now_optional', location,
        `${name} pasa a opcional`, `${name} is now optional`));
    }
  }
  return changes;
}

function compareModels(oldModel, newModel) {
  const changes = [];
  const oldOps = new Map(oldModel.operations.map(op => [op.id, op]));
  const newOps = new Map(newModel.operations.map(op => [op.id, op]));
  for (const [id, op] of oldOps) {
    if (!newOps.has(id)) changes.push(change('breaking', 'operation_removed', id,
      'Operación eliminada', 'Operation removed'));
  }
  for (const [id, op] of newOps) {
    if (!oldOps.has(id)) changes.push(change('info', 'operation_added', id,
      'Operación añadida', 'Operation added'));
  }
  for (const [id, after] of newOps) {
    const before = oldOps.get(id);
    if (!before) continue;
    const oldParams = new Map(before.parameters.map(p => [p.name, p]));
    const newParams = new Map(after.parameters.map(p => [p.name, p]));
    for (const [name, param] of oldParams) {
      if (!newParams.has(name)) changes.push(change('breaking', 'parameter_removed', id,
        `Parámetro eliminado: ${name}`, `Parameter removed: ${name}`));
    }
    for (const [name, param] of newParams) {
      const prior = oldParams.get(name);
      if (!prior) {
        changes.push(change(param.required ? 'breaking' : 'info', 'parameter_added', id,
          `Parámetro añadido: ${name}${param.required ? ' (obligatorio)' : ''}`,
          `Parameter added: ${name}${param.required ? ' (required)' : ''}`));
      } else {
        if (basicType(prior.type) !== basicType(param.type)) {
          changes.push(change('breaking', 'parameter_type_changed', id,
            `Tipo cambiado en ${name}: ${prior.type} → ${param.type}`,
            `Type changed on ${name}: ${prior.type} → ${param.type}`));
        }
        if (!prior.required && param.required) {
          changes.push(change('breaking', 'parameter_now_required', id,
            `${name} pasa a obligatorio`, `${name} is now required`));
        }
      }
    }
    changes.push(...compareFields(before.requestFields, after.requestFields, id, false));
    changes.push(...compareFields(before.responseFields, after.responseFields, id, true));
  }

  const oldSchemas = new Map(oldModel.schemas.map(s => [s.name, s]));
  const newSchemas = new Map(newModel.schemas.map(s => [s.name, s]));
  for (const [name] of oldSchemas) {
    if (!newSchemas.has(name)) changes.push(change('warning', 'schema_removed', name,
      'Esquema eliminado', 'Schema removed'));
  }
  for (const [name, schema] of newSchemas) {
    const before = oldSchemas.get(name);
    if (!before) {
      changes.push(change('info', 'schema_added', name, 'Esquema añadido', 'Schema added'));
      continue;
    }
    changes.push(...compareFields(before.fields, schema.fields, name, false));
  }

  const limited = changes.slice(0, MAX_FINDINGS);
  const summary = {
    breaking: limited.filter(item => item.severity === 'breaking').length,
    warning: limited.filter(item => item.severity === 'warning').length,
    info: limited.filter(item => item.severity === 'info').length,
    truncated: changes.length > limited.length
  };
  return {summary, changes: limited};
}

function normalizeRoute(raw) {
  let value = asText(raw).split(/[?#]/)[0].trim().replace(/\/+$/, '');
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/*')) return '';
  const segments = value.split('/').map(segment => {
    if (!segment) return '';
    if (/^[:*]/.test(segment) || /^\{[\w-]+\}$/.test(segment) ||
        segment.includes('${') || /^<[\w-]+>$/.test(segment)) return '{}';
    return segment;
  });
  return segments.join('/') || '/';
}

function inferType(tail) {
  const value = asText(tail).trim();
  if (/^['"`]/.test(value)) return 'string';
  if (/^String\s*\(/.test(value)) return 'string';
  if (/^Number\s*\(/.test(value)) return 'number';
  if (/^Boolean\s*\(/.test(value)) return 'boolean';
  if (/^-?\d/.test(value)) return 'number';
  if (/^(true|false)\b/.test(value)) return 'boolean';
  if (/^\[/.test(value)) return 'array';
  if (/^\{/.test(value)) return 'object';
  return 'unknown';
}

function extractFile(text, path) {
  const routes = [];
  const fields = [];
  const routeRe = /(['"`])([^'"`\n]{1,240})\1/g;
  let match;
  while ((match = routeRe.exec(text)) !== null) {
    const raw = match[2];
    if (!raw.startsWith('/')) continue;
    const normalized = normalizeRoute(raw);
    if (normalized && normalized !== '/') {
      routes.push({value: normalized, raw, line: lineAt(text, match.index)});
    }
  }
  const keyRe = /(?:["']([A-Za-z_$][\w$-]{1,60})["']|\b([A-Za-z_$][\w$]{1,60}))\s*:\s*([^\n,})\]]{0,40})/g;
  while ((match = keyRe.exec(text)) !== null) {
    const name = match[1] || match[2];
    if (STOP_WORDS.has(name.toLowerCase())) continue;
    if (fields.some(field => field.name === name)) continue;
    fields.push({name, type: inferType(match[3]), file: path, line: lineAt(text, match.index)});
    if (fields.length >= 300) break;
  }
  return {path, routes, fields};
}

async function collectFiles(args, warnings) {
  const explicit = Array.isArray(args.files) ? args.files.map(asText).filter(Boolean) : [];
  const discovered = [];
  if (args.directory) {
    const directory = normalizePath(args.directory, 'la carpeta de código', 'code directory');
    const entries = await chrome.antigem.listFiles({path: directory, recursive: true, limit: 2000});
    for (const entry of entries) {
      if (entry.isFile && EXTENSIONS.includes(extOf(entry.path))) discovered.push(entry.path);
    }
  }
  const output = [];
  const seen = new Set();
  for (const path of [...explicit, ...discovered]) {
    const safe = normalizePath(path, 'la ruta de archivo', 'file path');
    if (seen.has(safe)) continue;
    seen.add(safe);
    output.push(safe);
    if (output.length >= MAX_FILES) {
      pushOnce(warnings, `Archivos limitados a ${MAX_FILES}`);
      break;
    }
  }
  return output;
}

async function scanCode(model, args) {
  const warnings = [];
  const paths = await collectFiles(args, warnings);
  if (!paths.length) fail('No hay archivos de código para analizar', 'No code files to scan');

  const files = [];
  for (const path of paths) {
    try {
      const stat = await chrome.antigem.stat({path});
      if (!stat.isFile) continue;
      if (Number(stat.size || 0) > MAX_FILE_BYTES) {
        pushOnce(warnings, `Archivo omitido por tamaño: ${path}`);
        continue;
      }
      const text = await chrome.antigem.readFile({path, encoding: 'utf8'});
      if (text.includes('\0')) {
        pushOnce(warnings, `Archivo binario omitido: ${path}`);
        continue;
      }
      files.push(extractFile(text, path));
    } catch (error) {
      pushOnce(warnings, `No se pudo leer ${path}: ${error.message}`);
    }
  }

  const byRoute = new Map();
  const routeExpected = new Map();
  for (const op of model.operations) {
    const key = normalizeRoute(op.path);
    if (!byRoute.has(key)) byRoute.set(key, []);
    byRoute.get(key).push(op);
    if (!routeExpected.has(key)) routeExpected.set(key, new Set());
    const expected = routeExpected.get(key);
    for (const param of op.parameters) expected.add(leaf(param.name));
    for (const field of [...op.requestFields, ...op.responseFields]) expected.add(leaf(field.name));
  }

  const findings = [];
  const matchedRoutes = new Set();
  const unmatchedRoutes = [];
  const operationIds = new Set();
  const codeByOperation = new Map();
  for (const file of files) {
    for (const route of file.routes) {
      const ops = byRoute.get(route.value) || [];
      if (!ops.length) {
        if (unmatchedRoutes.length < 30) unmatchedRoutes.push({route: route.raw, file: file.path, line: route.line});
        continue;
      }
      matchedRoutes.add(route.value);
      for (const op of ops) {
        operationIds.add(op.id);
        if (!codeByOperation.has(op.id)) codeByOperation.set(op.id, new Map());
        for (const field of file.fields) {
          if (!codeByOperation.get(op.id).has(field.name)) {
            codeByOperation.get(op.id).set(field.name, field);
          }
        }
      }
    }
  }

  if (!operationIds.size) {
    findings.push(change('warning', 'no_route_match', 'scan',
      'Ninguna ruta del código coincide con el contrato; revisa los archivos o las rutas',
      'No code route matches the contract; check files or routes'));
  }
  for (const item of unmatchedRoutes) {
    findings.push(change('info', 'unmatched_route', item.route,
      `Ruta de código sin contrato: ${item.file}:${item.line}`,
      `Code route without contract: ${item.file}:${item.line}`));
  }

  for (const id of operationIds) {
    const op = model.operations.find(item => item.id === id);
    const codeFields = Array.from((codeByOperation.get(id) || new Map()).values());
    const codeNames = new Set(codeFields.map(field => field.name));
    const requestFields = [
      ...op.parameters.map(param => ({name: param.name, type: param.type, required: param.required})),
      ...op.requestFields
    ];
    const expected = new Set([
      ...requestFields.map(field => leaf(field.name)),
      ...op.responseFields.map(field => leaf(field.name))
    ]);
    const sharedExpected = routeExpected.get(normalizeRoute(op.path)) || expected;
    if (codeFields.length) {
      for (const field of requestFields) {
        const name = leaf(field.name);
        if (!codeNames.has(name)) {
          findings.push(change('warning', 'missing_field', id,
            `Campo del contrato no visto en el código: ${name}`,
            `Contract field not seen in code: ${name}`));
        }
      }
      for (const field of codeFields) {
        if (sharedExpected.has(field.name) || field.name.length < 3) continue;
        findings.push(change('info', 'extra_field', id,
          `Campo en código fuera del contrato: ${field.name} (${field.file}:${field.line})`,
          `Code field outside the contract: ${field.name} (${field.file}:${field.line})`));
      }
      for (const field of requestFields) {
        const name = leaf(field.name);
        const actual = codeFields.find(item => item.name === name);
        if (!actual || actual.type === 'unknown' || basicType(field.type) === 'any') continue;
        if (basicType(field.type) !== basicType(actual.type)) {
          findings.push(change('warning', 'type_mismatch', id,
            `Tipo de ${name}: contrato ${field.type}, código ${actual.type} (${actual.file}:${actual.line})`,
            `Type of ${name}: contract ${field.type}, code ${actual.type} (${actual.file}:${actual.line})`));
        }
      }
    }
  }

  const limited = findings.slice(0, MAX_FINDINGS);
  return {
    filesScanned: files.length,
    matchedRoutes: Array.from(matchedRoutes).sort(),
    unmatchedRoutes,
    findings: limited,
    summary: {
      files: files.length,
      operations: operationIds.size,
      breaking: limited.filter(item => item.severity === 'breaking').length,
      warning: limited.filter(item => item.severity === 'warning').length,
      info: limited.filter(item => item.severity === 'info').length,
      truncated: findings.length > limited.length
    },
    warnings
  };
}

async function contractParse(args) {
  const path = normalizePath(args.path, 'la ruta del contrato', 'contract path', '.json');
  const model = await loadModel(path);
  return {
    ok: true,
    path,
    contract: contractSummary(model),
    operations: model.operations.map(op => ({
      id: op.id,
      summary: op.summary,
      parameters: op.parameters,
      requestFields: op.requestFields,
      responseFields: op.responseFields
    })),
    schemas: model.schemas.map(schema => ({name: schema.name, type: schema.type, fields: schema.fields})),
    message: both(`${model.operations.length} operaciones y ${model.schemas.length} esquemas.`,
      `${model.operations.length} operations and ${model.schemas.length} schemas.`)
  };
}

async function contractDiff(args) {
  const oldPath = normalizePath(args.old, 'la ruta del contrato anterior', 'old contract path', '.json');
  const newPath = normalizePath(args.new, 'la ruta del contrato nuevo', 'new contract path', '.json');
  const [oldModel, newModel] = await Promise.all([loadModel(oldPath), loadModel(newPath)]);
  const result = compareModels(oldModel, newModel);
  return {
    ok: true,
    old: oldPath,
    new: newPath,
    summary: result.summary,
    changes: result.changes,
    message: both(
      `${result.summary.breaking} rupturas, ${result.summary.warning} avisos, ${result.summary.info} notas.`,
      `${result.summary.breaking} breaking, ${result.summary.warning} warnings, ${result.summary.info} info.`
    )
  };
}

async function contractScan(args) {
  const path = normalizePath(args.contract, 'la ruta del contrato', 'contract path', '.json');
  const model = await loadModel(path);
  const scan = await scanCode(model, args);
  return {ok: true, contract: path, model: contractSummary(model), scan,
    message: both(`${scan.summary.operations} operaciones revisadas en ${scan.summary.files} archivos.`,
      `${scan.summary.operations} operations checked across ${scan.summary.files} files.`)};
}

function markdownRow(cells) {
  return `| ${cells.map(cell => asText(cell).replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`;
}

function renderReport(model, diff, scan, args) {
  const lines = [
    '# API Contract Checker',
    '',
    '## ES',
    '',
    `Contrato: \`${model.path}\` (${model.kind} ${model.version}).`,
    '',
    `- Operaciones: ${model.operations.length}`,
    `- Esquemas: ${model.schemas.length}`,
    `- Avisos del contrato: ${model.warnings.length}`,
    ''
  ];
  if (diff) {
    lines.push('### Cambios entre versiones', '',
      `- Rupturas: ${diff.summary.breaking} | Avisos: ${diff.summary.warning} | Notas: ${diff.summary.info}`,
      '', markdownRow(['Gravedad', 'Tipo', 'Ubicación', 'Detalle']),
      markdownRow(['---', '---', '---', '---']));
    for (const item of diff.changes) {
      lines.push(markdownRow([item.severity, item.kind, item.location, item.detail]));
    }
    if (!diff.changes.length) lines.push('', 'Sin cambios.');
    lines.push('');
  }
  if (scan) {
    lines.push('### Deriva frente al código', '',
      `- Archivos analizados: ${scan.summary.files} | Operaciones con ruta coincidente: ${scan.summary.operations}`,
      `- Rupturas: ${scan.summary.breaking} | Avisos: ${scan.summary.warning} | Notas: ${scan.summary.info}`,
      '', markdownRow(['Gravedad', 'Tipo', 'Ubicación', 'Detalle']),
      markdownRow(['---', '---', '---', '---']));
    for (const item of scan.findings) {
      lines.push(markdownRow([item.severity, item.kind, item.location, item.detail]));
    }
    if (!scan.findings.length) lines.push('', 'Sin hallazgos.');
    lines.push('');
  }
  lines.push('> Análisis heurístico basado en texto: revisa los hallazgos antes de aplicar cambios.', '');

  lines.push('## EN', '',
    `Contract: \`${model.path}\` (${model.kind} ${model.version}).`, '',
    `- Operations: ${model.operations.length}`,
    `- Schemas: ${model.schemas.length}`,
    `- Contract warnings: ${model.warnings.length}`, '');
  if (diff) {
    lines.push('### Changes between versions', '',
      `- Breaking: ${diff.summary.breaking} | Warnings: ${diff.summary.warning} | Info: ${diff.summary.info}`,
      '', markdownRow(['Severity', 'Kind', 'Location', 'Detail']),
      markdownRow(['---', '---', '---', '---']));
    for (const item of diff.changes) {
      lines.push(markdownRow([item.severity, item.kind, item.location, item.detail]));
    }
    if (!diff.changes.length) lines.push('', 'No changes.');
    lines.push('');
  }
  if (scan) {
    lines.push('### Code drift', '',
      `- Files scanned: ${scan.summary.files} | Operations with a matching route: ${scan.summary.operations}`,
      `- Breaking: ${scan.summary.breaking} | Warnings: ${scan.summary.warning} | Info: ${scan.summary.info}`,
      '', markdownRow(['Severity', 'Kind', 'Location', 'Detail']),
      markdownRow(['---', '---', '---', '---']));
    for (const item of scan.findings) {
      lines.push(markdownRow([item.severity, item.kind, item.location, item.detail]));
    }
    if (!scan.findings.length) lines.push('', 'No findings.');
    lines.push('');
  }
  lines.push('> Text-based heuristic analysis: review every finding before changing code.', '');
  if (args.output) lines.push(`Report: \`${args.output}\``, '');
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

async function contractReport(args) {
  const path = normalizePath(args.contract, 'la ruta del contrato', 'contract path', '.json');
  const model = await loadModel(path);
  let diff = null;
  if (args.old && args.new) {
    const oldPath = normalizePath(args.old, 'la ruta del contrato anterior', 'old contract path', '.json');
    const newPath = normalizePath(args.new, 'la ruta del contrato nuevo', 'new contract path', '.json');
    const [oldModel, newModel] = await Promise.all([loadModel(oldPath), loadModel(newPath)]);
    diff = compareModels(oldModel, newModel);
  }
  let scan = null;
  if (args.files || args.directory) scan = await scanCode(model, args);
  const output = args.output == null ? '' : normalizePath(args.output, 'la ruta del informe', 'report path', '.md');
  const markdown = renderReport(model, diff, scan, {...args, output});
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
  return {
    ok: true,
    contract: path,
    output: output || null,
    dry_run: dryRun,
    written,
    diff: diff ? diff.summary : null,
    scan: scan ? scan.summary : null,
    markdown,
    message: both('Informe de deriva listo.', 'Drift report ready.')
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    const args = message.args || {};
    if (message.tool === 'contract_parse') return await contractParse(args);
    if (message.tool === 'contract_diff') return await contractDiff(args);
    if (message.tool === 'contract_scan') return await contractScan(args);
    if (message.tool === 'contract_report') return await contractReport(args);
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: error && error.message ? error.message : String(error)}]
  }));
  return true;
});
