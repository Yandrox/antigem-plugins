'use strict';

// Bot Forge — kit offline para bots de Telegram y Discord. No envía mensajes ni usa tokens.

const DISCORD_TYPES = {
  string: 3, integer: 4, boolean: 5, user: 6, channel: 7,
  role: 8, mentionable: 9, number: 10, attachment: 11
};
const TELEGRAM_NAME_RE = /^[a-z0-9_]{1,32}$/;
const DISCORD_NAME_RE = /^[a-z0-9_-]{1,32}$/;
const TOPICS = [
  'telegram-setup', 'telegram-commands', 'telegram-keyboards', 'telegram-inline',
  'telegram-webhooks', 'telegram-limits', 'discord-setup', 'discord-slash',
  'discord-embeds', 'discord-intents', 'discord-permissions', 'discord-webhooks',
  'security', 'testing', 'deployment', 'comparison'
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

function langOf(value) {
  return ['es', 'en', 'both'].includes(value) ? value : 'both';
}

function trimText(value, max) {
  return String(value || '').trim().slice(0, max);
}

function slug(value, fallback) {
  const clean = String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return clean || fallback;
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

function mdList(items, empty) {
  if (!items.length) return `- ${empty}`;
  return items.map(item => `- ${item}`).join('\n');
}

function validationMarkdown(validation, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `## ${t('Validación', 'Validation')}`,
    '',
    `- ${t('Errores', 'Errors')}: ${validation.errors.length}`,
    `- ${t('Avisos', 'Warnings')}: ${validation.warnings.length}`,
    ''
  ];
  for (const item of validation.errors) lines.push(`- ERROR: ${item}`);
  for (const item of validation.warnings) lines.push(`- WARN: ${item}`);
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* bot_command_spec                                                    */
/* ------------------------------------------------------------------ */

function normalizeOption(raw) {
  const opt = raw && typeof raw === 'object' ? raw : {};
  const type = Object.prototype.hasOwnProperty.call(DISCORD_TYPES, opt.type) ? opt.type : 'string';
  return {
    name: trimText(opt.name, 32).toLowerCase(),
    type,
    required: opt.required === true,
    description_es: String(opt.description_es || '').trim(),
    description_en: String(opt.description_en || '').trim(),
    choices: Array.isArray(opt.choices)
      ? opt.choices.map(value => trimText(value, 100)).filter(Boolean).slice(0, 25) : []
  };
}

function normalizeCommand(raw) {
  const cmd = raw && typeof raw === 'object' ? raw : {};
  return {
    name: trimText(cmd.name, 32).toLowerCase(),
    description_es: String(cmd.description_es || '').trim(),
    description_en: String(cmd.description_en || '').trim(),
    aliases: Array.isArray(cmd.aliases)
      ? cmd.aliases.map(value => trimText(value, 32).toLowerCase()).filter(Boolean) : [],
    admin_only: cmd.admin_only === true,
    dm_only: cmd.dm_only === true,
    options: Array.isArray(cmd.options) ? cmd.options.map(normalizeOption).slice(0, 25) : []
  };
}

function pickDescription(item, language) {
  const es = String(item.description_es || '').trim();
  const en = String(item.description_en || '').trim();
  if (language === 'es') return es || en;
  if (language === 'en') return en || es;
  return es && en ? `${es} / ${en}` : es || en;
}

function coerceChoice(value, type) {
  if (type === 'integer' || type === 'number') return Number(value);
  if (type === 'boolean') return value === 'true' || value === true;
  return String(value);
}

function validateCommands(commands, language) {
  const errors = [];
  const warnings = [];
  const seen = new Set();
  if (!commands.length) errors.push('No se recibieron comandos / No commands received');

  commands.forEach((cmd, index) => {
    const where = `[${index}] ${cmd.name || 'sin nombre / unnamed'}`;
    if (!cmd.name) errors.push(`${where}: falta name / missing name`);
    else if (!TELEGRAM_NAME_RE.test(cmd.name) && !DISCORD_NAME_RE.test(cmd.name)) {
      errors.push(`${where}: name debe ser a-z0-9_ o a-z0-9_- / invalid name`);
    }
    if (cmd.name && seen.has(cmd.name)) errors.push(`${where}: comando duplicado / duplicate command`);
    if (cmd.name) seen.add(cmd.name);

    const description = pickDescription(cmd, language);
    if (!description) errors.push(`${where}: falta descripción / missing description`);
    else if (description.length > 100) {
      warnings.push(`${where}: descripción recortada a 100 caracteres / description truncated`);
    }

    for (const alias of cmd.aliases) {
      if (!DISCORD_NAME_RE.test(alias)) errors.push(`${where}: alias inválido / invalid alias: ${alias}`);
      if (seen.has(alias)) warnings.push(`${where}: alias repetido / duplicate alias: ${alias}`);
      seen.add(alias);
    }
    if (cmd.aliases.length > 20) warnings.push(`${where}: muchos alias; BotFather admite 100 comandos / command limit`);

    let optionalSeen = false;
    cmd.options.forEach((opt, optIndex) => {
      const optWhere = `${where}.options[${optIndex}]`;
      if (!opt.name || !DISCORD_NAME_RE.test(opt.name)) errors.push(`${optWhere}: nombre inválido / invalid name`);
      if (!pickDescription(opt, language)) errors.push(`${optWhere}: falta descripción / missing description`);
      if (opt.required && optionalSeen) {
        warnings.push(`${optWhere}: Discord exige obligatorias antes que opcionales; se reordenan / reordered`);
      }
      if (!opt.required) optionalSeen = true;
      if (opt.choices.length > 25) errors.push(`${optWhere}: máximo 25 choices / max 25 choices`);
    });
  });

  const telegramTotal = commands.reduce((sum, cmd) => sum + 1 + cmd.aliases.length, 0);
  if (telegramTotal > 100) {
    warnings.push(`BotFather admite 100 comandos; se generaron ${telegramTotal} / 100-command limit`);
  }
  return {errors, warnings};
}

function telegramCommandsText(commands, language, botName) {
  const lines = [];
  if (botName) lines.push(String(botName).trim());
  for (const cmd of commands) {
    const description = trimText(pickDescription(cmd, language), 100);
    lines.push(`${cmd.name} - ${description}`);
    for (const alias of cmd.aliases) lines.push(`${alias} - ${description}`);
  }
  return `${lines.join('\n')}\n`;
}

function discordCommandsJson(commands, language) {
  return commands.map(cmd => {
    const options = [...cmd.options].sort((a, b) => Number(b.required) - Number(a.required));
    const built = {
      name: cmd.name,
      description: trimText(pickDescription(cmd, language), 100),
      options: options.map(opt => {
        const option = {
          name: opt.name,
          description: trimText(pickDescription(opt, language), 100),
          type: DISCORD_TYPES[opt.type],
          required: opt.required
        };
        if (opt.choices.length) {
          option.choices = opt.choices.map(value => ({
            name: trimText(value, 100),
            value: coerceChoice(value, opt.type)
          }));
        }
        return option;
      }),
      dm_permission: !cmd.dm_only
    };
    if (cmd.admin_only) built.default_member_permissions = '8';
    return built;
  });
}

function commandSpecMarkdown(result, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${t('Especificación de comandos', 'Command specification')}`,
    '',
    `- ${t('Plataformas', 'Platforms')}: ${result.platform}`,
    `- ${t('Comandos', 'Commands')}: ${result.count}`,
    `- ${t('Alias', 'Aliases')}: ${result.aliasCount}`,
    '',
    `## ${t('BotFather (/setcommands)', 'BotFather (/setcommands)')}`,
    '',
    '```text',
    result.telegram.text.replace(/\n$/, ''),
    '```',
    '',
    `## ${t('Discord (application commands)', 'Discord (application commands)')}`,
    '',
    '```json',
    JSON.stringify(result.discord.commands, null, 2),
    '```',
    '',
    validationMarkdown(result.validation, language),
    '',
    `- ${t('Guardado', 'Saved')}: ${result.written ? t('sí', 'yes') : t('no', 'no')}`
  ];
  return `${lines.join('\n')}\n`;
}

async function botCommandSpec(args) {
  const language = langOf(args.language);
  const platform = ['both', 'telegram', 'discord'].includes(args.platform) ? args.platform : 'both';
  const rawCommands = Array.isArray(args.commands) ? args.commands : [];
  const commands = rawCommands.map(normalizeCommand).slice(0, 100);
  const validation = validateCommands(commands, language);
  if (rawCommands.length > 100) {
    validation.warnings.push(`Se recortaron los comandos a 100 / Commands truncated to 100`);
  }
  for (let index = 0; index < Math.min(rawCommands.length, 100); index++) {
    const raw = rawCommands[index] && typeof rawCommands[index] === 'object' ? rawCommands[index] : {};
    const rawOptions = Array.isArray(raw.options) ? raw.options : [];
    if (rawOptions.length > 25) {
      validation.warnings.push(`[${index}]: opciones recortadas a 25 / options truncated to 25`);
    }
    rawOptions.slice(0, 25).forEach((rawOption, optIndex) => {
      if (rawOption && Array.isArray(rawOption.choices) && rawOption.choices.length > 25) {
        validation.warnings.push(`[${index}].options[${optIndex}]: choices recortados a 25 / choices truncated to 25`);
      }
    });
  }
  const telegram = {
    text: telegramCommandsText(commands, language, args.telegram_bot_name),
    count: commands.reduce((sum, cmd) => sum + 1 + cmd.aliases.length, 0)
  };
  const discord = {commands: discordCommandsJson(commands, language)};
  const result = {
    format: 'antigem-bot-command-spec',
    version: 1,
    createdAt: Date.now(),
    language, platform,
    count: commands.length,
    aliasCount: commands.reduce((sum, cmd) => sum + cmd.aliases.length, 0),
    telegram, discord, validation,
    written: false,
    path: null
  };
  result.markdown = commandSpecMarkdown(result, language);
  result.written = await maybeWrite(args, args.output, result.markdown);
  result.path = result.written ? String(args.output).trim() : null;
  return result;
}

/* ------------------------------------------------------------------ */
/* bot_scaffold                                                        */
/* ------------------------------------------------------------------ */

const ALL_FEATURES = ['env_token', 'start_command', 'error_handler', 'graceful_shutdown', 'logging'];

function selectedFeatures(raw) {
  if (!Array.isArray(raw) || !raw.length) return [...ALL_FEATURES];
  const valid = raw.filter(feature => ALL_FEATURES.includes(feature));
  return valid.length ? valid : [...ALL_FEATURES];
}

function nodeTelegramLines(project, features) {
  const has = name => features.includes(name);
  return [
    "import 'dotenv/config';",
    "import { Bot } from 'grammy';",
    '',
    'const token = process.env.BOT_TOKEN;',
    'if (!token) {',
    "  console.error('Falta BOT_TOKEN en .env / Missing BOT_TOKEN in .env');",
    '  process.exit(1);',
    '}',
    '',
    'const bot = new Bot(token);',
    '',
    ...(has('logging') ? [
      'bot.use(async (ctx, next) => {',
      "  console.log('update', ctx.update.update_id);",
      '  await next();',
      '});',
      ''
    ] : []),
    ...(has('start_command') ? [
      "bot.command('start', (ctx) => ctx.reply('Hola / Hello. Usa /ayuda para ver los comandos.'));",
      ''
    ] : []),
    ...(has('error_handler') ? [
      "bot.on('error', (err) => console.error('Error del bot / Bot error:', err));",
      ''
    ] : []),
    "bot.start({ onStart: () => console.log('Bot en marcha / Bot running') });",
    ...(has('graceful_shutdown') ? [
      '',
      "for (const signal of ['SIGINT', 'SIGTERM']) {",
      '  process.once(signal, () => bot.stop(signal));',
      '}'
    ] : []),
    ''
  ];
}

function pythonTelegramLines(features) {
  const has = name => features.includes(name);
  return [
    'import os',
    ...(has('logging') ? ['import logging'] : []),
    '',
    'from dotenv import load_dotenv',
    'from telegram import Update',
    'from telegram.ext import Application, CommandHandler, ContextTypes',
    '',
    'load_dotenv()',
    'TOKEN = os.getenv("BOT_TOKEN")',
    'if not TOKEN:',
    '    raise SystemExit("Falta BOT_TOKEN en .env / Missing BOT_TOKEN in .env")',
    '',
    ...(has('logging') ? [
      'logging.basicConfig(level=logging.INFO)',
      ''
    ] : []),
    ...(has('start_command') ? [
      'async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:',
      '    await update.message.reply_text("Hola / Hello. Usa /ayuda.")',
      ''
    ] : []),
    'def main() -> None:',
    '    application = Application.builder().token(TOKEN).build()',
    ...(has('start_command') ? ['    application.add_handler(CommandHandler("start", start))'] : []),
    ...(has('error_handler') ? [
      '    application.add_error_handler(',
      '        lambda update, context: logging.error("Bot error: %s", context.error)',
      '    )'
    ] : []),
    '    application.run_polling()',
    '',
    'if __name__ == "__main__":',
    '    main()',
    ''
  ];
}

function nodeDiscordLines(features) {
  const has = name => features.includes(name);
  return [
    "import 'dotenv/config';",
    "import { Client, GatewayIntentBits, Events } from 'discord.js';",
    '',
    'const token = process.env.DISCORD_TOKEN;',
    'if (!token) {',
    "  console.error('Falta DISCORD_TOKEN en .env / Missing DISCORD_TOKEN in .env');",
    '  process.exit(1);',
    '}',
    '',
    'const client = new Client({',
    '  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],',
    '  // GatewayIntentBits.MessageContent es privilegiado / is privileged',
    '});',
    '',
    "client.once(Events.ClientReady, (c) => console.log('Conectado / Logged in as', c.user.tag));",
    ...(has('start_command') ? [
      "client.on(Events.MessageCreate, (msg) => {",
      '  if (msg.author.bot) return;',
      "  if (msg.content === '!ping') msg.reply('pong');",
      '});',
      ''
    ] : []),
    ...(has('logging') ? [
      "client.on(Events.Debug, (msg) => console.log('[discord]', msg));",
      ''
    ] : []),
    ...(has('error_handler') ? [
      "client.on(Events.Error, (err) => console.error('Error del bot / Bot error:', err));",
      ''
    ] : []),
    'client.login(token);',
    ...(has('graceful_shutdown') ? [
      '',
      "for (const signal of ['SIGINT', 'SIGTERM']) {",
      '  process.once(signal, () => client.destroy());',
      '}'
    ] : []),
    ''
  ];
}

function pythonDiscordLines(features) {
  const has = name => features.includes(name);
  return [
    'import os',
    ...(has('logging') ? ['import logging'] : []),
    '',
    'import discord',
    'from dotenv import load_dotenv',
    '',
    'load_dotenv()',
    'TOKEN = os.getenv("DISCORD_TOKEN")',
    'if not TOKEN:',
    '    raise SystemExit("Falta DISCORD_TOKEN en .env / Missing DISCORD_TOKEN in .env")',
    '',
    ...(has('logging') ? ['logging.basicConfig(level=logging.INFO)', ''] : []),
    'intents = discord.Intents.default()',
    '# intents.message_content = True  # privilegiado / privileged: actívalo en el portal',
    'client = discord.Client(intents=intents)',
    '',
    '@client.event',
    'async def on_ready():',
    '    print("Conectado / Logged in as", client.user)',
    '',
    ...(has('start_command') ? [
      '@client.event',
      'async def on_message(message):',
      '    if message.author.bot:',
      '        return',
      '    if message.content == "!ping":',
      '        await message.reply("pong")',
      ''
    ] : []),
    ...(has('error_handler') ? [
      '@client.event',
      'async def on_error(event, *args, **kwargs):',
      '    logging.exception("Bot error en / in %s", event)',
      ''
    ] : []),
    'client.run(TOKEN)',
    ''
  ];
}

function scaffoldReadme(project, platform, runtime, language, envVar, install, run) {
  const t = (es, en) => localText(language, es, en);
  return [
    `# ${project}`,
    '',
    `- ${t('Plataforma', 'Platform')}: ${platform}`,
    `- ${t('Runtime', 'Runtime')}: ${runtime}`,
    '',
    `## ${t('Puesta en marcha', 'Getting started')}`,
    '',
    `1. ${t('Copia', 'Copy')} \`.env.example\` ${t('a', 'to')} \`.env\` ${t('y rellena', 'and fill in')} \`${envVar}\`.`,
    `2. ${t('Instala', 'Install')}: \`${install}\`.`,
    `3. ${t('Ejecuta', 'Run')}: \`${run}\`.`,
    '',
    `## ${t('Seguridad', 'Security')}`,
    '',
    `- ${t('Nunca subas', 'Never commit')} \`.env\` ${t('ni pegues el token en el código', 'or paste the token into code')}.`,
    `- ${t('Si el token se filtra, revócalo en BotFather o en el portal de Discord', 'If the token leaks, revoke it in BotFather or the Discord portal')}.`,
    `- ${t('Este proyecto no contacta con ninguna plataforma hasta que lo ejecutes', 'This project does not contact any platform until you run it')}.`,
    ''
  ].join('\n');
}

async function botScaffold(args) {
  const language = langOf(args.language);
  const platform = ['telegram', 'discord'].includes(args.platform) ? args.platform : 'telegram';
  const runtime = ['node', 'python'].includes(args.runtime) ? args.runtime : 'node';
  const project = slug(args.project_name, `${platform}-bot`);
  const features = selectedFeatures(args.features);
  const outputDir = String(args.output_dir || '').trim();
  if (outputDir && !isLocalPath(outputDir)) {
    throw new Error('output_dir debe empezar por ~/ o /sdcard/ / output_dir must start with ~/ or /sdcard/');
  }

  const envVar = platform === 'telegram' ? 'BOT_TOKEN' : 'DISCORD_TOKEN';
  const isNode = runtime === 'node';
  const codeLines = platform === 'telegram'
    ? (isNode ? nodeTelegramLines(project, features) : pythonTelegramLines(features))
    : (isNode ? nodeDiscordLines(project, features) : pythonDiscordLines(features));
  const entry = isNode ? 'index.js' : 'bot.py';
  const install = isNode ? 'npm install' : 'pip install -r requirements.txt';
  const run = isNode ? 'npm start' : 'python bot.py';

  const files = [];
  files.push({path: '.env.example', content: `${envVar}=your_token_here\n`});
  files.push({path: '.gitignore', content: '.env\nnode_modules/\n__pycache__/\n*.pyc\n'});
  if (isNode) {
    const dependencies = platform === 'telegram'
      ? {'grammy': '^1.30.0', 'dotenv': '^16.4.5'}
      : {'discord.js': '^14.15.0', 'dotenv': '^16.4.5'};
    files.push({
      path: 'package.json',
      content: `${JSON.stringify({
        name: project,
        version: '1.0.0',
        private: true,
        type: 'module',
        scripts: {start: `node ${entry}`},
        dependencies
      }, null, 2)}\n`
    });
  } else {
    const requirements = platform === 'telegram'
      ? ['python-telegram-bot[rate-limiter]==21.10', 'python-dotenv==1.0.1']
      : ['discord.py==2.4.0', 'python-dotenv==1.0.1'];
    files.push({path: 'requirements.txt', content: `${requirements.join('\n')}\n`});
  }
  files.push({path: entry, content: `${codeLines.join('\n')}\n`});
  files.push({
    path: 'README.md',
    content: scaffoldReadme(project, platform, runtime, language, envVar, install, run)
  });

  const written = [];
  for (const file of files) {
    const path = outputDir ? `${outputDir.replace(/\/+$/, '')}/${file.path}` : '';
    file.written = path ? await maybeWrite(args, path, file.content) : false;
    file.path = path || file.path;
    written.push(file.written);
  }

  const t = (es, en) => localText(language, es, en);
  const markdown = [
    `# ${t('Andamiaje de bot', 'Bot scaffold')}`,
    '',
    `- ${t('Proyecto', 'Project')}: \`${project}\``,
    `- ${t('Plataforma', 'Platform')}: ${platform} · ${t('Runtime', 'Runtime')}: ${runtime}`,
    `- ${t('Funciones', 'Features')}: ${features.join(', ')}`,
    `- ${t('Directorio', 'Directory')}: ${outputDir || t('no especificado / not specified')}`,
    `- ${t('Archivos escritos', 'Files written')}: ${written.filter(Boolean).length}/${files.length}`,
    '',
    '| ' + t('Archivo', 'File') + ' | ' + t('Bytes', 'Bytes') + ' | ' + t('Escrito', 'Written') + ' |',
    '| --- | --- | --- |',
    ...files.map(file => `| \`${file.path}\` | ${file.content.length} | ${file.written ? t('sí', 'yes') : t('no', 'no')} |`),
    '',
    t('Revisa el token en `.env` antes de ejecutar. Ningún archivo contiene un token real.',
      'Review the token in `.env` before running. No file contains a real token.')
  ].join('\n');

  return {
    format: 'antigem-bot-scaffold',
    version: 1,
    createdAt: Date.now(),
    language, platform, runtime, project, features,
    entry, envVar, files,
    markdown: `${markdown}\n`,
    written: written.some(Boolean),
    outputDir: outputDir || null
  };
}

/* ------------------------------------------------------------------ */
/* bot_audit                                                           */
/* ------------------------------------------------------------------ */

const TELEGRAM_TOKEN_RE = /\b\d{8,10}:[A-Za-z0-9_-]{30,42}\b/g;
const DISCORD_TOKEN_RE = /\b[A-Za-z0-9_-]{23,28}\.[A-Za-z0-9_-]{6,7}\.[A-Za-z0-9_-]{27,40}\b/g;
const DISCORD_WEBHOOK_RE = /https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/g;
const ASSIGN_SECRET_RE = /\b(TOKEN|SECRET|PASSWORD|API_KEY|WEBHOOK)\b\s*[:=]\s*["'`]([^"'`\n]{8,})["'`]/gi;
const PLACEHOLDER_RE = /^(your|tu|xxx|change|example|placeholder|<|\{|process\.env|os\.getenv|getenv|ENV)/i;

function finding(id, severity, category, es, en, fixEs, fixEn, line) {
  return {id, severity, category, title_es: es, title_en: en, fix_es: fixEs, fix_en: fixEn, line: line || null};
}

function lineOf(code, index) {
  return code.slice(0, index).split('\n').length;
}

function detectPlatform(code, config, requested) {
  if (requested && requested !== 'auto') return requested;
  // URLs can mention the other platform (e.g. a Discord webhook inside a Telegram bot).
  const lower = String(code || '').toLowerCase().replace(/https?:\/\/\S+/g, ' ');
  const telegramHits = (lower.match(/telegram|grammy|botfather|telebot|bot\.api|bot\.command|setwebhook|run_polling/g) || []).length;
  const discordHits = (lower.match(/discord\.js|discord\.py|discord|gatewayintent|client\.login|slash_command|interaction\./g) || []).length;
  if (telegramHits > discordHits) return 'telegram';
  if (discordHits > telegramHits) return 'discord';
  return String(config && config.platform) === 'discord' ? 'discord'
    : String(config && config.platform) === 'telegram' ? 'telegram' : 'unknown';
}

function looksRealToken(value) {
  const text = String(value || '').trim();
  return text.length >= 8 && !PLACEHOLDER_RE.test(text) && !/^[x*-]+$/i.test(text);
}

function auditBot(args) {
  const code = String(args.code || '');
  const config = args.config && typeof args.config === 'object' ? args.config : {};
  const language = langOf(args.language);
  const platform = detectPlatform(code, config, args.platform);
  const findings = [];
  const lower = code.toLowerCase();

  for (const match of code.matchAll(TELEGRAM_TOKEN_RE)) {
    findings.push(finding('TELEGRAM_TOKEN_EMBEDDED', 'critical', 'secret',
      'Token de Telegram embebido en el código',
      'Embedded Telegram token in code',
      'Revócalo con /revoke en BotFather y léelo desde una variable de entorno.',
      'Revoke it with /revoke in BotFather and read it from an environment variable.',
      lineOf(code, match.index)));
  }
  for (const match of code.matchAll(DISCORD_TOKEN_RE)) {
    findings.push(finding('DISCORD_TOKEN_EMBEDDED', 'critical', 'secret',
      'Token de Discord embebido en el código',
      'Embedded Discord token in code',
      'Restablece el token en el portal de Discord y usa una variable de entorno.',
      'Reset the token in the Discord portal and use an environment variable.',
      lineOf(code, match.index)));
  }
  for (const match of code.matchAll(DISCORD_WEBHOOK_RE)) {
    findings.push(finding('DISCORD_WEBHOOK_EMBEDDED', 'critical', 'secret',
      'URL de webhook de Discord con secreto en el código',
      'Discord webhook URL with secret embedded in code',
      'Elimina el webhook filtrado y guárdalo como secreto, nunca en el repositorio.',
      'Delete the leaked webhook and store it as a secret, never in the repository.',
      lineOf(code, match.index)));
  }
  for (const match of code.matchAll(ASSIGN_SECRET_RE)) {
    if (looksRealToken(match[2])) {
      findings.push(finding('LITERAL_SECRET', 'high', 'secret',
        `Valor literal asignado a ${match[1]}`,
        `Literal value assigned to ${match[1]}`,
        'Sustituye el literal por process.env / os.getenv y añade el archivo al .gitignore.',
        'Replace the literal with process.env / os.getenv and add the file to .gitignore.',
        lineOf(code, match.index)));
    }
  }

  if (/console\.(log|info|debug|error)\([^)]*\b(token|secret|password)\b/i.test(code) ||
      /print\([^)]*\b(token|secret|password)\b/i.test(code) ||
      /logging\.(debug|info)\([^)]*\b(token|secret|password)\b/i.test(code)) {
    findings.push(finding('SECRET_IN_LOG', 'high', 'logging',
      'Posible secreto escrito en logs',
      'Possible secret written to logs',
      'Nunca imprimas el token; registra solo un identificador o los últimos 4 caracteres.',
      'Never print the token; log an identifier or the last 4 characters only.'));
  }
  if (config.logging_token === true) {
    findings.push(finding('CONFIG_LOGGING_TOKEN', 'high', 'logging',
      'La configuración activa el registro del token',
      'Configuration enables token logging',
      'Pon logging_token a false y redacta los campos sensibles.',
      'Set logging_token to false and redact sensitive fields.'));
  }

  const hasErrorHandling = /try\s*\{|catch\s*\(|\.on\(['"]error['"]\)|add_error_handler|on_error|except\s+\w*Error|Events\.Error/i.test(code);
  if (code.trim() && !hasErrorHandling) {
    findings.push(finding('NO_ERROR_HANDLER', 'medium', 'reliability',
      'No se detectó manejo de errores',
      'No error handler detected',
      platform === 'discord'
        ? "Añade client.on('error') y envuelve las llamadas a la API en try/catch."
        : "Añade bot.on('error') y envuelve las llamadas a la API en try/catch.",
      platform === 'discord'
        ? "Add client.on('error') and wrap API calls in try/catch."
        : "Add bot.on('error') and wrap API calls in try/catch."));
  }

  if (platform === 'discord' || /guildmember|guild_presences|message_content|intents/i.test(lower)) {
    const privileged = /GUILD_MEMBERS|GUILD_PRESENCES|MESSAGE_CONTENT|message_content/i.test(code) ||
      (Array.isArray(config.intents) && config.intents.some(i => /MEMBER|PRESENCE|MESSAGE_CONTENT/i.test(String(i))));
    if (privileged) {
      findings.push(finding('PRIVILEGED_INTENTS', 'medium', 'permissions',
        'Se usan intents privilegiados de Discord',
        'Privileged Discord intents in use',
        'Actívalos en Developer Portal → Bot → Privileged Gateway Intents y documenta por qué los necesitas.',
        'Enable them in Developer Portal → Bot → Privileged Gateway Intents and document why you need them.'));
    }
  }

  const rawPermissions = config.permissions;
  const permList = Array.isArray(rawPermissions) ? rawPermissions.map(String) : [];
  const broad = permList.some(p => /^8$|administrator|admin|manage_guild|manageguild/i.test(p)) ||
    rawPermissions === 8 || rawPermissions === '8';
  if (broad) {
    findings.push(finding('BROAD_PERMISSIONS', 'high', 'permissions',
      'Permisos amplios o administrador',
      'Broad permissions or administrator',
      'Usa el permiso mínimo: reduce el bitfield y evita ADMINISTRATOR (8).',
      'Use least privilege: reduce the bitfield and avoid ADMINISTRATOR (8).'));
  }

  const webhook = String(config.webhook || '').trim();
  if (webhook && /^http:\/\//i.test(webhook)) {
    findings.push(finding('WEBHOOK_INSECURE', 'critical', 'webhook',
      'Webhook configurado con HTTP',
      'Webhook configured over HTTP',
      'Usa HTTPS; las plataformas rechazan webhooks HTTP.',
      'Use HTTPS; the platforms reject HTTP webhooks.'));
  }
  if (webhook && !config.webhook_secret) {
    findings.push(finding('WEBHOOK_NO_SECRET', 'medium', 'webhook',
      'Webhook sin secreto',
      'Webhook without secret',
      platform === 'discord'
        ? 'Añade un secreto al webhook y verifica la cabecera X-Signature-Ed25519.'
        : 'Configura secret_token en setWebhook y valida X-Telegram-Bot-Api-Secret-Token.',
      platform === 'discord'
        ? 'Add a webhook secret and verify the X-Signature-Ed25519 header.'
        : 'Set secret_token in setWebhook and validate X-Telegram-Bot-Api-Secret-Token.'));
  }
  if (/setwebhook/i.test(code) && /run_polling|bot\.start\(/i.test(code)) {
    findings.push(finding('POLLING_AND_WEBHOOK', 'high', 'webhook',
      'Polling y webhook activados a la vez',
      'Polling and webhook enabled together',
      'Elige uno solo: llama a deleteWebhook si vas a usar polling.',
      'Choose one: call deleteWebhook if you use polling.'));
  }
  if (!config.rate_limit_handling && !/retry_after|rate.?limit|\b429\b|retry.?after/i.test(code)) {
    findings.push(finding('NO_RATE_LIMIT_HANDLING', 'medium', 'reliability',
      'No se detectó manejo de límites de velocidad',
      'No rate-limit handling detected',
      'Respeta retry_after / Retry-After y aplica retroceso exponencial.',
      'Honour retry_after / Retry-After and use exponential backoff.'));
  }
  if (code.trim() && !/process\.env|getenv|os\.environ|import\.meta\.env/i.test(code) &&
      /\b(token|TOKEN)\b/.test(code)) {
    findings.push(finding('TOKEN_NOT_FROM_ENV', 'medium', 'secret',
      'El token no parece venir de una variable de entorno',
      'Token does not appear to come from an environment variable',
      'Lee el token de process.env o os.getenv antes de inicializar el cliente.',
      'Read the token from process.env or os.getenv before initialising the client.'));
  }

  const severities = {critical: 0, high: 0, medium: 0, low: 0};
  for (const item of findings) severities[item.severity] = (severities[item.severity] || 0) + 1;
  return {
    format: 'antigem-bot-audit', version: 1, createdAt: Date.now(),
    language, platform, findings, severities,
    passed: severities.critical === 0 && severities.high === 0,
    markdown: ''
  };
}

function auditMarkdown(result, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${t('Auditoría de bot', 'Bot audit')}`,
    '',
    `- ${t('Plataforma', 'Platform')}: ${result.platform}`,
    `- ${t('Resultado', 'Result')}: **${result.passed ? t('OK', 'PASS') : t('REVISAR', 'REVIEW')}**`,
    `- ${t('Hallazgos', 'Findings')}: ${result.findings.length}`,
    `- ${t('Críticos / Altos / Medios', 'Critical / High / Medium')}: ` +
      `${result.severities.critical} / ${result.severities.high} / ${result.severities.medium}`,
    ''
  ];
  if (!result.findings.length) {
    lines.push(t('No se encontraron problemas con las reglas disponibles.',
      'No issues were found with the available rules.'));
  }
  for (const item of result.findings) {
    const title = localText(language, item.title_es, item.title_en);
    const fix = localText(language, item.fix_es, item.fix_en);
    lines.push(`## ${item.severity.toUpperCase()} · ${item.id}`, '',
      `- ${t('Categoría', 'Category')}: ${item.category}`,
      `- ${t('Línea', 'Line')}: ${item.line || '-'}`,
      `- ${t('Problema', 'Issue')}: ${title}`,
      `- ${t('Corrección', 'Fix')}: ${fix}`, '');
  }
  lines.push(t('Análisis estático: no se ejecuta código ni se contacta con las plataformas.',
    'Static analysis: no code is executed and no platform is contacted.'));
  return `${lines.join('\n')}\n`;
}

async function botAudit(args) {
  const result = auditBot(args);
  result.markdown = auditMarkdown(result, result.language);
  result.written = await maybeWrite(args, args.output, result.markdown);
  result.path = result.written ? String(args.output).trim() : null;
  return result;
}

/* ------------------------------------------------------------------ */
/* bot_reference                                                       */
/* ------------------------------------------------------------------ */

function ref(titleEs, titleEn, pointsEs, pointsEn, checkEs, checkEn, mistakesEs, mistakesEn, snippet) {
  return {
    titleEs, titleEn, pointsEs, pointsEn,
    checkEs, checkEn, mistakesEs, mistakesEn,
    snippet: snippet || ''
  };
}

const REFERENCES = {
  'telegram-setup': ref(
    'Configurar un bot de Telegram', 'Set up a Telegram bot',
    ['Crea el bot con /newbot en BotFather y guarda el token solo en una variable de entorno.',
     'Comprueba el token con getMe antes de escribir nada más.',
     'Elige polling (simple) o webhook HTTPS (recomendado en producción).'],
    ['Create the bot with /newbot in BotFather and keep the token only in an environment variable.',
     'Check the token with getMe before writing anything else.',
     'Choose polling (simple) or an HTTPS webhook (recommended in production).'],
    ['Token en .env y .env en .gitignore', 'getMe funciona', 'Sin token en el historial de Git'],
    ['Token in .env and .env in .gitignore', 'getMe works', 'No token in Git history'],
    ['Pegar el token en el código', 'Subir .env al repositorio'],
    ['Pasting the token into code', 'Committing .env to the repository'],
    "const bot = new Bot(process.env.BOT_TOKEN);\nawait bot.api.getMe();"),
  'telegram-commands': ref(
    'Comandos de Telegram', 'Telegram commands',
    ['Envía /setcommands a BotFather con líneas «comando - descripción».',
     'Nombre: 1-32 caracteres, minúsculas, dígitos y guion bajo.',
     'La descripción tiene un máximo de 100 caracteres; los comandos son visibles con el carácter /.'],
    ['Send /setcommands to BotFather with "command - description" lines.',
     'Name: 1-32 chars, lowercase, digits and underscore.',
     'Description is capped at 100 chars; commands appear with the / prefix.'],
    ['Nombres únicos', 'Descripción corta y clara', 'Máximo 100 comandos'],
    ['Unique names', 'Short clear description', 'Maximum 100 commands'],
    ['Usar mayúsculas en el nombre', 'Descripción de más de 100 caracteres'],
    ['Uppercase command names', 'Descriptions longer than 100 chars'],
    "start - Inicia el bot / Starts the bot\nayuda - Muestra la ayuda / Shows help"),
  'telegram-keyboards': ref(
    'Teclados de Telegram', 'Telegram keyboards',
    ['ReplyKeyboardMarkup muestra botones en el teclado del usuario; InlineKeyboardMarkup va dentro del mensaje.',
     'callback_data admite hasta 64 bytes; guarda el estado en tu BD y envía solo un ID.',
     'resize_keyboard y one_time_keyboard controlan la presentación del teclado de respuesta.'],
    ['ReplyKeyboardMarkup shows buttons in the user keyboard; InlineKeyboardMarkup sits inside the message.',
     'callback_data holds up to 64 bytes; store state in your DB and send only an ID.',
     'resize_keyboard and one_time_keyboard control the reply keyboard presentation.'],
    ['callback_data corto', 'Texto visible en cada botón', 'URL válida en los botones web'],
    ['Short callback_data', 'Visible label on every button', 'Valid URL on web buttons'],
    ['Meter un JSON largo en callback_data', 'Olvidar responder a la callback query'],
    ['Putting a long JSON in callback_data', 'Forgetting to answer the callback query'],
    "new InlineKeyboard().text('Sí / Yes', 'yes:42').url('Docs', 'https://example.com')"),
  'telegram-inline': ref(
    'Modo inline de Telegram', 'Telegram inline mode',
    ['Activa el modo inline con /setinline en BotFather.',
     'Responde inline_query con answerInlineQuery; el usuario ve los resultados al escribir @bot.',
     'cache_time evita repetir la misma consulta; switch_pm_text invita al chat privado.'],
    ['Enable inline mode with /setinline in BotFather.',
     'Answer inline_query with answerInlineQuery; results appear when typing @bot.',
     'cache_time avoids repeating the same query; switch_pm_text invites the user to a private chat.'],
    ['Modo inline activado', 'Menos de 50 resultados por respuesta', 'cache_time configurado'],
    ['Inline mode enabled', 'Fewer than 50 results per answer', 'cache_time configured'],
    ['Devolver más de 50 resultados', 'Olvidar el campo id del resultado'],
    ['Returning more than 50 results', 'Missing result id field'],
    "await bot.on('inline_query', (ctx) => ctx.answerInlineQuery(results, {cache_time: 30}));"),
  'telegram-webhooks': ref(
    'Webhooks de Telegram', 'Telegram webhooks',
    ['setWebhook exige una URL HTTPS pública.',
     'Envía secret_token y verifica la cabecera X-Telegram-Bot-Api-Secret-Token.',
     'drop_pending_updates evita procesar mensajes antiguos al reiniciar.'],
    ['setWebhook requires a public HTTPS URL.',
     'Send secret_token and verify the X-Telegram-Bot-Api-Secret-Token header.',
     'drop_pending_updates avoids replaying old messages on restart.'],
    ['HTTPS válido', 'Secreto configurado', 'Ruta solo para el bot', 'Verificación de la cabecera'],
    ['Valid HTTPS', 'Secret configured', 'Bot-only path', 'Header verification'],
    ['URL HTTP', 'Publicar el token en la URL del webhook'],
    ['HTTP URL', 'Putting the token in the webhook URL'],
    "await bot.api.setWebhook('https://example.com/hook', {secret_token: process.env.HOOK_SECRET});"),
  'telegram-limits': ref(
    'Límites de Telegram', 'Telegram limits',
    ['Aproximadamente 30 mensajes por segundo en total; por chat hay límites más bajos.',
     'Si recibes 429, espera el valor de retry_after antes de reintentar.',
     'Texto de mensaje: 4096 caracteres; caption: 1024; callback_data: 64 bytes.'],
    ['Around 30 messages per second overall; per-chat limits are lower.',
     'On 429, wait the retry_after value before retrying.',
     'Message text: 4096 chars; caption: 1024; callback_data: 64 bytes.'],
    ['Cola de envío', 'Retroceso en 429', 'Mensajes largos divididos'],
    ['Send queue', 'Backoff on 429', 'Long messages split'],
    ['Reintentos inmediatos', 'Enviar 100 mensajes seguidos a un mismo chat'],
    ['Immediate retries', 'Sending 100 messages in a row to one chat'],
    "if (err.error_code === 429) await sleep(err.parameters.retry_after * 1000);"),
  'discord-setup': ref(
    'Configurar un bot de Discord', 'Set up a Discord bot',
    ['Crea una aplicación en el Developer Portal y añade un bot usuario.',
     'Invita el bot con los scopes bot y applications.commands.',
     'El token va en DISCORD_TOKEN; no lo compartas ni lo subas al repositorio.'],
    ['Create an application in the Developer Portal and add a bot user.',
     'Invite the bot with the bot and applications.commands scopes.',
     'The token goes in DISCORD_TOKEN; never share or commit it.'],
    ['Scopes correctos en la URL de invitación', 'Intents activados en el portal', 'Token en entorno'],
    ['Correct scopes in the invite URL', 'Intents enabled in the portal', 'Token in env'],
    ['Faltó applications.commands y no aparecen los slash commands', 'Activar intents solo en el código'],
    ['Missing applications.commands so slash commands do not appear', 'Enabling intents only in code'],
    "const client = new Client({intents: [GatewayIntentBits.Guilds]});\nclient.login(process.env.DISCORD_TOKEN);"),
  'discord-slash': ref(
    'Slash commands de Discord', 'Discord slash commands',
    ['Nombre 1-32 caracteres en minúsculas; descripción 1-100.',
     'Máximo 25 opciones por comando y 25 choices por opción.',
     'Responde en 3 segundos o usa deferReply; las respuestas efímeras las ve solo el autor.'],
    ['Name 1-32 lowercase chars; description 1-100.',
     'Maximum 25 options per command and 25 choices per option.',
     'Reply within 3 seconds or use deferReply; ephemeral replies are visible only to the author.'],
    ['Comandos registrados en la guild de pruebas', 'Opciones obligatorias primero', 'Manejo de deferReply'],
    ['Commands registered in the test guild', 'Required options first', 'deferReply handling'],
    ['Registrar solo global y esperar una hora en pruebas', 'Superar 100 caracteres de descripción'],
    ['Registering only globally and waiting an hour during testing', 'Exceeding 100 chars in a description'],
    "await interaction.reply({content: 'OK', ephemeral: true});"),
  'discord-embeds': ref(
    'Embeds de Discord', 'Discord embeds',
    ['Título 256 caracteres, descripción 4096 y hasta 25 campos.',
     'El total del embed no puede superar 6000 caracteres.',
     'color es un entero hexadecimal; timestamp acepta una cadena ISO 8601.'],
    ['Title 256 chars, description 4096 and up to 25 fields.',
     'The total embed cannot exceed 6000 characters.',
     'color is a hex integer; timestamp accepts an ISO 8601 string.'],
    ['Suma de caracteres dentro del límite', 'Campos con nombre y valor', 'Color legible'],
    ['Total characters within limit', 'Fields have name and value', 'Readable colour'],
    ['Campos vacíos', 'Pasar color como cadena "#fff" en vez de entero'],
    ['Empty fields', 'Passing colour as "#fff" string instead of an integer'],
    "new EmbedBuilder().setTitle('Informe').setColor(0x22D3EE).setTimestamp();"),
  'discord-intents': ref(
    'Intents de Discord', 'Discord intents',
    ['Gateway intent define qué eventos recibe el bot.',
     'GUILD_MEMBERS, GUILD_PRESENCES y MESSAGE_CONTENT son privilegiados.',
     'Hay que activarlos en el Developer Portal y pedirlos también en el código.'],
    ['A gateway intent defines which events the bot receives.',
     'GUILD_MEMBERS, GUILD_PRESENCES and MESSAGE_CONTENT are privileged.',
     'Enable them in the Developer Portal and request them in code too.'],
    ['Mínimos intents necesarios', 'Portal y código coinciden', 'Justificación documentada'],
    ['Minimum necessary intents', 'Portal and code agree', 'Documented justification'],
    ['Pedir todos los intents "por si acaso"', 'Activarlos solo en el código'],
    ['Requesting every intent "just in case"', 'Enabling them only in code'],
    "intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]"),
  'discord-permissions': ref(
    'Permisos de Discord', 'Discord permissions',
    ['Los permisos son un bitfield; ADMINISTRATOR es 8 y lo desbloquea todo.',
     'Manage Messages es 8192; calcula el mínimo con la calculadora del portal.',
     'default_member_permissions limita los comandos por defecto; dm_permission controla los DM.'],
    ['Permissions are a bitfield; ADMINISTRATOR is 8 and unlocks everything.',
     'Manage Messages is 8192; compute the minimum with the portal calculator.',
     'default_member_permissions limits commands by default; dm_permission controls DMs.'],
    ['Permiso mínimo', 'Sin ADMINISTRATOR', 'URL de invitación revisada'],
    ['Least privilege', 'No ADMINISTRATOR', 'Reviewed invite URL'],
    ['Dar administrador para "que funcione"', 'Olvidar permisos de los canales'],
    ['Granting admin "to make it work"', 'Forgetting channel permissions'],
    '"default_member_permissions": "8192"'),
  'discord-webhooks': ref(
    'Webhooks de Discord', 'Discord webhooks',
    ['Una URL de webhook es un secreto: quien la tiene puede publicar en ese canal.',
     'Puedes publicar con embed, username y avatar_url sin necesidad de token de bot.',
     'Verifica la firma Ed25519 si recibes interacciones por webhook.'],
    ['A webhook URL is a secret: anyone holding it can post to that channel.',
     'You can post with embed, username and avatar_url without a bot token.',
     'Verify the Ed25519 signature when receiving interactions via webhook.'],
    ['URL guardada como secreto', 'Webhook eliminado tras una filtración', 'allowed_mentions configurado'],
    ['URL stored as a secret', 'Webhook deleted after a leak', 'allowed_mentions configured'],
    ['Pegar la URL en un log', 'Permitir menciones masivas por defecto'],
    ['Pasting the URL into a log', 'Allowing everyone mentions by default'],
    "allowed_mentions: {parse: []}"),
  'security': ref(
    'Seguridad de bots', 'Bot security',
    ['Token filtrado equivale a bot comprometido: revócalo de inmediato.',
     'Usa secretos del sistema en producción y .env solo en desarrollo local.',
     'Valida y sanea toda entrada del usuario; nunca ejecutes su contenido.'],
    ['A leaked token means a compromised bot: revoke it immediately.',
     'Use platform secrets in production and .env only for local development.',
     'Validate and sanitise all user input; never execute its content.'],
    ['Sin secretos en logs', 'Rotación de token posible', 'Permisos mínimos', 'HTTPS en webhooks'],
    ['No secrets in logs', 'Token rotation possible', 'Least privilege', 'HTTPS webhooks'],
    ['Confiar en el contenido de un mensaje', 'Dejar el token en el historial de Git'],
    ['Trusting message content', 'Leaving the token in Git history'],
    '# BotFather: /revoke   |   Discord: reset token'),
  'testing': ref(
    'Probar bots sin plataforma', 'Testing bots without the platform',
    ['Separa la lógica del cliente: funciones puras se prueban sin red.',
     'Simula actualizaciones con un objeto mínimo que tenga los campos que usas.',
     'Usa un guild o chat de pruebas y limpia los comandos registrados al terminar.'],
    ['Separate logic from the client: pure functions can be tested offline.',
     'Mock updates with a minimal object containing only the fields you use.',
     'Use a test guild or chat and clean up registered commands afterwards.'],
    ['Pruebas unitarias de la lógica', 'Comandos duplicados en test', 'Sin llamadas reales en CI'],
    ['Unit tests for logic', 'Duplicate commands in test', 'No real calls in CI'],
    ['Probar directamente en producción', 'Llamar a la API real desde CI'],
    ['Testing directly in production', 'Calling the real API from CI'],
    "assert(parseCommand('/start') === 'start');"),
  'deployment': ref(
    'Desplegar un bot', 'Deploying a bot',
    ['El token se inyecta como variable de entorno del servicio, nunca en la imagen.',
     'Usa un gestor de procesos y apagado limpio para liberar la conexión.',
     'Un webhook necesita HTTPS público; el polling necesita una sola instancia.'],
    ['Inject the token as a service environment variable, never into the image.',
     'Use a process manager and graceful shutdown to release the connection.',
     'A webhook needs public HTTPS; polling needs a single instance.'],
    ['Una sola instancia en polling', 'Health check', 'Logs sin secretos', 'Reinicio automático'],
    ['Single polling instance', 'Health check', 'Secret-free logs', 'Automatic restart'],
    ['Dos instancias haciendo polling', 'Token copiado en el Dockerfile'],
    ['Two instances polling', 'Token copied into the Dockerfile'],
    'process.once("SIGTERM", () => bot.stop("SIGTERM"));'),
  'comparison': ref(
    'Telegram frente a Discord', 'Telegram versus Discord',
    ['Telegram destaca por canales, grupos grandes y teclados inline; Discord por servidores, roles y slash commands.',
     'Comandos: BotFather /setcommands frente a application commands con opciones tipadas.',
     'Los intents de Discord controlan eventos; Telegram no tiene equivalente directo.',
     'Webhook HTTPS y secretos son recomendables en las dos plataformas.'],
    ['Telegram shines for channels, large groups and inline keyboards; Discord for servers, roles and slash commands.',
     'Commands: BotFather /setcommands versus application commands with typed options.',
     'Discord intents gate events; Telegram has no direct equivalent.',
     'HTTPS webhooks and secrets are recommended on both platforms.'],
    ['Elegir según la comunidad', 'Una sola capa de lógica de negocio', 'Adaptadores por plataforma'],
    ['Choose based on the community', 'One business-logic layer', 'One adapter per platform'],
    ['Copiar la lógica de una plataforma a otra sin adaptar', 'Asumir límites idénticos'],
    ['Copying logic across platforms without adapting it', 'Assuming identical limits'],
    'core → Telegram adapter | core → Discord adapter')
};

function referenceMarkdown(result, language) {
  const r = result.card;
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${localText(language, r.titleEs, r.titleEn)}`,
    '',
    `- ${t('Tema', 'Topic')}: \`${result.topic}\``,
    ''
  ];
  const section = (titleEs, titleEn, itemsEs, itemsEn) => {
    lines.push(`## ${localText(language, titleEs, titleEn)}`, '');
    if (language === 'both') {
      lines.push('### ES', '', mdList(itemsEs, '—'), '', '### EN', '', mdList(itemsEn, '—'), '');
    } else {
      lines.push(mdList(language === 'es' ? itemsEs : itemsEn, '—'), '');
    }
  };
  section('Ideas clave', 'Key points', r.pointsEs, r.pointsEn);
  section('Checklist', 'Checklist', r.checkEs, r.checkEn);
  section('Errores comunes', 'Common mistakes', r.mistakesEs, r.mistakesEn);
  if (r.snippet) {
    lines.push(`## ${t('Ejemplo', 'Example')}`, '', '```text', r.snippet, '```', '');
  }
  lines.push(t('Ficha offline: verifica siempre los límites actuales en la documentación oficial.',
    'Offline card: always verify current limits in the official documentation.'));
  return `${lines.join('\n')}\n`;
}

async function botReference(args) {
  const language = langOf(args.language);
  const topic = TOPICS.includes(args.topic) ? args.topic : 'comparison';
  const result = {
    format: 'antigem-bot-reference',
    version: 1,
    createdAt: Date.now(),
    language, topic,
    availableTopics: [...TOPICS],
    card: REFERENCES[topic]
  };
  result.markdown = referenceMarkdown(result, language);
  result.written = await maybeWrite(args, args.output, result.markdown);
  result.path = result.written ? String(args.output).trim() : null;
  return result;
}

/* ------------------------------------------------------------------ */
/* MCP dispatch                                                        */
/* ------------------------------------------------------------------ */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    const args = message.args || {};
    if (message.tool === 'bot_command_spec') return await botCommandSpec(args);
    if (message.tool === 'bot_scaffold') return await botScaffold(args);
    if (message.tool === 'bot_audit') return await botAudit(args);
    if (message.tool === 'bot_reference') return await botReference(args);
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: error && error.message ? error.message : String(error)}]
  }));
  return true;
});
