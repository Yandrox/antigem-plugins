# Matriz de APIs / API matrix

## ES

Fuente: documentación del SDK de AntiGem (`chrome-api.md`, `antigem-api.md`, `mcp.md`, `lifecycle.md`). "Soportado" significa que el método hace lo que dice; un stub puede responder `undefined` o resolver sin efecto.

### Leyenda

| Símbolo | Significado |
| --- | --- |
| ✅ | Implementado con la semántica documentada. |
| ⚠️ | Implementado con límites importantes. |
| 🧊 | Stub: acepta la llamada o el listener, pero no produce efecto. |
| ❌ | No existe, no aplica o rechaza la llamada. |

Convenciones globales: salvo indicación contraria, los métodos devuelven Promise **y** aceptan un callback final; con callback no se devuelve Promise. Los eventos solo tienen `addListener`, `removeListener`, `hasListener` y `hasListeners`: **no** hay filtros ni argumentos de registro extra. Los valores se serializan a JSON: no pases funciones, DOM, ciclos ni BigInt (excepto `scripting.executeScript.func`). `chrome.antigm.*` usa **solo Promises**, sin callback.

### `chrome.runtime` y `chrome.extension`

| API | Estado | Detalle |
| --- | --- | --- |
| `runtime.id` | ✅ | ID estable del manifest. |
| `runtime.lastError` | ⚠️ | Solo existe dentro del callback y solo con `chrome.runtime.lastError.message`. |
| `runtime.getManifest()` | ✅ | Copia JSON síncrona del manifest. |
| `runtime.getURL(path)` | ⚠️ | URL con token por carga, **no** `chrome-extension://`. Los recursos HTML están bloqueados; no hardcodees la URL. |
| `runtime.sendMessage(...)` | ⚠️ | Solo dentro del mismo ID de extensión; el mensajeado entre extensiones rechaza. Prefiere objetos, no strings con `options`. |
| `runtime.connect(...)` | ⚠️ | Solo mismo ID; los `Port` son canales de mensajes, no puertos TCP. |
| `runtime.reload()` | ✅ | Recarga el worker; se pierden variables y trabajos en memoria. |
| `runtime.getPlatformInfo()` | ✅ | `{os:"android",arch,nacl_arch}`. |
| `runtime.getBrowserInfo()` | ⚠️ | Metadatos de AntiGem, no negociación de versión de Chromium. |
| `runtime.getContexts()` | ⚠️ | Devuelve contextos actuales; el filtro se ignora. |
| `runtime.onMessage` | ✅ | `(message, sender, sendResponse)`; devuelve `true` para responder después o una Promise. Primer response gana. Timeout 180 s. |
| `runtime.onConnect`, `onInstalled`, `onStartup` | ✅ | `onStartup` se dispara en cada carga, incluida una recarga. |
| `runtime.onMessageExternal`, `onSuspend` | 🧊 | Aceptan listeners pero no se disparan. |
| `runtime.openOptionsPage()` | ❌ | Sin UI de extensión. |
| `extension.getURL`, `extension.inIncognitoContext` | ✅/⚠️ | Alias de `runtime.getURL`; incógnito siempre `false`. |
| `connectNative`, `sendNativeMessage` | ❌ | Sin native messaging. |

### `chrome.storage` — permiso `storage`

| API | Estado | Detalle |
| --- | --- | --- |
| `local.get/set/remove/clear/getBytesInUse/getKeys` | ✅ | Persiste por ID estable. |
| `sync.*` | ⚠️ | Persiste localmente; **no** sincroniza con una cuenta de Google. |
| `session.*` | ⚠️ | Se reinicia cuando recarga esa extensión. |
| `storage.onChanged` y `area.onChanged` | ✅ | Se disparan tras diferencias reales; `oldValue`/`newValue` cuando están definidos. |

No hay cuotas ni modos trusted/untrusted emulados. Leer-modificar-escribir **no** es atómico: serializa las actualizaciones conflictivas en el worker. No hay `localStorage` ni IndexedDB en el worker: usa `chrome.storage`.

### `chrome.tabs`

| API | Estado | Detalle |
| --- | --- | --- |
| `query`, `get` | ✅ | Filtros `active`, `windowId`, `url`, `status`, `title`; el resto se ignora. |
| `create`, `update`, `remove`, `reload`, `goBack`, `goForward`, `duplicate` | ✅ | `create` abre una pestaña de layout escritorio; `duplicate` no copia el historial. |
| `getZoom`, `setZoom`, `getZoomSettings`, `setZoomSettings` | ⚠️ | `setZoomSettings` solo acepta `mode:"automatic"`; los bloqueos de automatización pueden impedir cambios. |
| `captureVisibleTab` | ⚠️ | Solo ventana 1/actual; devuelve data URL de la WebView. |
| `sendMessage`, `connect` | ⚠️ | Requieren acceso a la página; no inventan un listener `onMessage`. |
| `executeScript` (legacy) | ⚠️ | Solo `{code}` o `{file}` en el mundo ISOLATED del frame superior; prefiere `scripting.executeScript`. |
| `move`, `detectLanguage` | ❌ | Rechazan: no soportadas. |
| `onCreated`, `onUpdated`, `onRemoved`, `onActivated` | ⚠️ | Generadas por un poll de ~300 ms; pueden agrupar transiciones breves. |
| `onMoved`, `onZoomChange`, `onReplaced` | 🧊 | Inertes. |

Los IDs de pestaña los asigna el host y cambian al reiniciar: **no los persistas** como identificadores nativos. Hay una sola ventana (`windowId:1`; `-2` = actual). Las operaciones básicas no exigen el permiso `tabs`, pero inyectar en página sí exige host permission o `activeTab`.

### `chrome.scripting` — permiso `scripting` + host permission

| API | Estado | Detalle |
| --- | --- | --- |
| `executeScript` | ⚠️ | `{target:{tabId,…},func?,files?,args?,world?}`; exactamente una de `func`/`files`. `func` se serializa: **se pierden closures**. Por defecto ISOLATED; MAIN solo evalúa el documento superior. `documentIds` rechaza; `injectImmediately` se ignora. |
| `insertCSS`, `removeCSS` | ⚠️ | Nodo de estilo deduplicado en el documento superior; `origin`/`allFrames` se ignoran. |
| `registerContentScripts`, `getRegisteredContentScripts`, `updateContentScripts`, `unregisterContentScripts` | ⚠️ | Registros dinámicos en memoria; IDs duplicados rechazan. Vuelve a registrarlos al iniciar el worker. `run_at:"document_idle"` no es el idle completo de Chrome. |
| `world:"MAIN"` | ⚠️ | No tiene Chrome facade; el código de página puede observar tus ayudantes. |

Los `frameId` devueltos enumeran resultados y son índices temporales de un recorrido CDP, **no** identificadores persistentes. El frame superior (`0`) es el caso fiable. No pidas `allFrames` para automatización autenticada sin verificar cada destino: el chequeo de permisos se hace contra el documento superior.

Patrones de match: `<all_urls>`, http/https/file/ftp, esquemas comodín http+https y límites `*.host`. La ruta compara pathname + query, no fragmento. El acceso a `file:` depende de Android.

### `chrome.debugger` — permiso `debugger` + acceso a página

| API | Estado | Detalle |
| --- | --- | --- |
| `attach`, `detach`, `sendCommand`, `getTargets` | ✅/⚠️ | CDP real de la WebView; una extensión puede poseer el debugger de una pestaña. Timeout 180 s. Los targets son pestañas. |
| `onEvent`, `onDetach` | ✅ | Eventos CDP y desconexión. |

Para toques confiables usa `chrome.antigm.automation`: `element.click()` desde JS no tiene el mismo nivel de confianza que un touch nativo.

### Otros namespaces

| Namespace | Estado | Detalle |
| --- | --- | --- |
| `windows.*` | ⚠️ | Solo ventana 1. `get/getAll/getCurrent/getLastFocused/update/create` funcionan como compatibilidad; `create` añade pestañas a la ventana existente. `remove` rechaza; `onCreated/onRemoved/onFocusChanged` inertes. |
| `cookies.*` | ⚠️ | Permiso `cookies` + host + página abierta permitida. `get/getAll/set/remove/getAllCookieStores`; sin URL, `getAll` solo lee pestañas abiertas permitidas. Store 0 compartido. `onChanged` inerte. |
| `downloads.*` | ⚠️ | Permiso `downloads`. `download/search/cancel/erase/removeFile`; `open/show/getFileIcon` rechazan. Sin `saveAs`, headers ni `sameSite`/`partitionKey`. Archivos en `files/Downloads/<ID>/` con root privado. Eventos `onCreated/onChanged/onErased`; `onDeterminingFilename` inerte. |
| `alarms.*` | ⚠️ | Permiso `alarms`. `create/get/getAll/clear/clearAll`. Se disparan solo mientras la app esté viva; **no** despiertan el sistema. Usa timers de ms, no throttling de Chrome. |
| `permissions.*` | ⚠️ | `getAll/contains/request` comprueban permisos declarados; `request` **no abre diálogo**. `remove` rechaza. `onAdded/onRemoved` inertes. |
| `i18n.*` | ⚠️ | `getUILanguage()` = `"en"`, `getMessage`, `getAcceptLanguages()` = `["en"]`. `detectLanguage` es stub (`{isReliable:false,languages:[]}`). Sin fallback de locale. |
| `action` / `browserAction` | 🧊 | Solo metadatos en memoria: badge, título, icono, enable. Nada se dibuja; los valores por pestaña no se implementan. `setPopup/getPopup/openPopup` rechazan; `onClicked` inerte. |
| `sidePanel.*` | ❌ | Todos los métodos rechazan: sin panel lateral. |
| `webRequest`, `declarativeNetRequest`, `navigation`, `history`, `bookmarks`, `contextMenus`, `notifications`, `commands`, `identity`, `management`, `nativeMessaging` | ❌ | Namespaces ausentes. |

### `chrome.antigm.*` — permiso `antigemFiles`

Todas son Promises; requieren `antigemFiles`, también para automatización. La automatización además comprueba host permission de la pestaña activa.

| API | Detalle |
| --- | --- |
| `automation({tabId,busy?,locked?,tap?})` | Arrienda/renueva el lease con `busy:true` (renueva cada <60 s; Flow usa 15 s). `locked` no expira: libéralo explícitamente. `tap:{fx,fy}` son fracciones del viewport visible `[0,1]`, **no** coordenadas CSS de página. Usa `try/finally`. |
| `uploadFiles({tabId,files,selector?,point?,method?,timeoutMs?})` | 1–20 rutas locales; sube como una persona con selector o punto. `method:"auto"` usa el file chooser y cae a construir archivos en la página (≤25 MiB). Prefiere esto a `File`/`DataTransfer` o CDP. |
| `stat`, `readFile`, `writeFile`, `listFiles`, `copyFile` | Rutas absolutas del home del terminal, `~/...` o `/sdcard/...` si Android lo permite. `listFiles` limita a 500 por defecto y 2000 como máximo, incluye directorios y no ordena. `stat` devuelve `isFile`, no `isDirectory`. |
| `download({url,path,reuse?})` | Fetch Node-side: **no hereda cookies de la WebView**. Con `reuse`, reutiliza un archivo existente no vacío. |
| `mediaInfo`, `mediaFrame` | Usan MediaMetadataRetriever de Android; `mediaFrame` escribe un PNG junto al archivo. |

### Sustituciones habituales

| En vez de… | Usa… |
| --- | --- |
| `localStorage`, IndexedDB en el worker | `chrome.storage.local` |
| `document`, `window`, DOM en el worker | `chrome.scripting.executeScript` dentro de una pestaña permitida |
| `element.click()` para simular un usuario | `chrome.antigm.automation({tabId,tap:{fx,fy}})` |
| `File`/`DataTransfer` o `DOM.setFileInputFiles` a mano | `chrome.antigm.uploadFiles` |
| `fetch` con cookies de la WebView | `scripting.executeScript` en la página permitida |
| `chrome.tabs.executeScript` | `chrome.scripting.executeScript` |
| `webRequest` / `declarativeNetRequest` | No hay reglas de red nativas: intercepta en la página o replantea el flujo del tool |
| `notifications`, popup, options page, side panel | MCP tools y la UI de AntiGem |
| Mensajería cross-extension | Mensajería dentro del mismo ID; el agente coordina entre plugins |
| `chrome-extension://...` | `chrome.runtime.getURL(path)` sin hardcodear |
| `require`, `process`, módulos Node | Módulos ES relativos, `background.type:"module"` o bundles locales |
| IDs de pestaña persistentes | Consulta de nuevo con `tabs.query` |
| `downloads.open`, `show` | `chrome.antigm.download({url,path})` y reporta la ruta al usuario |
| `permissions.request` con diálogo | Declara permisos en el manifest; `request` solo comprueba |
| Alarmas que despiertan el sistema | `alarms` solo mientras la app esté viva; explica la limitación |
| `chrome.storage.sync` como nube | `chrome.storage.local` |

### Entorno JavaScript del worker

Disponibles: `chrome`, `browser` (alias), `self`, `globalThis`, `console`, timers, `fetch`, `URL`, `TextEncoder/Decoder`, `Blob`, `FormData`, `Request/Response/Headers`, `AbortController`, Web Crypto, `performance`, `structuredClone`, `atob/btoa`, eventos, `navigator`, `location`. WebSocket solo si el Node embebido lo proporciona; es cliente, no servidor.

Ausentes: DOM, `window`, `document`, `localStorage`, IndexedDB, `require`, `process`, imports de módulos arbitrarios y servidores HTTP/TCP listen. Los módulos estáticos y dinámicos deben ser relativos y estar dentro del paquete; la inicialización síncrona está limitada a 10 s. Un worker vive mientras viva el host: **no** se suspende por inactividad como en Chrome. Recargar o actualizar borra variables y `storage.session`, pero conserva `local`/`sync` y alarmas.

### Cómo detectar un stub

1. La llamada resuelve `undefined` y no hay efecto observable.
2. Un listener se registra (`hasListener` devuelve `true`) pero nunca se dispara.
3. El manifest acepta la clave pero la UI no muestra nada (`action`, `side_panel`, `options_page`).
4. El error es genérico o no aparece en `webview_extension_logs`.

Ante la duda, ejecuta una prueba mínima con `webview_extension_test` y comprueba el **efecto**, no solo la ausencia de excepción.

## EN

Source: AntiGem SDK docs (`chrome-api.md`, `antigem-api.md`, `mcp.md`, `lifecycle.md`). "Supported" means the method does what it says; a stub may resolve `undefined` or resolve with no effect.

### Legend

| Symbol | Meaning |
| --- | --- |
| ✅ | Implemented with the documented semantics. |
| ⚠️ | Implemented with important limits. |
| 🧊 | Stub: accepts the call or listener but has no effect. |
| ❌ | Missing, not applicable or rejecting. |

Global conventions: unless stated, methods return a Promise **and** accept a final callback; with a callback no Promise is returned. Events expose only `addListener`, `removeListener`, `hasListener` and `hasListeners`: **no** filters or extra registration arguments. Values are JSON-serialized: no functions, DOM objects, cycles or BigInts (except `scripting.executeScript.func`). `chrome.antigm.*` uses **Promises only**, no callbacks.

### `chrome.runtime` and `chrome.extension`

| API | Status | Detail |
| --- | --- | --- |
| `runtime.id` | ✅ | Stable manifest ID. |
| `runtime.lastError` | ⚠️ | Exists only inside the callback, with `chrome.runtime.lastError.message`. |
| `runtime.getManifest()` | ✅ | Synchronous JSON copy of the manifest. |
| `runtime.getURL(path)` | ⚠️ | Per-load tokenized URL, **not** `chrome-extension://`. HTML resources blocked; never hardcode it. |
| `runtime.sendMessage(...)` | ⚠️ | Same extension ID only; cross-extension messaging rejects. Prefer object messages over strings with `options`. |
| `runtime.connect(...)` | ⚠️ | Same ID only; `Port` is a message channel, not a TCP port. |
| `runtime.reload()` | ✅ | Reloads the worker; in-memory variables and jobs are lost. |
| `runtime.getPlatformInfo()` | ✅ | `{os:"android",arch,nacl_arch}`. |
| `runtime.getBrowserInfo()` | ⚠️ | AntiGem metadata, not Chromium version negotiation. |
| `runtime.getContexts()` | ⚠️ | Returns current contexts; the filter is ignored. |
| `runtime.onMessage` | ✅ | `(message, sender, sendResponse)`; return `true` to reply later or a Promise. First response wins. 180 s timeout. |
| `runtime.onConnect`, `onInstalled`, `onStartup` | ✅ | `onStartup` fires on every load, including reload. |
| `runtime.onMessageExternal`, `onSuspend` | 🧊 | Accept listeners but never fire. |
| `runtime.openOptionsPage()` | ❌ | No extension UI. |
| `extension.getURL`, `extension.inIncognitoContext` | ✅/⚠️ | Alias of `runtime.getURL`; incognito is always `false`. |
| `connectNative`, `sendNativeMessage` | ❌ | No native messaging. |

### `chrome.storage` — permission `storage`

| API | Status | Detail |
| --- | --- | --- |
| `local.get/set/remove/clear/getBytesInUse/getKeys` | ✅ | Persists per stable ID. |
| `sync.*` | ⚠️ | Persists locally; **does not** sync with a Google account. |
| `session.*` | ⚠️ | Resets when that extension reloads. |
| `storage.onChanged` and `area.onChanged` | ✅ | Fire after actual differences; `oldValue`/`newValue` when defined. |

No quotas or trusted/untrusted modes are emulated. Read-modify-write is **not** atomic: serialize conflicting updates in your worker. There is no `localStorage` or IndexedDB in the worker: use `chrome.storage`.

### `chrome.tabs`

| API | Status | Detail |
| --- | --- | --- |
| `query`, `get` | ✅ | Filters `active`, `windowId`, `url`, `status`, `title`; others ignored. |
| `create`, `update`, `remove`, `reload`, `goBack`, `goForward`, `duplicate` | ✅ | `create` opens a desktop-layout tab; `duplicate` does not copy browsing history. |
| `getZoom`, `setZoom`, `getZoomSettings`, `setZoomSettings` | ⚠️ | `setZoomSettings` accepts only `mode:"automatic"`; automation locks may prevent changes. |
| `captureVisibleTab` | ⚠️ | Window 1/current only; returns a WebView data URL. |
| `sendMessage`, `connect` | ⚠️ | Need page access; do not invent an `onMessage` listener. |
| `executeScript` (legacy) | ⚠️ | Only `{code}` or `{file}` in the top frame's ISOLATED world; prefer `scripting.executeScript`. |
| `move`, `detectLanguage` | ❌ | Reject: unsupported. |
| `onCreated`, `onUpdated`, `onRemoved`, `onActivated` | ⚠️ | Generated by a ~300 ms poll; brief transitions may be merged. |
| `onMoved`, `onZoomChange`, `onReplaced` | 🧊 | Inert. |

Tab IDs are host-assigned and change on restart: **do not persist them** as native identifiers. There is one window (`windowId:1`; `-2` = current). Basic tab operations need no `tabs` permission, but injecting into a page requires host permission or `activeTab`.

### `chrome.scripting` — permission `scripting` + host permission

| API | Status | Detail |
| --- | --- | --- |
| `executeScript` | ⚠️ | `{target:{tabId,…},func?,files?,args?,world?}`; exactly one of `func`/`files`. `func` is serialized: **closures are lost**. ISOLATED by default; MAIN evaluates the top document only. `documentIds` rejects; `injectImmediately` ignored. |
| `insertCSS`, `removeCSS` | ⚠️ | Deduplicated style node in the top document; `origin`/`allFrames` ignored. |
| `registerContentScripts`, `getRegisteredContentScripts`, `updateContentScripts`, `unregisterContentScripts` | ⚠️ | Memory-only dynamic registrations; duplicate IDs reject. Re-register on worker startup. `run_at:"document_idle"` is not Chrome's full idle scheduling. |
| `world:"MAIN"` | ⚠️ | No Chrome facade; page code can observe your helpers. |

Returned `frameId` values enumerate results and are temporary indices in a CDP walk, **not** persistent IDs. The top frame (`0`) is the dependable case. Do not request `allFrames` for authenticated automation without checking each target: permission is checked against the top document.

Match patterns: `<all_urls>`, http/https/file/ftp, wildcard http+https schemes and `*.host` boundaries. The path matches pathname + query, not fragment. `file:` access depends on Android.

### `chrome.debugger` — permission `debugger` + page access

| API | Status | Detail |
| --- | --- | --- |
| `attach`, `detach`, `sendCommand`, `getTargets` | ✅/⚠️ | Real WebView CDP; one extension may own a tab's debugger. 180 s deadline. Targets are tabs. |
| `onEvent`, `onDetach` | ✅ | CDP events and detachment. |

For trusted touches use `chrome.antigm.automation`: a JS `element.click()` does not carry the same trust as a native touch.

### Other namespaces

| Namespace | Status | Detail |
| --- | --- | --- |
| `windows.*` | ⚠️ | Window 1 only. `get/getAll/getCurrent/getLastFocused/update/create` work as compatibility shims; `create` adds tabs to the existing window. `remove` rejects; `onCreated/onRemoved/onFocusChanged` inert. |
| `cookies.*` | ⚠️ | Permission `cookies` + host + permitted open page. `get/getAll/set/remove/getAllCookieStores`; without URL, `getAll` reads permitted open tabs only. Shared store 0. `onChanged` inert. |
| `downloads.*` | ⚠️ | Permission `downloads`. `download/search/cancel/erase/removeFile`; `open/show/getFileIcon` reject. No `saveAs`, headers or `sameSite`/`partitionKey`. Files under `files/Downloads/<ID>/` with a private root. Events `onCreated/onChanged/onErased`; `onDeterminingFilename` inert. |
| `alarms.*` | ⚠️ | Permission `alarms`. `create/get/getAll/clear/clearAll`. Fire only while the app is alive; **no** OS wakeups. Millisecond JS timers, not Chrome throttling. |
| `permissions.*` | ⚠️ | `getAll/contains/request` check declared permissions; `request` **opens no dialog**. `remove` rejects. `onAdded/onRemoved` inert. |
| `i18n.*` | ⚠️ | `getUILanguage()` = `"en"`, `getMessage`, `getAcceptLanguages()` = `["en"]`. `detectLanguage` is a stub (`{isReliable:false,languages:[]}`). No locale fallback. |
| `action` / `browserAction` | 🧊 | In-memory metadata only: badge, title, icon, enable. Nothing is drawn; per-tab state is not implemented. `setPopup/getPopup/openPopup` reject; `onClicked` inert. |
| `sidePanel.*` | ❌ | All methods reject: no side panel. |
| `webRequest`, `declarativeNetRequest`, `navigation`, `history`, `bookmarks`, `contextMenus`, `notifications`, `commands`, `identity`, `management`, `nativeMessaging` | ❌ | Absent namespaces. |

### `chrome.antigm.*` — permission `antigemFiles`

All are Promises and require `antigemFiles`, including automation. Automation additionally checks the active tab's host permission.

| API | Detail |
| --- | --- |
| `automation({tabId,busy?,locked?,tap?})` | Acquires/renews the lease with `busy:true` (renew every <60 s; Flow uses 15 s). `locked` does not expire: release it explicitly. `tap:{fx,fy}` are visible-viewport fractions `[0,1]`, **not** page CSS coordinates. Use `try/finally`. |
| `uploadFiles({tabId,files,selector?,point?,method?,timeoutMs?})` | 1–20 local paths; uploads like a person picking files. `method:"auto"` uses the chooser and falls back to building files in the page (≤25 MiB). Prefer this to `File`/`DataTransfer` or CDP. |
| `stat`, `readFile`, `writeFile`, `listFiles`, `copyFile` | Absolute paths in the terminal home, `~/...` or `/sdcard/...` when Android allows. `listFiles` defaults to 500 and caps at 2000, includes directories and is unordered. `stat` returns `isFile`, not `isDirectory`. |
| `download({url,path,reuse?})` | Node-side fetch: **does not inherit WebView cookies**. With `reuse`, an existing nonempty file is reused. |
| `mediaInfo`, `mediaFrame` | Use Android MediaMetadataRetriever; `mediaFrame` writes a PNG beside the source. |

### Common substitutions

| Instead of… | Use… |
| --- | --- |
| `localStorage`, IndexedDB in the worker | `chrome.storage.local` |
| `document`, `window`, DOM in the worker | `chrome.scripting.executeScript` in a permitted tab |
| `element.click()` to simulate a user | `chrome.antigm.automation({tabId,tap:{fx,fy}})` |
| `File`/`DataTransfer` or `DOM.setFileInputFiles` by hand | `chrome.antigm.uploadFiles` |
| `fetch` with WebView cookies | `scripting.executeScript` inside the permitted page |
| `chrome.tabs.executeScript` | `chrome.scripting.executeScript` |
| `webRequest` / `declarativeNetRequest` | No native network rules: intercept in the page or rethink the tool flow |
| `notifications`, popup, options page, side panel | MCP tools and AntiGem's own UI |
| Cross-extension messaging | Messaging within the same ID; the agent coordinates plugins |
| `chrome-extension://...` | `chrome.runtime.getURL(path)` without hardcoding |
| `require`, `process`, Node modules | Relative ES modules, `background.type:"module"` or local bundles |
| Persistent tab IDs | Re-query with `tabs.query` |
| `downloads.open`, `show` | `chrome.antigm.download({url,path})` and report the path |
| `permissions.request` with a dialog | Declare permissions in the manifest; `request` only checks |
| Alarms that wake the OS | `alarms` while the app is alive only; state the limitation |

### Worker JavaScript environment

Available: `chrome`, `browser` (alias), `self`, `globalThis`, `console`, timers, `fetch`, `URL`, `TextEncoder/Decoder`, `Blob`, `FormData`, `Request/Response/Headers`, `AbortController`, Web Crypto, `performance`, `structuredClone`, `atob/btoa`, events, `navigator`, `location`. WebSocket exists only if the embedded Node provides it; it is a client, not a server.

Missing: DOM, `window`, `document`, `localStorage`, IndexedDB, `require`, `process`, arbitrary module imports and HTTP/TCP listen servers. Static and dynamic imports must be relative and inside the package; synchronous initialization is capped at 10 s. A worker lives as long as the host: it is **not** suspended for inactivity like in Chrome. Reload/update clears variables and `storage.session`, but keeps `local`/`sync` and alarms.

### How to spot a stub

1. The call resolves `undefined` and has no observable effect.
2. A listener registers (`hasListener` returns `true`) but never fires.
3. The manifest accepts a key but the UI shows nothing (`action`, `side_panel`, `options_page`).
4. The error is generic or absent from `webview_extension_logs`.

When in doubt, run a minimal probe with `webview_extension_test` and check the **effect**, not just the absence of an exception.
