# Rotación y limpieza / Rotation and cleanup

## ES

Estos pasos son **orientación offline**: no hacen llamadas a ningún proveedor. Ejecútalos tú en la consola web de cada servicio. Orden importante: **revoca → emite nuevas → actualiza el almacén seguro → limpia el repo y el historial → verifica**.

### Por proveedor

| Patrón | Revocar | Emitir / verificar |
| --- | --- | --- |
| `openai` | Revoca la clave en la consola de OpenAI. | Crea una nueva, guárdala en el gestor de secretos, revisa uso y facturación de la antigua. |
| `github` | Revoca el token en Settings → Developer settings. | Crea uno con el ámbito mínimo; actualiza Actions y los secrets de los repos. |
| `aws` | Desactiva la clave en IAM → revisa CloudTrail por uso inesperado. | Crea una nueva con permisos mínimos; prefiere roles temporales sobre claves permanentes. |
| `google-api` | Desactiva la clave en Google Cloud Console. | Crea una restringida por API y por dominio/IP; comprueba cuotas. |
| `google-oauth` | Revoca tokens y sesiones. | Vuelve a autorizar con el ámbito mínimo. |
| `slack` | Revoca el token en la configuración de la app. | Reinstala la app con scopes mínimos. |
| `stripe` | Revoca la clave live en el dashboard. | Genera otra, restringe permisos y revisa eventos recientes. |
| `telegram` | Envía `/revoke` al BotFather. | Guarda el nuevo token fuera del repo; actualiza el bot. |
| `npm` | Revoca el token en npmjs.com. | Publica uno granular con solo el ámbito necesario. |
| `sendgrid` | Revoca la clave en SendGrid. | Crea una con permisos mínimos. |
| `jwt` | Rota el secreto de firma y las claves de verificación. | Invalida los tokens emitidos y fuerza nuevo login; revisa la expiración. |
| `private-key` | Genera un par nuevo. | Sustituye la clave pública donde se desplegó; descarta la antigua y revisa logs de acceso. |
| `google-service` | Deshabilita la cuenta de servicio. | Crea otra con roles mínimos y elimina la clave antigua. |
| `bearer` / `basic-auth` | Revoca el token o cambia la contraseña. | Vuelve a autenticar con el ámbito mínimo. |
| `url-credentials` | Cambia la contraseña. | Quita las credenciales de la URL y usa variables de entorno. |
| `password-literal` / `secret-literal` | Rota el valor en el sistema correspondiente. | Muévelo al gestor de secretos y añade la ruta a `.gitignore`. |
| `hex-secret` | Rota el valor. | Elimina el literal del código y usa una variable de entorno. |

### Limpiar el historial de Git

Cambiar el archivo en un commit nuevo **no** elimina el secreto: sigue en commits anteriores. Si el repo es público, trata la clave como comprometida aunque borres el historial.

1. **Avisa al equipo** y congela los pushes: todos deben saber que habrá force-push.
2. **Reescribe el historial** con `git filter-repo` (recomendado) o BFG:
   ```bash
   git filter-repo --replace-text replacements.txt
   ```
   donde `replacements.txt` contiene `SECRETO_REAL==>REDACTED`. No pegues el secreto en logs ni en el chat.
3. **Fuerza el push** de todas las ramas y tags: `git push --force --all` y `git push --force --tags`.
4. **Pide a cada colaborador** que vuelva a clonar o que haga `git reset --hard origin/main`; sus clones locales siguen sucios.
5. **Limpia cachés y forks**: GitHub puede conservar objetos en caché y los forks tienen su propio historial. Contacta al soporte si hace falta.
6. **Verifica**: vuelve a escanear el repo y busca el valor redactado en `git log -S`.

### Prevención

- `.gitignore` con `.env`, `*.key`, `*.pem`, `config/secrets.*`, `local.properties`.
- Un `.env.example` con claves ficticias y nunca valores reales.
- Variables de entorno o un gestor de secretos del dispositivo; nunca literales en código.
- Ejecuta `secrets_scan` antes de cada `git push` y revisa el diff con `code-review-offline`.
- Si un secreto apareció en CI logs, rota también los tokens de logging y restringe quién puede ver los logs.

### Límites

- La detección es por patrones: una clave con formato nuevo puede no aparecer.
- Los valores se redactan en el informe, pero **no se ha comprobado su validez**; decide tú en el proveedor.
- Un falso positivo no autoriza a ignorar otros hallazgos del mismo archivo.

## EN

These steps are **offline guidance**: they make no provider calls. Perform them in each service's web console. Order matters: **revoke → issue new ones → update the secret store → clean the repo and history → verify**.

### By provider

| Pattern | Revoke | Issue / verify |
| --- | --- | --- |
| `openai` | Revoke the key in the OpenAI console. | Create a new one, store it in the secret manager, review usage and billing of the old one. |
| `github` | Revoke the token in Settings → Developer settings. | Create a least-scope token; update Actions and repo secrets. |
| `aws` | Deactivate the key in IAM → review CloudTrail for unexpected use. | Issue a new least-privilege key; prefer temporary roles over permanent keys. |
| `google-api` | Disable the key in Google Cloud Console. | Create one restricted by API and domain/IP; check quotas. |
| `google-oauth` | Revoke tokens and sessions. | Re-authorise with the minimum scope. |
| `slack` | Revoke the token in the app configuration. | Reinstall the app with minimal scopes. |
| `stripe` | Revoke the live key in the dashboard. | Generate another, restrict permissions and review recent events. |
| `telegram` | Send `/revoke` to BotFather. | Store the new token outside the repo; update the bot. |
| `npm` | Revoke the token on npmjs.com. | Publish a granular token with only the needed scope. |
| `sendgrid` | Revoke the key in SendGrid. | Create a least-privilege one. |
| `jwt` | Rotate the signing secret and verification keys. | Invalidate issued tokens, force re-login, review expiry. |
| `private-key` | Generate a new keypair. | Replace the public key where deployed; discard the old one and review access logs. |
| `google-service` | Disable the service account. | Create another with minimal roles and delete the old key. |
| `bearer` / `basic-auth` | Revoke the token or change the password. | Re-authenticate with minimum scope. |
| `url-credentials` | Change the password. | Remove credentials from the URL and use environment variables. |
| `password-literal` / `secret-literal` | Rotate the value in the relevant system. | Move it to the secret manager and add the path to `.gitignore`. |
| `hex-secret` | Rotate the value. | Remove the literal from code and use an environment variable. |

### Clean Git history

Changing the file in a new commit does **not** remove the secret: it remains in earlier commits. If the repo is public, treat the key as compromised even after cleaning history.

1. **Tell the team** and freeze pushes: everyone must know a force-push is coming.
2. **Rewrite history** with `git filter-repo` (recommended) or BFG:
   ```bash
   git filter-repo --replace-text replacements.txt
   ```
   with `REAL_SECRET==>REDACTED` in `replacements.txt`. Do not paste the secret into logs or chat.
3. **Force-push** all branches and tags: `git push --force --all` and `git push --force --tags`.
4. **Ask every collaborator** to re-clone or run `git reset --hard origin/main`; their local clones are still dirty.
5. **Clean caches and forks**: GitHub may retain cached objects and forks have their own history. Contact support if needed.
6. **Verify**: scan the repo again and search the redacted value in `git log -S`.

### Prevention

- `.gitignore` with `.env`, `*.key`, `*.pem`, `config/secrets.*`, `local.properties`.
- A `.env.example` with fictitious keys and never real values.
- Environment variables or an on-device secret manager; never literals in code.
- Run `secrets_scan` before every `git push` and review the diff with `code-review-offline`.
- If a secret appeared in CI logs, rotate logging tokens too and restrict who can view logs.

### Limits

- Detection is pattern-based: a novel key format may not appear.
- Values are redacted in the report, but **validity was not checked**; that is your decision at the provider.
- A false positive does not justify ignoring other findings in the same file.
