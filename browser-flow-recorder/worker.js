'use strict';

// Browser Flow Recorder - flujos reproducibles del navegador integrado.
// Sin dependencias externas ni red: solo chrome.antigem (antigemFiles) y Web Crypto.

const ROOT = '~/browser-flow-recorder';
const FLOWS = ROOT + '/flows';
const RUNS = ROOT + '/runs';
const REPORTS = ROOT + '/reports';
const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_STEPS = 200;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const SCHEMA = 'browser-flow-recorder/1';

const SENSITIVE_KEY = /(pass(word|wd)?|secret|token|api[_-]?key|auth(orization)?|cookie|session|otp|pin|credential)/i;
const SECRET_PATTERNS = [
  [/\b(Bearer\s+)[A-Za-z0-9._~+/-]{8,}=*/gi, '$1[REDACTED]'],
  [/\b(sk-|ghp_|gho_|ghu_|ghs_|ghr_|xox[baprs]-|AIza)[A-Za-z0-9_-]{10,}/g, '[REDACTED]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[REDACTED]'],
  [/\b(password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie|session|otp)\s*[:=]\s*["']?[^\s,;"']{4,}/gi, '$1=[REDACTED]']
];

function bad(es, en) {
  throw new Error(`${es} / ${en}`);
}
function asText(value) {
  return typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value);
}
function validName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!NAME_RE.test(name)) bad('name debe tener 1-64 letras, dígitos, _ o -', 'name must be 1-64 letters, digits, _ or -');
  return name;
}
function safeOutput(value, extension) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') bad('output debe ser una ruta de texto', 'output must be a text path');
  const path = value.trim();
  if (!/^(~\/|\/sdcard\/|\/data\/)/.test(path)) bad('output debe empezar por ~/, /sdcard/ o /data/', 'output must start with ~/, /sdcard/ or /data/');
  if (path.includes('..') || !path.toLowerCase().endsWith(extension)) bad(`output debe ser una ruta ${extension} sin ..`, `output must be a ${extension} path without ..`);
  return path;
}
function escapeCell(value) {
  return asText(value).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}
function hex(buffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  return hex(await crypto.subtle.digest('SHA-256', bytes));
}

function makeRedactor(extraValues) {
  let count = 0;
  const values = Array.isArray(extraValues) ? extraValues.filter(v => typeof v === 'string' && v.length >= 3) : [];
  values.sort((a, b) => b.length - a.length);
  function clean(text) {
    let out = text;
    for (const value of values) {
      if (out.includes(value)) {
        out = out.split(value).join('[REDACTED]');
        count++;
      }
    }
    for (const [re, replacement] of SECRET_PATTERNS) {
      const matches = out.match(re);
      if (matches) count += matches.length;
      out = out.replace(re, replacement);
    }
    return out;
  }
  function walk(value, parentKey) {
    if (typeof value === 'string') return clean(value);
    if (Array.isArray(value)) return value.map(item => walk(item, parentKey));
    if (value && typeof value === 'object') {
      const out = {};
      for (const [key, child] of Object.entries(value)) {
        if (SENSITIVE_KEY.test(key) || (parentKey && SENSITIVE_KEY.test(parentKey))) {
          out[key] = '[REDACTED]';
          count++;
        } else {
          out[key] = walk(child, key);
        }
      }
      return out;
    }
    return value;
  }
  return {walk, count: () => count};
}

function normalizeSteps(steps) {
  if (!Array.isArray(steps)) bad('steps debe ser una lista', 'steps must be an array');
  if (steps.length > MAX_STEPS) bad(`máximo ${MAX_STEPS} pasos`, `${MAX_STEPS} steps maximum`);
  const warnings = [];
  const normalized = steps.map((raw, i) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) bad(`paso ${i + 1} inválido`, `step ${i + 1} is invalid`);
    const tool = typeof raw.tool === 'string' && raw.tool ? raw.tool : 'browser_computer';
    const action = typeof raw.action === 'string' ? raw.action : '';
    const args = raw.args && typeof raw.args === 'object' && !Array.isArray(raw.args) ? raw.args : {};
    const selector = typeof raw.selector === 'string' ? raw.selector : typeof args.selector === 'string' ? args.selector : '';
    const description = typeof raw.description === 'string' ? raw.description : typeof args.description === 'string' ? args.description : '';
    const refs = JSON.stringify(args).match(/ref_\d+/g) || [];
    let target = typeof raw.target === 'string' ? raw.target : selector || description || '';
    let unstable = false;
    if (refs.length) {
      if (selector || description) {
        target = target.replace(/ref_\d+/g, selector || `<${description}>`);
        warnings.push(`Paso ${i + 1}: refs convertidos a una referencia estable. / Step ${i + 1}: refs mapped to a stable reference.`);
      } else {
        unstable = true;
        warnings.push(`Paso ${i + 1}: ref_... es de la sesión; añade selector o description. / Step ${i + 1}: ref_... is session-specific; add selector or description.`);
      }
    }
    return {
      index: i + 1,
      tool,
      action,
      target,
      args,
      expect: raw.expect && typeof raw.expect === 'object' ? raw.expect : null,
      note: typeof raw.note === 'string' ? raw.note : '',
      unstable
    };
  });
  return {normalized, warnings};
}

async function readJSON(path) {
  const text = await chrome.antigem.readFile({path, encoding: 'utf8'});
  try {
    return JSON.parse(text);
  } catch (error) {
    bad('JSON corrupto en ' + path, 'Corrupt JSON in ' + path);
  }
}
async function writeJSON(path, value) {
  await chrome.antigem.writeFile({path, data: JSON.stringify(value, null, 2), encoding: 'utf8'});
  return path;
}
async function saveRun(name, data) {
  const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const run = Object.assign({id, flow: name, at: new Date().toISOString()}, data);
  await writeJSON(`${RUNS}/${id}.json`, run);
  return run;
}
async function findRun(name, runId) {
  if (runId) {
    const id = typeof runId === 'string' ? runId.trim() : '';
    if (!NAME_RE.test(id)) bad('run inválido', 'invalid run id');
    try {
      return await readJSON(`${RUNS}/${id}.json`);
    } catch (error) {
      bad('No existe la ejecución ' + id, 'No run named ' + id);
    }
  }
  let entries;
  try {
    entries = await chrome.antigem.listFiles({path: RUNS, limit: 2000});
  } catch (error) {
    bad('No hay ejecuciones guardadas', 'No saved runs');
  }
  const candidates = entries.filter(e => e.isFile && e.name.endsWith('.json'));
  const runs = [];
  for (const entry of candidates) {
    try {
      const run = await readJSON(entry.path);
      if (!name || run.flow === name) runs.push(run);
    } catch (error) { /* ignora ejecuciones corruptas */ }
  }
  runs.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  if (!runs.length) bad('No hay ejecuciones para este flujo', 'No runs for this flow');
  return runs[0];
}

function haystack(observations, key) {
  const value = observations[key == null || key === '' ? 'text' : key];
  return asText(value);
}
function arrayValues(observations, key) {
  if (key && Array.isArray(observations[key])) return observations[key];
  const found = [];
  for (const [name, value] of Object.entries(observations)) {
    if (Array.isArray(value) && /elements|visible|items|labels|nodes/i.test(name)) found.push(...value);
  }
  return found;
}
function evaluate(exp, observations) {
  if (!exp || typeof exp !== 'object') return {passed: false, detail: 'expect vacío / empty expectation'};
  const type = typeof exp.type === 'string' ? exp.type.toLowerCase() : 'contains';
  const key = typeof exp.key === 'string' ? exp.key : 'text';
  const expected = exp.value != null ? exp.value : exp.pattern;
  const actual = observations[key] != null ? observations[key] : haystack(observations, key);
  const insensitive = exp.case_insensitive !== false;
  let passed = false;
  let detail = '';
  try {
    if (type === 'contains' || type === 'not_contains') {
      const a = insensitive ? asText(actual).toLowerCase() : asText(actual);
      const b = insensitive ? asText(expected).toLowerCase() : asText(expected);
      passed = type === 'contains' ? a.includes(b) : !a.includes(b);
    } else if (type === 'regex') {
      const re = new RegExp(asText(exp.pattern || expected), exp.flags || (insensitive ? 'i' : ''));
      passed = re.test(asText(actual));
    } else if (type === 'equals') {
      passed = JSON.stringify(actual) === JSON.stringify(expected);
    } else if (type === 'exists') {
      const values = arrayValues(observations, key === 'text' ? '' : key).map(v => asText(v).toLowerCase());
      const present = observations.present && typeof observations.present === 'object' ? observations.present : null;
      const needle = asText(expected).toLowerCase();
      passed = values.some(v => v.includes(needle)) || !!(present && present[asText(expected)] === true);
    } else if (type === 'count') {
      const counts = observations.counts && typeof observations.counts === 'object' ? observations.counts : {};
      passed = Number(counts[key]) === Number(expected);
    } else {
      detail = 'Tipo desconocido / unknown type: ' + type;
    }
  } catch (error) {
    detail = String(error && error.message || error);
  }
  return {type, key, expected, actual, passed, detail};
}

async function imageInfo(path) {
  if (typeof path !== 'string' || !path.trim()) bad('path de imagen requerido', 'image path required');
  const target = path.trim();
  if (!/^(~\/|\/sdcard\/|\/data\/)/.test(target)) bad('ruta de imagen no permitida', 'image path not allowed');
  const stat = await chrome.antigem.stat({path: target});
  if (!stat.isFile) bad('la captura no es un archivo', 'the screenshot is not a file');
  if (stat.size > MAX_FILE_BYTES) bad('la captura supera 8 MiB', 'the screenshot exceeds 8 MiB');
  const base64 = await chrome.antigem.readFile({path: target, encoding: 'base64'});
  const bytes = Uint8Array.from(atob(base64), ch => ch.charCodeAt(0));
  let width = null;
  let height = null;
  const png = bytes.length > 24 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  if (png) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + 16, 8);
    width = view.getUint32(0);
    height = view.getUint32(4);
  }
  return {path: target, size: bytes.length, width, height, format: png ? 'png' : 'unknown', sha256: hex(await crypto.subtle.digest('SHA-256', bytes))};
}

function compareObservations(before, after) {
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})])).sort();
  const red = makeRedactor([]);
  const changes = [];
  for (const key of keys) {
    const a = before && before[key] !== undefined ? before[key] : null;
    const b = after && after[key] !== undefined ? after[key] : null;
    const same = JSON.stringify(a) === JSON.stringify(b);
    if (!same) changes.push({key, status: a === null ? 'added' : b === null ? 'removed' : 'changed', before: red.walk(a, key), after: red.walk(b, key)});
  }
  return {identical: changes.length === 0, changes};
}

function buildReport(flow, run, comparison, language) {
  const lang = language === 'es' || language === 'en' ? language : 'both';
  const t = (es, en) => lang === 'es' ? es : lang === 'en' ? en : `${es} / ${en}`;
  const label = {
    flow: t('Flujo', 'Flow'), url: t('URL', 'URL'), hash: t('Hash', 'Hash'), steps: t('Pasos', 'Steps'),
    tool: t('Herramienta', 'Tool'), action: t('Acción', 'Action'), target: t('Objetivo', 'Target'),
    expected: t('Esperado', 'Expected'), result: t('Resultado', 'Result'), detail: t('Detalle', 'Detail'),
    assertions: t('Aserciones', 'Assertions'), type: t('Tipo', 'Type'), actual: t('Real', 'Actual'),
    screenshots: t('Capturas', 'Screenshots'), before: t('Antes', 'Before'), after: t('Después', 'After'),
    verdict: t('Veredicto', 'Verdict'), redaction: t('Redacción', 'Redaction'), run: t('Ejecución', 'Run')
  };
  const lines = [
    `# ${t('Informe de flujo', 'Flow report')}: ${flow.id}`,
    '',
    `- **${label.flow}:** \`${flow.id}\``,
    `- **${label.url}:** ${escapeCell(flow.url || '-')}`,
    `- **${label.hash}:** \`${flow.hash || '-'}\``,
    `- **${label.run}:** \`${run ? run.id : '-'}\``,
    `- **${label.redaction}:** ${run && run.redactions != null ? run.redactions : flow.redactions || 0} ${t('valores ocultos', 'hidden values')}`,
    '',
    `## ${label.steps}`,
    '',
    '| # | ' + [label.tool, label.action, label.target, label.expected].join(' | ') + ' |',
    '| --- | --- | --- | --- | --- |'
  ];
  for (const step of flow.steps || []) {
    lines.push(`| ${step.index} | \`${escapeCell(step.tool)}\` | ${escapeCell(step.action || '-')} | ${escapeCell(step.target || (step.unstable ? 'ref inestable / unstable ref' : '-'))} | ${escapeCell(step.expect ? JSON.stringify(step.expect) : '-')} |`);
  }
  lines.push('', `## ${label.assertions}`, '');
  const results = run && Array.isArray(run.results) ? run.results : [];
  if (!results.length) {
    lines.push(t('(sin resultados: ejecuta flow_check)', '(no results: run flow_check)'));
  } else {
    lines.push('| ' + [label.type, label.expected, label.actual, label.result, label.detail].join(' | ') + ' |', '| --- | --- | --- | --- | --- |');
    for (const r of results) {
      lines.push(`| ${escapeCell(r.type)} | ${escapeCell(r.expected)} | ${escapeCell(r.actual)} | ${r.passed ? '✅' : '❌'} | ${escapeCell(r.detail || '-')} |`);
    }
  }
  lines.push('', `## ${label.screenshots}`, '');
  const images = comparison && comparison.images ? comparison.images : null;
  if (!images) {
    lines.push(t('(sin capturas: pasa beforePath y afterPath)', '(no screenshots: pass beforePath and afterPath)'));
  } else {
    lines.push('| ' + [label.before, label.after, t('Tamaño', 'Size'), t('Iguales', 'Identical')].join(' | ') + ' |', '| --- | --- | --- | --- |');
    lines.push(`| ${escapeCell(images.before ? images.before.path : '-')} | ${escapeCell(images.after ? images.after.path : '-')} | ${images.before && images.after ? images.before.size + ' / ' + images.after.size : '-'} | ${images.identical ? '✅' : '⚠️ ' + t('cambió', 'changed')} |`);
  }
  const ok = !!(run && run.summary && run.summary.ok);
  lines.push('', `**${label.verdict}:** ${ok ? '✅ ' + t('LISTO PARA REPETIR', 'READY TO REPLAY') : '❌ ' + t('CON FALLOS', 'FAILED')}`, '');
  return lines.join('\n');
}

const tools = {
  async flow_save(args) {
    const name = validName(args.name);
    const red = makeRedactor(args.sensitive);
    const rawSteps = red.walk(args.steps || []);
    const expect = args.expect == null ? [] : red.walk(args.expect);
    const notes = args.notes == null ? '' : red.walk(asText(args.notes));
    const url = args.url == null ? '' : red.walk(asText(args.url));
    const {normalized, warnings} = normalizeSteps(rawSteps);
    const body = {
      schema: SCHEMA, id: name, url, notes, steps: normalized, expect,
      created: new Date().toISOString(), updated: new Date().toISOString()
    };
    body.hash = await sha256(JSON.stringify(body));
    body.redactions = red.count();
    const path = `${FLOWS}/${name}.json`;
    await writeJSON(path, body);
    return {
      ok: true, path, name, url, steps: normalized.length, expect: expect.length,
      hash: body.hash, redactions: body.redactions, warnings,
      note: 'Los refs se normalizan a selectores; comprueba los pasos unstable antes de repetir. / Refs are mapped to selectors; check unstable steps before replay.'
    };
  },

  async flow_list(args) {
    const limit = Math.min(2000, Math.max(1, Number(args.limit) || 100));
    if (args.name != null && args.name !== '') {
      const name = validName(args.name);
      const path = `${FLOWS}/${name}.json`;
      return {ok: true, path, flow: await readJSON(path)};
    }
    let entries;
    try {
      entries = await chrome.antigem.listFiles({path: FLOWS, limit: 2000});
    } catch (error) {
      return {ok: true, flows: [], note: 'Aún no hay flujos guardados. / No saved flows yet.'};
    }
    const flows = [];
    for (const entry of entries.filter(e => e.isFile && e.name.endsWith('.json')).slice(0, limit)) {
      try {
        const flow = await readJSON(entry.path);
        flows.push({name: flow.id || entry.name.replace(/\.json$/, ''), steps: (flow.steps || []).length, url: flow.url || '', hash: flow.hash || '', updated: flow.updated || '', path: entry.path});
      } catch (error) { /* ignora entradas corruptas */ }
    }
    flows.sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
    return {ok: true, count: flows.length, flows};
  },

  async flow_check(args) {
    if (!args.observations || typeof args.observations !== 'object' || Array.isArray(args.observations)) bad('observations debe ser un objeto', 'observations must be an object');
    let name = null;
    let flow = null;
    if (args.name != null && args.name !== '') {
      name = validName(args.name);
      flow = await readJSON(`${FLOWS}/${name}.json`);
    }
    const expect = Array.isArray(args.expect) ? args.expect : flow ? flow.expect || [] : [];
    if (!expect.length) bad('no hay aserciones: guarda expect en el flujo o pásalo aquí', 'no assertions: save expect in the flow or pass it here');
    const results = expect.map(exp => evaluate(exp, args.observations));
    const passed = results.filter(r => r.passed).length;
    const summary = {total: results.length, passed, failed: results.length - passed, ok: results.length > 0 && passed === results.length};
    const red = makeRedactor([]);
    const visible = {observations: red.walk(args.observations), results: results.map(r => Object.assign({}, r, {expected: red.walk(r.expected), actual: red.walk(r.actual)}))};
    let run = null;
    if (args.save !== false && name) {
      run = await saveRun(name, Object.assign(visible, {
        summary, redactions: red.count(), language: args.language || 'both',
        expect: results.length, flowHash: flow ? flow.hash : ''
      }));
    }
    return {ok: summary.ok, summary, results: visible.results, runId: run ? run.id : null, saved: !!run};
  },

  async flow_compare(args) {
    const out = {ok: true, images: null, observations: null, baseline: null};
    if (args.beforePath || args.afterPath) {
      if (!args.beforePath || !args.afterPath) bad('para comparar capturas hacen falta beforePath y afterPath', 'both beforePath and afterPath are required');
      const before = await imageInfo(args.beforePath);
      const after = await imageInfo(args.afterPath);
      out.images = {
        before, after,
        identical: before.sha256 === after.sha256,
        dimensionsMatch: before.width == null || after.width == null ? null : before.width === after.width && before.height === after.height,
        note: 'La comparación es por bytes y dimensiones; revisa las imágenes para diferencias de píxel. / Byte and dimension comparison only; review images for pixel differences.'
      };
    }
    if (args.beforeObservations || args.afterObservations) {
      out.observations = compareObservations(args.beforeObservations || {}, args.afterObservations || {});
    }
    if (args.baseline) {
      const name = validName(args.baseline);
      const flow = await readJSON(`${FLOWS}/${name}.json`);
      out.baseline = {name, expected: flow.hash || '', actual: typeof args.hash === 'string' ? args.hash : '', same: !!args.hash && args.hash === flow.hash};
    }
    if (!out.images && !out.observations && !out.baseline) bad('nada que comparar: pasa capturas, observaciones o baseline', 'nothing to compare: pass screenshots, observations or baseline');
    const ok = (!out.images || out.images.identical) && (!out.observations || out.observations.identical) && (!out.baseline || out.baseline.same);
    out.ok = ok;
    out.verdict = ok ? '✅ sin cambios / no changes' : '⚠️ hay cambios / changes detected';
    return out;
  },

  async flow_report(args) {
    let flow = null;
    if (args.name != null && args.name !== '') flow = await readJSON(`${FLOWS}/${validName(args.name)}.json`);
    const run = await findRun(flow ? flow.id : null, args.run);
    if (!flow) flow = await readJSON(`${FLOWS}/${validName(run.flow)}.json`);
    let comparison = null;
    if (args.beforePath && args.afterPath) {
      const before = await imageInfo(args.beforePath);
      const after = await imageInfo(args.afterPath);
      comparison = {images: {before, after, identical: before.sha256 === after.sha256, dimensionsMatch: before.width == null || after.width == null ? null : before.width === after.width && before.height === after.height}};
    }
    const markdown = buildReport(flow, run, comparison, args.language || 'both');
    const dryRun = args.dry_run !== false;
    let path = safeOutput(args.output, '.md');
    if (!path) path = `${REPORTS}/${flow.id}-${run.id}.md`;
    if (!dryRun) await chrome.antigem.writeFile({path, data: markdown, encoding: 'utf8'});
    return {ok: true, path, written: !dryRun, language: args.language || 'both', runId: run.id, markdown, warnings: (flow.steps || []).filter(s => s.unstable).map(s => s.index)};
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  const fn = tools[message.tool];
  if (!fn) return false;
  (async () => fn(message.args || {}))().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: error && error.message ? error.message : String(error)}]
  }));
  return true;
});
