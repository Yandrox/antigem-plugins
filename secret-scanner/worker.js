'use strict';

// Secret Scanner — solo lectura. Nunca escribe, nunca envía red.

const DEFAULT_SKIP = [
  '.git', '.hg', '.svn', '.cache', '__pycache__', '.gradle', '.idea',
  'node_modules', 'vendor', 'dist', 'build', 'coverage'
];
const LIST_LIMIT = 500;

const LOCKFILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'npm-shrinkwrap.json',
  'poetry.lock', 'pipfile.lock', 'cargo.lock', 'go.sum', 'gradle.lockfile',
  'composer.lock', 'gemfile.lock', 'mix.lock'
]);
const BINARY_EXT = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'pdf', 'zip', 'gz', 'tar', 'jar',
  'apk', 'so', 'a', 'o', 'class', 'dex', 'woff', 'woff2', 'ttf', 'eot', 'mp3',
  'mp4', 'mov', 'db', 'sqlite', 'bin', 'pyc'
]);

const PATTERNS = [
  {id:'openai', es:'Clave OpenAI', en:'OpenAI key', confidence:'high',
    re:/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/g},
  {id:'github', es:'Token GitHub', en:'GitHub token', confidence:'high',
    re:/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/g},
  {id:'aws', es:'Clave de acceso AWS', en:'AWS access key', confidence:'high',
    re:/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g},
  {id:'google-api', es:'Clave de API de Google', en:'Google API key', confidence:'high',
    re:/\bAIza[0-9A-Za-z_-]{35}\b/g},
  {id:'google-oauth', es:'Token OAuth de Google', en:'Google OAuth token', confidence:'high',
    re:/\bya29\.[A-Za-z0-9_.-]{20,}\b/g},
  {id:'slack', es:'Token de Slack', en:'Slack token', confidence:'high',
    re:/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g},
  {id:'stripe', es:'Clave de Stripe', en:'Stripe key', confidence:'high',
    re:/\b(?:sk|rk)_live_[0-9A-Za-z]{16,}\b/g},
  {id:'telegram', es:'Token de bot de Telegram', en:'Telegram bot token', confidence:'high',
    re:/\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g},
  {id:'npm', es:'Token de npm', en:'npm token', confidence:'high',
    re:/\bnpm_[A-Za-z0-9]{30,}\b/g},
  {id:'sendgrid', es:'Clave de SendGrid', en:'SendGrid key', confidence:'high',
    re:/\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{20,}\b/g},
  {id:'jwt', es:'JWT firmado', en:'Signed JWT', confidence:'high',
    re:/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g},
  {id:'private-key', es:'Clave privada PEM', en:'PEM private key', confidence:'high',
    re:/-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/g},
  {id:'google-service', es:'Cuenta de servicio de Google', en:'Google service account', confidence:'high',
    re:/"type"\s*:\s*"service_account"/g},
  {id:'bearer', es:'Bearer token', en:'Bearer token', confidence:'medium',
    re:/\bBearer\s+[A-Za-z0-9_.-]{20,}\b/g},
  {id:'basic-auth', es:'Basic auth en claro', en:'Plaintext basic auth', confidence:'medium',
    re:/\bBasic\s+[A-Za-z0-9+/=]{16,}\b/g},
  {id:'url-credentials', es:'Credenciales en URL', en:'Credentials in URL', confidence:'medium',
    re:/[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s/@]+@/gi},
  {id:'password-literal', es:'Contraseña en claro', en:'Plaintext password', confidence:'medium',
    re:/\b(?:password|passwd|pwd|pass)\s*[:=]\s*['"]([^'"]{6,})['"]/gi},
  {id:'secret-literal', es:'Secreto o token literal', en:'Literal secret or token', confidence:'medium',
    re:/\b(?:api[_-]?key|secret[_-]?key|access[_-]?token|client[_-]?secret|auth[_-]?token)\s*[:=]\s*['"]([^'"]{8,})['"]/gi},
  {id:'hex-secret', es:'Valor hexadecimal junto a clave/token', en:'Hex value next to key/token', confidence:'low',
    re:/\b(?:secret|token|api_key)\b[^\n]{0,24}\b[0-9a-f]{32,64}\b/gi}
];

const CONFIDENCE_RANK = {low: 0, medium: 1, high: 2};

const PLACEHOLDER = /changeme|your[_-]?|example|sample|placeholder|dummy|fake|xxxx|redacted|\$\{|\{\{|<[^>]+>|process\.env|getenv|environ|BuildConfig|Secrets\.|null|undefined/i;

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
  return /^(~\/|\/)/.test(String(value || '').trim());
}

function errorText(error) {
  return error && error.message ? error.message : String(error);
}

function joinPath(base, name) {
  return String(base).replace(/\/+$/, '') + '/' + name;
}

function relPath(root, file) {
  if (file === root) return '.';
  const prefix = String(root).replace(/\/+$/, '') + '/';
  return String(file).startsWith(prefix) ? String(file).slice(prefix.length) : String(file);
}

function redact(value) {
  const text = String(value || '');
  if (text.length <= 6) return `[REDACTED] (${text.length} chars)`;
  return `${text.slice(0, 2)}…${text.slice(-2)} (${text.length} chars)`;
}

function isIgnored(name, includeExamples) {
  const lower = String(name).toLowerCase();
  if (/\.(bak|tmp|orig|rej|old|save|swp|log)$/.test(lower)) return true;
  if (LOCKFILES.has(lower)) return true;
  const ext = lower.includes('.') ? lower.split('.').pop() : '';
  if (BINARY_EXT.has(ext)) return true;
  if (!includeExamples && /(^|[._-])(example|sample|template|fixture|testdata|mock)([._-]|$)/.test(lower)) return true;
  return false;
}

function rotationFor(id) {
  const map = {
    openai: 'Revoca la clave en OpenAI → genera una nueva → actualiza el almacén seguro → revisa uso y facturación.',
    github: 'Revoca el token en GitHub Settings → crea uno con el mínimo alcance → actualiza CI y secretos.',
    aws: 'Desactiva la clave en IAM → revisa CloudTrail → emite una nueva con permisos mínimos.',
    'google-api': 'Desactiva la clave en Google Cloud Console → crea una restringida por API y dominio/IP.',
    'google-oauth': 'Revoca los tokens y las sesiones → vuelve a autorizar con el ámbito mínimo.',
    slack: 'Revoca el token en la app de Slack → reinstala con los scopes mínimos.',
    stripe: 'Revoca la clave en el dashboard de Stripe -> genera otra en modo live -> restringe permisos.',
    telegram: 'Envía /revoke al BotFather → guarda el nuevo token fuera del repo.',
    npm: 'Revoca el token en npmjs.com → publica uno nuevo con granularidad mínima.',
    sendgrid: 'Revoca la clave en SendGrid → crea una con permisos mínimos.',
    jwt: 'Rota el secreto de firma → invalida los tokens emitidos → fuerza nuevo login.',
    'private-key': 'Genera un par nuevo → sustituye la clave pública donde se desplegó → descarta la antigua.',
    'google-service': 'Deshabilita la cuenta de servicio → crea otra con roles mínimos → elimina la clave antigua.',
    bearer: 'Revoca el token en el proveedor → vuelve a autenticar con el ámbito mínimo.',
    'basic-auth': 'Cambia la contraseña → usa un gestor de secretos en lugar de credenciales en claro.',
    'url-credentials': 'Cambia la contraseña → quita las credenciales de la URL → usa variables de entorno.',
    'password-literal': 'Cambia la contraseña → muévela al almacén seguro → añade la ruta a .gitignore.',
    'secret-literal': 'Rota el valor → muévelo al almacén seguro → añade la ruta a .gitignore.',
    'hex-secret': 'Rota el valor → elimina el literal del código → usa una variable de entorno.'
  };
  const es = map[id] || 'Rota el valor en el proveedor y elimina el literal del repositorio.';
  const en = {
    openai: 'Revoke the key in OpenAI → issue a new one → update the secret store → review usage and billing.',
    github: 'Revoke the token in GitHub Settings → create a least-privilege token → update CI and secrets.',
    aws: 'Deactivate the key in IAM → review CloudTrail → issue a new least-privilege key.',
    'google-api': 'Disable the key in Google Cloud Console → create a restricted key per API and domain/IP.',
    'google-oauth': 'Revoke tokens and sessions → re-authorise with the minimum scope.',
    slack: 'Revoke the token in the Slack app → reinstall with minimal scopes.',
    stripe: 'Revoke the key in the Stripe dashboard → create a new live key → restrict permissions.',
    telegram: 'Send /revoke to BotFather → store the new token outside the repo.',
    npm: 'Revoke the token on npmjs.com → publish a granular new one.',
    sendgrid: 'Revoke the key in SendGrid → create a least-privilege one.',
    jwt: 'Rotate the signing secret → invalidate issued tokens → force re-login.',
    'private-key': 'Generate a new keypair → replace the public key where deployed → discard the old one.',
    'google-service': 'Disable the service account → create another with minimal roles → delete the old key.',
    bearer: 'Revoke the token at the provider → re-authenticate with minimum scope.',
    'basic-auth': 'Change the password → use a secret manager instead of plaintext credentials.',
    'url-credentials': 'Change the password → remove credentials from the URL → use environment variables.',
    'password-literal': 'Change the password → move it to the secret store → add the path to .gitignore.',
    'secret-literal': 'Rotate the value → move it to the secret store → add the path to .gitignore.',
    'hex-secret': 'Rotate the value → remove the literal from the code → use an environment variable.'
  };
  return {es, en: en[id] || 'Rotate the value at the provider and remove the literal from the repository.'};
}

/* ------------------------------------------------------------------ */
/* Escaneo                                                             */
/* ------------------------------------------------------------------ */

async function readHead(path, maxBytes) {
  let info;
  try { info = await chrome.antigem.stat({path}); }
  catch (error) { return {text: null, error: errorText(error)}; }
  if (!info.isFile) return {text: null, error: 'not a file'};
  if (info.size > maxBytes) return {text: null, skipped: true, size: info.size};
  try {
    return {text: await chrome.antigem.readFile({path, encoding: 'utf8'}), size: info.size};
  } catch (error) {
    return {text: null, error: errorText(error)};
  }
}

function scanText(text, file) {
  const findings = [];
  const lines = String(text).split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    for (const pattern of PATTERNS) {
      pattern.re.lastIndex = 0;
      let match;
      while ((match = pattern.re.exec(line)) !== null) {
        if (match[0].length === 0) { pattern.re.lastIndex++; continue; }
        const value = match[1] || match[0];
        if (pattern.confidence !== 'high' && PLACEHOLDER.test(value)) {
          break;
        }
        findings.push({
          id: pattern.id,
          label_es: pattern.es,
          label_en: pattern.en,
          confidence: pattern.confidence,
          file,
          line: index + 1,
          value: redact(value),
          length: String(value).length
        });
      }
    }
  }
  return findings;
}

async function secretsScan(args) {
  const root = String(args.root || '').trim();
  if (!isLocalPath(root)) {
    throw new Error('root debe ser una ruta local / root must be a local path');
  }
  let rootStat;
  try { rootStat = await chrome.antigem.stat({path: root}); }
  catch (error) { throw new Error(`root no encontrado / root not found: ${root} — ${errorText(error)}`); }
  if (rootStat.isFile) throw new Error('root debe ser un directorio / root must be a directory');

  const language = langOf(args.language);
  const maxFiles = clamp(args.max_files, 1, 2000, 400);
  const maxDirs = clamp(args.max_dirs, 1, 2000, 300);
  const maxDepth = clamp(args.max_depth, 1, 20, 6);
  const maxBytes = clamp(args.max_bytes_per_file, 1024, 8388608, 131072);
  const includeExamples = args.include_examples === true;
  const minConfidence = ['low', 'medium', 'high'].includes(args.min_confidence) ? args.min_confidence : 'low';
  const skip = Array.isArray(args.exclude_dirs)
    ? args.exclude_dirs.map(name => String(name).toLowerCase())
    : DEFAULT_SKIP.slice();

  const stats = {dirs: 0, filesRead: 0, filesSkipped: 0, filesIgnored: 0,
    dirsSkipped: 0, entriesTruncated: 0, linesScanned: 0};
  const warnings = [];
  const findings = [];
  const visited = new Set();
  const queue = [{path: root, depth: 0}];

  while (queue.length && stats.dirs < maxDirs && stats.filesRead < maxFiles) {
    const current = queue.shift();
    if (visited.has(current.path)) continue;
    visited.add(current.path);
    stats.dirs++;

    let entries;
    try {
      entries = await chrome.antigem.listFiles({path: current.path, limit: LIST_LIMIT});
    } catch (error) {
      warnings.push(`No se pudo listar / could not list ${current.path}: ${errorText(error)}`);
      continue;
    }
    if (entries.length >= LIST_LIMIT) {
      stats.entriesTruncated++;
      warnings.push(`Listado recortado en ${current.path} / listing truncated`);
    }

    const childDirs = [];
    for (const entry of entries) {
      if (entry.isDirectory) {
        if (skip.includes(String(entry.name).toLowerCase())) {
          stats.dirsSkipped++;
          continue;
        }
        if (current.depth < maxDepth) childDirs.push({path: entry.path, depth: current.depth + 1});
        continue;
      }
      if (!entry.isFile || stats.filesRead >= maxFiles) continue;
      if (isIgnored(entry.name, includeExamples)) {
        stats.filesIgnored++;
        continue;
      }
      const read = await readHead(entry.path, maxBytes);
      if (read.skipped) { stats.filesSkipped++; continue; }
      if (read.error) {
        warnings.push(`No se pudo leer / could not read ${entry.path}: ${read.error}`);
        continue;
      }
      if (!read.text) continue;
      stats.filesRead++;
      stats.linesScanned += read.text.split('\n').length;
      const file = relPath(root, entry.path);
      for (const finding of scanText(read.text, file)) {
        if (CONFIDENCE_RANK[finding.confidence] >= CONFIDENCE_RANK[minConfidence]) {
          findings.push(finding);
        }
      }
    }
    for (const dir of childDirs) queue.push(dir);
  }

  if (stats.dirs >= maxDirs) warnings.push(`Límite de directorios alcanzado (${maxDirs}) / directory limit reached`);
  if (stats.filesRead >= maxFiles) warnings.push(`Límite de archivos alcanzado (${maxFiles}) / file limit reached`);

  findings.sort((a, b) =>
    (CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence]) ||
    String(a.file).localeCompare(String(b.file)) || a.line - b.line);

  const byConfidence = {high: 0, medium: 0, low: 0};
  for (const finding of findings) byConfidence[finding.confidence]++;

  const byPattern = {};
  for (const finding of findings) byPattern[finding.id] = (byPattern[finding.id] || 0) + 1;

  const gitignore = [];
  for (const file of [...new Set(findings.filter(f => f.confidence === 'high').map(f => f.file))]) {
    const base = String(file).split('/').pop();
    const dir = String(file).split('/').slice(0, -1).join('/');
    gitignore.push(base.startsWith('.') ? base : (dir ? '/' + dir + '/' + base : '/' + base));
  }
  const uniqueGitignore = [...new Set(gitignore)].sort();

  const rotationIds = [...new Set(findings.map(f => f.id))];

  return {
    format: 'antigem-secret-scan',
    version: 1,
    createdAt: Date.now(),
    language, root,
    min_confidence: minConfidence,
    alwaysReadOnly: true,
    stats, warnings,
    summary: {total: findings.length, high: byConfidence.high,
      medium: byConfidence.medium, low: byConfidence.low},
    byPattern,
    findings,
    gitignoreSuggestions: uniqueGitignore,
    rotation: rotationIds.map(id => Object.assign({id}, rotationFor(id))),
    markdown: ''
  };
}

/* ------------------------------------------------------------------ */
/* Informe                                                             */
/* ------------------------------------------------------------------ */

function cell(value) {
  return String(value === null || value === undefined ? '-' : value)
    .replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function renderMarkdown(result) {
  const t = (es, en) => localText(result.language, es, en);
  const lines = [
    `# ${t('Escaneo de secretos', 'Secret scan')}`, '',
    `- ${t('Raíz', 'Root')}: \`${result.root}\``,
    `- ${t('Generado', 'Generated')}: ${new Date(result.createdAt).toISOString()}`,
    `- ${t('Modo', 'Mode')}: **${t('solo lectura', 'read-only')}** — ` +
      t('ningún archivo fue modificado', 'no file was modified'),
    '',
    `## ${t('Resumen', 'Summary')}`, '',
    `- ${t('Hallazgos', 'Findings')}: ${result.summary.total} · ` +
      `${t('Alto', 'High')}: ${result.summary.high} · ` +
      `${t('Medio', 'Medium')}: ${result.summary.medium} · ` +
      `${t('Bajo', 'Low')}: ${result.summary.low}`,
    `- ${t('Confianza mínima', 'Minimum confidence')}: ${result.min_confidence}`,
    `- ${t('Archivos leídos', 'Files read')}: ${result.stats.filesRead} · ` +
      `${t('Líneas', 'Lines')}: ${result.stats.linesScanned} · ` +
      `${t('Directorios', 'Directories')}: ${result.stats.dirs}`,
    `- ${t('Ignorados', 'Ignored')}: ${result.stats.filesIgnored} · ` +
      `${t('Omitidos por tamaño', 'Skipped by size')}: ${result.stats.filesSkipped}`,
    '',
    `## ${t('Hallazgos', 'Findings')}`, ''
  ];

  if (!result.findings.length) {
    lines.push(t('Sin hallazgos con la confianza solicitada. / No findings at the requested confidence.'));
  } else {
    lines.push(
      '| ' + t('Confianza', 'Confidence') + ' | ' + t('Ruta:línea', 'File:line') + ' | ' +
        t('Tipo', 'Type') + ' | ' + t('Valor', 'Value') + ' |',
      '| --- | --- | --- | --- |'
    );
    for (const finding of result.findings) {
      lines.push(`| ${finding.confidence} | \`${cell(finding.file)}:${finding.line}\` | ` +
        `${cell(localText(result.language, finding.label_es, finding.label_en))} | ` +
        `${cell(finding.value)} |`);
    }
  }

  lines.push('', `## ${t('Patrones detectados', 'Detected patterns')}`, '');
  const patternIds = Object.keys(result.byPattern).sort();
  if (!patternIds.length) lines.push(t('Ninguno. / None.', 'Ninguno. / None.'));
  for (const id of patternIds) lines.push(`- \`${id}\`: ${result.byPattern[id]}`);

  lines.push('', `## ${t('Entradas sugeridas para .gitignore', 'Suggested .gitignore entries')}`, '');
  if (!result.gitignoreSuggestions.length) {
    lines.push(t('No se han aplicado cambios. / No changes were applied.', 'No se han aplicado cambios. / No changes were applied.'));
  } else {
    lines.push('```gitignore');
    for (const entry of result.gitignoreSuggestions) lines.push(entry);
    lines.push('```');
    lines.push('', t('Estas líneas son solo una propuesta: la tool no escribe nada.',
      'These lines are only a proposal: the tool writes nothing.'));
  }

  lines.push('', `## ${t('Rotación', 'Rotation')} (${result.rotation.length})`, '');
  if (!result.rotation.length) {
    lines.push('Ninguno. / None.');
  } else {
    for (const item of result.rotation) {
      lines.push(`- **${item.id}** — ${localText(result.language, item.es, item.en)}`);
    }
  }

  lines.push('', `## ${t('Avisos y límites', 'Warnings and limits')}`, '');
  if (!result.warnings.length) lines.push('Sin avisos. / No warnings.');
  for (const warning of result.warnings) lines.push(`- ${warning}`);
  lines.push(
    `- ${t('El valor del secreto se ha redactado en el informe.', 'Secret values are redacted in the report.')}`,
    `- ${t('Un hallazgo es una señal: confirma el archivo antes de actuar.', 'A finding is a signal: confirm the file before acting.')}`,
    `- ${t('Sin red: no se ha comprobado si los secretos están activos.', 'No network: secret validity was not checked.')}`
  );
  return `${lines.join('\n')}\n`;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    if (message.tool === 'secrets_scan') {
      const result = await secretsScan(message.args || {});
      result.markdown = renderMarkdown(result);
      return result;
    }
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: errorText(error)}]
  }));
  return true;
});
