# Seguridad y auditoría / Security and audit

## ES

`bot_audit` hace análisis estático: lee el código y la configuración que le pasas, no ejecuta nada y no contacta con Telegram ni Discord. Es una red de seguridad antes de publicar, no un sustituto de revisar el diff.

### Configuración que entiende

```json
{
  "platform": "discord",
  "webhook": "https://example.com/hook",
  "webhook_secret": "valor-desde-secreto",
  "intents": ["Guilds", "GuildMessages", "MessageContent"],
  "permissions": ["8192"],
  "rate_limit_handling": true,
  "logging_token": false
}
```

Todos los campos son opcionales. Con `platform:"auto"` la herramienta detecta la plataforma por el código.

### Reglas implementadas

| ID | Severidad | Qué detecta |
| --- | --- | --- |
| `TELEGRAM_TOKEN_EMBEDDED` | critical | Token con formato `numero:cadena` dentro del código |
| `DISCORD_TOKEN_EMBEDDED` | critical | Token de tres segmentos separados por puntos |
| `DISCORD_WEBHOOK_EMBEDDED` | critical | URL de webhook de Discord con secreto |
| `LITERAL_SECRET` | high | Literal asignado a TOKEN/SECRET/PASSWORD/API_KEY/WEBHOOK |
| `SECRET_IN_LOG` | high | Token o secreto pasado a `console.log`, `print` o logging |
| `CONFIG_LOGGING_TOKEN` | high | `logging_token: true` en la configuración |
| `NO_ERROR_HANDLER` | medium | No hay `try/catch`, `.on('error')` ni manejador equivalente |
| `PRIVILEGED_INTENTS` | medium | Intents privilegiados sin activar en el portal |
| `BROAD_PERMISSIONS` | high | ADMINISTRATOR (8) o permisos amplios |
| `WEBHOOK_INSECURE` | critical | Webhook con `http://` |
| `WEBHOOK_NO_SECRET` | medium | Webhook sin `webhook_secret` |
| `POLLING_AND_WEBHOOK` | high | `setWebhook` y polling activados a la vez |
| `NO_RATE_LIMIT_HANDLING` | medium | No hay `retry_after`, `429` ni retroceso |
| `TOKEN_NOT_FROM_ENV` | medium | El token no viene de `process.env` o `getenv` |

### Cómo actuar

1. **Critical**: asume que el secreto está comprometido. Revoca el token (`/revoke` en BotFather, reset en Discord) o elimina el webhook, y reemplázalo antes de seguir.
2. **High**: corrígelo antes del despliegue. Baja permisos, saca el secreto a un entorno y añade manejo de errores.
3. **Medium**: planifícalo. Afecta a robustez y a límites, no necesariamente a la seguridad inmediata.
4. `result.passed` es `true` solo cuando no hay hallazgos critical ni high.

### Limitaciones

Es un análisis por patrones: puede dar falsos positivos con tokens de ejemplo y puede no detectar secretos ofuscados. No sustituye a un escáner de secretos del repositorio ni a la revisión humana. La salida incluye el número de línea cuando está disponible para que localices el problema.

## EN

`bot_audit` performs static analysis: it reads the code and config you pass, executes nothing and contacts neither platform. It is a safety net before publishing, not a replacement for reviewing the diff.

### Config it understands

Same JSON as above. All fields are optional. With `platform:"auto"` the platform is detected from the code.

### Rules implemented

See the table above for IDs, severities and descriptions.

### How to act

1. **Critical**: assume the secret is compromised. Revoke the token (`/revoke` in BotFather, reset in Discord) or delete the webhook, and replace it before continuing.
2. **High**: fix before deploying. Reduce permissions, move the secret to an environment variable and add error handling.
3. **Medium**: plan it. It affects robustness and limits, not necessarily immediate security.
4. `result.passed` is `true` only when there are no critical or high findings.

### Limitations

It is pattern-based: example tokens may trigger false positives and obfuscated secrets may be missed. It does not replace a repository secret scanner or human review. Output includes the line number when available.
