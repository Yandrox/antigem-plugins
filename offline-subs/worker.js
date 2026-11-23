'use strict';

// Offline Subs - subtítulos SRT/VTT generados y ajustados sin servicios externos.

const PRESETS = {
  bold: {
    es: 'Negrita alta', en: 'High bold',
    color: '#FFFFFF', outline: '#000000', outlineWidth: 4,
    background: 'rgba(0,0,0,0.38)', weight: 800, radius: 10, shadow: '0 2px 12px rgba(0,0,0,0.65)'
  },
  neon: {
    es: 'Neón', en: 'Neon',
    color: '#67E8F9', outline: '#0F172A', outlineWidth: 3,
    background: 'rgba(15,23,42,0.55)', weight: 800, radius: 12,
    shadow: '0 0 12px rgba(103,232,249,0.9), 0 0 28px rgba(34,211,238,0.55)'
  },
  minimal: {
    es: 'Mínimo', en: 'Minimal',
    color: '#F8FAFC', outline: '#0F172A', outlineWidth: 2,
    background: 'rgba(2,6,23,0.28)', weight: 600, radius: 6, shadow: '0 1px 6px rgba(0,0,0,0.5)'
  },
  karaoke: {
    es: 'Karaoke', en: 'Karaoke',
    color: '#FDE047', outline: '#7C2D12', outlineWidth: 4,
    background: 'rgba(76,5,25,0.45)', weight: 800, radius: 10, shadow: '0 2px 10px rgba(0,0,0,0.6)'
  },
  banner: {
    es: 'Banda inferior', en: 'Bottom banner',
    color: '#FFFFFF', outline: '#111827', outlineWidth: 2,
    background: 'rgba(17,24,39,0.82)', weight: 700, radius: 0, shadow: 'none'
  }
};

const PLATFORM_DEFAULTS = {
  shorts: {fontSize: 64, maxChars: 32, bottom: '18%', aspect: '9:16', name: 'YouTube Shorts'},
  reels: {fontSize: 60, maxChars: 34, bottom: '16%', aspect: '9:16', name: 'Instagram Reels'},
  tiktok: {fontSize: 62, maxChars: 32, bottom: '20%', aspect: '9:16', name: 'TikTok'},
  youtube: {fontSize: 48, maxChars: 60, bottom: '8%', aspect: '16:9', name: 'YouTube'},
  all: {fontSize: 58, maxChars: 40, bottom: '14%', aspect: '9:16 / 16:9', name: 'General'}
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

function parseTimeToMs(value) {
  const raw = String(value == null ? '' : value).trim().replace(',', '.');
  let match = raw.match(/^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (match) {
    return Math.round((Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000);
  }
  match = raw.match(/^(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (match) return Math.round((Number(match[1]) * 60 + Number(match[2])) * 1000);
  match = raw.match(/^(\d+(?:\.\d+)?)s?$/i);
  if (match) return Math.round(Number(match[1]) * 1000);
  return null;
}

function pad(value, size = 2) {
  return String(value).padStart(size, '0');
}

function formatTime(ms, separator = ',') {
  const safe = Math.max(0, Math.round(Number(ms) || 0));
  const hours = Math.floor(safe / 3600000);
  const minutes = Math.floor((safe % 3600000) / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  const millis = safe % 1000;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${separator}${pad(millis, 3)}`;
}

function parseTimeRange(line) {
  const parts = String(line).split('-->');
  if (parts.length !== 2) return null;
  const start = parseTimeToMs(parts[0]);
  const endToken = parts[1].trim().split(/\s+/)[0];
  const end = parseTimeToMs(endToken);
  if (start === null || end === null) return null;
  return {start, end};
}

function parseSrt(text) {
  const source = String(text || '').replace(/\r\n?/g, '\n');
  const blocks = source.split(/\n\s*\n/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.trim().split('\n').filter(line => line.trim());
    if (!lines.length) continue;
    const rangeIndex = lines.findIndex(line => line.includes('-->'));
    if (rangeIndex < 0) continue;
    const range = parseTimeRange(lines[rangeIndex]);
    if (!range) continue;
    const body = lines.slice(rangeIndex + 1).join('\n').trim();
    if (!body) continue;
    cues.push({start_ms: range.start, end_ms: range.end, text: body});
  }
  return cues;
}

function renderSrt(cues) {
  return cues.map((cue, index) => [
    String(index + 1),
    `${formatTime(cue.start_ms, ',')} --> ${formatTime(cue.end_ms, ',')}`,
    String(cue.text || '').trim(),
    ''
  ].join('\n')).join('\n');
}

function renderVtt(cues) {
  const body = cues.map(cue => [
    `${formatTime(cue.start_ms, '.')} --> ${formatTime(cue.end_ms, '.')}`,
    String(cue.text || '').trim(),
    ''
  ].join('\n')).join('\n');
  return `WEBVTT\n\n${body}`;
}

function wordCount(text) {
  return (String(text || '').match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9']+/g) || []).length;
}

function wrapText(text, maxChars) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean || clean.length <= maxChars) return clean ? [clean] : [];
  const words = clean.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function sentencesFrom(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+|\n+/)
    .map(part => part.trim())
    .filter(Boolean);
}

function estimatedDurationMs(text, wpm, minMs, maxMs) {
  const words = wordCount(text);
  const raw = words > 0 ? Math.round((words / wpm) * 60000) : minMs;
  return Math.min(maxMs, Math.max(minMs, raw));
}

function hasTimestampMarkers(text) {
  return String(text || '').split(/\n+/).some(line =>
    /^\s*[\[(]?\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?[\])]?\s*[-–—]?\s*\S/.test(line));
}

function parseTimestampedScript(text, options, targetMs) {
  const cues = [];
  const lines = String(text || '').split(/\n+/);
  let sawRange = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(/^([\[(]?)(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?)([\])]?)\s*(?:[-–—]\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?))?\s*(.*)$/);
    if (!match) {
      if (cues.length) cues[cues.length - 1].text += ` ${line}`;
      continue;
    }
    const start = parseTimeToMs(match[2]);
    const explicitEnd = match[4] ? parseTimeToMs(match[4]) : null;
    const body = String(match[5] || '').trim();
    if (!body) continue;
    if (explicitEnd !== null && explicitEnd > start) sawRange = true;
    cues.push({
      start_ms: start,
      end_ms: explicitEnd !== null && explicitEnd > start
        ? explicitEnd : start + estimatedDurationMs(body, options.wpm, options.minCueMs, options.maxCueMs),
      text: body
    });
  }
  for (let index = 0; index < cues.length - 1; index++) {
    if (cues[index + 1].start_ms > cues[index].start_ms) {
      cues[index].end_ms = Math.min(cues[index].end_ms, cues[index + 1].start_ms - options.gapMs);
    }
  }
  if (targetMs && cues.length && !sawRange) {
    const last = cues[cues.length - 1];
    last.end_ms = Math.min(last.end_ms, targetMs);
  }
  return cues;
}

function plainScriptCues(text, options, targetMs) {
  const cues = [];
  let cursor = 0;
  for (const sentence of sentencesFrom(text)) {
    for (const line of wrapText(sentence, options.maxChars)) {
      const duration = estimatedDurationMs(line, options.wpm, options.minCueMs, options.maxCueMs);
      cues.push({start_ms: cursor, end_ms: cursor + duration, text: line});
      cursor += duration + options.gapMs;
    }
  }
  if (targetMs && cues.length) {
    const originalEnd = cues[cues.length - 1].end_ms;
    if (originalEnd > 0) {
      const ratio = targetMs / originalEnd;
      for (const cue of cues) {
        cue.start_ms = Math.round(cue.start_ms * ratio);
        cue.end_ms = Math.round(cue.end_ms * ratio);
      }
    }
  }
  return cues;
}

function normalizeCues(cues, options, targetMs, offsetMs) {
  const warnings = [];
  const result = [];
  let cursor = 0;
  let shifted = 0;
  let clamped = 0;
  const source = cues
    .map(cue => ({
      start_ms: Math.max(0, Math.round(Number(cue.start_ms) || 0) + offsetMs),
      end_ms: Math.max(0, Math.round(Number(cue.end_ms) || 0) + offsetMs),
      text: String(cue.text == null ? '' : cue.text).replace(/\s+/g, ' ').trim()
    }))
    .filter(cue => cue.text)
    .sort((a, b) => a.start_ms - b.start_ms || a.end_ms - b.end_ms);

  for (const cue of source) {
    const desiredStart = cue.start_ms;
    const start = Math.max(cursor, desiredStart);
    if (start !== desiredStart && result.length) shifted++;
    let end = Math.max(cue.end_ms, start + options.minCueMs);
    if (end - start > options.maxCueMs) {
      end = start + options.maxCueMs;
      clamped++;
    }
    if (targetMs && end > targetMs) {
      end = targetMs;
      clamped++;
    }
    if (end <= start) continue;
    result.push({start_ms: start, end_ms: end, text: cue.text});
    cursor = end + options.gapMs;
    if (targetMs && cursor >= targetMs) break;
  }
  if (shifted) {
    warnings.push({
      code: 'CUES_SHIFTED',
      severity: 'info',
      es: `Se desplazaron ${shifted} cues para evitar solapes.`,
      en: `${shifted} cues were shifted to avoid overlaps.`
    });
  }
  if (clamped) {
    warnings.push({
      code: 'CUES_CLAMPED',
      severity: 'warning',
      es: `Se recortaron ${clamped} cues por duración máxima o fin del vídeo.`,
      en: `${clamped} cues were clamped by maximum duration or video end.`
    });
  }
  return {cues: result, warnings};
}

function cueStats(cues, durationMs) {
  const totalWords = cues.reduce((total, cue) => total + wordCount(cue.text), 0);
  const endMs = cues.length ? cues[cues.length - 1].end_ms : 0;
  const effectiveMs = durationMs && durationMs > 0 ? durationMs : endMs;
  const wpm = effectiveMs > 0 ? Math.round((totalWords / (effectiveMs / 60000)) * 10) / 10 : 0;
  const durations = cues.map(cue => cue.end_ms - cue.start_ms);
  const gaps = cues.slice(1).map((cue, index) => cue.start_ms - cues[index].end_ms);
  return {
    cues: cues.length,
    words: totalWords,
    wpm,
    durationMs: effectiveMs,
    lastEndMs: endMs,
    avgCueMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
    minGapMs: gaps.length ? Math.min(...gaps) : null,
    maxChars: cues.reduce((max, cue) => Math.max(max, cue.text.length), 0)
  };
}

function renderGenerationMarkdown(generation, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${t('Generación de subtítulos', 'Subtitle generation')}`,
    '',
    `- ${t('ID', 'ID')}: \`${generation.generationId}\``,
    `- ${t('Fuente', 'Source')}: \`${generation.source}\``,
    `- ${t('Duración', 'Duration')}: ${(generation.durationMs / 1000).toFixed(2)}s`,
    `- ${t('Cues', 'Cues')}: ${generation.stats.cues}`,
    `- ${t('Ritmo', 'Pace')}: ${generation.stats.wpm} ${t('palabras/min', 'words/min')}`,
    `- ${t('SRT', 'SRT')}: \`${generation.paths.srt || '-'}\``,
    `- ${t('VTT', 'VTT')}: \`${generation.paths.vtt || '-'}\``,
    '',
    `## ${t('Cues', 'Cues')}`,
    '',
    '| # | ' + t('Inicio', 'Start') + ' | ' + t('Fin', 'End') + ' | ' + t('Texto', 'Text') + ' |',
    '| --- | --- | --- | --- |'
  ];
  for (const cue of generation.cues.slice(0, 60)) {
    const text = String(cue.text).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
    lines.push(`| ${generation.cues.indexOf(cue) + 1} | ${formatTime(cue.start_ms, '.')} | ` +
      `${formatTime(cue.end_ms, '.')} | ${text} |`);
  }
  if (generation.warnings.length) {
    lines.push('', `## ${t('Avisos', 'Warnings')}`, '');
    for (const warning of generation.warnings) {
      lines.push(`- **${warning.code}** ${localText(language, warning.es, warning.en)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function resolveDuration(args) {
  if (Number.isFinite(Number(args.duration)) && Number(args.duration) > 0) {
    return {ms: Math.round(Number(args.duration) * 1000), estimated: false, source: 'explicit'};
  }
  if (String(args.video_path || '').trim()) {
    const info = await chrome.antigem.mediaInfo({path: String(args.video_path).trim()});
    const seconds = Number(info && info.duration);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error('No se pudo leer la duración del vídeo / Could not read video duration');
    }
    return {ms: Math.round(seconds * 1000), estimated: false, source: 'mediaInfo'};
  }
  return {ms: 0, estimated: true, source: 'words'};
}

async function loadStored(key) {
  const values = await chrome.storage.local.get(key);
  return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
}

async function writeOutputs(args, srt, vtt) {
  const paths = {srt: null, vtt: null};
  if (args.dry_run === false) {
    if (String(args.srt_path || '').trim()) {
      paths.srt = String(args.srt_path).trim();
      await chrome.antigem.writeFile({path: paths.srt, data: srt, encoding: 'utf8'});
    }
    if (String(args.vtt_path || '').trim()) {
      paths.vtt = String(args.vtt_path).trim();
      await chrome.antigem.writeFile({path: paths.vtt, data: vtt, encoding: 'utf8'});
    }
  }
  return paths;
}

async function subsFromScript(args) {
  let script = String(args.script || '').trim();
  if (!script && String(args.script_path || '').trim()) {
    script = String(await chrome.antigem.readFile({
      path: String(args.script_path).trim(), encoding: 'utf8'
    })).trim();
  }
  if (!script) throw new Error('El guion está vacío / Script is empty');

  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  const options = {
    wpm: numberInRange(args.wpm, 60, 400, 150),
    maxChars: clamp(args.max_chars, 12, 160, 48),
    minCueMs: clamp(args.min_cue_ms, 200, 10000, 800),
    maxCueMs: clamp(args.max_cue_ms, 500, 30000, 6000),
    gapMs: clamp(args.gap_ms, 0, 2000, 120)
  };
  if (options.minCueMs > options.maxCueMs) {
    options.maxCueMs = options.minCueMs;
  }
  const offsetMs = clamp(args.offset_ms, -60000, 60000, 0);
  const duration = await resolveDuration(args);
  const warnings = [];

  const rawCues = hasTimestampMarkers(script)
    ? parseTimestampedScript(script, options, duration.ms)
    : plainScriptCues(script, options, duration.ms);
  if (!rawCues.length) throw new Error('No se obtuvieron cues / No cues were produced');

  const normalized = normalizeCues(rawCues, options, duration.ms, offsetMs);
  warnings.push(...normalized.warnings);
  if (duration.source === 'words') {
    warnings.push({
      code: 'DURATION_ESTIMATED',
      severity: 'info',
      es: 'Duración estimada desde las palabras; pasa video_path o duration para afinar.',
      en: 'Duration estimated from words; pass video_path or duration to refine it.'
    });
  }
  if (duration.ms && normalized.cues.length &&
      normalized.cues[normalized.cues.length - 1].end_ms < duration.ms * 0.9) {
    warnings.push({
      code: 'TIMELINE_SHORT',
      severity: 'info',
      es: 'Los subtítulos terminan antes del 90 % del vídeo.',
      en: 'Subtitles end before 90% of the video.'
    });
  }

  const srt = renderSrt(normalized.cues);
  const vtt = renderVtt(normalized.cues);
  const paths = await writeOutputs(args, srt, vtt);
  const generation = {
    generationId: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    language,
    source: String(args.script_path || '').trim() ? 'script_path' : 'inline',
    videoPath: String(args.video_path || '').trim() || null,
    durationMs: duration.ms || (normalized.cues.length ? normalized.cues[normalized.cues.length - 1].end_ms : 0),
    durationSource: duration.source,
    estimatedDuration: duration.estimated,
    options,
    offsetMs,
    cues: normalized.cues,
    stats: cueStats(normalized.cues, duration.ms),
    warnings,
    srt, vtt,
    paths,
    written: Boolean(paths.srt || paths.vtt)
  };
  generation.markdown = renderGenerationMarkdown(generation, language);
  await chrome.storage.local.set({
    [`subs.generations.${generation.generationId}`]: generation,
    'subs.lastGeneration': generation.generationId
  });
  return generation;
}

function cuesFromInput(args) {
  if (Array.isArray(args.cues)) {
    return args.cues.map(cue => ({
      start_ms: Number(cue.start_ms == null ? cue.start : cue.start_ms),
      end_ms: Number(cue.end_ms == null ? cue.end : cue.end_ms),
      text: String(cue.text == null ? '' : cue.text)
    }));
  }
  if (String(args.srt || '').trim()) return parseSrt(args.srt);
  return null;
}

function renderAlignmentMarkdown(alignment, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${t('Alineación de subtítulos', 'Subtitle alignment')}`,
    '',
    `- ${t('ID', 'ID')}: \`${alignment.alignmentId}\``,
    `- ${t('Modo', 'Mode')}: \`${alignment.mode}\``,
    `- ${t('Duración original', 'Original duration')}: ${(alignment.originalDurationMs / 1000).toFixed(2)}s`,
    `- ${t('Duración objetivo', 'Target duration')}: ${(alignment.targetDurationMs / 1000).toFixed(2)}s`,
    `- ${t('Factor', 'Ratio')}: ${alignment.ratio}`,
    `- ${t('Desplazamiento', 'Offset')}: ${alignment.offsetMs} ms`,
    `- ${t('Cues', 'Cues')}: ${alignment.cues.length}`,
    ''
  ];
  if (alignment.warnings.length) {
    lines.push(`## ${t('Avisos', 'Warnings')}`, '');
    for (const warning of alignment.warnings) {
      lines.push(`- **${warning.code}** ${localText(language, warning.es, warning.en)}`);
    }
  }
  lines.push(`## ${t('Resultado', 'Result')}`, '', '```srt', alignment.srt.trim(), '```');
  return `${lines.join('\n')}\n`;
}

async function subsAlign(args) {
  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  let original = cuesFromInput(args);
  let generationId = null;
  if (!original && String(args.generation || '').trim()) {
    generationId = String(args.generation).trim();
    const generation = await loadStored(`subs.generations.${generationId}`);
    if (!generation) throw new Error(`No existe la generación ${generationId} / Generation not found`);
    original = generation.cues;
  }
  if (!original || !original.length) {
    throw new Error('No hay cues para alinear / No cues to align');
  }

  const duration = await resolveDuration({duration: args.duration, video_path: args.video_path});
  const originalDurationMs = Math.max(...original.map(cue => Number(cue.end_ms) || 0), 0);
  const targetDurationMs = duration.ms || originalDurationMs;
  const mode = args.mode === 'shift' ? 'shift' : 'scale';
  const ratio = mode === 'scale' && originalDurationMs > 0
    ? Math.round((targetDurationMs / originalDurationMs) * 10000) / 10000 : 1;
  const offsetMs = clamp(args.offset_ms, -60000, 60000, 0);
  const options = {
    minCueMs: 300,
    maxCueMs: 30000,
    gapMs: clamp(args.min_gap_ms, 0, 2000, 80)
  };

  const scaled = original.map(cue => ({
    start_ms: Math.round((Number(cue.start_ms) || 0) * ratio),
    end_ms: Math.round((Number(cue.end_ms) || 0) * ratio),
    text: String(cue.text || '')
  }));
  const normalized = normalizeCues(scaled, options, targetDurationMs, offsetMs);
  const warnings = [...normalized.warnings];
  if (!duration.ms) {
    warnings.push({
      code: 'NO_TARGET_DURATION',
      severity: 'warning',
      es: 'No se indicó duración objetivo; se conservó la duración original.',
      en: 'No target duration was given; the original duration was kept.'
    });
  }
  if (mode === 'scale' && Math.abs(ratio - 1) > 0.25) {
    warnings.push({
      code: 'LARGE_DRIFT',
      severity: 'warning',
      es: `El ajuste de tiempo es grande (factor ${ratio}); revisa el guion.`,
      en: `The timing adjustment is large (ratio ${ratio}); review the script.`
    });
  }

  const srt = renderSrt(normalized.cues);
  const vtt = renderVtt(normalized.cues);
  const paths = await writeOutputs(args, srt, vtt);
  const alignment = {
    alignmentId: `align_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    language, mode,
    generationId,
    source: generationId ? 'generation' : cuesFromInput(args) ? 'inline' : 'srt',
    originalDurationMs,
    targetDurationMs,
    ratio,
    offsetMs,
    cues: normalized.cues,
    stats: cueStats(normalized.cues, targetDurationMs),
    warnings,
    srt, vtt,
    paths,
    written: Boolean(paths.srt || paths.vtt)
  };
  alignment.markdown = renderAlignmentMarkdown(alignment, language);
  await chrome.storage.local.set({
    [`subs.alignments.${alignment.alignmentId}`]: alignment,
    'subs.lastAlignment': alignment.alignmentId
  });
  return alignment;
}

function cssFor(style, position) {
  const positions = {
    top: 'top: 8%; bottom: auto;',
    middle: 'top: 45%; bottom: auto;',
    bottom: 'bottom: var(--subs-bottom);'
  };
  return `:root {\n  --subs-bottom: ${style.bottom};\n}\n\n` +
    `.subtitle-caption {\n` +
    `  position: absolute;\n` +
    `  left: 5%;\n` +
    `  right: 5%;\n` +
    `  ${positions[position] || positions.bottom}\n` +
    `  margin: 0 auto;\n` +
    `  text-align: center;\n` +
    `  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;\n` +
    `  font-size: clamp(${Math.round(style.fontSize * 0.65)}px, 5vw, ${style.fontSize}px);\n` +
    `  font-weight: ${style.weight};\n` +
    `  line-height: 1.18;\n` +
    `  color: ${style.color};\n` +
    `  -webkit-text-stroke: ${style.outlineWidth}px ${style.outline};\n` +
    `  paint-order: stroke fill;\n` +
    `  text-shadow: ${style.shadow};\n` +
    `  background: ${style.background};\n` +
    `  padding: 8px 14px;\n` +
    `  border-radius: ${style.radius}px;\n` +
    `  max-width: 92%;\n` +
    `  overflow-wrap: break-word;\n` +
    `}\n`;
}

function vttStyleFor(style) {
  return `STYLE\n::cue {\n` +
    `  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;\n` +
    `  font-size: ${Math.round(style.fontSize * 0.55)}px;\n` +
    `  font-weight: ${style.weight};\n` +
    `  color: ${style.color};\n` +
    `  background: ${style.background};\n` +
    `  text-shadow: ${style.shadow};\n` +
    `}\n`;
}

function renderStyleMarkdown(result, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${t('Estilo de subtítulos', 'Subtitle style')}`,
    '',
    `- ${t('ID', 'ID')}: \`${result.styleId}\``,
    `- ${t('Plataforma', 'Platform')}: ${result.platformName}`,
    `- ${t('Preset', 'Preset')}: ${localText(language, result.preset.es, result.preset.en)}`,
    `- ${t('Tamaño', 'Size')}: ${result.style.fontSize}px`,
    `- ${t('Máximo recomendado', 'Recommended max')}: ${result.maxChars} ${t('caracteres', 'characters')}`,
    '',
    `## CSS`,
    '',
    '```css',
    result.css.trim(),
    '```',
    '',
    `## WebVTT`,
    '',
    '```vtt',
    result.vttStyle.trim(),
    '```',
    '',
    `## ${t('Checklist', 'Checklist')}`,
    ''
  ];
  for (const item of result.checklist) lines.push(`- [ ] ${localText(language, item.es, item.en)}`);
  return `${lines.join('\n')}\n`;
}

async function subsStyle(args) {
  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  const platform = ['shorts', 'reels', 'tiktok', 'youtube', 'all'].includes(args.platform)
    ? args.platform : 'all';
  const presetKey = Object.prototype.hasOwnProperty.call(PRESETS, args.preset) ? args.preset : 'bold';
  const base = PLATFORM_DEFAULTS[platform];
  const preset = PRESETS[presetKey];
  const style = {
    fontSize: clamp(args.font_size, 16, 160, base.fontSize),
    color: String(args.color || preset.color),
    outline: String(args.outline_color || preset.outline),
    outlineWidth: preset.outlineWidth,
    background: String(args.background || preset.background),
    weight: preset.weight,
    radius: preset.radius,
    shadow: preset.shadow,
    bottom: base.bottom
  };
  const position = ['top', 'middle', 'bottom'].includes(args.position) ? args.position : 'bottom';
  const maxChars = clamp(args.max_chars, 12, 160, base.maxChars);

  const checklist = [
    {
      es: `Mantén los subtítulos dentro del área segura de ${base.aspect} (10 % de margen).`,
      en: `Keep captions inside the ${base.aspect} safe area (10% margin).`
    },
    {
      es: `No superes ${maxChars} caracteres por línea para ${base.name}.`,
      en: `Do not exceed ${maxChars} characters per line for ${base.name}.`
    },
    {
      es: 'Comprueba el contraste sobre el fotograma más claro.',
      en: 'Check contrast against the brightest frame.'
    },
    {
      es: 'Usa fuentes del sistema: no se descarga ninguna fuente remota.',
      en: 'Use system fonts: no remote font is downloaded.'
    }
  ];

  const result = {
    styleId: `style_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    language, platform,
    platformName: base.name,
    aspect: base.aspect,
    presetKey,
    preset: {es: preset.es, en: preset.en},
    position,
    style,
    maxChars,
    css: cssFor(style, position),
    vttStyle: vttStyleFor(style),
    checklist,
    path: null,
    written: false
  };
  if (String(args.output || '').trim() && args.dry_run === false) {
    result.path = String(args.output).trim();
    await chrome.antigem.writeFile({path: result.path, data: result.css, encoding: 'utf8'});
    result.written = true;
  }
  result.markdown = renderStyleMarkdown(result, language);
  await chrome.storage.local.set({
    [`subs.styles.${result.styleId}`]: result,
    'subs.lastStyle': result.styleId
  });
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    const args = message.args || {};
    if (message.tool === 'subs_from_script') return await subsFromScript(args);
    if (message.tool === 'subs_align') return await subsAlign(args);
    if (message.tool === 'subs_style') return await subsStyle(args);
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: error && error.message ? error.message : String(error)}]
  }));
  return true;
});
