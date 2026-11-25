'use strict';

// Skill Linter — solo lectura. Nunca escribe, nunca llama a la red.

const LIST_LIMIT = 500;
const MAX_WALK_FILES = 5000;
const MAX_WALK_DIRS = 500;
const SKILL_NAME_RE = /^[A-Za-z0-9_.-]+$/;
const MIN_DESCRIPTION = 40;
const MAX_DESCRIPTION = 800;
const MAX_SKILL_CHARS = 40000;
const MIN_BODY_CHARS = 100;
const SKIP_DIRS = new Set([
  '.git', '.hg', '.svn', '.cache', '__pycache__', '.gradle', '.idea', '.vscode',
  'node_modules', 'vendor', 'dist', 'build', 'coverage'
]);

const INJECTION_PATTERNS = [
  /\bignore\s+(?:all\s+)?(?:previous|prior|earlier)\s+instructions\b/gi,
  /\bignora\s+(?:todas\s+)?(?:las\s+)?instrucciones\s+anteriores\b/gi,
  /\bolvida\s+(?:tus|las)\s+instrucciones\b/gi,
  /\bforget\s+(?:your|all|the)\s+(?:instructions|rules)\b/gi,
  /\byou\s+are\s+now\s+(?:an?|the)\b/gi,
  /\beres\s+ahora\s+(?:un|una|el|la)\b/gi,
  /^\s*system\s*:/gim,
  /\breveal\s+(?:your|the)\s+(?:system\s+)?prompt\b/gi,
  /\brevela\s+tu\s+(?:prompt|instrucciones)\b/gi,
  /<\|\s*(?:im_start|system|endoftext)\s*\|>/gi,
  /\bjailbreak\b/gi
];

const SEVERITY_RANK = {error: 3, warning: 2, info: 1};

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
  return /^(~\/|\/sdcard\/|\/data\/)/.test(String(value || '').trim());
}

function errorText(error) {
  return error && error.message ? error.message : String(error);
}

function joinPath(base, ...parts) {
  let out = String(base).replace(/\/+$/, '');
  for (const part of parts) {
    const clean = String(part).replace(/^\/+|\/+$/g, '');
    if (clean) out += '/' + clean;
  }
  return out;
}

function basename(path) {
  return String(path).split('/').filter(Boolean).pop() || '';
}

function parentDir(path) {
  const parts = String(path).split('/');
  parts.pop();
  return parts.join('/') || '/';
}

function relPath(root, path) {
  const prefix = String(root).replace(/\/+$/, '') + '/';
  return String(path).startsWith(prefix) ? String(path).slice(prefix.length) : String(path);
}

function short(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function cell(value) {
  return String(value === null || value === undefined ? '-' : value)
    .replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function makeIssue(severity, code, path, line, es, en, fixEs, fixEn) {
  return {
    severity, code, path: String(path || ''), line: Number(line) || 1,
    es, en, fix_es: fixEs || '', fix_en: fixEn || ''
  };
}

/* ------------------------------------------------------------------ */
/* Lectura local acotada                                               */
/* ------------------------------------------------------------------ */

async function resolveRoot(input) {
  const value = String(input || '').trim();
  if (!isLocalPath(value)) {
    throw new Error('root debe ser una ruta local / root must be a local path');
  }
  let stat;
  try { stat = await chrome.antigem.stat({path: value}); }
  catch (error) { throw new Error(`root no encontrado / root not found: ${errorText(error)}`); }
  if (stat.isFile) throw new Error('root debe ser una carpeta / root must be a directory');
  return value.replace(/\/+$/, '');
}

async function listDir(path) {
  try {
    return {entries: await chrome.antigem.listFiles({path, limit: LIST_LIMIT})};
  } catch (error) {
    return {error: errorText(error)};
  }
}

async function readText(path, maxBytes) {
  let info;
  try { info = await chrome.antigem.stat({path}); }
  catch (error) { return {error: errorText(error)}; }
  if (!info.isFile) return {error: 'not a file'};
  if (info.size > maxBytes) return {error: 'file too large', size: info.size};
  try {
    return {text: await chrome.antigem.readFile({path, encoding: 'utf8'}), size: info.size};
  } catch (error) {
    return {error: errorText(error), size: info.size};
  }
}

async function walk(root) {
  const files = [];
  const dirs = [];
  const queue = [{path: root, depth: 0}];
  let truncated = false;
  while (queue.length && dirs.length < MAX_WALK_DIRS && !truncated) {
    const current = queue.shift();
    const listed = await listDir(current.path);
    if (listed.error) continue;
    for (const entry of listed.entries) {
      const name = String(entry.name || '');
      if (entry.isDirectory) {
        const lower = name.toLowerCase();
        if (name.startsWith('.') || SKIP_DIRS.has(lower)) continue;
        const child = String(entry.path || joinPath(current.path, name));
        dirs.push(child);
        if (current.depth < 12) queue.push({path: child, depth: current.depth + 1});
      } else if (entry.isFile) {
        files.push({
          path: String(entry.path || joinPath(current.path, name)),
          name, size: Number(entry.size || 0)
        });
        if (files.length >= MAX_WALK_FILES) { truncated = true; break; }
      }
    }
    if (dirs.length >= MAX_WALK_DIRS) truncated = true;
  }
  return {files, dirs, truncated};
}

/* ------------------------------------------------------------------ */
/* Análisis de contenido                                               */
/* ------------------------------------------------------------------ */

function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (String(lines[0] || '').trim() !== '---') return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (String(lines[i]).trim() === '---') { end = i; break; }
  }
  if (end < 0) return {malformed: true, fields: {}, fieldLines: {}, end: 0, lines};
  const fields = {};
  const fieldLines = {};
  for (let i = 1; i < end; i++) {
    const match = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(String(lines[i]).trim());
    if (match) {
      fields[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
      fieldLines[match[1]] = i + 1;
    }
  }
  return {malformed: false, fields, fieldLines, end, lines};
}

function sectionInfo(lines) {
  let esStart = -1;
  let enStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const text = String(lines[i]).trim();
    if (/^##\s+ES\b/i.test(text) && esStart < 0) esStart = i;
    if (/^##\s+EN\b/i.test(text) && enStart < 0) enStart = i;
  }
  const endOf = start => {
    if (start < 0) return -1;
    for (let i = start + 1; i < lines.length; i++) {
      if (/^##\s/.test(String(lines[i]).trim())) return i;
    }
    return lines.length;
  };
  return {
    esStart, enStart,
    esLines: esStart < 0 ? 0 : Math.max(0, endOf(esStart) - esStart - 1),
    enLines: enStart < 0 ? 0 : Math.max(0, endOf(enStart) - enStart - 1)
  };
}

function collectRefs(text, detailNames) {
  const refs = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const explicit = /get_skill_file\s*\(\s*\{[^}\n]*?file\s*:\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = explicit.exec(line)) !== null) {
      refs.push({file: match[1], line: index + 1, explicit: true, likely: true});
    }
    const inline = /`([A-Za-z0-9_.-]+\.md)`/g;
    while ((match = inline.exec(line)) !== null) {
      const before = line.slice(0, match.index);
      const likely = /(?:lee|read|consulta|see|in|en|está en|detail|detalle|archivo|file|skill)\s*$/i.test(before) ||
        detailNames.has(match[1].toLowerCase());
      refs.push({file: match[1], line: index + 1, explicit: false, likely});
    }
  });
  return refs;
}

function checkLinks(text, skillDir, filesSet, dirsSet, add) {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const pattern = /\[[^\]\n]*\]\(([^)\n]+)\)/g;
    let match;
    while ((match = pattern.exec(line)) !== null) {
      let target = match[1].trim().split(/\s+/)[0].replace(/^<|>$/g, '');
      if (!target || /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target)) continue;
      target = target.split('#')[0].split('?')[0];
      if (!target) continue;
      if (target.startsWith('/') || target.split('/').includes('..')) {
        add('warning', 'LINK_UNSAFE', index + 1,
          `Enlace local no seguro: ${short(target, 80)}.`,
          `Unsafe local link: ${short(target, 80)}.`,
          'Usa una ruta relativa dentro de la skill.',
          'Use a relative path inside the skill.');
        continue;
      }
      let decoded = target;
      try { decoded = decodeURIComponent(target); } catch (_) { /* keep raw */ }
      const resolved = joinPath(skillDir, decoded);
      if (!filesSet.has(resolved) && !dirsSet.has(resolved)) {
        add('warning', 'BROKEN_LINK', index + 1,
          `Enlace roto: ${short(target, 80)}.`,
          `Broken link: ${short(target, 80)}.`,
          'Corrige la ruta o elimina el enlace.',
          'Fix the path or remove the link.');
      }
    }
  });
}

function checkInjection(text, add) {
  for (const pattern of INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (!match) continue;
    const line = text.slice(0, match.index).split('\n').length;
    add('warning', 'INJECTION_PATTERN', line,
      `Texto que parece una orden inyectada: ${short(match[0], 80)}. Puede ser documentación legítima: revísalo.`,
      `Text that looks like an injected instruction: ${short(match[0], 80)}. It may be legitimate documentation: review it.`,
      'Si es un ejemplo, márcalo como ejemplo; si no, elimínalo.',
      'If it is an example, label it as such; otherwise remove it.');
  }
}

async function lintSkills(args) {
  const root = await resolveRoot(args.root);
  const language = langOf(args.language);
  const requireBilingual = args.require_bilingual !== false;
  const maxFiles = clamp(args.max_files, 1, 1000, 200);
  const maxBytes = clamp(args.max_bytes_per_file, 1024, 8388608, 262144);
  const warnings = [];
  const walked = await walk(root);
  if (walked.truncated) {
    warnings.push(`Recorrido recortado por límites / walk truncated at limits: ${root}`);
  }
  const filesSet = new Set(walked.files.map(file => file.path));
  const dirsSet = new Set(walked.dirs);
  const issues = [];
  const skills = [];
  let scanned = 0;

  for (const file of walked.files) {
    if (scanned >= maxFiles) {
      warnings.push(`Límite de skills alcanzado (${maxFiles}) / skill limit reached`);
      break;
    }
    if (!/\.md$/i.test(file.name)) continue;
    const parent = parentDir(file.path);
    if (basename(parent).toLowerCase() !== 'skills') continue;
    scanned++;

    const read = await readText(file.path, maxBytes);
    if (read.error) {
      const issue = makeIssue('warning', 'READ_FAILED', file.path, 1,
        `No se pudo leer la skill: ${short(read.error, 120)}.`,
        `Could not read the skill: ${short(read.error, 120)}.`);
      issues.push(issue);
      warnings.push(`${relPath(root, file.path)}: ${short(read.error, 120)}`);
      continue;
    }

    const text = read.text;
    const lines = text.split(/\r?\n/);
    const name = file.name.replace(/\.md$/i, '');
    const skillIssues = [];
    const add = (severity, code, line, es, en, fixEs, fixEn) => {
      const issue = makeIssue(severity, code, file.path, line, es, en, fixEs, fixEn);
      skillIssues.push(issue);
      issues.push(issue);
    };

    if (!SKILL_NAME_RE.test(name)) {
      add('error', 'NAME_INVALID', 1,
        `Nombre de skill inválido: ${short(name, 60)}.`,
        `Invalid skill name: ${short(name, 60)}.`,
        'Usa letras, dígitos, punto, guion o guion bajo.',
        'Use letters, digits, dot, dash or underscore.');
    }

    const fm = parseFrontmatter(text);
    const frontmatter = {present: false, malformed: false, name: null, description: null};
    if (!fm) {
      add('error', 'FM_MISSING', 1,
        'Falta frontmatter con name y description.',
        'Missing frontmatter with name and description.',
        'Añade un bloque --- al inicio con name y description.',
        'Add a leading --- block with name and description.');
    } else if (fm.malformed) {
      add('error', 'FM_UNCLOSED', 1,
        'El frontmatter no tiene cierre ---.',
        'The frontmatter has no closing ---.',
        'Cierra el bloque de frontmatter con ---.',
        'Close the frontmatter block with ---.');
      frontmatter.malformed = true;
    } else {
      frontmatter.present = true;
      frontmatter.name = fm.fields.name || null;
      frontmatter.description = fm.fields.description || null;
      const nameLine = fm.fieldLines.name || 1;
      const descLine = fm.fieldLines.description || nameLine;
      if (!fm.fields.name) {
        add('warning', 'FM_NAME_MISSING', nameLine,
          'Falta "name" en el frontmatter.',
          'Missing "name" in frontmatter.',
          'Añade un título corto, por ejemplo "Higiene de Git / Git hygiene".',
          'Add a short title, for example "Git hygiene / Higiene de Git".');
      } else if (fm.fields.name.length > 120) {
        add('warning', 'FM_NAME_LONG', nameLine,
          '"name" supera 120 caracteres; se cortará en las listas.',
          '"name" exceeds 120 characters; it will be truncated in lists.',
          'Acorta el título del frontmatter.',
          'Shorten the frontmatter title.');
      }
      if (!fm.fields.description) {
        add('error', 'FM_DESCRIPTION_MISSING', descLine,
          'Falta "description" en el frontmatter.',
          'Missing "description" in frontmatter.',
          'Describe cuándo usar la skill y qué hace, en ES y EN.',
          'Describe when to use the skill and what it does, in ES and EN.');
      } else {
        const length = fm.fields.description.length;
        if (length < MIN_DESCRIPTION) {
          add('warning', 'FM_DESCRIPTION_SHORT', descLine,
            `"description" muy corta (${length} caracteres).`,
            `"description" too short (${length} characters).`,
            'Explica el caso de uso y cómo activar la skill.',
            'Explain the use case and how to trigger the skill.');
        }
        if (length > MAX_DESCRIPTION) {
          add('warning', 'FM_DESCRIPTION_LONG', descLine,
            `"description" muy larga (${length} caracteres).`,
            `"description" too long (${length} characters).`,
            'Déjala en una frase bilingüe y mueve el detalle al cuerpo.',
            'Keep one bilingual sentence and move details to the body.');
        }
      }
      const extra = Object.keys(fm.fields).filter(key => !['name', 'description'].includes(key));
      if (extra.length) {
        add('info', 'FM_EXTRA_FIELD', nameLine,
          `Campos de frontmatter no usados por AntiGem: ${extra.join(', ')}.`,
          `Frontmatter fields unused by AntiGem: ${extra.join(', ')}.`,
          'AntiGem solo lee name y description; el resto se ignora.',
          'AntiGem only reads name and description; the rest is ignored.');
      }
    }

    const sections = sectionInfo(fm && !fm.malformed ? lines.slice(fm.end + 1) : lines);
    if (requireBilingual) {
      if (sections.esStart < 0) {
        add('warning', 'NO_ES_SECTION', 1,
          'Falta la sección ## ES.',
          'Missing ## ES section.',
          'Añade ## ES con la guía en español.',
          'Add ## ES with the Spanish guide.');
      } else if (sections.esLines < 3) {
        add('warning', 'ES_SECTION_EMPTY', sections.esStart + 1,
          'La sección ## ES está casi vacía.',
          'The ## ES section is almost empty.',
          'Completa la guía en español.',
          'Complete the Spanish guide.');
      }
      if (sections.enStart < 0) {
        add('warning', 'NO_EN_SECTION', 1,
          'Falta la sección ## EN.',
          'Missing ## EN section.',
          'Añade ## EN con la guía en inglés.',
          'Add ## EN with the English guide.');
      } else if (sections.enLines < 3) {
        add('warning', 'EN_SECTION_EMPTY', sections.enStart + 1,
          'La sección ## EN está casi vacía.',
          'The ## EN section is almost empty.',
          'Completa la guía en inglés.',
          'Complete the English guide.');
      }
    }

    if (text.length > MAX_SKILL_CHARS) {
      add('warning', 'TOO_LONG', 1,
        `Skill muy larga (${text.length} caracteres).`,
        `Skill very long (${text.length} characters).`,
        'Divide el contenido en archivos de detalle bajo skills/<nombre>/.',
        'Split the content into detail files under skills/<name>/.');
    }
    const body = fm && !fm.malformed ? lines.slice(fm.end + 1).join('\n') : text;
    if (body.trim().length < MIN_BODY_CHARS) {
      add('error', 'EMPTY_SKILL', 1,
        'La skill no tiene contenido suficiente tras el frontmatter.',
        'The skill has too little content after the frontmatter.',
        'Explica cuándo usarla, el flujo y las reglas.',
        'Explain when to use it, the flow and the rules.');
    }

    const detailDir = joinPath(parent, name);
    const detailNames = new Map();
    if (dirsSet.has(detailDir)) {
      const listed = await listDir(detailDir);
      if (!listed.error) {
        for (const entry of listed.entries) {
          if (entry.isFile && /\.md$/i.test(String(entry.name || ''))) {
            detailNames.set(String(entry.name).toLowerCase(), String(entry.name));
          }
        }
      }
    }
    const refs = collectRefs(text, detailNames);
    const referenced = new Set();
    for (const ref of refs) {
      const key = String(ref.file).toLowerCase();
      if (detailNames.has(key)) {
        referenced.add(key);
      } else if (ref.explicit || ref.likely) {
        add('warning', 'DETAIL_REF_MISSING', ref.line,
          `Cita un archivo de detalle inexistente: ${short(ref.file, 80)}.`,
          `References a missing detail file: ${short(ref.file, 80)}.`,
          'Crea skills/<nombre>/<archivo>.md o corrige la referencia.',
          'Create skills/<name>/<file>.md or fix the reference.');
      }
    }
    for (const [key, original] of detailNames) {
      if (!referenced.has(key)) {
        add('info', 'ORPHAN_DETAIL', 1,
          `Archivo de detalle nunca citado: ${short(original, 80)}.`,
          `Detail file never referenced: ${short(original, 80)}.`,
          'Cítalo desde la skill con get_skill_file o en el texto.',
          'Reference it from the skill with get_skill_file or in the text.');
      }
    }

    checkLinks(text, parent, filesSet, dirsSet, add);
    checkInjection(text, add);

    const status = skillIssues.some(issue => issue.severity === 'error') ? 'error' :
      skillIssues.some(issue => issue.severity === 'warning') ? 'warning' : 'ok';
    skills.push({
      name,
      path: relPath(root, file.path),
      chars: text.length,
      lines: lines.length,
      frontmatter,
      bilingual: {
        es: sections.esStart >= 0,
        en: sections.enStart >= 0,
        es_lines: sections.esLines,
        en_lines: sections.enLines
      },
      detail_dir: dirsSet.has(detailDir) ? relPath(root, detailDir) : null,
      detail_files: [...detailNames.values()].sort(),
      referenced_detail_files: [...referenced].map(key => detailNames.get(key)).sort(),
      status,
      issues: skillIssues
    });
  }

  issues.sort((a, b) =>
    String(a.path).localeCompare(String(b.path)) ||
    a.line - b.line ||
    SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  skills.sort((a, b) => a.path.localeCompare(b.path));

  const counts = {error: 0, warning: 0, info: 0};
  for (const issue of issues) counts[issue.severity]++;
  const summary = {
    skills: skills.length,
    errors: counts.error,
    warnings: counts.warning,
    info: counts.info,
    ok: skills.filter(skill => skill.status === 'ok').length,
    with_frontmatter: skills.filter(skill => skill.frontmatter.present).length,
    bilingual: skills.filter(skill => skill.bilingual.es && skill.bilingual.en).length,
    with_details: skills.filter(skill => skill.detail_files.length).length,
    max_skills: maxFiles,
    require_bilingual: requireBilingual
  };

  const result = {
    format: 'antigem-skill-lint',
    version: 1,
    createdAt: Date.now(),
    language, root,
    alwaysReadOnly: true,
    summary, skills, issues, warnings,
    markdown: ''
  };
  result.markdown = renderMarkdown(result);
  return result;
}

/* ------------------------------------------------------------------ */
/* Informe                                                             */
/* ------------------------------------------------------------------ */

function renderMarkdown(result) {
  const t = (es, en) => localText(result.language, es, en);
  const summary = result.summary;
  const lines = [
    `# ${t('Linter de skills', 'Skill linter')}`, '',
    `- ${t('Raíz', 'Root')}: \`${result.root}\``,
    `- ${t('Generado', 'Generated')}: ${new Date(result.createdAt).toISOString()}`,
    `- ${t('Modo', 'Mode')}: **${t('solo lectura', 'read-only')}** — ` +
      t('ningún archivo fue modificado', 'no file was modified'),
    '',
    `## ${t('Resumen', 'Summary')}`, '',
    `- ${t('Skills revisadas', 'Skills checked')}: ${summary.skills} · ` +
      `${t('Correctas', 'OK')}: ${summary.ok} · ` +
      `${t('Con frontmatter', 'With frontmatter')}: ${summary.with_frontmatter} · ` +
      `${t('Bilingües', 'Bilingual')}: ${summary.bilingual}`,
    `- ${t('Con archivos de detalle', 'With detail files')}: ${summary.with_details} · ` +
      `${t('Errores / avisos / notas', 'Errors / warnings / notes')}: ` +
      `${summary.errors} / ${summary.warnings} / ${summary.info}`,
    ''
  ];

  if (result.skills.length) {
    lines.push(
      `## ${t('Skills', 'Skills')}`, '',
      '| ' + t('Skill', 'Skill') + ' | ' + t('Estado', 'Status') + ' | ' +
        t('Líneas', 'Lines') + ' | ' + t('Caracteres', 'Chars') + ' | ES/EN | ' +
        t('Detalles', 'Details') + ' |',
      '| --- | --- | --- | --- | --- | --- |'
    );
    for (const skill of result.skills) {
      lines.push(`| \`${cell(skill.path)}\` | ${skill.status} | ${skill.lines} | ` +
        `${skill.chars} | ${skill.bilingual.es ? 'ES' : '—'}/${skill.bilingual.en ? 'EN' : '—'} | ` +
        `${skill.detail_files.length} |`);
    }
    lines.push('');
  }

  lines.push(`## ${t('Hallazgos', 'Findings')}`, '');
  if (!result.issues.length) {
    lines.push(t('Sin hallazgos.', 'No findings.'));
  } else {
    for (const issue of result.issues) {
      const message = localText(result.language, issue.es, issue.en);
      const fix = localText(result.language, issue.fix_es, issue.fix_en);
      lines.push(`- **${issue.severity.toUpperCase()}** [\`${issue.code}\`] ` +
        `\`${cell(relPath(result.root, issue.path))}:${issue.line}\` — ${cell(message)}` +
        (fix ? ` → ${cell(fix)}` : ''));
    }
  }

  lines.push('', `## ${t('Avisos y límites', 'Warnings and limits')}`, '');
  if (!result.warnings.length) lines.push(t('Sin avisos.', 'No warnings.'));
  for (const warning of result.warnings) lines.push(`- ${warning}`);
  lines.push(
    `- ${t('plugin-doctor valida la estructura; este linter revisa el contenido.',
      'plugin-doctor checks structure; this linter checks content.')}`,
    `- ${t('Los patrones de inyección son heurísticos: revisa antes de actuar.',
      'Injection patterns are heuristic: review before acting.')}`,
    `- ${t('La tool nunca corrige archivos: las correcciones son propuestas.',
      'The tool never fixes files: corrections are proposals.')}`
  );
  return `${lines.join('\n')}\n`;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    if (message.tool === 'lint_skills') return await lintSkills(message.args || {});
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: errorText(error)}]
  }));
  return true;
});
