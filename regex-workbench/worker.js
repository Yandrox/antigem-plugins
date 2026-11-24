'use strict';

// Regex Workbench — regex con español y Unicode, sin red y sin pegar nada en una web.

const FLAG_NAMES = {
  g: 'global / global', i: 'insensible a mayúsculas / case-insensitive',
  m: 'multilínea / multiline', s: 'dotAll', u: 'unicode', y: 'sticky',
  d: 'índices / indices', v: 'conjuntos Unicode / unicode sets'
};

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
  return /^(~\/|\/sdcard\/)/.test(String(value || '').trim());
}

async function maybeWrite(args, path, data) {
  if (!String(path || '').trim() || args.dry_run !== false) return false;
  if (!isLocalPath(path)) {
    throw new Error('output debe empezar por ~/ o /sdcard/ / output must start with ~/ or /sdcard/');
  }
  await chrome.antigem.writeFile({path: String(path).trim(), data, encoding: 'utf8'});
  return true;
}

function cleanFlags(value) {
  const raw = String(value || '').replace(/[^gimsuydv]/g, '');
  return [...new Set(raw.split(''))].join('');
}

function compile(pattern, flags) {
  try {
    const regex = new RegExp(pattern, flags);
    return {ok: true, regex, error: null};
  } catch (error) {
    return {ok: false, regex: null, error: error && error.message ? error.message : String(error)};
  }
}

/* ------------------------------------------------------------------ */
/* Tokenizer                                                           */
/* ------------------------------------------------------------------ */

function describeEscape(raw) {
  const simple = {
    '\\d': ['Un dígito ASCII (0-9)', 'An ASCII digit (0-9)', 'digit'],
    '\\D': ['Cualquier carácter salvo un dígito ASCII', 'Any character except an ASCII digit', 'digit'],
    '\\w': ['Letra, dígito o guion bajo ASCII', 'ASCII letter, digit or underscore', 'word'],
    '\\W': ['Cualquier carácter salvo [A-Za-z0-9_]', 'Any character except [A-Za-z0-9_]', 'word'],
    '\\s': ['Un espacio en blanco', 'A whitespace character', 'space'],
    '\\S': ['Cualquier carácter que no sea espacio', 'Any non-whitespace character', 'space'],
    '\\b': ['Frontera de palabra ASCII', 'ASCII word boundary', 'boundary'],
    '\\B': ['No es frontera de palabra ASCII', 'Not an ASCII word boundary', 'boundary'],
    '\\n': ['Salto de línea', 'Line feed', 'literal'],
    '\\r': ['Retorno de carro', 'Carriage return', 'literal'],
    '\\t': ['Tabulador', 'Tab', 'literal'],
    '\\f': ['Avance de página', 'Form feed', 'literal'],
    '\\v': ['Tabulador vertical', 'Vertical tab', 'literal'],
    '\\0': ['Carácter NUL', 'NUL character', 'literal']
  };
  if (Object.prototype.hasOwnProperty.call(simple, raw)) {
    const [es, en, kind] = simple[raw];
    return {kind, es, en};
  }
  if (/^\\p\{/i.test(raw)) {
    const property = raw.slice(3, -1);
    return {kind: 'unicode', es: `Propiedad Unicode ${property}`, en: `Unicode property ${property}`};
  }
  if (/^\\P\{/i.test(raw)) {
    const property = raw.slice(3, -1);
    return {kind: 'unicode', es: `Propiedad Unicode negada ${property}`, en: `Negated Unicode property ${property}`};
  }
  if (/^\\k</.test(raw)) {
    return {kind: 'backref', es: `Referencia al grupo con nombre ${raw.slice(3, -1)}`,
      en: `Named backreference ${raw.slice(3, -1)}`};
  }
  if (/^\\[1-9]/.test(raw)) {
    return {kind: 'backref', es: `Referencia al grupo ${raw.slice(1)}`, en: `Backreference to group ${raw.slice(1)}`};
  }
  if (/^\\u/i.test(raw)) {
    return {kind: 'unicode', es: `Punto de código ${raw}`, en: `Code unit ${raw}`};
  }
  if (/^\\x/i.test(raw)) {
    return {kind: 'literal', es: `Carácter hexadecimal ${raw}`, en: `Hex character ${raw}`};
  }
  const char = raw.slice(1);
  return {kind: 'literal', es: `Literal escapado "${char}"`, en: `Escaped literal "${char}"`};
}

function tokenize(pattern) {
  const tokens = [];
  let i = 0;
  let groupCount = 0;
  const push = (start, raw, kind, es, en, extra) => {
    tokens.push(Object.assign({start, raw, kind, description_es: es, description_en: en}, extra || {}));
  };

  while (i < pattern.length) {
    const ch = pattern[i];
    const start = i;

    if (ch === '\\') {
      const next = pattern[i + 1];
      if (next === undefined) {
        push(start, '\\', 'error', 'Barra final incompleta', 'Trailing backslash');
        i++;
        continue;
      }
      let raw = '\\' + next;
      let consumed = 2;
      if ((next === 'x' || next === 'X') && /^[0-9a-f]{2}$/i.test(pattern.slice(i + 2, i + 4))) {
        raw += pattern.slice(i + 2, i + 4);
        consumed = 4;
      } else if (next === 'u') {
        if (pattern[i + 2] === '{') {
          const end = pattern.indexOf('}', i + 3);
          if (end > 0) { raw = pattern.slice(i, end + 1); consumed = end + 1 - i; }
        } else if (/^[0-9a-f]{4}$/i.test(pattern.slice(i + 2, i + 6))) {
          raw += pattern.slice(i + 2, i + 6);
          consumed = 6;
        }
      } else if ((next === 'p' || next === 'P') && pattern[i + 2] === '{') {
        const end = pattern.indexOf('}', i + 3);
        if (end > 0) { raw = pattern.slice(i, end + 1); consumed = end + 1 - i; }
      } else if (next === 'k' && pattern[i + 2] === '<') {
        const end = pattern.indexOf('>', i + 3);
        if (end > 0) { raw = pattern.slice(i, end + 1); consumed = end + 1 - i; }
      }
      i += consumed;
      const described = describeEscape(raw);
      push(start, raw, described.kind, described.es, described.en);
      continue;
    }

    if (ch === '[') {
      let j = i + 1;
      if (pattern[j] === '^') j++;
      while (j < pattern.length) {
        if (pattern[j] === '\\') { j += 2; continue; }
        if (pattern[j] === ']') { j++; break; }
        j++;
      }
      const raw = pattern.slice(i, j);
      i = j;
      const negated = raw.startsWith('[^');
      push(start, raw, 'class',
        negated ? `Clase negada ${raw}` : `Clase de caracteres ${raw}`,
        negated ? `Negated character class ${raw}` : `Character class ${raw}`);
      continue;
    }

    if (ch === '(') {
      const rest = pattern.slice(i);
      let raw = '(';
      let kind = 'group';
      let es = 'Grupo de captura';
      let en = 'Capturing group';
      let name = null;
      if (/^\(\?<=/.test(rest)) {
        raw = '(?<='; kind = 'lookbehind'; es = 'Mirada atrás positiva'; en = 'Positive lookbehind';
      } else if (/^\(\?<!/.test(rest)) {
        raw = '(?<!'; kind = 'lookbehind'; es = 'Mirada atrás negativa'; en = 'Negative lookbehind';
      } else if (/^\(\?<[^>]+>/.test(rest)) {
        raw = rest.match(/^\(\?<[^>]+>/)[0];
        name = raw.slice(3, -1);
        kind = 'named-group'; es = `Grupo con nombre "${name}"`; en = `Named group "${name}"`;
      } else if (rest.startsWith('(?:')) {
        raw = '(?:'; kind = 'noncapture'; es = 'Grupo sin captura'; en = 'Non-capturing group';
      } else if (rest.startsWith('(?=')) {
        raw = '(?='; kind = 'lookahead'; es = 'Mirada adelante positiva'; en = 'Positive lookahead';
      } else if (rest.startsWith('(?!')) {
        raw = '(?!'; kind = 'lookahead'; es = 'Mirada adelante negativa'; en = 'Negative lookahead';
      } else {
        groupCount++;
      }
      push(start, raw, kind, es, en, name ? {name} : {index: kind === 'group' ? groupCount : null});
      i += raw.length;
      continue;
    }

    if (ch === ')') { push(start, ')', 'group-end', 'Fin de grupo', 'End of group'); i++; continue; }
    if (ch === '|') { push(start, '|', 'alternation', 'Alternativa (o)', 'Alternation (or)'); i++; continue; }
    if (ch === '^') { push(start, '^', 'anchor', 'Inicio de texto o línea', 'Start of text or line'); i++; continue; }
    if (ch === '$') { push(start, '$', 'anchor', 'Fin de texto o línea', 'End of text or line'); i++; continue; }
    if (ch === '.') { push(start, '.', 'dot', 'Cualquier carácter excepto salto de línea', 'Any character except newline'); i++; continue; }

    if (ch === '*' || ch === '+' || ch === '?') {
      const names = {'*': 'Cero o más', '+': 'Uno o más', '?': 'Opcional'};
      const enNames = {'*': 'Zero or more', '+': 'One or more', '?': 'Optional'};
      let raw = ch;
      if (pattern[i + 1] === '?') { raw += '?'; i++; }
      push(start, raw, 'quantifier',
        `${names[ch]}${raw.length === 2 ? ' (perezoso)' : ''}`,
        `${enNames[ch]}${raw.length === 2 ? ' (lazy)' : ''}`,
        {risk: raw.length === 2 ? null : 'greedy'});
      i++;
      continue;
    }

    if (ch === '{') {
      const match = pattern.slice(i).match(/^\{(\d+)(,(\d*))?\}/);
      if (match) {
        const raw = match[0];
        push(start, raw, 'quantifier', `Repetición ${raw}`, `Repetition ${raw}`,
          {min: Number(match[1]), max: match[3] === undefined ? Number(match[1]) : (match[3] === '' ? Infinity : Number(match[3]))});
        i += raw.length;
      } else {
        push(start, '{', 'literal', 'Llave literal', 'Literal brace');
        i++;
      }
      continue;
    }

    let j = i + 1;
    while (j < pattern.length && !'\\[]()|^$.*+?{}'.includes(pattern[j])) j++;
    const raw = pattern.slice(i, j);
    push(start, raw, 'literal', `Literal "${raw}"`, `Literal "${raw}"`);
    i = j;
  }

  return {tokens, groupCount};
}

/* ------------------------------------------------------------------ */
/* Riesgo de backtracking                                              */
/* ------------------------------------------------------------------ */

function analyzeRisk(pattern) {
  const reasons = [];
  const add = (level, es, en) => reasons.push({level, es, en});

  const nested = /(\((?:\\[\s\S]|[^()])*?)([+*]|\{\d+(?:,\d*)?\})((?:\\[\s\S]|[^()])*?\))([+*]|\{\d+(?:,\d*)?\})/.test(pattern);
  if (nested) {
    add('high', 'Cuantificador anidado dentro de un grupo: patrón clásico de backtracking catastrófico.',
      'Quantifier nested inside a quantified group: classic catastrophic backtracking pattern.');
  }
  if (/\(\?[=!][^)]*[+*][^)]*\)[+*]/.test(pattern)) {
    add('high', 'Mirada adelante con cuantificador y repetida: puede explotar con entradas largas.',
      'Quantified lookahead that is itself repeated: can explode on long inputs.');
  }
  if (/\((?:[^()]*\|[^()]*)\)\s*[+*]/.test(pattern)) {
    add('medium', 'Alternancia con ramas que pueden solaparse dentro de un cuantificador.',
      'Alternation with potentially overlapping branches inside a quantifier.');
  }
  if (/(\\[sSwWdD])[*+][\s\S]*\1[*+]/.test(pattern)) {
    add('medium', 'Varios cuantificadores ambiguos de la misma clase seguidos: retrospectiva costosa.',
      'Several ambiguous quantifiers of the same class in a row: expensive backtracking.');
  }
  if (/\\\d[+*{]/.test(pattern)) {
    add('medium', 'Referencia numérica con cuantificador: puede reintentar muchas combinaciones.',
      'Quantified numeric backreference: may retry many combinations.');
  }
  const repeats = [...pattern.matchAll(/\{(\d+)(?:,(\d*))?\}/g)]
    .map(match => Number(match[1] || 0)).filter(Number.isFinite);
  const maxRepeat = repeats.length ? Math.max(...repeats) : 0;
  if (maxRepeat > 1000) {
    add('medium', `Repetición acotada muy alta ({${maxRepeat}}): coste lineal elevado.`,
      `Very high bounded repetition ({${maxRepeat}}): high linear cost.`);
  }
  if (/\(\?<?[=!]/.test(pattern) && /[+*]/.test(pattern)) {
    add('low', 'Aserciones de mirada combinadas con repeticiones: revisa el coste con entradas largas.',
      'Lookaround combined with repetitions: review cost on long inputs.');
  }

  const level = reasons.some(reason => reason.level === 'high') ? 'high'
    : reasons.some(reason => reason.level === 'medium') ? 'medium'
      : reasons.length ? 'low' : 'low';
  return {level, reasons};
}

/* ------------------------------------------------------------------ */
/* Unicode y banderas                                                  */
/* ------------------------------------------------------------------ */

function unicodeAdvice(pattern, flags, tokens) {
  const advice = [];
  const hasNonAscii = /[^\x00-\x7F]/.test(pattern);
  if (hasNonAscii && !flags.includes('u')) {
    advice.push({flag: 'u', level: 'suggested',
      es: 'El patrón contiene caracteres no ASCII; añade u para tratarlos como puntos de código.',
      en: 'The pattern contains non-ASCII characters; add u to treat them as code points.'});
  }
  if (/\\[pP]\{/.test(pattern) && !flags.includes('u')) {
    advice.push({flag: 'u', level: 'required',
      es: 'Las propiedades \\p{...} exigen la bandera u; sin ella el patrón no compila.',
      en: '\\p{...} properties require the u flag; without it the pattern does not compile.'});
  }
  if (hasNonAscii && !flags.includes('i')) {
    advice.push({flag: 'i', level: 'suggested',
      es: 'Hay letras con acento o ñ: con i+u se igualan mayúsculas y minúsculas Unicode.',
      en: 'There are accented letters or ñ: i+u matches Unicode upper/lowercase forms.'});
  }
  if (tokens.some(token => token.kind === 'boundary') && hasNonAscii) {
    advice.push({flag: null, level: 'warning',
      es: '\\b usa la definición ASCII de "palabra": "año" se corta entre ñ y o. Usa (?<=\\P{L}) y (?=\\P{L}) o \\p{L}.',
      en: '\\b uses the ASCII word definition: "año" breaks at ñ. Use (?<=\\P{L})/(?=\\P{L}) or \\p{L}.'});
  }
  if (tokens.some(token => token.raw === '\\w') && hasNonAscii) {
    advice.push({flag: null, level: 'warning',
      es: '\\w no incluye á, é, ñ ni otras letras Unicode, incluso con u. Usa [\\p{L}\\p{N}_].',
      en: '\\w excludes á, é, ñ and other Unicode letters even with u. Use [\\p{L}\\p{N}_].'});
  }
  if (/[áéíóúüñÁÉÍÓÚÜÑ]/.test(pattern) && flags.includes('i') && !flags.includes('u')) {
    advice.push({flag: 'u', level: 'suggested',
      es: 'Con i pero sin u, la equivalencia de mayúsculas acentuadas no es fiable.',
      en: 'With i but without u, accented case folding is unreliable.'});
  }
  return advice;
}

/* ------------------------------------------------------------------ */
/* Conversión de sabores                                               */
/* ------------------------------------------------------------------ */

function transformOutsideClasses(pattern, fn) {
  let out = '';
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\') {
      out += fn(pattern.slice(i, i + 2), 'escape');
      i++;
      continue;
    }
    if (ch === '[' && !inClass) { inClass = true; out += ch; continue; }
    if (ch === ']' && inClass) { inClass = false; out += ch; continue; }
    out += inClass ? ch : fn(ch, 'char');
  }
  return out;
}

function convertFlavors(pattern, flags) {
  const baseFlags = cleanFlags(flags).replace(/[gy]/g, '');
  const pcreFlags = baseFlags.includes('u') ? baseFlags : baseFlags + (/[^\x00-\x7F]|\\[pP]\{/.test(pattern) ? 'u' : '');
  const pcre = transformOutsideClasses(pattern, (chunk, kind) => {
    if (kind === 'escape') {
      const named = chunk.match(/^\\k<([^>]+)>$/);
      if (named) return `\\k<${named[1]}>`;
      return chunk;
    }
    return chunk;
  }).replace(/\(\?<([^>]+)>/g, '(?P<$1>');

  const notesEre = [];
  if (/\(\?/.test(pattern)) notesEre.push('Las aserciones y grupos no capturadores no existen en POSIX ERE / Lookarounds and non-capturing groups do not exist in POSIX ERE.');
  if (/\\[pP]\{/.test(pattern)) notesEre.push('Las propiedades Unicode no existen en POSIX / Unicode properties do not exist in POSIX.');
  if (/(?<!\\)[?*+]\?/.test(pattern)) notesEre.push('Los cuantificadores perezosos no existen en POSIX / Lazy quantifiers do not exist in POSIX.');
  if (/\\\d/.test(pattern)) notesEre.push('\\1 en POSIX es retroceso, no dígito / \\1 in POSIX is a backreference, not a digit.');

  let ere = transformOutsideClasses(pattern, (chunk, kind) => {
    if (kind !== 'escape') return chunk;
    const map = {
      '\\d': '[0-9]', '\\D': '[^0-9]', '\\w': '[[:alnum:]_]', '\\W': '[^[:alnum:]_]',
      '\\s': '[[:space:]]', '\\S': '[^[:space:]]'
    };
    return Object.prototype.hasOwnProperty.call(map, chunk) ? map[chunk] : chunk;
  });
  ere = ere.replace(/\\p\{L\}/g, '[[:alpha:]]').replace(/\\P\{L\}/g, '[^[:alpha:]]');
  ere = ere.replace(/\(\?<[^>]+>/g, '(');
  ere = ere.replace(/\(\?[:=!]|<=/g, '(');
  ere = ere.replace(/([?*+])\?/g, '$1');

  const bre = transformOutsideClasses(ere, (chunk, kind) => {
    if (kind !== 'char') return chunk;
    return /[(){}|+?]/.test(chunk) ? '\\' + chunk : chunk;
  });

  return {
    js: {pattern, flags: baseFlags, note: 'JavaScript RegExp nativa / Native JavaScript RegExp'},
    pcre: {pattern: pcre, flags: pcreFlags, note: 'PCRE2; named groups in (?P<name>...) form'},
    posix: {
      ere: {pattern: ere, notes: notesEre},
      bre: {pattern: bre, notes: notesEre.concat(['BRE necesita \\( \\) \\+ \\? \\| y \\{n,m\\}; la conversión es aproximada / BRE requires escaped meta characters; conversion is approximate.'])}
    }
  };
}

/* ------------------------------------------------------------------ */
/* Generación de casos                                                 */
/* ------------------------------------------------------------------ */

const UNICODE_PROBES = [
  {text: 'áéíóú', kind: 'letters', es: ' vocales acentuadas', en: ' accented vowels'},
  {text: 'ñ', kind: 'letters', es: ' eñe', en: ' ñ'},
  {text: 'ÁÉ', kind: 'letters', es: ' mayúsculas acentuadas', en: ' accented uppercase'},
  {text: '中文', kind: 'letters', es: ' caracteres CJK', en: ' CJK characters'},
  {text: '123', kind: 'digits', es: ' dígitos', en: ' digits'},
  {text: '😀', kind: 'other', es: ' emoji', en: ' emoji'},
  {text: 'a\nb', kind: 'other', es: ' salto de línea', en: ' newline'}
];

function generateCases(pattern, flags, tokens) {
  const cases = [];
  const seen = new Set();
  const add = (text, expect, es, en, source) => {
    const key = `${text}\u0000${expect}`;
    if (seen.has(key)) return;
    seen.add(key);
    cases.push({text, expect, why_es: es, why_en: en, source: source || 'generated'});
  };
  const has = regex => regex.test(pattern);

  if (has(/\\d/)) {
    add('123', true, 'Coincide con \\d', 'Matches \\d', 'generated');
    add('abc', false, 'Sin dígitos', 'No digits', 'generated');
    add('a1b', true, 'Dígito en medio', 'Digit in the middle', 'generated');
  }
  if (has(/\\w/)) {
    add('abc_123', true, 'Solo caracteres de palabra ASCII', 'ASCII word characters only', 'generated');
    add('ñ', false, 'ñ queda fuera de \\w ASCII', 'ñ is outside ASCII \\w', 'false-positive-probe');
    add('á', false, 'á queda fuera de \\w ASCII', 'á is outside ASCII \\w', 'false-positive-probe');
  }
  if (has(/\\s/)) {
    add(' ', true, 'Espacio', 'Space', 'generated');
    add('x', false, 'Sin espacio', 'No space', 'generated');
  }
  if (/\\p\{L\}/.test(pattern)) {
    add('ñ', true, '\\p{L} incluye la eñe', '\\p{L} includes ñ', 'generated');
    add('漢', true, '\\p{L} incluye CJK', '\\p{L} includes CJK', 'generated');
    add('7', false, 'Un dígito no es letra', 'A digit is not a letter', 'generated');
  }
  if (/\[a-z/.test(pattern)) {
    add('abc', true, 'Minúsculas ascii', 'ASCII lowercase', 'generated');
    add('ABC', false, 'Mayúsculas fuera del rango', 'Uppercase outside the range', 'false-positive-probe');
    add('ñ', false, 'ñ está fuera de a-z', 'ñ is outside a-z', 'false-positive-probe');
  }
  if (/\[A-Za-z/.test(pattern)) {
    add('Abc', true, 'Letras ASCII de ambos casos', 'ASCII letters of either case', 'generated');
    add('ñ', false, 'ñ no es ASCII', 'ñ is not ASCII', 'false-positive-probe');
  }
  if (has(/[áéíóúñÁÉÍÓÚÑ]/)) {
    add('ñ', true, 'Carácter acento/ñ literal del patrón', 'Literal accent/ñ from the pattern', 'generated');
    add('n', false, 'Sin la ñ', 'Without ñ', 'false-positive-probe');
  }
  const literal = tokens.find(token => token.kind === 'literal' && token.raw.length >= 3);
  if (literal) {
    add(literal.raw, true, `Literal del patrón: ${literal.raw}`, `Literal from pattern: ${literal.raw}`, 'generated');
    const upper = literal.raw.toUpperCase();
    if (upper !== literal.raw) {
      add(upper, flags.includes('i'), 'Variante de mayúsculas', 'Uppercase variant', 'false-positive-probe');
    }
  }
  if (/^\^/.test(pattern) && /\$$/.test(pattern)) {
    add('abc', true, 'Texto completo', 'Whole text', 'generated');
    add('xabcx', false, 'El patrón está anclado', 'The pattern is anchored', 'false-positive-probe');
  }
  if (tokens.some(token => token.kind === 'boundary')) {
    add('gato', true, 'Palabra completa', 'Whole word', 'generated');
    add('gaton', false, 'No es frontera de palabra', 'Not a word boundary', 'false-positive-probe');
  }

  for (const probe of UNICODE_PROBES) {
    const letterProbe = probe.kind === 'letters' && /\\p\{L\}/.test(pattern);
    const expected = letterProbe ? true : false;
    add(probe.text, expected,
      `Sonda Unicode: ${probe.es}${letterProbe ? ' (se espera coincidencia)' : ''}`,
      `Unicode probe: ${probe.en}${letterProbe ? ' (expected to match)' : ''}`,
      letterProbe ? 'generated' : 'unicode-probe');
  }
  return cases.slice(0, 40);
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

function tokensMarkdown(result, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `## ${t('Tokens', 'Tokens')}`, '',
    '| ' + t('Pos', 'Pos') + ' | ' + t('Fragmento', 'Fragment') + ' | ' +
      t('Tipo', 'Kind') + ' | ' + t('Significado', 'Meaning') + ' |',
    '| --- | --- | --- | --- |'
  ];
  for (const token of result.tokens) {
    const raw = token.raw.replace(/\|/g, '\\|').replace(/\n/g, '\\n');
    lines.push(`| ${token.start} | \`${raw}\` | ${token.kind} | ` +
      `${localText(language, token.description_es, token.description_en).replace(/\|/g, '\\|')} |`);
  }
  return lines.join('\n');
}

function explainMarkdown(result, language) {
  const t = (es, en) => localText(language, es, en);
  if (!result.valid) {
    return [
      `# ${t('Explicación de regex', 'Regex explanation')}`, '',
      `- ${t('Patrón', 'Pattern')}: \`${result.pattern}\``,
      `- ${t('Banderas', 'Flags')}: \`${result.flags || '-'}\``,
      `- **${t('INVÁLIDO', 'INVALID')}**: ${result.error}`, ''
    ].join('\n');
  }
  const lines = [
    `# ${t('Explicación de regex', 'Regex explanation')}`, '',
    `- ${t('Patrón', 'Pattern')}: \`${result.pattern}\``,
    `- ${t('Banderas', 'Flags')}: \`${result.flags || '-'}\``,
    `- ${t('Grupos de captura', 'Capturing groups')}: ${result.groupCount}`,
    `- ${t('Riesgo de backtracking', 'Backtracking risk')}: **${result.risk.level.toUpperCase()}**`,
    `- ${t('Guardado', 'Saved')}: ${result.written ? t('sí', 'yes') : t('no', 'no')}`,
    '',
    tokensMarkdown(result, language), '',
    `## ${t('Riesgos', 'Risks')}`, ''
  ];
  if (!result.risk.reasons.length) lines.push(t('Sin señales de riesgo.', 'No risk signals.'));
  for (const reason of result.risk.reasons) {
    lines.push(`- **[${reason.level}]** ${localText(language, reason.es, reason.en)}`);
  }
  lines.push('', `## ${t('Unicode y banderas', 'Unicode and flags')}`, '');
  if (!result.unicode.length) lines.push(t('Sin recomendaciones.', 'No recommendations.'));
  for (const item of result.unicode) {
    lines.push(`- ${item.flag ? `\`${item.flag}\` ` : ''}[${item.level}] ` +
      localText(language, item.es, item.en));
  }
  lines.push('', `## ${t('Sabores', 'Flavours')}`, '',
    `- **JavaScript**: \`/${result.flavors.js.pattern}/${result.flavors.js.flags}\``,
    `- **PCRE**: \`/${result.flavors.pcre.pattern}/${result.flavors.pcre.flags}\``,
    `- **POSIX ERE**: \`${result.flavors.posix.ere.pattern}\``,
    `- **POSIX BRE**: \`${result.flavors.posix.bre.pattern}\``, '');
  for (const note of result.flavors.posix.ere.notes) lines.push(`- ${t('POSIX', 'POSIX')}: ${note}`);
  lines.push('', `## ${t('Casos generados', 'Generated cases')}`, '',
    '| ' + t('Texto', 'Text') + ' | ' + t('Esperado', 'Expected') + ' | ' +
      t('Motivo', 'Reason') + ' |',
    '| --- | --- | --- |');
  for (const item of result.cases) {
    lines.push(`| \`${item.text.replace(/\|/g, '\\|').replace(/\n/g, '\\n')}\` | ` +
      `${item.expect ? t('sí', 'yes') : t('no', 'no')} | ` +
      `${localText(language, item.why_es, item.why_en).replace(/\|/g, '\\|')} |`);
  }
  return `${lines.join('\n')}\n`;
}

/* ------------------------------------------------------------------ */
/* Tools                                                               */
/* ------------------------------------------------------------------ */

async function regexExplain(args) {
  const language = langOf(args.language);
  const pattern = String(args.pattern == null ? '' : args.pattern);
  const flags = cleanFlags(args.flags);
  const compiled = compile(pattern, flags);
  const result = {
    format: 'antigem-regex-explain',
    version: 1,
    createdAt: Date.now(),
    language, pattern, flags,
    valid: compiled.ok,
    error: compiled.error,
    tokens: [], groupCount: 0,
    risk: {level: 'unknown', reasons: []},
    unicode: [], flavors: null, cases: [],
    written: false, path: null
  };
  if (compiled.ok) {
    const parsed = tokenize(pattern);
    result.tokens = parsed.tokens;
    result.groupCount = parsed.groupCount;
    result.risk = analyzeRisk(pattern);
    result.unicode = unicodeAdvice(pattern, flags, parsed.tokens);
    result.flavors = convertFlavors(pattern, flags);
    result.cases = generateCases(pattern, flags, parsed.tokens);
    result.flagsSuggested = {
      u: flags.includes('u') ? flags : flags + 'u',
      iu: flags.includes('i') ? (flags.includes('u') ? flags : flags + 'u') : (flags.includes('u') ? flags + 'i' : flags + 'iu')
    };
  }
  result.markdown = explainMarkdown(result, language);
  result.written = await maybeWrite(args, args.output, result.markdown);
  result.path = result.written ? String(args.output).trim() : null;
  return result;
}

function execSample(pattern, flags, text, maxMatches) {
  const re = new RegExp(pattern, cleanFlags(flags).replace(/[gy]/g, '') + 'g');
  const matches = [];
  let match;
  let guard = 0;
  while ((match = re.exec(text)) !== null) {
    matches.push({
      index: match.index,
      text: match[0],
      groups: match.slice(1).map(value => value === undefined ? null : value)
    });
    if (match[0] === '') re.lastIndex++;
    if (matches.length >= maxMatches || ++guard > maxMatches * 2) break;
  }
  return matches;
}

function normalizeSamples(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((item, index) => {
    if (typeof item === 'string') {
      return {text: item, expect: null, label: `sample_${index + 1}`, source: 'sample'};
    }
    if (!item || typeof item !== 'object') {
      return {text: String(item), expect: null, label: `sample_${index + 1}`, source: 'sample'};
    }
    return {
      text: String(item.text == null ? '' : item.text),
      expect: typeof item.expect === 'boolean' ? item.expect : null,
      label: String(item.label || `sample_${index + 1}`),
      source: 'sample'
    };
  });
}

function testMarkdown(result, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${t('Prueba de regex', 'Regex test')}`, '',
    `- ${t('Patrón', 'Pattern')}: \`${result.pattern}\``,
    `- ${t('Banderas', 'Flags')}: \`${result.flags || '-'}\``,
    `- ${t('Riesgo', 'Risk')}: **${result.risk.level.toUpperCase()}**`,
    `- ${t('Casos', 'Cases')}: ${result.summary.total}`,
    `- ${t('Correctos', 'Passed')}: ${result.summary.passed}`,
    `- ${t('Fallidos', 'Failed')}: ${result.summary.failed}`,
    `- ${t('Falsos positivos', 'False positives')}: ${result.summary.falsePositives}`,
    `- ${t('Omitidos', 'Skipped')}: ${result.summary.skipped}`,
    '',
    '| ' + t('Origen', 'Source') + ' | ' + t('Texto', 'Text') + ' | ' +
      t('Esperado', 'Expected') + ' | ' + t('Real', 'Actual') + ' | ' +
      t('Resultado', 'Result') + ' |',
    '| --- | --- | --- | --- | --- |'
  ];
  for (const item of result.cases) {
    const label = item.status === 'skip' ? 'SKIP' : (item.pass ? 'OK' : 'FAIL');
    lines.push(`| ${item.source} | \`${item.text.replace(/\|/g, '\\|').replace(/\n/g, '\\n')}\` | ` +
      `${item.expect === null ? '-' : (item.expect ? t('sí', 'yes') : t('no', 'no'))} | ` +
      `${item.matched === null ? '-' : (item.matched ? t('sí', 'yes') : t('no', 'no'))} | ${label} |`);
  }
  if (result.warnings.length) {
    lines.push('', `## ${t('Avisos', 'Warnings')}`, '');
    for (const warning of result.warnings) lines.push(`- ${warning}`);
  }
  return `${lines.join('\n')}\n`;
}

async function regexTest(args) {
  const language = langOf(args.language);
  const pattern = String(args.pattern == null ? '' : args.pattern);
  const flags = cleanFlags(args.flags);
  const compiled = compile(pattern, flags);
  const result = {
    format: 'antigem-regex-test',
    version: 1,
    createdAt: Date.now(),
    language, pattern, flags,
    valid: compiled.ok,
    error: compiled.error,
    risk: {level: 'unknown', reasons: []},
    cases: [], warnings: [],
    summary: {total: 0, passed: 0, failed: 0, falsePositives: 0, skipped: 0},
    written: false, path: null
  };

  if (!compiled.ok) {
    result.markdown = testMarkdown(result, language);
    return result;
  }

  const parsed = tokenize(pattern);
  result.risk = analyzeRisk(pattern);
  const maxMatches = clamp(args.max_matches, 1, 100, 20);
  const samples = normalizeSamples(args.samples);
  const cases = args.generate_cases === false ? samples : samples.concat(generateCases(pattern, flags, parsed.tokens));

  if (result.risk.level === 'high') {
    result.warnings.push(localText(language,
      'Riesgo alto de backtracking catastrófico: no se ejecutó ninguna muestra. Simplifica el patrón antes de probarlo.',
      'High catastrophic-backtracking risk: no samples were executed. Simplify the pattern before testing.'));
  } else {
    if (result.risk.level === 'medium') {
      result.warnings.push(localText(language,
        'Riesgo medio: se limitó el tamaño de cada muestra a 200 caracteres.',
        'Medium risk: each sample was capped at 200 characters.'));
    }
    for (const item of cases) {
      const text = result.risk.level === 'medium' ? item.text.slice(0, 200) : item.text;
      const matches = execSample(pattern, flags, text, maxMatches);
      const matched = matches.length > 0;
      let pass = true;
      let status = 'ok';
      if (item.expect === null) {
        status = 'ok';
      } else if (matched !== item.expect) {
        pass = false;
        status = 'fail';
        if (item.expect === false && matched) result.summary.falsePositives++;
      }
      result.cases.push(Object.assign({}, item, {
        text, matched, matches, pass, status,
        firstMatch: matches.length ? matches[0] : null
      }));
    }
  }

  result.summary.total = result.cases.length;
  result.summary.passed = result.cases.filter(item => item.pass && item.status !== 'skip').length;
  result.summary.failed = result.cases.filter(item => !item.pass).length;
  result.summary.skipped = result.risk.level === 'high' ? cases.length : 0;
  result.markdown = testMarkdown(result, language);
  result.written = await maybeWrite(args, args.output, result.markdown);
  result.path = result.written ? String(args.output).trim() : null;
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    const args = message.args || {};
    if (message.tool === 'regex_explain') return await regexExplain(args);
    if (message.tool === 'regex_test') return await regexTest(args);
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: error && error.message ? error.message : String(error)}]
  }));
  return true;
});
