---
name: Revisión previa de mini apps / Mini app preflight
description: ES: Checklist antes de miniapp_sign o miniapp_install: manifest, permisos, uso de AntiGem.*, tamaño del bundle, consola, captura base y estado del backup de la clave. Emite un informe ✅/⚠️/❌. Solo skills, offline. EN: Preflight checklist before miniapp_sign or miniapp_install: manifest, permissions, AntiGem.* usage, bundle size, console, baseline screenshot and key backup status. Emits a ✅/⚠️/❌ report. Skills only, offline.
---

# Revisión previa de mini apps / Mini app preflight

## ES

Esta skill es la puerta de calidad antes de `miniapp_sign`, `miniapp_install` o dar una mini app por terminada. Usa las herramientas `miniapp_*` del **Mini App Developer MCP** (`miniapp_guide` sirve la documentación exacta de la versión instalada). No firma ni instala por ti: recoge evidencia, marca cada comprobación y deja una decisión explícita.

Si las herramientas `miniapp_*` no están disponibles, no improvises: pide al usuario que añada el preset **Mini App Developer** en los MCP del agente y reinicie el chat.

### Cuándo usarla

- Antes de firmar o instalar una mini app, o antes de exportar un paquete firmado.
- Después de cambiar `manifest.json`, permisos, icono o scripts.
- Cuando un paquete instalado falla justo después de instalarse.
- Antes de entregar una app a otra persona.

### Reglas que no se negocian

- Las herramientas de archivos, consola, `eval`, captura y permisos solo funcionan en **apps de desarrollo** (`~/mini-apps`). Nunca inspecciones ni modifiques una app instalada: eso rompería su firma.
- Los permisos los concede el usuario en el teléfono. El agente puede listar, reiniciar o denegar, pero **nunca conceder**.
- La contraseña de la clave se escribe solo en el teléfono. **Nunca la pidas ni la guardes.**
- Instalar siempre requiere que el usuario confirme en la pantalla del teléfono, incluso para un paquete recién firmado.
- No cambies el `id` para esquivar un conflicto: cambia la identidad y borra los datos. Usa otro `id` solo para una prueba paralela.

### Flujo de siete comprobaciones

1. **Inventario y clave.** `miniapp_list` → localiza la carpeta y revisa `kind`, `runs`, `broken`, conflictos de `id`, `developer_mode` y el estado de la clave. `miniapp_key_status` → `exists`, `developer`, `fingerprint`, `backed_up`. Si no hay clave: `miniapp_key_create` (una sola vez por teléfono). Si `backed_up` es falso: abre `miniapp_key_backup` y deja que el usuario escriba la contraseña en el teléfono; vuelve a comprobar con `miniapp_key_status`. ⚠️ una clave sin backup significa que las apps firmadas con ella no podrán actualizarse si se pierde.
2. **Manifest.** `miniapp_validate` → corrige todos los `errors` (bloquean la firma) y revisa los `warnings`. Comprueba además:
   - `manifest_version: 1`; `id` con `^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$` y estable; `name` y `version` presentes; `version` subida en cada release.
   - `version_code` entero (o cadena de dígitos) o ausente: se calcula desde `version`. Un sufijo pre-release (`1.2.3-beta`) **no** cambia el código.
   - `entry` existe; `icon` es PNG/JPEG/WebP cuadrado de al menos 192 px (un SVG no sirve); el script de `background` existe si se declara.
   - `theme_color` válido (`#rgb`, `#rrggbb`, un nombre de Android o `auto`). Usa la UI kit o las variables `--ag-*`; nunca fondos blancos/negros fijos. Prueba tema claro y oscuro.
   - Sin CDNs, fuentes ni scripts/estilos remotos: `miniapp_validate` marca las páginas que cargan recursos de internet. Empaquétalos en la carpeta.
   - `required_permissions` solo para lo imprescindible: un permiso no declarado se ignora, y uno requerido sin conceder impide que la app abra.
3. **Permisos.** `miniapp_permissions` (`list`) y los estados de `miniapp_list`. Declara solo lo que usas, con hosts y carpetas lo más estrechos posible. Atención a los warnings: `"storage"` en forma de lista se ignora, un nombre desconocido suele ser un typo, `"mcp": true` no declara nada, `network.hosts: []` y `localhost.ports: []` no permiten nada. Confirma que el código maneja `NotAllowedError` con un mensaje amable y que `*.ejemplo.com` no se usa para cubrir el dominio desnudo.
4. **Uso de `AntiGem.*`.** Repasa el código fuente: `AntiGem.ui` para diálogos, hojas, selectores y toasts; `AntiGem.onBack` para cerrar paneles; `AntiGem.storage` o IndexedDB para datos; rutas `data/…` o carpetas declaradas; hosts declarados también para redirecciones. No llames a `navigator.serviceWorker.register`, no incluyas `/_antigem/sdk.js` y usa rutas relativas. En el script de background no hay UI, `fs.pick`, `nav.push` ni diálogos; como máximo 10 tareas, intervalos ≥15 min, 48 ejecuciones al día y 60 s por ejecución.
5. **Tamaño y bundle.** `miniapp_read_file` sin `path` lista archivos y tamaños; `miniapp_validate` informa del tamaño de la app. `miniapp_write_files` admite hasta 10 MB por archivo. ⚠️ si el bundle incluye cachés (`net-cache/`, `thumbs/`), binarios grandes o recursos que no se usan.
6. **Consola y captura base.** `miniapp_open` → `miniapp_screenshot` (guarda la referencia visual: primer render, icono, tema) → `miniapp_console` con `level:"error"` y después con `since: now` para ver solo líneas nuevas. ❌ cualquier error, excepción no capturada o rechazo; ⚠️ los avisos de `manifest.json: …`. Usa `miniapp_eval` para verificar estado real (`AntiGem.storage`, permisos) cuando haga falta. Repite tras cada corrección hasta que la consola quede limpia.
7. **Decisión y firma.** Solo si no queda ningún ❌: `miniapp_sign` (comprueba la ruta del `.agapp`, `id`, `version`/`version_code`, `developer` y `fingerprint`) y después `miniapp_install` (revisa `action`: `new`, `update`, `reinstall` o `downgrade`; o `refused` con el motivo). Usa `wait_seconds` (≤180) si quieres esperar la confirmación. Recuerda que el usuario pulsa Instalar/Actualizar en el teléfono.

### Informe

Entrega siempre un bloque como este, con evidencia concreta (salida real de la herramienta, ruta o línea):

```markdown
## Preflight — <nombre> (<id>)

| # | Comprobación | Estado | Evidencia / acción |
| --- | --- | --- | --- |
| 1 | Inventario y clave | ✅/⚠️/❌ | … |
| 2 | Manifest | ✅/⚠️/❌ | … |
| 3 | Permisos | ✅/⚠️/❌ | … |
| 4 | AntiGem.* | ✅/⚠️/❌ | … |
| 5 | Bundle | ✅/⚠️/❌ | … |
| 6 | Consola y captura | ✅/⚠️/❌ | … |
| 7 | Firma e instalación | ✅/⚠️/❌ | … |

**Veredicto:** LISTO PARA FIRMAR / NO LISTO — <motivo>
```

Regla de decisión: cualquier ❌ bloquea la firma. Un ⚠️ se documenta y se acepta conscientemente, o se corrige. Nunca cambies un ❌ a ✅ sin volver a ejecutar la comprobación.

Si aparece un error concreto, abre `errores-comunes.md` para el diagnóstico y la solución; para profundizar, `miniapp_guide` con los temas `manifest`, `permissions`, `troubleshooting`, `signing-and-distribution` y `getting-started`.

## EN

This skill is the quality gate before `miniapp_sign`, `miniapp_install`, or calling a mini app finished. Use the `miniapp_*` tools of the **Mini App Developer MCP** (`miniapp_guide` serves the documentation matching the installed version). It does not sign or install for you: it gathers evidence, grades each check and leaves an explicit decision.

If the `miniapp_*` tools are unavailable, do not improvise: ask the user to add the **Mini App Developer** preset to the agent's MCP settings and restart the chat.

### When to use it

- Before signing, installing or exporting a signed package.
- After changing `manifest.json`, permissions, the icon or scripts.
- When an installed package fails right after installation.
- Before handing an app to somebody else.

### Non-negotiable rules

- File, console, `eval`, screenshot and permission tools only work on **development apps** (`~/mini-apps`). Never inspect or edit an installed app: that would break its signature.
- The user grants permissions on the phone. The agent may list, reset or deny them but **never grant** them.
- The key password is typed on the phone only. **Never ask for it or store it.**
- Installing always needs the user's confirmation on the phone, even for a package you just signed.
- Do not change the `id` to dodge a conflict: it changes identity and deletes data. Use another `id` only for a parallel test.

### Seven checks

1. **Inventory and key.** `miniapp_list` → find the folder and check `kind`, `runs`, `broken`, `id` conflicts, `developer_mode` and key status. `miniapp_key_status` → `exists`, `developer`, `fingerprint`, `backed_up`. With no key: `miniapp_key_create` (once per phone). If `backed_up` is false: open `miniapp_key_backup`, let the user type the password on the phone, then re-check with `miniapp_key_status`. ⚠️ an unbacked-up key means apps signed with it can never be updated if it is lost.
2. **Manifest.** `miniapp_validate` → fix every `error` (signing is blocked) and review `warnings`. Also check:
   - `manifest_version: 1`; a stable `id` matching `^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$`; `name` and `version` present; `version` bumped for each release.
   - `version_code` is a whole number (or a digit string) or omitted (computed from `version`). A pre-release suffix (`1.2.3-beta`) does **not** change the code.
   - `entry` exists; `icon` is a square PNG/JPEG/WebP of at least 192 px (SVG does not work); the `background` script exists if declared.
   - `theme_color` is valid (`#rgb`, `#rrggbb`, an Android color name or `auto`). Use the UI kit or `--ag-*` variables; never hard-code white/black backgrounds. Test light and dark themes.
   - No CDNs, web fonts or remote scripts/styles: `miniapp_validate` flags pages loading internet resources. Bundle them into the folder.
   - `required_permissions` only for what the app cannot work without: an undeclared permission is ignored, and a required one that isn't granted prevents the app from opening.
3. **Permissions.** `miniapp_permissions` (`list`) plus the states in `miniapp_list`. Declare only what you use, with the narrowest hosts and folders. Watch the warnings: `"storage"` in list form is ignored, an unknown name is usually a typo, `"mcp": true` declares nothing, `network.hosts: []` and `localhost.ports: []` allow nothing. Confirm the code handles `NotAllowedError` with a friendly message and that `*.example.com` isn't used to cover the bare domain.
4. **`AntiGem.*` usage.** Review the source: `AntiGem.ui` for dialogs, sheets, pickers and toasts; `AntiGem.onBack` to close in-page panels; `AntiGem.storage` or IndexedDB for data; `data/…` paths or declared folders; declared hosts for requests including redirects. Never call `navigator.serviceWorker.register`, never include `/_antigem/sdk.js`, use relative paths. In the background script there is no UI, `fs.pick`, `nav.push` or dialogs; at most 10 tasks, intervals ≥15 minutes, 48 runs per day and 60 seconds per run.
5. **Size and bundle.** `miniapp_read_file` without `path` lists files and sizes; `miniapp_validate` reports the app size. `miniapp_write_files` allows up to 10 MB per file. ⚠️ if the bundle contains caches (`net-cache/`, `thumbs/`), large binaries or unused assets.
6. **Console and baseline screenshot.** `miniapp_open` → `miniapp_screenshot` (keep the visual baseline: first render, icon, theme) → `miniapp_console` with `level:"error"` and again with `since: now` for new lines only. ❌ any error, uncaught exception or rejected promise; ⚠️ `manifest.json: …` warnings. Use `miniapp_eval` to check real state (`AntiGem.storage`, permissions) when needed. Repeat after every fix until the console is clean.
7. **Decision and signing.** Only with no ❌ left: `miniapp_sign` (check the `.agapp` path, `id`, `version`/`version_code`, `developer` and `fingerprint`), then `miniapp_install` (check `action`: `new`, `update`, `reinstall` or `downgrade`; or `refused` with its reason). Use `wait_seconds` (≤180) to wait for confirmation. The user still taps Install/Update on the phone.

### Report

Always deliver a block like this, with concrete evidence (real tool output, path or line):

```markdown
## Preflight — <name> (<id>)

| # | Check | Status | Evidence / action |
| --- | --- | --- | --- |
| 1 | Inventory and key | ✅/⚠️/❌ | … |
| 2 | Manifest | ✅/⚠️/❌ | … |
| 3 | Permissions | ✅/⚠️/❌ | … |
| 4 | AntiGem.* | ✅/⚠️/❌ | … |
| 5 | Bundle | ✅/⚠️/❌ | … |
| 6 | Console and screenshot | ✅/⚠️/❌ | … |
| 7 | Signing and install | ✅/⚠️/❌ | … |

**Verdict:** READY TO SIGN / NOT READY — <reason>
```

Decision rule: any ❌ blocks signing. A ⚠️ is documented and consciously accepted, or fixed. Never turn a ❌ into a ✅ without re-running the check.

For a specific error, open `errores-comunes.md` for diagnosis and fix; to go deeper, use `miniapp_guide` with the topics `manifest`, `permissions`, `troubleshooting`, `signing-and-distribution` and `getting-started`.
