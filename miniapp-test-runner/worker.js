'use strict';

// Algunos WebViews de este runtime no exponen crypto.randomUUID y las APIs
// de scripting/mensajería lo necesitan internamente. Se aporta un polyfill
// determinista antes de cualquier llamada a chrome.*.
try {
  if (!globalThis.crypto) globalThis.crypto = {};
  if (typeof globalThis.crypto.randomUUID !== 'function') {
    globalThis.crypto.randomUUID = function randomUUID() {
      const bytes = new Uint8Array(16);
      if (typeof globalThis.crypto.getRandomValues === 'function') {
        globalThis.crypto.getRandomValues(bytes);
      } else {
        for (let index = 0; index < bytes.length; index++) {
          bytes[index] = Math.floor(Math.random() * 256);
        }
      }
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
      return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-` +
        `${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-` +
        `${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
    };
  }
} catch (_) {
  // Si el entorno no permite tocar crypto, seguimos sin polyfill.
}

// MiniApp Test Runner - grabación y repetición de pruebas dentro de WebViews.
// Todo el código va incluido en el plugin: sin CDNs ni servicios remotos.

const PREFIX = 'mtr.';

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(Math.min(max, Math.max(min, number)));
}

function safeName(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value.trim())) {
    throw new Error('name debe tener 1-64 letras, números, _ o - / name must be 1-64 letters, numbers, _ or -');
  }
  return value.trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function joinPath(base, file) {
  const cleanBase = String(base).replace(/\/+$/, '');
  return `${cleanBase}/${String(file).replace(/^\/+/, '')}`;
}

async function storeGet(key, fallback = null) {
  const values = await chrome.storage.local.get(key);
  return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback;
}

async function storeSet(key, value) {
  await chrome.storage.local.set({[key]: value});
}

async function resolveTabId(args) {
  if (args.tabId !== undefined && args.tabId !== null) {
    const tabId = Number(args.tabId);
    if (!Number.isInteger(tabId)) throw new Error('tabId debe ser entero / tabId must be an integer');
    await chrome.tabs.get(tabId);
    return tabId;
  }
  const tabs = await chrome.tabs.query({active: true, windowId: 1});
  if (!tabs.length) throw new Error('No hay pestaña activa / No active tab');
  return tabs[0].id;
}

async function injectViaBridge(tabId, func, args) {
  // El content script incluido evita el fallo de executeScript en este WebView.
  const response = await chrome.tabs.sendMessage(tabId, {
    type: 'mtr.code', code: func.toString(), args
  });
  if (!response) throw new Error('El content script no respondió / Content script did not respond');
  if (!response.ok) throw new Error(response.error || 'Error en la página / Page error');
  return response.value;
}

async function injectViaDebugger(tabId, func, args) {
  const expression = `(${func.toString()})(...${JSON.stringify(args || [])})`;
  await chrome.debugger.attach({tabId}, '1.3');
  try {
    const response = await chrome.debugger.sendCommand({tabId}, 'Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (response && response.exceptionDetails) {
      throw new Error(response.exceptionDetails.text || 'CDP evaluation failed');
    }
    return response && response.result ? response.result.value : undefined;
  } finally {
    await chrome.debugger.detach({tabId});
  }
}

async function inject(tabId, func, args = []) {
  const strategies = [
    ['bridge', () => injectViaBridge(tabId, func, args)],
    ['debugger', () => injectViaDebugger(tabId, func, args)],
    ['scripting', async () => {
      const results = await chrome.scripting.executeScript({
        target: {tabId}, func, args
      });
      return results && results[0] ? results[0].result : undefined;
    }]
  ];
  let lastError = null;
  for (const [name, run] of strategies) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(lastError && lastError.message ? lastError.message : String(lastError));
}

function installRecorder(input) {
  const escapeCss = value => String(value).replace(/[^A-Za-z0-9_-]/g, char => `\\${char}`);
  const selectorOf = element => {
    if (!element || element.nodeType !== 1) return '';
    if (element.id) return `#${escapeCss(element.id)}`;
    const parts = [];
    let node = element;
    while (node && node.nodeType === 1 && parts.length < 5) {
      let part = node.tagName.toLowerCase();
      const className = typeof node.className === 'string' ? node.className.trim() : '';
      if (className) part += `.${className.split(/\s+/).slice(0, 2).map(escapeCss).join('.')}`;
      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.prototype.filter.call(parent.children,
          child => child.tagName === node.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      if (node.id) break;
      node = parent;
    }
    return parts.join(' > ');
  };

  if (input.clear || !window.__mtrSteps) window.__mtrSteps = [];
  if (window.__mtrRecorderInstalled) {
    return {installed: true, count: window.__mtrSteps.length};
  }
  const push = step => {
    window.__mtrSteps.push(Object.assign({t: Date.now()}, step));
    if (window.__mtrSteps.length > 500) window.__mtrSteps.shift();
  };
  document.addEventListener('click', event => {
    push({type: 'click', selector: selectorOf(event.target),
      text: String(event.target && event.target.innerText || '').slice(0, 40)});
  }, true);
  document.addEventListener('input', event => {
    const element = event.target;
    if (element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
      push({type: 'type', selector: selectorOf(element), value: String(element.value || '').slice(0, 200)});
    }
  }, true);
  document.addEventListener('change', event => {
    const element = event.target;
    if (element && element.tagName === 'SELECT') {
      push({type: 'select', selector: selectorOf(element), value: String(element.value || '')});
    }
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === 'Escape') {
      push({type: 'key', key: event.key, selector: selectorOf(event.target)});
    }
  }, true);
  window.__mtrRecorderInstalled = true;
  return {installed: true, count: 0};
}

function readRecorder() {
  return JSON.parse(JSON.stringify(window.__mtrSteps || []));
}

function pageAction(input) {
  const findNodes = () => {
    let nodes = [];
    try {
      nodes = Array.prototype.slice.call(document.querySelectorAll(String(input.selector || '')));
    } catch (error) {
      return {error: String(error && error.message || error)};
    }
    if (input.text) {
      nodes = nodes.filter(node => String(node.innerText || node.textContent || '').indexOf(input.text) >= 0);
    }
    return {nodes};
  };
  const pick = found => found.nodes[Math.min(Math.max(0, input.index || 0), found.nodes.length - 1)];

  switch (input.kind) {
    case 'click': {
      const found = findNodes();
      if (found.error) return {ok: false, error: found.error};
      const node = pick(found);
      if (!node) return {ok: false, error: `no element matches ${input.selector}`};
      node.click();
      return {ok: true, tag: node.tagName, text: String(node.innerText || '').slice(0, 80)};
    }
    case 'rect': {
      const found = findNodes();
      if (found.error) return {ok: false, error: found.error};
      const node = pick(found);
      if (!node) return {ok: false, error: `no element matches ${input.selector}`};
      const box = node.getBoundingClientRect();
      const viewport = window.visualViewport;
      const width = viewport ? viewport.width : window.innerWidth;
      const height = viewport ? viewport.height : window.innerHeight;
      return {
        ok: true,
        fx: (box.left + box.width / 2 - (viewport ? viewport.offsetLeft : 0)) / width,
        fy: (box.top + box.height / 2 - (viewport ? viewport.offsetTop : 0)) / height
      };
    }
    case 'type': {
      const found = findNodes();
      if (found.error) return {ok: false, error: found.error};
      const node = pick(found);
      if (!node) return {ok: false, error: `no element matches ${input.selector}`};
      const value = String(input.value == null ? '' : input.value);
      if (node.isContentEditable) {
        node.textContent = value;
      } else {
        const prototype = Object.getPrototypeOf(node);
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value') ||
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        if (descriptor && descriptor.set) descriptor.set.call(node, value);
        else node.value = value;
      }
      node.dispatchEvent(new Event('input', {bubbles: true}));
      node.dispatchEvent(new Event('change', {bubbles: true}));
      return {ok: true, value};
    }
    case 'select': {
      const found = findNodes();
      if (found.error) return {ok: false, error: found.error};
      const node = pick(found);
      if (!node) return {ok: false, error: `no element matches ${input.selector}`};
      node.value = String(input.value == null ? '' : input.value);
      node.dispatchEvent(new Event('change', {bubbles: true}));
      return {ok: true, value: node.value};
    }
    case 'key': {
      const found = findNodes();
      if (found.error) return {ok: false, error: found.error};
      const target = input.selector ? pick(found) : document.body;
      if (!target) return {ok: false, error: `no element matches ${input.selector}`};
      const key = String(input.key || 'Enter');
      target.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true}));
      target.dispatchEvent(new KeyboardEvent('keyup', {key, bubbles: true}));
      return {ok: true, key};
    }
    case 'scroll': {
      if (!input.selector) {
        window.scrollBy(Number(input.x || 0), Number(input.y || 0));
        return {ok: true};
      }
      const found = findNodes();
      if (found.error) return {ok: false, error: found.error};
      const node = pick(found);
      if (!node) return {ok: false, error: `no element matches ${input.selector}`};
      node.scrollIntoView({block: 'center'});
      return {ok: true};
    }
    case 'assert': {
      const found = findNodes();
      if (found.error) return {ok: false, error: found.error};
      const nodes = found.nodes;
      if (input.exists === false && !input.text && input.value === undefined && !input.attr) {
        return {ok: nodes.length === 0, actual: {count: nodes.length}};
      }
      const node = nodes[0];
      if (!node) return {ok: false, actual: {count: 0}, error: `no element matches ${input.selector}`};
      const actual = {
        count: nodes.length,
        text: String(node.innerText || node.textContent || '').slice(0, 200),
        value: 'value' in node ? String(node.value) : null
      };
      if (input.attr) actual.attr = node.getAttribute(input.attr);
      let ok = true;
      const checks = [];
      if (input.exists === false) {
        ok = false;
        checks.push('exists=false but element found');
      }
      if (input.text && actual.text.indexOf(String(input.text)) < 0) {
        ok = false;
        checks.push('text mismatch');
      }
      if (input.value !== undefined && actual.value !== String(input.value)) {
        ok = false;
        checks.push('value mismatch');
      }
      if (input.attr) {
        const expected = input.attrValue == null ? '' : String(input.attrValue);
        if (actual.attr !== expected) {
          ok = false;
          checks.push('attribute mismatch');
        }
      }
      return {ok, actual, checks};
    }
    default:
      return {ok: false, error: `unknown step kind: ${input.kind}`};
  }
}

function domSnapshot() {
  const inputs = Array.prototype.slice.call(document.querySelectorAll('input, textarea, select')).slice(0, 40);
  const buttons = Array.prototype.slice.call(document.querySelectorAll('button, [role="button"]')).slice(0, 40);
  return JSON.parse(JSON.stringify({
    url: location.href,
    title: document.title,
    bodyText: String(document.body && document.body.innerText || '').slice(0, 2000),
    inputs: inputs.map(element => ({
      tag: element.tagName,
      id: element.id || '',
      name: element.name || '',
      type: element.type || '',
      value: String(element.value || '').slice(0, 200)
    })),
    buttons: buttons.map(element => String(element.innerText || element.getAttribute('aria-label') || '').slice(0, 80))
  }));
}

async function safeCapture(tabId, artifactsDir, prefix) {
  try {
    await chrome.tabs.update(tabId, {active: true});
    const dataUrl = await chrome.tabs.captureVisibleTab(1, {format: 'png'});
    let ref = 'inline';
    if (artifactsDir && String(artifactsDir).trim()) {
      const path = joinPath(String(artifactsDir).trim(), `${prefix}_${Date.now()}.png`);
      await chrome.antigem.writeFile({
        path,
        data: dataUrl.slice(dataUrl.indexOf(',') + 1),
        encoding: 'base64'
      });
      ref = path;
    }
    return {dataUrl, ref};
  } catch (error) {
    return {dataUrl: null, ref: 'unavailable', error: error.message || String(error)};
  }
}

async function safeDom(tabId) {
  try {
    return await inject(tabId, domSnapshot);
  } catch (error) {
    return {error: error.message || String(error)};
  }
}

function pageActionFromStep(step) {
  const source = Object.assign({}, step);
  const kinds = {click: 'click', type: 'type', select: 'select', key: 'key', scroll: 'scroll', assert: 'assert'};
  return Object.assign({kind: source.kind || kinds[source.type] || source.type}, source);
}

function localText(language, es, en) {
  return language === 'es' ? es : language === 'en' ? en : `${es} / ${en}`;
}

function renderRunSummary(run, language) {
  const text = (es, en) => localText(language, es, en);
  const lines = [
    `# ${text('Resultado de la prueba', 'Test result')}`,
    '',
    `- **Run:** \`${run.runId}\``,
    `- **Test:** \`${run.name || 'inline'}\``,
    `- **URL:** ${run.url || '-'}`,
    `- **${text('Estado', 'Status')}:** **${run.ok ? 'PASS' : 'FAIL'}**`,
    `- ${text('Pasos', 'Steps')}: ${run.steps.length}`,
    `- ${text('Fallos', 'Failures')}: ${run.failures}`,
    ''
  ];
  for (const item of run.steps) {
    const label = item.step && (item.step.type || item.step.kind) || 'step';
    lines.push(`- ${item.ok ? '✅' : '❌'} ${item.index + 1}. \`${label}\` ` +
      `${item.error || (item.result && item.result.error) || ''}`);
  }
  return `${lines.join('\n')}\n`;
}

async function testRecord(args) {
  const name = safeName(args.name);
  const tabId = await resolveTabId(args);
  const tab = await chrome.tabs.get(tabId);
  const duration = clampInt(args.duration_ms, 1000, 120000, 8000);
  const withShots = args.screenshots !== false;
  const before = withShots ? await safeCapture(tabId, args.artifacts_dir, 'before') : null;
  const installed = await inject(tabId, installRecorder, [{clear: args.clear !== false}]);
  await sleep(duration);
  const steps = (await inject(tabId, readRecorder)) || [];
  const after = withShots ? await safeCapture(tabId, args.artifacts_dir, 'after') : null;
  const test = {
    name, tabId, url: tab.url || '', createdAt: Date.now(), duration,
    steps, before, after
  };
  await storeSet(`${PREFIX}tests.${name}`, test);
  await storeSet(`${PREFIX}lastTest`, name);
  return {
    ok: true, name, tabId, url: test.url, count: steps.length, steps,
    recorder: installed,
    screenshots: withShots ? {before: before && before.ref, after: after && after.ref} : null,
    markdown: `# ${name}\n\n- URL: ${test.url}\n- Steps: ${steps.length}\n- Duration: ${duration} ms\n`
  };
}

async function testRun(args) {
  let name = null;
  let steps;
  if (Array.isArray(args.steps)) {
    steps = args.steps;
  } else {
    name = safeName(args.name);
    const test = await storeGet(`${PREFIX}tests.${name}`);
    if (!test || !Array.isArray(test.steps)) {
      throw new Error(`No existe la prueba ${name} / Test ${name} not found`);
    }
    steps = test.steps;
  }
  const tabId = await resolveTabId(args);
  const tab = await chrome.tabs.get(tabId);
  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  const withShots = args.screenshots !== false;
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const startedAt = Date.now();
  const before = withShots ? await safeCapture(tabId, args.artifacts_dir, 'before') : null;
  const domBefore = await safeDom(tabId);
  const results = [];
  let failures = 0;

  for (let index = 0; index < steps.length; index++) {
    const step = steps[index] || {};
    try {
      let result;
      if (step.type === 'wait') {
        await sleep(clampInt(step.ms, 0, 30000, 0));
        result = {ok: true, waited: true};
      } else if (step.type === 'tap' || (step.type === 'click' && step.trusted)) {
        const rect = await inject(tabId, pageAction, [{kind: 'rect', selector: step.selector,
          index: step.index, text: step.text}]);
        if (!rect || !rect.ok) throw new Error(rect && rect.error || 'element not found');
        await chrome.antigem.automation({tabId, busy: true});
        try {
          await chrome.antigem.automation({tabId, tap: {fx: rect.fx, fy: rect.fy}});
        } finally {
          await chrome.antigem.automation({tabId, busy: false});
        }
        result = {ok: true, trusted: true};
      } else {
        result = await inject(tabId, pageAction, [pageActionFromStep(step)]);
      }
      const ok = Boolean(result && result.ok);
      if (!ok) failures++;
      results.push({index, step, ok, result});
      if (!ok && args.stop_on_fail) break;
    } catch (error) {
      failures++;
      results.push({index, step, ok: false, error: error.message || String(error)});
      if (args.stop_on_fail) break;
    }
  }

  const after = withShots ? await safeCapture(tabId, args.artifacts_dir, 'after') : null;
  const dom = await safeDom(tabId);
  const run = {
    runId, name, url: tab.url || '', startedAt, finishedAt: Date.now(),
    ok: failures === 0, steps: results, failures, before, after, domBefore, dom
  };
  await storeSet(`${PREFIX}runs.${runId}`, run);
  await storeSet(`${PREFIX}lastRun`, runId);
  return {
    ok: run.ok, runId, name, url: run.url, failures, steps: results,
    screenshots: withShots ? {before: before && before.ref, after: after && after.ref} : null,
    domBefore, dom, markdown: renderRunSummary(run, language)
  };
}

function hashText(text) {
  let hash = 0x811c9dc5;
  const value = String(text == null ? '' : text);
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function chunkHashes(text, size = 64) {
  const value = String(text == null ? '' : text);
  const hashes = [];
  for (let index = 0; index < value.length; index += size) {
    hashes.push(hashText(value.slice(index, index + size)));
  }
  return hashes;
}

function comparePayload(before, after) {
  const left = before && before.dataUrl ? String(before.dataUrl) : String(before == null ? '' : before);
  const right = after && after.dataUrl ? String(after.dataUrl) : String(after == null ? '' : after);
  const leftHashes = chunkHashes(left);
  const rightHashes = chunkHashes(right);
  const total = Math.max(leftHashes.length, rightHashes.length, 1);
  let changedChunks = 0;
  for (let index = 0; index < total; index++) {
    if (leftHashes[index] !== rightHashes[index]) changedChunks++;
  }
  return {
    identical: left === right,
    beforeHash: hashText(left),
    afterHash: hashText(right),
    beforeLength: left.length,
    afterLength: right.length,
    changedChunks,
    totalChunks: total,
    changeRatio: Number((changedChunks / total).toFixed(4))
  };
}

function tokenSimilarity(before, after) {
  const left = String(before == null ? '' : before).toLowerCase().split(/\s+/).filter(Boolean);
  const right = String(after == null ? '' : after).toLowerCase().split(/\s+/).filter(Boolean);
  if (!left.length && !right.length) return 1;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let shared = 0;
  for (const token of leftSet) if (rightSet.has(token)) shared++;
  const union = new Set([...leftSet, ...rightSet]).size || 1;
  return Number((shared / union).toFixed(4));
}

function compareDomSnapshots(before, after) {
  const left = before || {};
  const right = after || {};
  const changedFields = [];
  for (const field of ['url', 'title', 'bodyText']) {
    if (String(left[field] == null ? '' : left[field]) !== String(right[field] == null ? '' : right[field])) {
      changedFields.push(field);
    }
  }
  if (JSON.stringify(left.inputs || []) !== JSON.stringify(right.inputs || [])) changedFields.push('inputs');
  if (JSON.stringify(left.buttons || []) !== JSON.stringify(right.buttons || [])) changedFields.push('buttons');
  const summarize = snapshot => ({
    url: snapshot.url || '',
    title: snapshot.title || '',
    bodyText: String(snapshot.bodyText || '').slice(0, 300),
    inputs: (snapshot.inputs || []).length,
    buttons: (snapshot.buttons || []).length
  });
  return {
    identical: changedFields.length === 0,
    changedFields,
    textSimilarity: tokenSimilarity(left.bodyText, right.bodyText),
    before: summarize(left),
    after: summarize(right)
  };
}

function comparisonMarkdown(comparison, language) {
  const text = (es, en) => localText(language, es, en);
  const screenshot = comparison.screenshot || {};
  const dom = comparison.dom || {};
  return [
    `## ${text('Comparación', 'Comparison')}`,
    '',
    `- ${text('Modo', 'Mode')}: \`${comparison.mode}\``,
    `- ${text('Cambio detectado', 'Change detected')}: **${comparison.changed ? 'SÍ / YES' : 'NO / NO'}**`,
    `- ${text('Umbral', 'Threshold')}: ${comparison.threshold}`,
    `- ${text('Ratio de cambio visual', 'Visual change ratio')}: ${screenshot.changeRatio == null ? '-' : screenshot.changeRatio}`,
    `- ${text('Campos DOM cambiados', 'Changed DOM fields')}: ${(dom.changedFields || []).join(', ') || '-'}`,
    `- ${text('Similitud de texto', 'Text similarity')}: ${dom.textSimilarity == null ? '-' : dom.textSimilarity}`,
    ''
  ].join('\n');
}

async function testCompare(args) {
  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  const threshold = Number.isFinite(Number(args.threshold))
    ? Math.max(0, Math.min(1, Number(args.threshold))) : 0.02;
  let mode = 'before_after';
  let beforeRef = null;
  let afterRef = null;
  let screenshot;
  let dom;

  if (args.beforePath || args.afterPath) {
    mode = 'files';
    const read = async path => path
      ? String(await chrome.antigem.readFile({path, encoding: 'base64'})) : '';
    screenshot = comparePayload(await read(args.beforePath), await read(args.afterPath));
    dom = {identical: true, changedFields: [], textSimilarity: 1};
    beforeRef = args.beforePath || 'inline';
    afterRef = args.afterPath || 'inline';
  } else {
    const runId = args.run || await storeGet(`${PREFIX}lastRun`);
    if (!runId) throw new Error('No hay una ejecución guardada / No saved run');
    const run = await storeGet(`${PREFIX}runs.${runId}`);
    if (!run) throw new Error(`No existe la ejecución ${runId} / Run ${runId} not found`);
    if (args.against) {
      mode = 'runs';
      const other = await storeGet(`${PREFIX}runs.${args.against}`);
      if (!other) throw new Error(`No existe la ejecución ${args.against} / Run ${args.against} not found`);
      screenshot = comparePayload(run.after || null, other.after || null);
      dom = compareDomSnapshots(run.dom, other.dom);
      beforeRef = `${runId}:after (${(run.after && run.after.ref) || '-'})`;
      afterRef = `${args.against}:after (${(other.after && other.after.ref) || '-'})`;
    } else {
      screenshot = comparePayload(run.before || null, run.after || null);
      dom = compareDomSnapshots(run.domBefore, run.dom);
      beforeRef = `${runId}:before (${(run.before && run.before.ref) || '-'})`;
      afterRef = `${runId}:after (${(run.after && run.after.ref) || '-'})`;
    }
  }

  const changed = screenshot.changeRatio > threshold || !dom.identical;
  const comparison = {
    mode, changed, threshold, screenshot, dom,
    before: beforeRef, after: afterRef,
    language
  };
  return {...comparison, markdown: comparisonMarkdown(comparison, language)};
}

function reportTable(rows, language) {
  const text = (es, en) => localText(language, es, en);
  const lines = [
    `| # | ${text('Tipo', 'Type')} | ${text('Resultado', 'Result')} | ${text('Detalle', 'Detail')} |`,
    '| --- | --- | --- | --- |'
  ];
  for (const item of rows) {
    const step = item.step || {};
    const kind = step.type || step.kind || 'step';
    const detail = item.error || (item.result && item.result.error) ||
      JSON.stringify(item.result || {}).slice(0, 120);
    const clean = String(detail).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
    lines.push(`| ${item.index + 1} | \`${kind}\` | ${item.ok ? 'PASS' : 'FAIL'} | ${clean} |`);
  }
  return lines.length > 2 ? lines.join('\n') : text('Sin pasos.', 'No steps.');
}

function fullReportMarkdown(run, comparison, language) {
  const text = (es, en) => localText(language, es, en);
  const duration = run.startedAt && run.finishedAt ? `${run.finishedAt - run.startedAt} ms` : '-';
  const lines = [
    `# ${text('Informe de prueba de mini app', 'Mini app test report')}`,
    '',
    `- **Run:** \`${run.runId}\``,
    `- **${text('Prueba', 'Test')}:** \`${run.name || 'inline'}\``,
    `- **URL:** ${run.url || '-'}`,
    `- **${text('Estado', 'Status')}:** **${run.ok ? 'PASS' : 'FAIL'}**`,
    `- ${text('Pasos', 'Steps')}: ${(run.steps || []).length}`,
    `- ${text('Fallos', 'Failures')}: ${run.failures == null ? 0 : run.failures}`,
    `- ${text('Duración', 'Duration')}: ${duration}`,
    '',
    `## ${text('Pasos', 'Steps')}`,
    '',
    reportTable(run.steps || [], language),
    '',
    `## ${text('Capturas', 'Screenshots')}`,
    '',
    `- ${text('Antes', 'Before')}: \`${(run.before && run.before.ref) || '-'}\``,
    `- ${text('Después', 'After')}: \`${(run.after && run.after.ref) || '-'}\``,
    ''
  ];
  if (comparison) lines.push(comparisonMarkdown(comparison, language));
  const dom = run.dom || {};
  lines.push(
    `## DOM`,
    '',
    `- ${text('Título', 'Title')}: ${dom.title || '-'}`,
    `- ${text('Texto', 'Text')}: ${String(dom.bodyText || '-').slice(0, 300)}`,
    `- ${text('Inputs / botones', 'Inputs / buttons')}: ${(dom.inputs || []).length} / ${(dom.buttons || []).length}`,
    ''
  );
  return `${lines.join('\n')}\n`;
}

async function testReport(args) {
  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  const runId = args.run || await storeGet(`${PREFIX}lastRun`);
  if (!runId) throw new Error('No hay una ejecución guardada / No saved run');
  const run = await storeGet(`${PREFIX}runs.${runId}`);
  if (!run) throw new Error(`No existe la ejecución ${runId} / Run ${runId} not found`);
  let comparison = args.comparison || null;
  if (!comparison && args.includeComparison !== false) {
    comparison = await testCompare({run: runId, language});
  }
  const markdown = fullReportMarkdown(run, comparison, language);
  let path = null;
  let written = false;
  if (args.output && args.dry_run === false) {
    path = String(args.output);
    await chrome.antigem.writeFile({path, data: markdown, encoding: 'utf8'});
    written = true;
  }
  return {ok: true, runId, language, path, written, markdown, comparison};
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    const args = message.args || {};
    if (message.tool === 'test_record') return await testRecord(args);
    if (message.tool === 'test_run') return await testRun(args);
    if (message.tool === 'test_compare') return await testCompare(args);
    if (message.tool === 'test_report') return await testReport(args);
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: error && error.message ? error.message : String(error)}]
  }));
  return true;
});
