'use strict';

// Viral Script Lab - análisis heuristic offline de guiones cortos.
// Sin red, sin fuentes remotas y sin dependencias externas.

const POWER_WORDS = [
  'secreto', 'secrets', 'nunca', 'jamás', 'never', 'stop',
  'deja', 'truco', 'hack', 'rápido', 'fast', 'fácil', 'easy', 'gratis',
  'free', 'mejor', 'best', 'peor', 'worst', 'increíble', 'insane',
  'real', 'verdad', 'truth', 'efecto', 'resultado', 'antes', 'después',
  'antes', 'after', 'error', 'mistake', 'cuidado', 'watch out', 'solo', 'only'
];

const STOP_WORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'en',
  'con', 'por', 'para', 'como', 'que', 'del', 'al', 'se', 'su', 'sus', 'mi',
  'mis', 'tu', 'tus', 'es', 'son', 'fue', 'era', 'esto', 'esto', 'eso', 'ya',
  'no', 'sí', 'si', 'me', 'te', 'le', 'nos', 'vos', 'lo', 'la', 'más', 'menos',
  'muy', 'todo', 'toda', 'todos', 'todas', 'the', 'a', 'an', 'and', 'or', 'in',
  'on', 'for', 'to', 'with', 'of', 'is', 'are', 'was', 'were', 'this', 'that',
  'it', 'you', 'your', 'my', 'our', 'their', 'be', 'been', 'being', 'do', 'does',
  'did', 'have', 'has', 'had', 'will', 'can', 'just', 'so', 'not', 'but', 'if'
]);

const CTA_PATTERNS = [
  {type: 'follow', re: /sígueme|siguenos|síguenos|follow me|follow for more|follow us/i},
  {type: 'subscribe', re: /suscríbete|suscribete|suscríbete al canal|subscribe|sub to the channel/i},
  {type: 'comment', re: /comenta|déjalo en comentarios|escribe en comentarios|comment|tell me in the comments/i},
  {type: 'save', re: /guarda este|guarda el video|save this|bookmark/i},
  {type: 'share', re: /comparte|comparte este|share this|send this to/i},
  {type: 'link', re: /link en la bio|link en bio|enlace en la bio|link in bio|check the link/i}
];

const ACT_WORDS = {
  setup: /porque|cuando|hoy|antes|imagina|normalmente|because|when|today|usually|imagine|here's/i,
  conflict: /pero|sin embargo|hasta|entonces|problema|error|fallo|en vez|but|however|until|then|mistake|wrong|instead/i,
  payoff: /por eso|resultado|logré|conseguí|así|finalmente|solución|funciona|so|result|finally|now|solution|works/i
};

const PLATFORM_RANGES = {
  shorts: {cuts: [18, 40], wpm: [140, 180], maxSeconds: 60},
  reels: {cuts: [16, 36], wpm: [135, 175], maxSeconds: 90},
  tiktok: {cuts: [22, 48], wpm: [150, 190], maxSeconds: 60},
  all: {cuts: [18, 40], wpm: [140, 180], maxSeconds: 90}
};

const HASHTAGS_ES = [
  '#Viral', '#Shorts', '#Reels', '#TikTok', '#ParaTi', '#FYP', '#Consejos',
  '#Educación', '#Trucos', '#Tendencias'
];
const HASHTAGS_EN = [
  '#Viral', '#Shorts', '#Reels', '#TikTok', '#FYP', '#ForYou', '#Tips',
  '#Education', '#Hacks', '#Trending'
];

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

function words(text) {
  return String(text || '').match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9']+/g) || [];
}

function countWords(text) {
  return words(text).length;
}

function sentences(text) {
  return String(text || '')
    .split(/[.!?…\n]+/)
    .map(part => part.trim())
    .filter(Boolean);
}

function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '')
    .replace(/^_+|_+$/g, '');
}

function capitalize(value) {
  const text = String(value || '').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function rangeScore(value, range) {
  const [min, max] = range;
  if (value >= min && value <= max) return 100;
  if (value < min) return Math.max(0, Math.round(100 - ((min - value) / Math.max(1, min)) * 130));
  return Math.max(0, Math.round(100 - ((value - max) / Math.max(1, max)) * 110));
}

function addIssue(issues, severity, code, es, en, suggestionEs, suggestionEn) {
  issues.push({
    severity, code, message: en, message_es: es,
    suggestion: suggestionEn, suggestion_es: suggestionEs
  });
}

function platformRange(platform) {
  return PLATFORM_RANGES[platform] || PLATFORM_RANGES.all;
}

function estimateDuration(script, args, language) {
  const total = countWords(script);
  const wpm = clamp(args.wpm, 60, 300, 150);
  const given = Number(args.duration_seconds);
  const estimated = Number.isFinite(given) && given > 0
    ? given : Math.max(1, Math.round((total / wpm) * 60));
  const actualWpm = Number.isFinite(given) && given > 0
    ? Math.round(total / (given / 60)) : wpm;
  return {totalWords: total, wpm, seconds: estimated, actualWpm, estimated: !(Number.isFinite(given) && given > 0), language};
}

function analyzeHook(sentencesList, duration, hookSeconds) {
  // Palabras que caben en la ventana del gancho, no en todo el vídeo.
  const window = Math.max(4, Math.min(30, Math.round((hookSeconds * duration.actualWpm) / 60)));
  const picked = [];
  for (const sentence of sentencesList) {
    picked.push(sentence);
    if (countWords(picked.join(' ')) >= window) break;
  }
  const hookText = picked.join(' ').slice(0, 400) || sentencesList[0] || '';
  const hookWords = countWords(hookText);
  const lower = hookText.toLowerCase();
  const checks = {
    question: /[¿?]/.test(hookText),
    number: /\d/.test(hookText),
    powerWord: POWER_WORDS.some(word => lower.includes(word)),
    directAddress: /\b(tú|te|ti|tu|usted|you|your|you'll)\b/i.test(hookText),
    concise: hookWords >= 6 && hookWords <= 18,
    genericGreeting: /^(hola|hey|buenas|hello|hi|qué tal)\b/i.test(hookText.trim()),
    negation: /^(no|nunca|jamás|never|stop|deja|para)\b/i.test(hookText.trim()),
    exclamation: /!/.test(hookText)
  };

  let score = 35;
  if (checks.question) score += 14;
  if (checks.number) score += 12;
  if (checks.powerWord) score += 14;
  if (checks.directAddress) score += 10;
  if (checks.concise) score += 12;
  else if (hookWords > 24) score -= 18;
  else score -= 4;
  if (checks.genericGreeting) score -= 18;
  if (checks.negation) score += 10;
  if (checks.exclamation) score += 4;

  return {text: hookText, words: hookWords, window, checks, score: Math.max(0, Math.min(100, score))};
}

function analyzeCuts(script, sentencesList, duration, platform) {
  const markerMatches = script.match(/\[(?:cut|corte|shot|escena|pausa|pause)[^\]]*\]|\/\/\/|---+/gi) || [];
  const explicit = markerMatches.length;
  const lineBreaks = Math.max(0, script.split(/\n+/).length - 1);
  const sentenceBreaks = Math.max(0, sentencesList.length - 1);
  const estimated = explicit + Math.round(lineBreaks * 0.7) + Math.round(sentenceBreaks * 0.5);
  const perMinute = duration.seconds > 0 ? Math.round((estimated / (duration.seconds / 60)) * 10) / 10 : 0;
  const target = platformRange(platform).cuts;
  return {
    explicit, estimated, perMinute, target,
    score: rangeScore(perMinute, target)
  };
}

function analyzeActs(sentencesList) {
  const chunk = Math.max(1, Math.ceil(sentencesList.length / 3));
  const first = sentencesList.slice(0, chunk).join(' ');
  const middle = sentencesList.slice(chunk, chunk * 2).join(' ');
  const last = sentencesList.slice(chunk * 2).join(' ');
  const parts = [
    {name: 'setup', es: 'Planteamiento', en: 'Setup', text: first, found: ACT_WORDS.setup.test(first) || /[¿?]/.test(first)},
    {name: 'conflict', es: 'Conflicto', en: 'Conflict', text: middle, found: ACT_WORDS.conflict.test(middle)},
    {name: 'payoff', es: 'Resolución', en: 'Payoff', text: last, found: ACT_WORDS.payoff.test(last) || CTA_PATTERNS.some(item => item.re.test(last))}
  ];
  const score = (parts[0].found ? 35 : 0) + (parts[1].found ? 35 : 0) + (parts[2].found ? 30 : 0);
  return {parts: parts.map(part => ({...part, text: part.text.slice(0, 220)})), score};
}

function detectCta(script) {
  const parts = sentences(script);
  const tailCount = Math.max(1, Math.ceil(parts.length * 0.25));
  const tail = parts.slice(-tailCount).join(' ');
  const matches = source => {
    for (const pattern of CTA_PATTERNS) {
      const match = source.match(pattern.re);
      if (match) return {type: pattern.type, text: match[0]};
    }
    return null;
  };
  const finalMatch = matches(tail);
  if (finalMatch) {
    return {found: true, atEnd: true, type: finalMatch.type, text: finalMatch.text, score: 100};
  }
  const anywhere = matches(String(script));
  if (anywhere) {
    return {found: true, atEnd: false, type: anywhere.type, text: anywhere.text, score: 60};
  }
  return {found: false, atEnd: false, type: null, text: null, score: 0};
}

function gradeFor(score) {
  if (score >= 85) return {es: 'Excelente', en: 'Excellent'};
  if (score >= 70) return {es: 'Bueno', en: 'Good'};
  if (score >= 55) return {es: 'Mejorable', en: 'Improvable'};
  return {es: 'Débil', en: 'Weak'};
}

function buildIssues(hook, cuts, pace, acts, cta, duration, platform) {
  const issues = [];
  const range = platformRange(platform);

  if (hook.score < 60) {
    addIssue(issues, 'warning', 'HOOK_WEAK',
      'El gancho no engancha lo suficiente en los primeros segundos.',
      'The hook does not grab attention in the first seconds.',
      'Empieza con una pregunta, un número o una negación fuerte.',
      'Start with a question, a number or a strong negation.');
  }
  if (hook.checks.genericGreeting) {
    addIssue(issues, 'warning', 'HOOK_GENERIC',
      'El guion empieza con un saludo genérico.',
      'The script opens with a generic greeting.',
      'Quita el saludo y entra directamente en el conflicto.',
      'Drop the greeting and go straight into the conflict.');
  }
  if (hook.words > 24) {
    addIssue(issues, 'warning', 'HOOK_TOO_LONG',
      `El gancho tiene ${hook.words} palabras.`,
      `The hook has ${hook.words} words.`,
      'Acorta la primera frase a 6-18 palabras.',
      'Shorten the first sentence to 6-18 words.');
  }
  if (pace.wpm < range.wpm[0]) {
    addIssue(issues, 'warning', 'PACE_SLOW',
      `Ritmo lento: ${pace.wpm} palabras/minuto.`,
      `Slow pace: ${pace.wpm} words per minute.`,
      'Elimina muletillas y frases secundarias.',
      'Cut filler words and secondary clauses.');
  } else if (pace.wpm > range.wpm[1]) {
    addIssue(issues, 'warning', 'PACE_FAST',
      `Ritmo rápido: ${pace.wpm} palabras/minuto.`,
      `Fast pace: ${pace.wpm} words per minute.`,
      'Deja pausas para que se entienda el punto clave.',
      'Leave pauses so the key point lands.');
  }
  if (cuts.perMinute < range.cuts[0]) {
    addIssue(issues, 'warning', 'CUTS_LOW',
      `Pocos cortes: ${cuts.perMinute} por minuto.`,
      `Too few cuts: ${cuts.perMinute} per minute.`,
      'Añade marcadores [CUT] o cambia de plano cada 2-3 segundos.',
      'Add [CUT] markers or change shots every 2-3 seconds.');
  } else if (cuts.perMinute > range.cuts[1]) {
    addIssue(issues, 'info', 'CUTS_HIGH',
      `Muchos cortes: ${cuts.perMinute} por minuto.`,
      `Many cuts: ${cuts.perMinute} per minute.`,
      'Agrupa acciones para no fatigar la vista.',
      'Group actions to avoid visual fatigue.');
  }
  const missing = acts.parts.filter(part => !part.found).map(part => part.es);
  if (missing.length) {
    addIssue(issues, 'warning', 'ACTS_WEAK',
      `Faltan partes de la estructura de 3 actos: ${missing.join(', ')}.`,
      `Missing three-act parts: ${missing.join(', ')}.`,
      'Añade contexto, un giro y una resolución clara.',
      'Add context, a turn and a clear resolution.');
  }
  if (!cta.found) {
    addIssue(issues, 'info', 'CTA_MISSING',
      'No hay una llamada a la acción clara al final.',
      'There is no clear call to action at the end.',
      'Cierra con follow, comenta, guarda o link en bio.',
      'Close with follow, comment, save or link in bio.');
  } else if (!cta.atEnd) {
    addIssue(issues, 'info', 'CTA_NOT_FINAL',
      `La llamada a la acción «${cta.text}» aparece antes del final.`,
      `The call to action "${cta.text}" appears before the end.`,
      'Muévela a la última frase del guion.',
      'Move it to the final sentence of the script.');
  }
  if (duration.seconds > range.maxSeconds) {
    addIssue(issues, 'info', 'LENGTH_LONG',
      `Duración estimada ${duration.seconds}s, por encima de ${range.maxSeconds}s recomendados.`,
      `Estimated duration ${duration.seconds}s, above the recommended ${range.maxSeconds}s.`,
      'Recorta a lo esencial para la plataforma elegida.',
      'Trim to the essentials for the chosen platform.');
  }
  return issues;
}

function renderAnalysis(analysis, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${t('Análisis de guion viral', 'Viral script analysis')}`,
    '',
    `- ${t('Plataforma', 'Platform')}: \`${analysis.platform}\``,
    `- ${t('Puntuación', 'Score')}: **${analysis.score}/100** (${t(analysis.grade.es, analysis.grade.en)})`,
    `- ${t('Palabras', 'Words')}: ${analysis.duration.totalWords}`,
    `- ${t('Duración', 'Duration')}: ${analysis.duration.seconds}s ${analysis.duration.estimated ? t('(estimada)', '(estimated)') : ''}`,
    `- ${t('Ritmo', 'Pace')}: ${analysis.pace.wpm} ${t('palabras/min', 'words/min')}`,
    `- ${t('Cortes', 'Cuts')}: ${analysis.cuts.perMinute}/${t('min', 'min')} ${t('(objetivo', '(target')} ${analysis.cuts.target[0]}-${analysis.cuts.target[1]})`,
    '',
    `## ${t('Gancho', 'Hook')}`,
    '',
    `> ${analysis.hook.text}`,
    '',
    `- ${t('Puntuación del gancho', 'Hook score')}: ${analysis.hook.score}/100`,
    `- ${t('Palabras en el gancho', 'Hook words')}: ${analysis.hook.words}`,
    '',
    `## ${t('Estructura de 3 actos', 'Three-act structure')}`,
    ''
  ];
  for (const part of analysis.acts.parts) {
    lines.push(`- ${t(part.es, part.en)}: **${part.found ? 'OK' : t('FALTA', 'MISSING')}** — ${part.text || '-'}`);
  }
  lines.push('', `## ${t('CTA', 'CTA')}`, '', `- ${analysis.cta.found
    ? `\`${analysis.cta.type}\`: ${analysis.cta.text} (${analysis.cta.atEnd ? t('al final', 'at the end') : t('no al final', 'not at the end')})`
    : t('No detectado.', 'Not detected.')}`);
  lines.push('', `## ${t('Hallazgos', 'Findings')}`, '');
  if (!analysis.issues.length) lines.push(t('Sin hallazgos.', 'No findings.'));
  else {
    for (const issue of analysis.issues) {
      const message = language === 'es' ? issue.message_es : language === 'en' ? issue.message :
        `${issue.message_es} / ${issue.message}`;
      const suggestion = language === 'es' ? issue.suggestion_es : language === 'en' ? issue.suggestion :
        `${issue.suggestion_es} / ${issue.suggestion}`;
      lines.push(`- **${issue.severity.toUpperCase()}** [\`${issue.code}\`] ${message} ${t('→', '→')} ${suggestion}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function viralAnalyze(args) {
  const script = String(args.script || '').trim();
  if (!script) throw new Error('El guion está vacío / Script is empty');
  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  const platform = ['shorts', 'reels', 'tiktok', 'all'].includes(args.platform) ? args.platform : 'all';
  const hookSeconds = clamp(args.hook_seconds, 1, 15, 3);
  const duration = estimateDuration(script, args, language);
  const parts = sentences(script);
  const hook = analyzeHook(parts, duration, hookSeconds);
  const cuts = analyzeCuts(script, parts, duration, platform);
  const paceRange = platformRange(platform).wpm;
  const pace = {wpm: duration.actualWpm, target: paceRange, score: rangeScore(duration.actualWpm, paceRange)};
  const acts = analyzeActs(parts);
  const cta = detectCta(script);
  const issues = buildIssues(hook, cuts, pace, acts, cta, duration, platform);
  const score = Math.round(hook.score * 0.3 + cuts.score * 0.2 + pace.score * 0.2 + acts.score * 0.2 + cta.score * 0.1);

  const analysis = {
    analysisId: `an_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(), platform, language,
    score, grade: gradeFor(score),
    duration, hook, cuts, pace, acts, cta, issues,
    scriptExcerpt: script.slice(0, 1200)
  };
  analysis.markdown = renderAnalysis(analysis, language);
  await chrome.storage.local.set({
    [`analyses.${analysis.analysisId}`]: analysis,
    lastAnalysis: analysis.analysisId
  });
  return analysis;
}

function keywordScores(text) {
  const counts = new Map();
  for (const token of words(text)) {
    const lower = token.toLowerCase();
    if (lower.length < 4 || STOP_WORDS.has(lower)) continue;
    counts.set(lower, (counts.get(lower) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([word, count]) => ({word, count, score: count * 10 + word.length}))
    .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word))
    .slice(0, 8);
}

function extractTopic(args, keywords) {
  if (String(args.topic || '').trim()) return capitalize(String(args.topic).trim().slice(0, 80));
  const first = sentences(args.script || '')[0] || '';
  const cleaned = first
    .replace(/^(hola|hey|buenas|hello|hi)\b[^\n]*/i, '')
    .replace(/^[¿¡\[(]+|[)\]]+$/g, '')
    .trim();
  if (cleaned && countWords(cleaned) <= 6) return capitalize(cleaned);
  if (keywords.length >= 2) return `${capitalize(keywords[0].word)} + ${keywords[1].word}`;
  if (keywords.length === 1) return capitalize(keywords[0].word);
  return localText(args.language || 'both', 'tu idea', 'your idea');
}

function uniqueBy(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function titleTemplates(topic, seconds) {
  const inline = topic.charAt(0).toLowerCase() + topic.slice(1);
  return {
    es: [
      `${topic}: lo que nadie te cuenta`,
      `Los 3 secretos de ${inline}`,
      `No hagas esto con ${inline}`,
      `${topic} en ${seconds} segundos`,
      `La razón por la que ${inline} funciona`,
      `Probé ${inline} y esto pasó`,
      `${topic} explicado fácil`,
      `Antes de probar ${inline}, mira esto`,
      `Este truco de ${inline} cambia todo`,
      `${topic}: el error que todos cometen`
    ],
    en: [
      `${topic}: what nobody tells you`,
      `The 3 secrets of ${inline}`,
      `Stop doing this with ${inline}`,
      `${topic} in ${seconds} seconds`,
      `Why ${inline} actually works`,
      `I tried ${inline} and this happened`,
      `${topic} explained simply`,
      `Before you try ${inline}, watch this`,
      `This ${inline} hack changes everything`,
      `${topic}: the mistake everyone makes`
    ]
  };
}

function hookTemplates(topic) {
  const inline = topic.charAt(0).toLowerCase() + topic.slice(1);
  return {
    es: [
      `¿Sabías que ${inline} tiene un truco?`,
      `No uses ${inline} así nunca más.`,
      `En 3 segundos te explico ${inline}.`,
      `Esto es lo que nadie te dice de ${inline}.`,
      `Si haces ${inline}, mira esto primero.`
    ],
    en: [
      `Did you know ${inline} has a trick?`,
      `Stop using ${inline} like this.`,
      `I'll explain ${inline} in 3 seconds.`,
      `This is what nobody tells you about ${inline}.`,
      `If you do ${inline}, watch this first.`
    ]
  };
}

function renderVariants(variants, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${t('Variantes virales', 'Viral variants')}`,
    '',
    `- ${t('Tema', 'Topic')}: **${variants.topic}**`,
    `- ${t('Plataforma', 'Platform')}: \`${variants.platform}\``,
    '',
    `## ${t('Títulos', 'Titles')}`,
    ''
  ];
  variants.titles.forEach((title, index) => lines.push(`${index + 1}. ${title}`));
  lines.push('', `## ${t('Ganchos alternativos', 'Alternative hooks')}`, '');
  variants.hooks.forEach((hook, index) => lines.push(`${index + 1}. ${hook}`));
  lines.push('', `## ${t('Hashtags', 'Hashtags')}`, '', variants.hashtagString, '');
  if (variants.keywords.length) {
    lines.push(`## ${t('Palabras clave', 'Keywords')}`, '');
    lines.push(variants.keywords.map(item => `\`${item.word}\` (${item.count})`).join(', '));
  }
  return `${lines.join('\n')}\n`;
}

async function viralVariants(args) {
  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  const platform = ['shorts', 'reels', 'tiktok', 'all'].includes(args.platform) ? args.platform : 'all';
  const count = clamp(args.count, 3, 20, 8);
  const hashtagCount = clamp(args.hashtag_count, 1, 20, 6);
  const script = String(args.script || '');
  const keywords = keywordScores(`${args.topic || ''} ${script}`);
  const topic = extractTopic(args, keywords);
  const totalWords = countWords(script);
  const seconds = Math.max(3, Math.round((totalWords / clamp(args.wpm, 60, 300, 150)) * 60) || 30);

  const titles = titleTemplates(topic, seconds);
  const hooks = hookTemplates(topic);
  const pickedTitles = language === 'both' ? [] : titles[language].slice();
  if (language === 'both') {
    for (let index = 0; index < Math.max(titles.es.length, titles.en.length); index++) {
      if (titles.es[index]) pickedTitles.push(titles.es[index]);
      if (titles.en[index]) pickedTitles.push(titles.en[index]);
    }
  }

  const pickedHooks = language === 'both' ? [...hooks.es, ...hooks.en] : hooks[language].slice();
  const languageTags = language === 'both' ? [...HASHTAGS_ES, ...HASHTAGS_EN] :
    language === 'es' ? HASHTAGS_ES : HASHTAGS_EN;
  const platformTags = platform === 'shorts' ? ['#YouTubeShorts'] :
    platform === 'reels' ? ['#InstagramReels'] :
      platform === 'tiktok' ? ['#TikTokMadeMeTryIt'] : ['#YouTubeShorts', '#InstagramReels'];
  const topicTags = keywords
    .slice(0, hashtagCount + 2)
    .map(item => `#${capitalize(slug(item.word) || item.word)}`);
  const hashtags = uniqueBy([...platformTags, ...topicTags, ...languageTags]).slice(0, hashtagCount);

  const variants = {
    variantsId: `va_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(), language, platform, topic,
    titles: uniqueBy(pickedTitles).slice(0, count),
    hooks: uniqueBy(pickedHooks).slice(0, 5),
    hashtags, hashtagString: hashtags.join(' '), keywords,
    estimatedSeconds: seconds
  };
  variants.markdown = renderVariants(variants, language);
  await chrome.storage.local.set({
    [`variants.${variants.variantsId}`]: variants,
    lastVariants: variants.variantsId
  });
  return variants;
}

async function loadStored(key) {
  const values = await chrome.storage.local.get(key);
  return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
}

function renderFullReport(analysis, variants, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${t('Informe de guion viral', 'Viral script report')}`,
    '',
    `- **${t('Puntuación', 'Score')}:** ${analysis.score}/100 (${t(analysis.grade.es, analysis.grade.en)})`,
    `- ${t('Plataforma', 'Platform')}: \`${analysis.platform}\``,
    `- ${t('Duración', 'Duration')}: ${analysis.duration.seconds}s`,
    `- ${t('Ritmo', 'Pace')}: ${analysis.pace.wpm} ${t('wpm', 'wpm')}`,
    `- ${t('Cortes', 'Cuts')}: ${analysis.cuts.perMinute}/${t('min', 'min')}`,
    '',
    `## ${t('Métricas', 'Metrics')}`,
    '',
    `| ${t('Métrica', 'Metric')} | ${t('Valor', 'Value')} | ${t('Objetivo', 'Target')} | ${t('Nota', 'Score')} |`,
    '| --- | --- | --- | --- |',
    `| ${t('Gancho', 'Hook')} | ${analysis.hook.score} | 60+ | ${Math.round(analysis.hook.score * 0.3)} |`,
    `| ${t('Cortes', 'Cuts')} | ${analysis.cuts.perMinute} | ${analysis.cuts.target[0]}-${analysis.cuts.target[1]} | ${Math.round(analysis.cuts.score * 0.2)} |`,
    `| ${t('Ritmo', 'Pace')} | ${analysis.pace.wpm} | ${analysis.pace.target[0]}-${analysis.pace.target[1]} | ${Math.round(analysis.pace.score * 0.2)} |`,
    `| ${t('3 actos', '3 acts')} | ${analysis.acts.score} | 70+ | ${Math.round(analysis.acts.score * 0.2)} |`,
    `| CTA | ${analysis.cta.found ? analysis.cta.type : t('no', 'none')} | 1 | ${Math.round(analysis.cta.score * 0.1)} |`,
    '',
    `## ${t('Gancho actual', 'Current hook')}`,
    '',
    `> ${analysis.hook.text}`,
    '',
    `## ${t('Hallazgos', 'Findings')}`,
    ''
  ];
  if (!analysis.issues.length) lines.push(t('Sin hallazgos.', 'No findings.'));
  else {
    for (const issue of analysis.issues) {
      const message = language === 'es' ? issue.message_es : language === 'en' ? issue.message :
        `${issue.message_es} / ${issue.message}`;
      const suggestion = language === 'es' ? issue.suggestion_es : language === 'en' ? issue.suggestion :
        `${issue.suggestion_es} / ${issue.suggestion}`;
      lines.push(`- **${issue.severity.toUpperCase()}** [\`${issue.code}\`] ${message} → ${suggestion}`);
    }
  }
  if (variants) {
    lines.push('', `## ${t('Variantes sugeridas', 'Suggested variants')}`, '');
    lines.push(`### ${t('Títulos', 'Titles')}`, '');
    variants.titles.forEach((title, index) => lines.push(`${index + 1}. ${title}`));
    lines.push('', `### ${t('Ganchos', 'Hooks')}`, '');
    variants.hooks.forEach((hook, index) => lines.push(`${index + 1}. ${hook}`));
    lines.push('', `### ${t('Hashtags', 'Hashtags')}`, '', variants.hashtagString);
  }
  return `${lines.join('\n')}\n`;
}

async function viralReport(args) {
  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  let analysis = args.analysis && typeof args.analysis === 'object' ? args.analysis : null;
  if (!analysis) {
    const analysisId = args.analysis_id || await loadStored('lastAnalysis');
    if (analysisId) analysis = await loadStored(`analyses.${analysisId}`);
  }
  if (!analysis) throw new Error('No hay un análisis guardado / No saved analysis');

  let variants = null;
  if (args.include_variants !== false) {
    variants = args.variants && typeof args.variants === 'object' ? args.variants : null;
    if (!variants) {
      const variantsId = args.variants_id || await loadStored('lastVariants');
      if (variantsId) variants = await loadStored(`variants.${variantsId}`);
    }
  }

  const markdown = renderFullReport(analysis, variants, language);
  let path = null;
  let written = false;
  if (args.output && args.dry_run === false) {
    path = String(args.output);
    await chrome.antigem.writeFile({path, data: markdown, encoding: 'utf8'});
    written = true;
  }
  return {
    ok: true, language, analysisId: analysis.analysisId || null,
    variantsId: variants ? variants.variantsId : null,
    path, written, markdown
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    const args = message.args || {};
    if (message.tool === 'viral_analyze') return await viralAnalyze(args);
    if (message.tool === 'viral_variants') return await viralVariants(args);
    if (message.tool === 'viral_report') return await viralReport(args);
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: error && error.message ? error.message : String(error)}]
  }));
  return true;
});
