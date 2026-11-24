---
name: Bots de Telegram y Discord / Telegram and Discord bots
description: ES: Diseña, genera, audita y documenta bots de Telegram y Discord sin red: comandos para BotFather y Discord, andamiaje Node/Python, auditoría de secretos y permisos, y fichas de referencia. Úsala al crear, revisar o migrar un bot. EN: Design, scaffold, audit and document Telegram and Discord bots offline: BotFather and Discord commands, Node/Python starters, secret and permission audits, and reference cards. Use it when creating, reviewing or migrating a bot.
---

# Bots de Telegram y Discord / Telegram and Discord bots

## ES

Usa esta skill para **cualquier trabajo con bots de Telegram o Discord**: crear un proyecto, definir comandos, revisar seguridad, preparar el despliegue o responder dudas de plataforma. El plugin funciona sin red: no envía mensajes, no usa tokens y no contacta con las plataformas. Todo lo que produce es texto listo para que lo copies o guardes.

### Las cuatro tools

| Tool | Para qué sirve |
| --- | --- |
| `bot_command_spec` | Convierte una lista única de comandos en `/setcommands` de BotFather y en JSON de application commands de Discord, validando nombres, longitudes y límites. |
| `bot_scaffold` | Genera un proyecto base (Node o Python, Telegram o Discord) con token por entorno, manejo de errores y apagado limpio. |
| `bot_audit` | Analiza código y configuración en busca de tokens embebidos, secretos en logs, permisos amplios, intents privilegiados y problemas de webhook. |
| `bot_reference` | Devuelve una ficha bilingüe sobre 16 temas: configuración, comandos, teclados, inline, webhooks, límites, embeds, intents, permisos, seguridad, pruebas, despliegue y comparativa. |

### Flujo recomendado

1. **Diseña los comandos una sola vez.** Escribe una lista con `name`, `description_es`, `description_en` y, si aplica, `options` y `aliases`. Pásala a `bot_command_spec` con `platform:"both"`. Consulta `comandos.md`.
2. **Genera el esqueleto** con `bot_scaffold`: elige `platform`, `runtime`, `features` y un `output_dir` bajo `~/` o `/sdcard/`. Revisa el `.env.example`, nunca el token real.
3. **Audita antes de publicar** con `bot_audit`: pega el código y un `config` con `webhook`, `webhook_secret`, `intents` y `permissions`. Corrige primero los hallazgos `critical` y `high`. Consulta `seguridad.md`.
4. **Resuelve dudas concretas** con `bot_reference`: por ejemplo `topic:"discord-intents"` o `topic:"telegram-limits"`. Es offline, así que verifica siempre los límites en la documentación oficial antes de diseñar alrededor de ellos.
5. **Despliega con el token inyectado** como variable de entorno del servicio, una sola instancia si usas polling y HTTPS si usas webhook. Consulta `despliegue.md`.

### Reglas prácticas

- `dry_run: true` por defecto en las cuatro tools. Sin `dry_run:false` nada se escribe en disco.
- Las rutas de `output` y `output_dir` deben empezar por `~/` o `/sdcard/`.
- `bot_audit` es análisis estático: no ejecuta el código ni se conecta a las plataformas.
- Si el token aparece en un hallazgo, trátalo como **comprometido**: revócalo y genera uno nuevo antes de seguir.
- Las descripciones bilingües se unen con ` / ` cuando `language:"both"`. Si solo mandas un idioma, se rellena con el otro.
- Los comandos de Discord se ordenan con las opciones obligatorias primero, como exige la API.

Lee `comandos.md` para el formato exacto de comandos y opciones, `seguridad.md` para interpretar la auditoría y `despliegue.md` para la puesta en producción.

## EN

Use this skill for **any Telegram or Discord bot work**: creating a project, defining commands, reviewing security, preparing deployment or answering platform questions. The plugin works offline: it sends no messages, uses no tokens and contacts no platform. Everything it produces is text you can copy or save.

### The four tools

| Tool | Purpose |
| --- | --- |
| `bot_command_spec` | Turns one command list into BotFather `/setcommands` text and Discord application-command JSON, validating names, lengths and limits. |
| `bot_scaffold` | Generates a starter project (Node or Python, Telegram or Discord) with an env-var token, error handling and graceful shutdown. |
| `bot_audit` | Scans code and config for embedded tokens, secrets in logs, broad permissions, privileged intents and webhook problems. |
| `bot_reference` | Returns a bilingual card on 16 topics: setup, commands, keyboards, inline, webhooks, limits, embeds, intents, permissions, security, testing, deployment and comparison. |

### Recommended flow

1. **Design commands once.** Write a list with `name`, `description_es`, `description_en` and, where relevant, `options` and `aliases`. Pass it to `bot_command_spec` with `platform:"both"`. See `comandos.md`.
2. **Generate the scaffold** with `bot_scaffold`: choose `platform`, `runtime`, `features` and an `output_dir` under `~/` or `/sdcard/`. Review `.env.example`, never the real token.
3. **Audit before publishing** with `bot_audit`: paste the code and a `config` with `webhook`, `webhook_secret`, `intents` and `permissions`. Fix `critical` and `high` findings first. See `seguridad.md`.
4. **Answer specific questions** with `bot_reference`, e.g. `topic:"discord-intents"` or `topic:"telegram-limits"`. It is offline, so always verify current limits in the official docs before designing around them.
5. **Deploy with the token injected** as a service environment variable, one instance if polling and HTTPS if using a webhook. See `despliegue.md`.

### Practical rules

- `dry_run: true` by default in all four tools. Nothing is written without `dry_run:false`.
- `output` and `output_dir` paths must start with `~/` or `/sdcard/`.
- `bot_audit` is static analysis: it does not execute code or contact any platform.
- If a token appears in a finding, treat it as **compromised**: revoke it and issue a new one before continuing.
- Bilingual descriptions join with ` / ` under `language:"both"`. If you provide one language, the other is reused.
- Discord commands are emitted with required options first, as the API requires.

Read `comandos.md` for the exact command and option format, `seguridad.md` for interpreting the audit and `despliegue.md` for production setup.
