'use strict';

// MCP Health Check — solo lectura. Nunca escribe, nunca llama a la red.

const LIST_LIMIT = 500;
const MARKDOWN_LIMIT = 200;
const SLOW_MS = 1500;

const SEVERITY_RANK = {critical: 4, high: 3, medium: 2, low: 1, info: 0};

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

function compareVersions(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) return da > db ? 1 : -1;
  }
  return 0;
}

function shortError(value) {
  let text = String(value || '').replace(/\s+/g, ' ').trim();
  text = text
    .replace(/\b(password|passwd|pwd|secret|token|api[_-]?key|apikey|client[_-]?secret|auth[_-]?token)\b\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1=[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED]')
    .replace(/[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s/@]+@/gi, '[REDACTED]@')
    .replace(/\b(?:sk|ghp|gho|ghs|ghr|npm|ya29|AKIA|ASIA|xox[baprs])[-_A-Za-z0-9]{8,}\b/gi, '[REDACTED]');
  return text.length > 220 ? text.slice(0, 220) + '…' : text;
}

async function existsFile(path) {
  try {
    const info = await chrome.antigem.stat({path});
    return !!info.isFile;
  } catch (_) {
    return false;
  }
}

function cell(value) {
  return String(value === null || value === undefined ? '-' : value)
    .replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/* ------------------------------------------------------------------ */
/* Lectura local acotada                                               */
/* ------------------------------------------------------------------ */

async function listDir(path) {
  try {
    return {entries: await chrome.antigem.listFiles({path, limit: LIST_LIMIT})};
  } catch (error) {
    return {error: errorText(error)};
  }
}

async function readJson(path, maxBytes) {
  let info;
  try { info = await chrome.antigem.stat({path}); }
  catch (error) { return {error: errorText(error)}; }
  if (!info.isFile) return {error: 'not a file'};
  if (info.size > maxBytes) return {error: 'file too large', size: info.size};
  try {
    const text = await chrome.antigem.readFile({path, encoding: 'utf8'});
    try { return {data: JSON.parse(text), size: info.size}; }
    catch (error) { return {error: 'invalid JSON: ' + errorText(error), size: info.size}; }
  } catch (error) {
    return {error: errorText(error), size: info.size};
  }
}

async function countMarkdown(dir, maxDepth) {
  const result = {skills: [], detailFiles: 0, truncated: false};
  async function walk(path, depth, isRoot) {
    const listed = await listDir(path);
    if (listed.error) return;
    let count = 0;
    for (const entry of listed.entries) {
      if (count >= MARKDOWN_LIMIT) { result.truncated = true; break; }
      const name = String(entry.name || '');
      if (entry.isFile && /\.md$/i.test(name)) {
        count++;
        if (isRoot) result.skills.push(name.replace(/\.md$/i, ''));
        else result.detailFiles++;
      } else if (entry.isDirectory && depth < maxDepth) {
        await walk(entry.path, depth + 1, false);
        count++;
      }
    }
  }
  await walk(dir, 0, true);
  return result;
}

async function collectPlugins(base, source, sourceLabel, maxExtensions, maxBytes, warnings) {
  const plugins = [];
  if (!isLocalPath(base)) {
    warnings.push(`${sourceLabel}: ruta local no válida / invalid local path: ${base}`);
    return plugins;
  }
  const rootStat = await listDir(base);
  if (rootStat.error) {
    warnings.push(`${sourceLabel}: no se pudo listar / could not list ${base}: ${shortError(rootStat.error)}`);
    return plugins;
  }
  let seen = 0;
  for (const entry of rootStat.entries) {
    if (seen >= maxExtensions) {
      warnings.push(`${sourceLabel}: límite de plugins alcanzado (${maxExtensions}) / plugin limit reached`);
      break;
    }
    if (!entry.isDirectory || String(entry.name || '').startsWith('.')) continue;
    seen++;
    const prefix = source === 'draft' ? ['src'] : [];
    const manifestPath = joinPath(base, entry.name, ...prefix, 'manifest.json');
    const read = await readJson(manifestPath, maxBytes);
    if (read.error) {
      warnings.push(`${sourceLabel}/${entry.name}: manifest no legible / unreadable manifest: ${shortError(read.error)}`);
      continue;
    }
    const manifest = read.data && typeof read.data === 'object' ? read.data : {};
    const tools = Array.isArray(manifest.mcp_tools)
      ? manifest.mcp_tools.map(t => String((t && t.name) || '').trim()).filter(Boolean)
      : [];
    const skillsRoot = joinPath(base, entry.name, ...prefix, 'skills');
    const markdown = await countMarkdown(skillsRoot, 3);
    let hasWorker = false;
    const background = manifest.background;
    if (background && typeof background === 'object' &&
        typeof background.service_worker === 'string') {
      hasWorker = await existsFile(joinPath(base, entry.name, ...prefix, background.service_worker));
    }
    let zipBytes = 0;
    if (source === 'draft') {
      const dist = await listDir(joinPath(base, entry.name, 'dist'));
      if (!dist.error) {
        for (const item of dist.entries) {
          if (item.isFile && /\.zip$/i.test(String(item.name || ''))) zipBytes += Number(item.size || 0);
        }
      }
    }
    plugins.push({
      id: String(manifest.id || entry.name),
      name: String(manifest.name || entry.name),
      version: String(manifest.version || 'unknown'),
      source,
      sourceLabel,
      path: joinPath(base, entry.name),
      hasWorker,
      tools,
      skills: markdown.skills,
      detailFiles: markdown.detailFiles,
      markdownTruncated: markdown.truncated,
      zipBytes
    });
  }
  return plugins;
}

async function measureState(stateDir, maxBytes, warnings, knownIds) {
  const result = {available: false, files: 0, bytes: 0, byServer: {}, error: null};
  if (!isLocalPath(stateDir)) {
    result.error = 'ruta local no válida / invalid local path';
    return result;
  }
  const stat = await listDir(stateDir);
  if (stat.error) {
    result.error = shortError(stat.error);
    warnings.push(`state: no se pudo listar / could not list ${stateDir}: ${result.error}`);
    return result;
  }
  result.available = true;
  for (const entry of stat.entries) {
    if (!entry.isFile) continue;
    result.files++;
    const size = Number(entry.size || 0);
    result.bytes += size;
    const name = String(entry.name || '');
    const known = knownIds.slice().sort((a, b) => b.length - a.length)
      .find(id => name.startsWith(id));
    const server = known || name.split(/[.@_-]/)[0] || name;
    result.byServer[server] = (result.byServer[server] || 0) + size;
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Análisis                                                            */
/* ------------------------------------------------------------------ */

function normaliseObservations(observed) {
  const value = observed && typeof observed === 'object' ? observed : {};
  const list = key => Array.isArray(value[key])
    ? value[key].map(item => ({
        server: String((item && item.server) || 'unknown'),
        error: shortError((item && item.error) || '')
      }))
    : [];
  const latency = {};
  if (value.latency_ms && typeof value.latency_ms === 'object') {
    for (const [server, ms] of Object.entries(value.latency_ms)) {
      const number = Number(ms);
      if (Number.isFinite(number) && number >= 0) latency[String(server)] = Math.round(number);
    }
  }
  const logs = Array.isArray(value.logs)
    ? value.logs.map(item => ({
        server: String((item && item.server) || 'unknown'),
        level: String((item && item.level) || 'info').toLowerCase(),
        message: shortError((item && item.message) || '')
      }))
    : [];
  return {supplied: !!observed && typeof observed === 'object', declined: list('declined'),
    unreachable: list('unreachable'), latency, logs};
}

async function mcpHealth(args) {
  const language = langOf(args.language);
  const maxExtensions = clamp(args.max_extensions, 1, 500, 120);
  const maxBytes = clamp(args.max_bytes_per_file, 1024, 8388608, 262144);
  const storageWarn = clamp(args.storage_warn_bytes, 1, 1073741824, 1048576);
  const extensionsDir = String(args.extensions_dir || '~/extensions').trim();
  const draftsDir = String(args.drafts_dir || '~/extension-projects').trim();
  const stateDir = String(args.state_dir || '~/browser-extensions/.antigem-state').trim();

  const warnings = [];
  const t0 = Date.now();
  const installed = await collectPlugins(extensionsDir, 'installed', 'extensions', maxExtensions, maxBytes, warnings);
  const drafts = await collectPlugins(draftsDir, 'draft', 'drafts', maxExtensions, maxBytes, warnings);
  const state = await measureState(stateDir, maxBytes, warnings,
    installed.concat(drafts).map(p => p.id));
  const readMs = Date.now() - t0;
  const observed = normaliseObservations(args.observed);

  const plugins = installed.concat(drafts);
  const installedById = new Map(installed.map(p => [p.id, p]));

  const toolOwners = new Map();
  for (const plugin of plugins) {
    for (const tool of plugin.tools) {
      if (!toolOwners.has(tool)) toolOwners.set(tool, []);
      toolOwners.get(tool).push(plugin.id);
    }
  }
  const duplicates = [...toolOwners.entries()]
    .map(([name, owners]) => ({name, owners: [...new Set(owners)].sort()}))
    .filter(item => item.owners.length > 1)
    .map(item => ({name: item.name, count: item.owners.length, owners: item.owners}))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const versionDrift = [];
  for (const draft of drafts) {
    const live = installedById.get(draft.id);
    if (!live) continue;
    if (live.version !== draft.version) {
      const order = compareVersions(draft.version, live.version);
      versionDrift.push({
        id: draft.id, installed: live.version, draft: draft.version,
        direction: order > 0 ? 'draft-newer' : order < 0 ? 'installed-newer' : 'different'
      });
    }
  }

  const findings = [];
  const recommendations = [];
  const add = (severity, id, es, en, target) => findings.push({
    severity, id, title_es: es.title, title_en: en.title,
    detail_es: es.detail, detail_en: en.detail, target: target || null
  });
  const advise = (priority, target, es, en) => recommendations.push({
    priority, target, action_es: es, action_en: en
  });

  for (const plugin of plugins) {
    if (plugin.tools.length > 0 && !plugin.hasWorker) {
      add('high', 'worker-missing',
        {title: `Worker ausente: ${plugin.id}`,
          detail: `${plugin.id} declara ${plugin.tools.length} tool(s) pero su background.service_worker no existe: el servidor no puede arrancar.`},
        {title: `Missing worker: ${plugin.id}`,
          detail: `${plugin.id} declares ${plugin.tools.length} tool(s) but its background.service_worker does not exist: the server cannot start.`},
        plugin.id);
      advise(1, plugin.id,
        `Reinstala ${plugin.id} o corrige el manifest/worker; sin worker sus tools no responden.`,
        `Reinstall ${plugin.id} or fix the manifest/worker; without a worker its tools do not respond.`);
    }
  }

  for (const item of observed.declined) {
    add('high', 'mcp-declined',
      {title: `MCP declinado: ${item.server}`,
        detail: `El agente recibió Permission.DeclinedError al usar ${item.server}. ${item.error || ''}`.trim()},
      {title: `Declined MCP: ${item.server}`,
        detail: `The agent got Permission.DeclinedError from ${item.server}. ${item.error || ''}`.trim()},
      item.server);
    advise(1, item.server,
      `Reautoriza ${item.server} en Ajustes → MCP; si no lo necesitas, desactívalo para no perder turnos.`,
      `Re-authorise ${item.server} in Settings → MCP; if unused, disable it to avoid wasted turns.`);
  }
  for (const item of observed.unreachable) {
    add('high', 'mcp-unreachable',
      {title: `MCP no disponible: ${item.server}`, detail: `${item.server} no responde. ${item.error || ''}`.trim()},
      {title: `Unreachable MCP: ${item.server}`, detail: `${item.server} is not responding. ${item.error || ''}`.trim()},
      item.server);
    advise(1, item.server,
      `Comprueba el estado de ${item.server} y recarga el servidor antes de volver a invocarlo.`,
      `Check ${item.server} status and reload the server before calling it again.`);
  }

  const slow = Object.entries(observed.latency).filter(([, ms]) => ms > SLOW_MS)
    .sort((a, b) => b[1] - a[1]);
  for (const [server, ms] of slow) {
    add('medium', 'mcp-slow',
      {title: `MCP lento: ${server}`, detail: `${ms} ms declarados (umbral ${SLOW_MS} ms).`},
      {title: `Slow MCP: ${server}`, detail: `${ms} ms reported (threshold ${SLOW_MS} ms).`},
      server);
    advise(2, server,
      `Investiga por qué ${server} tarda ${ms} ms; divide las consultas grandes o desactívalo temporalmente.`,
      `Investigate why ${server} takes ${ms} ms; split large queries or temporarily disable it.`);
  }

  const logErrors = observed.logs.filter(item => item.level !== 'info' &&
    /error|fail|declin|timeout|exception|denied/i.test(item.message + ' ' + item.level));
  const loggedServers = new Set();
  for (const item of logErrors) {
    if (loggedServers.has(item.server)) continue;
    loggedServers.add(item.server);
    if (observed.declined.some(d => d.server === item.server)) continue;
    add('medium', 'mcp-log-error',
      {title: `Error reciente: ${item.server}`, detail: item.message || 'sin mensaje / no message'},
      {title: `Recent error: ${item.server}`, detail: item.message || 'no message'},
      item.server);
    advise(2, item.server,
      `Lee los logs recientes de ${item.server} y corrige la causa antes de seguir usándolo.`,
      `Read recent ${item.server} logs and fix the cause before using it again.`);
  }

  if (duplicates.length) {
    const top = duplicates.slice(0, 10).map(item => item.name).join(', ');
    const more = duplicates.length > 10 ? ` … y ${duplicates.length - 10} más.` : '.';
    add('info', 'tool-duplicates',
      {title: `${duplicates.length} tools repetidos`,
        detail: `Ejemplos: ${top}${more} Los nombres están scopeados por ID de extensión: suele ser informativo.`},
      {title: `${duplicates.length} duplicate tools`,
        detail: `Examples: ${top}${more} Names are scoped per extension ID: usually informational.`},
      null);
    advise(3, null,
      'Si algún duplicado confunde al modelo, renombra esa tool en un manifest con mcp-schema-designer; no es urgente.',
      'If a duplicate confuses the model, rename that tool in one manifest with mcp-schema-designer; not urgent.');
  }

  for (const item of versionDrift) {
    add('medium', 'version-drift',
      {title: `Versión divergente: ${item.id}`,
        detail: `Instalada ${item.installed}, borrador ${item.draft}.`},
      {title: `Version drift: ${item.id}`,
        detail: `Installed ${item.installed}, draft ${item.draft}.`},
      item.id);
    if (item.direction === 'installed-newer') {
      advise(2, item.id,
        `La versión instalada de ${item.id} (${item.installed}) es más nueva que el borrador (${item.draft}). Confirma cuál es la fuente de verdad; no hagas downgrade sin querer.`,
        `Installed ${item.id} (${item.installed}) is newer than the draft (${item.draft}). Confirm which is the source of truth; do not downgrade by accident.`);
    } else if (item.direction === 'draft-newer') {
      advise(2, item.id,
        `El borrador de ${item.id} (${item.draft}) es más nuevo que la versión instalada (${item.installed}). Valídalo y actualiza con el flujo de publicación.`,
        `The ${item.id} draft (${item.draft}) is newer than the installed version (${item.installed}). Validate it and update through the publishing flow.`);
    } else {
      advise(2, item.id,
        `Las versiones de ${item.id} difieren (instalada ${item.installed}, borrador ${item.draft}) sin un orden claro. Revisa ambas antes de publicar.`,
        `${item.id} versions differ (installed ${item.installed}, draft ${item.draft}) with no clear order. Review both before publishing.`);
    }
  }

  const oversized = Object.entries(state.byServer).filter(([, bytes]) => bytes > storageWarn)
    .sort((a, b) => b[1] - a[1]);
  for (const [server, bytes] of oversized) {
    add('low', 'storage-size',
      {title: `Storage elevado: ${server}`, detail: `${bytes} bytes > ${storageWarn} bytes de umbral.`},
      {title: `Large storage: ${server}`, detail: `${bytes} bytes above the ${storageWarn}-byte threshold.`},
      server);
    advise(3, server,
      `Revisa el storage de ${server} con storage-cleaner antes de hacer un backup.`,
      `Review ${server} storage with storage-cleaner before making a backup.`);
  }

  if (!observed.supplied) {
    add('info', 'no-observations',
      {title: 'Sin observaciones de ejecución',
        detail: 'No se han aportado datos de servidores declinados, lentos o con errores: ese estado es desconocido, no "sano".'},
      {title: 'No runtime observations',
        detail: 'No declined, slow or erroring server data was supplied: that state is unknown, not "healthy".'},
      null);
    advise(3, 'observations',
      'Recoge webview_extension_list / webview_extension_logs con la skill y vuelve a pasar los datos a mcp_health.',
      'Collect webview_extension_list / webview_extension_logs with the skill and pass the data to mcp_health again.');
  }
  if (!state.available) {
    add('info', 'state-unavailable',
      {title: 'Dumps de storage no disponibles',
        detail: `No se pudo leer ${stateDir}: ${state.error || 'directorio ausente'}. Los tamaños de storage no se han medido.`},
      {title: 'Storage dumps unavailable',
        detail: `Could not read ${stateDir}: ${state.error || 'missing directory'}. Storage sizes were not measured.`},
      null);
  }

  const scores = {'mcp-declined': 20, 'mcp-unreachable': 15, 'worker-missing': 15,
    'mcp-slow': 5, 'mcp-log-error': 5, 'version-drift': 5, 'storage-size': 2};
  let score = 100;
  for (const finding of findings) score -= scores[finding.id] || 0;
  if (!observed.supplied) score = Math.min(score, 74);
  score = Math.max(0, Math.min(100, score));
  const status = score >= 90 ? 'healthy' : score >= 70 ? 'attention' : score >= 50 ? 'degraded' : 'critical';

  findings.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  recommendations.sort((a, b) => a.priority - b.priority);

  const counts = {critical: 0, high: 0, medium: 0, low: 0, info: 0};
  for (const finding of findings) counts[finding.severity]++;

  const latencies = Object.values(observed.latency);
  const result = {
    format: 'antigem-mcp-health',
    version: 1,
    createdAt: Date.now(),
    language,
    alwaysReadOnly: true,
    paths: {extensions_dir: extensionsDir, drafts_dir: draftsDir, state_dir: stateDir},
    summary: {
      status, score, installed: installed.length, drafts: drafts.length,
      tools: plugins.reduce((n, p) => n + p.tools.length, 0),
      skills: plugins.reduce((n, p) => n + p.skills.length, 0),
      detailFiles: plugins.reduce((n, p) => n + p.detailFiles, 0),
      declined: observed.declined.length,
      unreachable: observed.unreachable.length,
      slow: slow.length,
      errorLogs: logErrors.length,
      duplicateTools: duplicates.length,
      versionDrift: versionDrift.length,
      storageBytes: state.available ? state.bytes : null,
      findings: counts,
      localReadMs: readMs,
      maxLatencyMs: latencies.length ? Math.max(...latencies) : null,
      avgLatencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null
    },
    plugins, duplicates, versionDrift, findings, recommendations,
    observations: {supplied: observed.supplied, declined: observed.declined,
      unreachable: observed.unreachable, latency: observed.latency, logs: observed.logs},
    storage: state,
    warnings,
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
  const s = result.summary;
  const lines = [
    `# ${t('Salud del ecosistema MCP', 'MCP ecosystem health')}`, '',
    `- ${t('Estado', 'Status')}: **${s.status}** (${s.score}/100)`,
    `- ${t('Generado', 'Generated')}: ${new Date(result.createdAt).toISOString()}`,
    `- ${t('Modo', 'Mode')}: **${t('solo lectura', 'read-only')}** — ` +
      t('ningún archivo fue modificado', 'no file was modified'),
    '',
    `## ${t('Resumen', 'Summary')}`, '',
    `- ${t('Plugins instalados', 'Installed plugins')}: ${s.installed} · ` +
      `${t('Borradores', 'Drafts')}: ${s.drafts} · ${t('Tools', 'Tools')}: ${s.tools} · ` +
      `${t('Skills', 'Skills')}: ${s.skills}`,
    `- ${t('Declinados', 'Declined')}: ${s.declined} · ` +
      `${t('No disponibles', 'Unreachable')}: ${s.unreachable} · ` +
      `${t('Lentos', 'Slow')}: ${s.slow} · ${t('Errores en logs', 'Log errors')}: ${s.errorLogs}`,
    `- ${t('Tools duplicados', 'Duplicate tools')}: ${s.duplicateTools} · ` +
      `${t('Deriva de versión', 'Version drift')}: ${s.versionDrift}`,
    `- ${t('Latencia máxima', 'Max latency')}: ${s.maxLatencyMs === null ? '-' : s.maxLatencyMs + ' ms'} · ` +
      `${t('Media', 'Average')}: ${s.avgLatencyMs === null ? '-' : s.avgLatencyMs + ' ms'}`,
    `- ${t('Lectura local', 'Local read')}: ${s.localReadMs} ms · ` +
      `${t('Storage observado', 'Observed storage')}: ${s.storageBytes === null ? '-' : s.storageBytes + ' bytes'}`,
    `- ${t('Hallazgos', 'Findings')}: ${Object.entries(s.findings).map(([k, v]) => `${k} ${v}`).join(' · ')}`,
    '',
    `## ${t('Inventario', 'Inventory')}`, ''
  ];

  if (!result.plugins.length) {
    lines.push(t('No se encontraron plugins.', 'No plugins found.'));
  } else {
    lines.push(
      '| ' + t('ID', 'ID') + ' | ' + t('Fuente', 'Source') + ' | ' + t('Versión', 'Version') +
        ' | Tools | Skills |',
      '| --- | --- | --- | --- | --- |'
    );
    for (const p of result.plugins) {
      lines.push(`| \`${cell(p.id)}\` | ${cell(p.source)} | ${cell(p.version)} | ` +
        `${p.tools.length} | ${p.skills.length} |`);
    }
  }

  lines.push('', `## ${t('Hallazgos', 'Findings')}`, '');
  if (!result.findings.length) {
    lines.push(t('Sin hallazgos.', 'No findings.'));
  } else {
    for (const finding of result.findings) {
      lines.push(`- **${finding.severity}** — ${localText(result.language, finding.title_es, finding.title_en)}` +
        (finding.target ? ` (\`${cell(finding.target)}\`)` : ''));
      lines.push('  ' + localText(result.language, finding.detail_es, finding.detail_en));
    }
  }

  lines.push('', `## ${t('Recomendaciones', 'Recommendations')}`, '');
  if (!result.recommendations.length) {
    lines.push(t('Ninguna.', 'None.'));
  } else {
    for (const item of result.recommendations) {
      lines.push(`${item.priority}. ${localText(result.language, item.action_es, item.action_en)}` +
        (item.target ? ` \`${cell(item.target)}\`` : ''));
    }
  }

  lines.push('', `## ${t('Duplicados y deriva', 'Duplicates and drift')}`, '');
  if (!result.duplicates.length && !result.versionDrift.length) {
    lines.push(t('Ninguno.', 'None.'));
  }
  for (const item of result.duplicates) {
    lines.push(`- \`${cell(item.name)}\` → ${item.owners.map(o => '`' + cell(o) + '`').join(', ')}`);
  }
  for (const item of result.versionDrift) {
    const label = item.direction === 'draft-newer'
      ? t('borrador más nuevo', 'draft newer')
      : item.direction === 'installed-newer'
      ? t('instalada más nueva', 'installed newer')
      : t('diferentes', 'different');
    lines.push(`- \`${cell(item.id)}\`: ${cell(item.installed)} → ${cell(item.draft)} — ${label}`);
  }

  lines.push('', `## ${t('Avisos', 'Warnings')}`, '');
  if (!result.warnings.length) lines.push(t('Sin avisos.', 'No warnings.'));
  for (const warning of result.warnings) lines.push(`- ${warning}`);
  lines.push(
    '',
    `- ${t('Los estados declinados/lentos solo se conocen si el agente los aporta.',
      'Declined/slow states are only known when the agent supplies them.')}`,
    `- ${t('Los duplicados son informativos: las tools están scopeadas por ID de extensión.',
      'Duplicates are informational: tools are scoped by extension ID.')}`,
    `- ${t('Ninguna acción se ha ejecutado: desactivar o reautorizar lo decide el usuario.',
      'No action was taken: disabling or re-authorising is the user\'s decision.')}`
  );
  return `${lines.join('\n')}\n`;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    if (message.tool === 'mcp_health') return await mcpHealth(message.args || {});
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: errorText(error)}]
  }));
  return true;
});
