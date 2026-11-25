# Errores comunes / Common errors

## ES

Fuente: `miniapp_guide` (`troubleshooting`, `manifest`, `permissions`, `api-reference`, `background`, `signing-and-distribution`). Lee el mensaje exacto antes de aplicar una solución; aquí están los casos que aparecen con más frecuencia en un preflight.

### Antes de abrir la app

| Síntoma | Causa | Solución |
| --- | --- | --- |
| La carpeta aparece en rojo: `<folder> isn't an app: manifest.json: …` | JSON inválido (coma final, comentario, comilla que falta) o `id`/`shared_id` que no cumple la regex. | Corrige el JSON; usa letras, dígitos, `.`, `_`, `-`, empezando por letra o dígito, 1–100 caracteres. |
| `its id <id> is already used by ~/mini-apps/<otra>` | Dos carpetas de desarrollo comparten `id`; gana la primera en orden alfabético. | Dale un `id` único a cada app. |
| `its id <id> belongs to an installed (signed) app` | Ya hay una app instalada con ese `id`. | Cambia el `id` de la carpeta de desarrollo o desinstala la app instalada (se borran sus datos). |
| `<App> is a development app … Development apps only run with Developer mode on` | Modo desarrollador desactivado. | Activa `</>` en la barra de Mini Apps. `miniapp_list` muestra `developer_mode`. |
| `<App> can't run without …` | Un permiso de `required_permissions` no está concedido. | Pulsa **Review permissions** o quita esa entrada de `required_permissions` si la app puede funcionar sin ella. |
| `miniapp_open` agota los 12 s | Suele haber un diálogo de permisos en pantalla o un permiso requerido bloqueando. | `miniapp_screenshot`, responde al diálogo en el teléfono o revisa permisos. El agente no puede concederlos. |
| La app no aparece tras crearla | El archivo no se llama exactamente `manifest.json` o está en una subcarpeta; la carpeta empieza con `.`. | Corrige la ruta o el nombre y pulsa el icono de actualizar en Mini Apps. |

### Permisos y manifiesto

| Mensaje / aviso | Causa | Solución |
| --- | --- | --- |
| `"<name>" permission is undeclared` | Falta en `permissions` o el nombre está mal escrito. | Añádelo; vigila los avisos `manifest.json: Unknown permission "…" ignored`. |
| `"<name>" permission is prompt` | Permiso nuevo o ampliado, aún no decidido. | `AntiGem.permissions.request(name)`; el usuario responde en el teléfono. |
| `"<name>" permission is denied` | El usuario lo rechazó. | Vuelve a pedirlo con `request()` o activearlo en App info. |
| `Network request to <host> blocked: the app has no "network" permission` | No se declaró `network`. | Declara `network` con los hosts exactos; recuerda los hosts de redirecciones. |
| `… <host> is not in the manifest's network hosts` | El host falta en `hosts`, o se usó `*.dominio` para el dominio desnudo. | Añade el host; `*.example.com` no cubre `example.com`. |
| `… the manifest's network hosts list is empty` | `"hosts": []` no permite ningún host. | Lista los hosts u omite `hosts` para permitir cualquiera. |
| `… localhost port <n> is not in the manifest` / `port <n> belongs to AntiGem` | Falta el puerto en `localhost.ports`, o es un puerto interno de AntiGem. | Declara el puerto o usa otro. |
| `Reading or writing <path> needs a "storage" folder in the manifest` | Ruta fuera de `data/…` sin declarar. | Declara la carpeta en `storage.folders` con el `access` correcto (`read`, `write`, `readwrite`) o usa `data/…`. |
| `<path> is protected` | Ruta inalcanzable: carpetas ocultas del home, datos de otras apps, fuera de home o `/sdcard`. | No intentes acceder; usa `data/…` o pide al usuario un archivo con `fs.pick`. |
| `Unknown permission "notification" ignored`, `"storage"` en lista, `"mcp": true`, `hosts: []`, `ports: []` | Entradas que AntiGem ignora, con aviso en consola y en `miniapp_validate.warnings`. | Corrige la forma: `notifications`, `storage` como objeto, `mcp: ["servidor"]`, listas no vacías. |
| `"version_code" must be a whole number (got …)` | `version_code` decimal, negativo, texto o `null`. | Usa un entero o cadena de dígitos, o omítelo. |
| El icono no se ve como/images | `icon` apunta a un SVG, a un archivo inexistente o la imagen no es cuadrada ≥192 px. | Usa PNG/JPEG/WebP cuadrado de 192 px o más. Sin icono válido se muestra una letra. |
| La app abre en blanco | `entry` no existe o un recurso relativo apunta mal. | Comprueba `entry` y las rutas; `/x.js` significa la raíz de la carpeta; las rutas sin extensión caen en `entry`. |

### Errores de ejecución

| Error | Causa típica | Solución |
| --- | --- | --- |
| `NotSupportedError` | Llamada de UI desde el background, método desconocido o `navigator.serviceWorker.register`. | Mueve la llamada a una página; service workers no están soportados. |
| `InvalidStateError` | Escritura en una carpeta con `fs.write`, borrado de carpeta no vacía sin `recursive`, o `background.run()` sin script declarado. | Corrige la operación o declara `background` en el manifest. |
| `QuotaExceededError` | Más de 12 notificaciones, 10 tareas de background o `fs.read` de un archivo >64 MB. | Reduce la cantidad o lee por fragmentos. |
| `AbortError` | Petición o trabajo de thread cancelado. | Maneja la cancelación en tu lógica. |
| `TypeError` | Argumentos incorrectos, URL inválida o fallo de red en `fetch`. | Revisa la llamada y los hosts declarados. |
| Recursos 404/bloqueados en consola | Script, hoja de estilos o fuente remota no empaquetada y sin permiso `network`. | Bundlea los recursos; no dependas de CDNs en una app offline. |
| Tareas de background omitidas | Falta permiso `background` o script, se alcanzaron 48 ejecuciones/día, `every` <15 min o el handler superó 60 s. | Declara permiso y script, espacia las tareas y termina el trabajo antes de resolver la Promise. |

### Firma e instalación

| Síntoma | Causa | Solución |
| --- | --- | --- |
| `miniapp_sign` se niega | `miniapp_validate` devolvió `errors`. | Corrige todos los errores y vuelve a validar antes de firmar. |
| `refused`: firmada por otro desarrollador | La clave no coincide con la de la app instalada. | Solo el desarrollador original puede actualizar; desinstala primero si confías en el paquete (se borran los datos). |
| `refused`: hay una app de desarrollo con ese `id` | Un paquete no puede tomar el `id` de una carpeta en `~/mini-apps`. | Cambia el `id` de la carpeta o elimínala, luego instala. |
| `refused`: `shared_id` firmado por otro desarrollador | Apps de un grupo de datos compartidos con claves distintas. | Usa la misma clave para todas las apps del grupo (`miniapp_list` muestra los grupos). |
| `Reinstall` o `Downgrade` en vez de `Update` | `version_code` igual o menor al instalado. | Sube `version` (o `version_code`) antes de firmar. |
| `403 Modified file` o la app aparece como *modified* | Se cambió un archivo de una app instalada. | No edites apps instaladas: recompila, sube la versión, firma e instala de nuevo. |
| Aviso de clave sin backup | `miniapp_key_status.backed_up` es falso. | Abre `miniapp_key_backup`; el usuario elige contraseña (≥8 caracteres) **en el teléfono** y guarda el `.agkey` de `Download/AntiGem/` en otro lugar. Nunca pidas la contraseña al modelo. |
| No se puede instalar en el mismo teléfono donde se desarrolla | El `id` de la app de desarrollo bloquea al paquete firmado. | Prueba con otro `id` o elimina la carpeta de desarrollo antes de instalar. |

## EN

Source: `miniapp_guide` (`troubleshooting`, `manifest`, `permissions`, `api-reference`, `background`, `signing-and-distribution`). Read the exact message before applying a fix; these are the cases that show up most often during preflight.

### Before the app opens

| Symptom | Cause | Fix |
| --- | --- | --- |
| Folder shown in red: `<folder> isn't an app: manifest.json: …` | Invalid JSON (trailing comma, comment, missing quote) or an `id`/`shared_id` failing the regex. | Fix the JSON; use letters, digits, `.`, `_`, `-`, starting with a letter or digit, 1–100 characters. |
| `its id <id> is already used by ~/mini-apps/<other>` | Two development folders share an `id`; the alphabetically first wins. | Give each app a unique `id`. |
| `its id <id> belongs to an installed (signed) app` | An installed app already owns that `id`. | Change the development folder's `id` or uninstall the installed app (its data is deleted). |
| `<App> is a development app … Development apps only run with Developer mode on` | Developer mode is off. | Tap `</>` in the Mini Apps top bar. `miniapp_list` shows `developer_mode`. |
| `<App> can't run without …` | A `required_permissions` entry isn't granted. | Tap **Review permissions**, or remove the entry if the app can work without it. |
| `miniapp_open` times out after 12 s | Usually a permission prompt on screen or a required permission blocking the app. | `miniapp_screenshot`, answer the dialog on the phone, or review permissions. The agent cannot grant them. |
| The app doesn't appear after creation | The file isn't exactly `manifest.json`, is in a subfolder, or the folder starts with `.`. | Fix the path or name and tap refresh in Mini Apps. |

### Permissions and manifest

| Message / warning | Cause | Fix |
| --- | --- | --- |
| `"<name>" permission is undeclared` | Missing from `permissions`, or misspelled. | Add it; watch `manifest.json: Unknown permission "…" ignored` warnings. |
| `"<name>" permission is prompt` | New or widened permission, not decided yet. | `AntiGem.permissions.request(name)`; the user answers on the phone. |
| `"<name>" permission is denied` | The user said no. | Ask again with `request()`, or enable it in App info. |
| `Network request to <host> blocked: the app has no "network" permission` | `network` wasn't declared. | Declare `network` with exact hosts; remember redirect hosts too. |
| `… <host> is not in the manifest's network hosts` | Missing host, or `*.domain` used for the bare domain. | Add the host; `*.example.com` does not cover `example.com`. |
| `… the manifest's network hosts list is empty` | `"hosts": []` allows no host. | List the hosts, or omit `hosts` to allow any. |
| `… localhost port <n> is not in the manifest` / `port <n> belongs to AntiGem` | Missing port in `localhost.ports`, or an AntiGem-internal port. | Declare the port or use another one. |
| `Reading or writing <path> needs a "storage" folder in the manifest` | Path outside `data/…` and undeclared. | Declare the folder in `storage.folders` with the right `access` (`read`, `write`, `readwrite`), or use `data/…`. |
| `<path> is protected` | Unreachable path: hidden home folders, other apps' data, outside home or `/sdcard`. | Don't try to access it; use `data/…` or ask the user via `fs.pick`. |
| `Unknown permission "notification" ignored`, `"storage"` in list form, `"mcp": true`, `hosts: []`, `ports: []` | Entries AntiGem ignores, warned about in the console and `miniapp_validate.warnings`. | Fix the shape: `notifications`, `storage` as an object, `mcp: ["server"]`, non-empty lists. |
| `"version_code" must be a whole number (got …)` | Decimal, negative, text or `null` `version_code`. | Use an integer or digit string, or omit it. |
| Icon missing or wrong | `icon` points to SVG, a missing file, or a non-square image under 192 px. | Use a square PNG/JPEG/WebP of at least 192 px. Without a valid icon a letter tile is shown. |
| Blank app | `entry` doesn't exist or a relative resource path is wrong. | Check `entry` and paths; `/x.js` means the folder root; extensionless paths fall back to `entry`. |

### Runtime errors

| Error | Typical cause | Fix |
| --- | --- | --- |
| `NotSupportedError` | UI call from the background page, unknown method, or `navigator.serviceWorker.register`. | Move the call to a page; service workers aren't supported. |
| `InvalidStateError` | `fs.write` to a folder, deleting a non-empty folder without `recursive`, or `background.run()` with no script. | Fix the operation or declare `background` in the manifest. |
| `QuotaExceededError` | More than 12 notifications, 10 background tasks, or `fs.read` of a file over 64 MB. | Reduce the count or read in chunks. |
| `AbortError` | A request or thread job was aborted. | Handle cancellation in your logic. |
| `TypeError` | Bad arguments, invalid URL or a `fetch` network failure. | Review the call and declared hosts. |
| 404/blocked assets in the console | A script, stylesheet or font wasn't bundled and `network` isn't declared. | Bundle the assets; don't rely on CDNs in an offline app. |
| Background runs skipped | Missing `background` permission or script, 48 runs/day reached, `every` under 15 minutes, or a handler over 60 s. | Declare permission and script, space tasks out, finish work before the Promise resolves. |

### Signing and installation

| Symptom | Cause | Fix |
| --- | --- | --- |
| `miniapp_sign` refuses | `miniapp_validate` returned `errors`. | Fix every error and validate again before signing. |
| `refused`: signed by a different developer | Key doesn't match the installed app's key. | Only the original developer can update it; uninstall first if you trust the package (data is deleted). |
| `refused`: a development app owns that `id` | A package can't take the `id` of a folder in `~/mini-apps`. | Change the folder's `id` or delete it, then install. |
| `refused`: `shared_id` signed by another developer | Apps in a shared-data group signed with different keys. | Use the same key for every app in the group (`miniapp_list` shows the groups). |
| `Reinstall` or `Downgrade` instead of `Update` | `version_code` equal to or lower than the installed one. | Bump `version` (or `version_code`) before signing. |
| `403 Modified file` or a *modified* label | A file of an installed app was changed. | Never edit installed apps: rebuild, bump the version, sign and install again. |
| Unbacked-up key warning | `miniapp_key_status.backed_up` is false. | Open `miniapp_key_backup`; the user chooses a password (≥8 chars) **on the phone** and stores the `.agkey` from `Download/AntiGem/` elsewhere. Never ask the model for the password. |
| Can't install on the development phone | The development app's `id` blocks the signed package. | Test with another `id` or remove the development folder before installing. |
