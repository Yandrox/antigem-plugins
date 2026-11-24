'use strict';

// Prompt Regression - casos entrada→salida para detectar deriva en skills, sin red.

const CATEGORIES = ['format', 'language', 'tool', 'length'];

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

function normalizeLanguage(value) {
  return ['es', 'en', 'both'].includes(value) ? value : 'both';
}

function countWords(text) {
  return (String(text || '').match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9']+/g) || []).length;
}

function unique(list) {
  return [...new Set((Array.isArray(list) ? list : [list])
    .filter(value => value !== null && value !== undefined && String(value).trim())
    .map(value => String(value)))];
}

function toRegExp(pattern) {
  if (!pattern) return null;
  let source = String(pattern);
  let flags = '';
  const match = source.match(/^\/([\s\S]*)\/([gimsuy]*)$/);
  if (match) {
    source = match[1];
    flags = match[2].replace(/g/g, '');
  }
  try {
    return new RegExp(source, flags);
  } catch (_) {
    return null;
  }
}

const ES_MARKERS = [
  'el', 'la', 'los', 'las', 'que', 'con', 'para', 'por', 'una', 'uno', 'este', 'esta',
  'estos', 'estas', 'no', 'se', 'su', 'sus', 'más', 'como', 'pero', 'también', 'cuando',
  'donde', 'todo', 'todos', 'puede', 'debe', 'usar', 'usa', 'añade', 'agrega', 'texto',
  'idioma', 'herramienta', 'formato', 'longitud', 'informe', 'caso', 'salida', 'entrada'
];

const EN_MARKERS = [
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'you', 'your', 'use', 'using',
  'should', 'can', 'when', 'where', 'all', 'output', 'input', 'language', 'format',
  'length', 'tool', 'report', 'case', 'check', 'default', 'preview', 'write', 'expected'
];

function countMarkers(text, markers) {
  const lower = String(text || '').toLowerCase();
  return markers.reduce((total, marker) => {
    const hits = lower.match(new RegExp(`\\b${marker}\\b`, 'g'));
    return total + (hits ? hits.length : 0);
  }, 0);
}

function detectLanguage(text) {
  const es = countMarkers(text, ES_MARKERS);
  const en = countMarkers(text, EN_MARKERS);
  const raw = String(text || '');
  const explicitBoth = /\bES\s*:/.test(raw) && /\bEN\s*:/.test(raw);
  if (es >= 1 && en >= 1 && (explicitBoth || Math.min(es, en) >= Math.max(es, en) * 0.4)) {
    return {detected: 'both', es, en};
  }
  if (es >= 2 && es > en * 1.5) return {detected: 'es', es, en};
  if (en >= 2 && en > es * 1.5) return {detected: 'en', es, en};
  if (es > 0 && en > 0) return {detected: 'both', es, en};
  if (es > 0) return {detected: 'es', es, en};
  if (en > 0) return {detected: 'en', es, en};
  return {detected: 'unknown', es, en};
}

function assertion(category, name, expected, actual, passed, detail) {
  return {category, name, expected, actual, passed: Boolean(passed), detail: detail || ''};
}

function evaluateCase(testCase, actualText, actualTool) {
  const actual = String(actualText == null ? '' : actualText);
  const expect = testCase.expect && typeof testCase.expect === 'object' ? testCase.expect : {};
  const results = [];

  const format = expect.format && typeof expect.format === 'object' ? expect.format : {};
  const contains = unique(format.contains);
  const notContains = unique(format.not_contains);
  for (const phrase of contains) {
    const found = actual.toLowerCase().includes(phrase.toLowerCase());
    results.push(assertion('format', 'contains', phrase, found ? 'encontrado / found' : 'ausente / missing',
      found, found ? '' : localText('both', 'Debe aparecer la frase.', 'The phrase must appear.')));
  }
  for (const phrase of notContains) {
    const found = actual.toLowerCase().includes(phrase.toLowerCase());
    results.push(assertion('format', 'not_contains', phrase, found ? 'encontrado / found' : 'ausente / missing',
      !found, found ? '' : localText('both', 'La frase no debe aparecer.', 'The phrase must not appear.')));
  }
  if (String(format.regex || '').trim()) {
    const regex = toRegExp(format.regex);
    if (!regex) {
      results.push(assertion('format', 'regex', format.regex, 'regex inválida / invalid regex', false,
        'REGEX_INVALID'));
    } else {
      const matched = regex.test(actual);
      results.push(assertion('format', 'regex', format.regex, matched ? 'match' : 'no match', matched));
    }
  }
  if (format.json === true) {
    let parsed = true;
    try {
      JSON.parse(actual);
    } catch (_) {
      parsed = false;
    }
    results.push(assertion('format', 'json', true, parsed ? 'válido / valid' : 'inválido / invalid', parsed));
  }

  const language = expect.language && typeof expect.language === 'object' ? expect.language : {};
  if (language.expected) {
    const expectedLanguage = ['es', 'en', 'both'].includes(language.expected) ? language.expected : 'both';
    const detection = detectLanguage(actual);
    const passed = expectedLanguage === detection.detected ||
      (expectedLanguage === 'es' && detection.detected === 'both') ||
      (expectedLanguage === 'en' && detection.detected === 'both');
    results.push(assertion('language', 'expected', expectedLanguage, detection.detected, passed,
      `ES marcadores ${detection.es}, EN marcadores ${detection.en}`));
  }

  const tool = expect.tool && typeof expect.tool === 'object' ? expect.tool : {};
  if (tool.expected) {
    const wanted = unique(tool.expected).map(value => value.toLowerCase());
    const got = String(actualTool || '').trim().toLowerCase();
    results.push(assertion('tool', 'expected', wanted.join(' | '), got || '-',
      Boolean(got) && wanted.includes(got),
      got ? '' : localText('both', 'Falta actual_tool.', 'actual_tool is missing.')));
  }
  for (const forbidden of unique(tool.forbidden)) {
    const got = String(actualTool || '').trim().toLowerCase();
    results.push(assertion('tool', 'forbidden', forbidden, got || '-', got !== forbidden.toLowerCase()));
  }

  const length = expect.length && typeof expect.length === 'object' ? expect.length : {};
  const chars = actual.length;
  const words = countWords(actual);
  if (Number.isFinite(Number(length.min_chars))) {
    const min = Number(length.min_chars);
    results.push(assertion('length', 'min_chars', min, chars, chars >= min));
  }
  if (Number.isFinite(Number(length.max_chars))) {
    const max = Number(length.max_chars);
    results.push(assertion('length', 'max_chars', max, chars, chars <= max));
  }
  if (Number.isFinite(Number(length.min_words))) {
    const min = Number(length.min_words);
    results.push(assertion('length', 'min_words', min, words, words >= min));
  }
  if (Number.isFinite(Number(length.max_words))) {
    const max = Number(length.max_words);
    results.push(assertion('length', 'max_words', max, words, words <= max));
  }

  if (!results.length) {
    results.push(assertion('format', 'assertions', 'al menos una / at least one', '0', false,
      'NO_ASSERTIONS'));
  }

  const failed = results.filter(result => !result.passed);
  const byCategory = {};
  for (const category of CATEGORIES) {
    byCategory[category] = {
      total: results.filter(result => result.category === category).length,
      failed: failed.filter(result => result.category === category).length
    };
  }
  return {
    results,
    failed,
    byCategory,
    passed: failed.length === 0,
    score: Math.round(((results.length - failed.length) / results.length) * 100),
    chars,
    words,
    detection: detectLanguage(actual)
  };
}

async function loadStored(key) {
  const values = await chrome.storage.local.get(key);
  return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
}

async function loadAll() {
  return await chrome.storage.local.get(null);
}

function markdownForCase(testCase, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${t('Caso registrado', 'Recorded case')}`,
    '',
    `- ${t('ID', 'ID')}: \`${testCase.caseId}\``,
    `- ${t('Skill', 'Skill')}: \`${testCase.skill}\``,
    `- ${t('Versión', 'Version')}: ${testCase.skillVersion || '-'}`,
    `- ${t('Entrada', 'Input')}: ${testCase.input.slice(0, 160).replace(/\n/g, ' ')}`,
    `- ${t('Aserciones', 'Assertions')}: ${Object.keys(testCase.expect || {}).join(', ') || '-'}`,
    `- ${t('Exportado', 'Exported')}: ${testCase.written ? t('sí', 'yes') : t('no', 'no')}`,
    ''
  ];
  return `${lines.join('\n')}\n`;
}

async function caseRecord(args) {
  const language = normalizeLanguage(args.language);
  const skill = String(args.skill || '').trim();
  const input = String(args.input || '').trim();
  if (!skill) throw new Error('Falta la skill / Missing skill');
  if (!input) throw new Error('La entrada está vacía / Empty input');

  const caseId = String(args.case_id || '').trim() ||
    `case_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const expect = args.expect && typeof args.expect === 'object' && !Array.isArray(args.expect)
    ? args.expect : {};
  const testCase = {
    format: 'antigem-prompt-case',
    version: 1,
    caseId,
    skill,
    skillVersion: String(args.skill_version || '').trim() || null,
    input,
    expect,
    notes: String(args.notes || '').trim(),
    language,
    createdAt: Date.now(),
    written: false,
    path: null
  };

  if (String(args.output || '').trim() && args.dry_run === false) {
    testCase.path = String(args.output).trim();
    await chrome.antigem.writeFile({
      path: testCase.path,
      data: JSON.stringify(testCase, null, 2),
      encoding: 'utf8'
    });
    testCase.written = true;
  }

  await chrome.storage.local.set({
    [`regressions.cases.${caseId}`]: testCase,
    lastCase: caseId
  });
  testCase.markdown = markdownForCase(testCase, language);
  return testCase;
}

async function resolveCase(ref, inline, lastId) {
  if (inline && typeof inline === 'object' && inline.input) {
    return {
      caseId: String(inline.caseId || inline.case_id || `inline_${Date.now()}`),
      skill: String(inline.skill || 'inline'),
      skillVersion: String(inline.skillVersion || inline.skill_version || ''),
      input: String(inline.input),
      expect: inline.expect || {},
      createdAt: Date.now()
    };
  }
  const value = String(ref || '').trim();
  if (!value && lastId) return await loadStored(`regressions.cases.${lastId}`);
  if (!value) return null;
  if (/^~\//.test(value) || /^\/sdcard\//.test(value)) {
    const parsed = JSON.parse(String(await chrome.antigem.readFile({path: value, encoding: 'utf8'})));
    if (!parsed || !parsed.expect) throw new Error(`El archivo no es un caso válido / Not a valid case: ${value}`);
    return parsed;
  }
  return await loadStored(`regressions.cases.${value}`);
}

function markdownForCheck(check, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${t('Comprobación de deriva', 'Drift check')}`,
    '',
    `- ${t('ID', 'ID')}: \`${check.checkId}\``,
    `- ${t('Caso', 'Case')}: \`${check.caseId}\``,
    `- ${t('Skill', 'Skill')}: \`${check.skill}\``,
    `- ${t('Resultado', 'Result')}: **${check.passed ? t('OK', 'PASS') : t('DERIVA', 'DRIFT')}** (${check.score}/100)`,
    `- ${t('Caracteres', 'Chars')}: ${check.actualChars} · ${t('Palabras', 'Words')}: ${check.actualWords}`,
    `- ${t('Idioma detectado', 'Detected language')}: ${check.detection.detected}`,
    ''
  ];
  for (const category of CATEGORIES) {
    const stat = check.byCategory[category];
    if (!stat.total) continue;
    lines.push(`## ${category} — ${stat.failed}/${stat.total}`);
    for (const result of check.results.filter(item => item.category === category)) {
      lines.push(`- ${result.passed ? 'OK' : 'FAIL'} \`${result.name}\`: ` +
        `${JSON.stringify(result.expected)} → ${JSON.stringify(result.actual)}` +
        (result.detail ? ` (${result.detail})` : ''));
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

async function caseCheck(args) {
  const language = normalizeLanguage(args.language);
  const lastId = await loadStored('lastCase');
  const testCase = await resolveCase(args.case, args.case_inline, lastId);
  if (!testCase) throw new Error('No hay casos registrados / No recorded cases');

  const actual = String(args.actual == null ? '' : args.actual);
  const evaluated = evaluateCase(testCase, actual, args.actual_tool);
  const check = {
    format: 'antigem-prompt-check',
    version: 1,
    checkId: `check_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
    caseId: testCase.caseId,
    skill: testCase.skill,
    skillVersion: testCase.skillVersion || null,
    language,
    actualChars: evaluated.chars,
    actualWords: evaluated.words,
    actualTool: String(args.actual_tool || '').trim() || null,
    detection: evaluated.detection,
    results: evaluated.results,
    byCategory: evaluated.byCategory,
    passed: evaluated.passed,
    score: evaluated.score,
    drift: evaluated.failed.map(result => ({
      category: result.category, name: result.name, detail: result.detail
    })),
    written: false,
    path: null
  };

  check.markdown = markdownForCheck(check, language);
  if (String(args.output || '').trim() && args.dry_run === false) {
    check.path = String(args.output).trim();
    await chrome.antigem.writeFile({path: check.path, data: check.markdown, encoding: 'utf8'});
    check.written = true;
  }
  await chrome.storage.local.set({
    [`regressions.checks.${check.checkId}`]: check,
    lastCheck: check.checkId
  });
  return check;
}

async function caseReport(args) {
  const language = normalizeLanguage(args.language);
  const limit = clamp(args.limit, 1, 200, 50);
  const skillFilter = String(args.skill || '').trim().toLowerCase();
  const all = await loadAll();
  const checks = Object.keys(all)
    .filter(key => key.startsWith('regressions.checks.'))
    .map(key => all[key])
    .filter(check => check && (!skillFilter || String(check.skill).toLowerCase().includes(skillFilter)))
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, limit);

  const byCategory = {};
  for (const category of CATEGORIES) byCategory[category] = {failed: 0, total: 0};
  for (const check of checks) {
    for (const category of CATEGORIES) {
      const stat = check.byCategory && check.byCategory[category];
      if (!stat) continue;
      byCategory[category].failed += Number(stat.failed) || 0;
      byCategory[category].total += Number(stat.total) || 0;
    }
  }

  const grouped = new Map();
  for (const check of checks) {
    const key = String(check.skill || 'inline');
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(check);
  }
  const skills = [...grouped.entries()].map(([skill, items]) => ({
    skill,
    checks: items.length,
    passed: items.filter(item => item.passed).length,
    failed: items.filter(item => !item.passed).length
  })).sort((a, b) => b.failed - a.failed || a.skill.localeCompare(b.skill));

  const passed = checks.filter(check => check.passed).length;
  const report = {
    reportId: `report_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
    language,
    skillFilter: skillFilter || null,
    limit,
    summary: {
      checks: checks.length,
      passed,
      failed: checks.length - passed,
      avgScore: checks.length
        ? Math.round(checks.reduce((sum, check) => sum + (Number(check.score) || 0), 0) / checks.length)
        : 0
    },
    byCategory,
    skills: skills.map(group => ({
      skill: group.skill,
      checks: grouped.get(group.skill).length,
      passed: group.passed,
      failed: group.failed,
      checksDetail: grouped.get(group.skill).slice(0, 10)
    })),
    written: false,
    path: null
  };
  report.markdown = renderReport(report, language);
  if (String(args.output || '').trim() && args.dry_run === false) {
    report.path = String(args.output).trim();
    await chrome.antigem.writeFile({path: report.path, data: report.markdown, encoding: 'utf8'});
    report.written = true;
  }
  return report;
}

function renderReport(report, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${t('Informe de deriva de skills', 'Skill drift report')}`,
    '',
    `- ${t('Comprobaciones', 'Checks')}: ${report.summary.checks}`,
    `- ${t('Correctas', 'Passed')}: ${report.summary.passed}`,
    `- ${t('Con deriva', 'With drift')}: ${report.summary.failed}`,
    `- ${t('Puntuación media', 'Average score')}: ${report.summary.avgScore}/100`,
    '',
    '| ' + t('Categoría', 'Category') + ' | ' + t('Fallas', 'Failures') + ' | ' +
      t('Comprobaciones', 'Checks') + ' |',
    '| --- | --- | --- |'
  ];
  for (const category of CATEGORIES) {
    lines.push(`| ${category} | ${report.byCategory[category].failed} | ${report.byCategory[category].total} |`);
  }
  for (const group of report.skills) {
    lines.push('', `## \`${group.skill}\``, '',
      `${group.passed}/${group.checks} ${t('correctas', 'passed')} · ` +
      `${group.failed} ${t('con deriva', 'with drift')}`);
    for (const check of group.checksDetail.slice(0, 10)) {
      const label = check.passed ? 'OK' : 'FAIL';
      const drift = (check.drift || []).map(item => `${item.category}/${item.name}`).join(', ') || '-';
      lines.push(`- ${label} \`${check.checkId}\` (${check.score}/100): ${drift}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    const args = message.args || {};
    if (message.tool === 'case_record') return await caseRecord(args);
    if (message.tool === 'case_check') return await caseCheck(args);
    if (message.tool === 'case_report') return await caseReport(args);
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: error && error.message ? error.message : String(error)}]
  }));
  return true;
});
