# Despliegue / Deployment

## ES

`bot_scaffold` genera archivos, no instala dependencias ni inicia nada. El código resultante está listo para ejecutarse en un servidor, una mini app de escritorio o un contenedor, siempre con el token fuera del repositorio.

### Opciones

- `platform`: `telegram` o `discord`.
- `runtime`: `node` o `python`.
- `features`: `env_token`, `start_command`, `error_handler`, `graceful_shutdown`, `logging`. Si omites la lista, se incluyen todas.
- `output_dir`: carpeta bajo `~/` o `/sdcard/`. Sin ella, los archivos solo se devuelven como texto.
- `dry_run:false` para escribir. Por defecto solo previsualiza.

### Archivos generados

| Archivo | Contenido |
| --- | --- |
| `.env.example` | Variable `BOT_TOKEN` o `DISCORD_TOKEN` con un marcador, nunca un token real |
| `.gitignore` | Excluye `.env`, `node_modules/` y cachés de Python |
| `index.js` / `bot.py` | Cliente inicializado desde entorno, con las funciones elegidas |
| `package.json` / `requirements.txt` | Dependencias fijadas: grammY o discord.js, python-telegram-bot o discord.py |
| `README.md` | Pasos de instalación, ejecución y seguridad en los dos idiomas |

### Antes de arrancar

1. Copia `.env.example` a `.env` y pon el token real solo ahí.
2. Instala dependencias con `npm install` o `pip install -r requirements.txt`.
3. Comprueba el token con `getMe` (Telegram) o revisando el `on_ready` (Discord).
4. Ejecuta `bot_audit` sobre el código generado antes de publicar.

### Polling frente a webhook

- **Polling**: más simple, no necesita dominio, pero solo puede haber **una instancia**. Dos instancias compiten y provocan `409 Conflict` en Telegram.
- **Webhook**: necesita HTTPS público y un secreto. Verifica la cabecera `X-Telegram-Bot-Api-Secret-Token` o la firma Ed25519 de Discord. Permite escalar sin competencia por actualizaciones.

### Producción

- Inyecta el token como variable de entorno del servicio, no en la imagen ni en el código.
- Mantén un solo proceso en polling; usa un gestor que reinicie en caso de caída.
- Implementa apagado limpio en `SIGTERM` para liberar la conexión.
- Registra sin secretos: nunca imprimas el token, solo un identificador.
- Respeta `retry_after` y `429` con retroceso exponencial.

## EN

`bot_scaffold` generates files; it does not install dependencies or start anything. The resulting code is ready to run on a server, desktop mini app or container, always with the token outside the repository.

### Options

- `platform`: `telegram` or `discord`.
- `runtime`: `node` or `python`.
- `features`: `env_token`, `start_command`, `error_handler`, `graceful_shutdown`, `logging`. Omit the list to include all.
- `output_dir`: folder under `~/` or `/sdcard/`. Without it, files are returned as text only.
- `dry_run:false` to write. Preview is the default.

### Generated files

See the table above: `.env.example`, `.gitignore`, `index.js`/`bot.py`, `package.json`/`requirements.txt` and a bilingual `README.md`.

### Before starting

1. Copy `.env.example` to `.env` and put the real token only there.
2. Install dependencies with `npm install` or `pip install -r requirements.txt`.
3. Check the token with `getMe` (Telegram) or by watching `on_ready` (Discord).
4. Run `bot_audit` on the generated code before publishing.

### Polling versus webhook

- **Polling**: simpler, needs no domain, but only **one instance**. Two instances compete and cause `409 Conflict` on Telegram.
- **Webhook**: needs public HTTPS and a secret. Verify `X-Telegram-Bot-Api-Secret-Token` or Discord's Ed25519 signature. Scales without update contention.

### Production

- Inject the token as a service environment variable, not into the image or code.
- Keep a single polling process; use a manager that restarts it on failure.
- Implement graceful shutdown on `SIGTERM` to release the connection.
- Log without secrets: never print the token, only an identifier.
- Honour `retry_after` and `429` with exponential backoff.
