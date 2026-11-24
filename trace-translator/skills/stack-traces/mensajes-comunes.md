# Mensajes de error comunes / Common error messages

## ES

Traducción en lenguaje claro y **siguiente paso concreto**. La tabla no sustituye la lectura del trace: confirma siempre el mensaje con un frame del proyecto. Si el texto exacto no aparece, explica el mecanismo sin inventar una causa.

### Java / Kotlin / Android

| Mensaje | Significa | Siguiente paso |
| --- | --- | --- |
| `NullPointerException` | Se usó una referencia que valía `null`. | Mira el primer frame del proyecto: comprueba esa variable con `?.` o `requireNotNull`. |
| `IndexOutOfBoundsException` | Se accede a una posición fuera del tamaño. | Comprueba `.size`/`length` antes de indexar; revisa índices en loops. |
| `ClassCastException` | Se fuerza un tipo que el objeto no tiene. | Imprime el tipo real (`it::class`) y valida antes del cast. |
| `IllegalArgumentException` | Un argumento no cumple lo que espera la función. | Revisa el valor exacto en el frame del proyecto y el contrato de la función. |
| `IllegalStateException` | La operación no es válida en el estado actual. | Comprueba ciclo de vida o inicialización: ¿se llamó antes de tiempo o dos veces? |
| `ConcurrentModificationException` | Se modifica una colección mientras se itera. | Copia la colección o usa un iterador que permita `remove`. |
| `NetworkOnMainThreadException` | Se hizo red en el hilo principal. | Envuelve la llamada en `withContext(Dispatchers.IO)` o muévela a un worker. |
| `Activity has leaked window ...` | Un dialog/ventana sigue abierto tras destruir la Activity. | Cierra el dialog en `onDestroy`/`onStop` y no guardes el `Context`. |
| `Unable to instantiate Activity` / `ClassNotFoundException` | El componente no está declarado o no tiene constructor público. | Revisa `AndroidManifest.xml` y el nombre completo de la clase. |
| `Permission denied` / `SecurityException` | Falta un permiso concedido en runtime. | Comprueba `checkSelfPermission` y el resultado de `requestPermissions`. |
| `SQLiteException: no such table` / `no such column` | El esquema de la base no coincide con la consulta. | Revisa migraciones y versión de `onUpgrade`. |
| `OutOfMemoryError` | No hay memoria para la operación (a menudo bitmaps o leak). | Reduce imágenes (`inSampleSize`), libera referencias y busca activitys filtradas. |
| `TransactionTooLargeException` | Un `Intent`/`Bundle` superó el límite del binder. | No pases listas grandes ni bitmaps por Intent; usa un repositorio o archivo. |
| `FATAL EXCEPTION: main` + `Fatal signal 11 (SIGSEGV)` | Crash nativo, no excepción Java. | Busca la librería en el tombstone; comprueba ABIs y libre de memoria nativa. |
| `ANR` / `Input dispatching timed out` | El hilo principal estuvo bloqueado. | Busca I/O, sleeps o loops largos en el hilo principal justo antes del ANR. |

### Dart / Flutter

| Mensaje | Significa | Siguiente paso |
| --- | --- | --- |
| `Null check operator used on a null value` | Se aplicó `!` a un valor `null`. | Mira el frame `package:` y cambia `!` por `?.` o comprueba antes. |
| `NoSuchMethodError: The getter 'x' was called on null` | Se llamó a un miembro de un objeto nulo (o inexistente). | Comprueba de dónde viene el objeto; valida antes de usar el getter. |
| `type 'X' is not a subtype of type 'Y'` | Un valor no tiene el tipo esperado, típico al parsear JSON. | Imprime el valor y valida el JSON con un modelo o `is` antes del cast. |
| `A RenderFlex overflowed by N pixels` | El contenido no cabe en el espacio disponible. | Usa `Expanded`/`Flexible`, `Wrap` o limita el texto; no es un crash lógico. |
| `_TypeError (type 'Null' is not a subtype of type 'String')` | Se esperaba un valor no nulo y llegó `null`. | Revisa el campo del JSON o el parámetro obligatorio que falta. |
| `Bad state: Future already completed` | Un `Completer` se completa dos veces. | Asegura una sola llamada a `complete`/`completeError`; guarda un flag. |
| `FormatException: Invalid date format` / `Unexpected character` | Falló el parseo de fecha/número/JSON. | Comprueba el locale y el formato exactos; valida la entrada antes de parsear. |
| `SocketException: Failed host lookup` / `Could not resolve host` | No se pudo resolver o alcanzar el servidor. | Verifica red, host y permiso `INTERNET`; no es un bug de UI. |
| `PlatformException(...)` | El código nativo devolvió un error (permiso, cámara, etc.). | Lee el `code` y los `details` del PlatformException; comprueba permisos. |
| `Another exception was thrown: ...` | Error secundario mientras se manejaba el primero. | **No lo tomes como causa**; busca la excepción original más arriba. |
| `Lost connection to device` | El proceso Flutter/Dart murió o se desconectó. | Mira logs nativos: suele ser OOM, crash nativo o hot reload inválido. |

### JavaScript / Node / navegador

| Mensaje | Significa | Siguiente paso |
| --- | --- | --- |
| `Cannot read properties of undefined (reading 'x')` | Se accede a una propiedad de `undefined`. | Mira la línea: comprueba el valor con `?.` o valida antes. |
| `TypeError: x is not a function` | El valor no es invocable. | Revisa el import y el tipo real; puede ser un default vs named export. |
| `ReferenceError: x is not defined` | La variable no existe en ese ámbito. | Falta declaración, import o hay typo; comprueba el frame del proyecto. |
| `UnhandledPromiseRejection` / `unhandled rejection` | Una promesa se rechazó sin `catch`. | Añade `.catch`/`try-await-catch` en la llamada que origina el rechazo. |
| `RangeError: Maximum call stack size exceeded` | Recursión infinita o ciclo en llamadas. | Busca la función que se llama a sí misma en los frames repetidos (×N). |
| `CORS policy: No 'Access-Control-Allow-Origin' header` | El servidor no permite el origen de la petición. | Configura el servidor o un proxy; no es un error del navegador. |
| `net::ERR_CONNECTION_REFUSED` / `ECONNREFUSED` | No hay nadie escuchando en ese host:puerto. | Comprueba que el servidor esté levantado y el puerto correcto. |
| `ENOTFOUND` / `EAI_AGAIN` | El DNS no resolvió el host. | Verifica el nombre del host y la conexión. |
| `ETIMEDOUT` | La conexión tardó demasiado. | Revisa timeouts, red y carga del servidor. |
| `EADDRINUSE` | El puerto ya está ocupado. | Cambia el puerto o cierra el proceso que lo usa. |
| `Cannot find module 'x'` | Falta la dependencia o la ruta es incorrecta. | Comprueba `package.json`, `npm install` y la ruta del import. |
| `ValidationError` / `ZodError` | Los datos de entrada no cumplen el esquema. | Mira el campo exacto del error y valida la fuente del dato. |
| `Hydration failed` / `Text content did not match` | El HTML del servidor difiere del cliente (React/Next). | Evita valores aleatorios/`Date.now()` en el primer render. |
| `Rendered more hooks than during the previous render` | Los hooks se llaman de forma condicional. | Mueve todos los hooks al inicio del componente, sin `if`. |

### Códigos HTTP frecuentes

| Código | Significa | Siguiente paso |
| --- | --- | --- |
| `400` | Petición mal formada. | Revisa el body/params contra el esquema de la API. |
| `401` | No autenticado. | Comprueba token, expiración y cabecera `Authorization`. |
| `403` | Autenticado pero sin permisos. | Revisa roles/alcances del token. |
| `404` | Recurso no encontrado. | Verifica la URL, el id y el método HTTP. |
| `409` | Conflicto (recurso ya existe / estado inválido). | Maneja el caso de duplicado o de transición de estado. |
| `429` | Demasiadas peticiones. | Respeta `Retry-After` y añade backoff. |
| `500` / `502` / `503` | Error del servidor o gateway. | Si persiste, es del backend; revisa el trace del servidor. |

## EN

Plain-language translation and a **concrete next step**. The table does not replace reading the trace: always confirm the message with a project frame. If the exact text is absent, explain the mechanism without inventing a cause.

### Java / Kotlin / Android

| Message | Meaning | Next step |
| --- | --- | --- |
| `NullPointerException` | A reference was `null` when used. | Check the first project frame: guard that variable with `?.` or `requireNotNull`. |
| `IndexOutOfBoundsException` | An index is outside the collection size. | Check `.size`/`length` before indexing; review loop bounds. |
| `ClassCastException` | A cast forces a type the object does not have. | Print the real type (`it::class`) and validate before casting. |
| `IllegalArgumentException` | An argument does not meet the function's contract. | Inspect the exact value in the project frame and the function contract. |
| `IllegalStateException` | The operation is invalid in the current state. | Check lifecycle or initialisation: was it called too early or twice? |
| `ConcurrentModificationException` | A collection changed while being iterated. | Copy the collection or use an iterator that supports `remove`. |
| `NetworkOnMainThreadException` | Network work ran on the main thread. | Wrap it in `withContext(Dispatchers.IO)` or move it to a worker. |
| `Activity has leaked window ...` | A dialog/window stayed open after the Activity was destroyed. | Dismiss it in `onDestroy`/`onStop` and do not store the `Context`. |
| `Unable to instantiate Activity` / `ClassNotFoundException` | Component not declared or no public constructor. | Check `AndroidManifest.xml` and the fully qualified class name. |
| `Permission denied` / `SecurityException` | A runtime permission was not granted. | Check `checkSelfPermission` and the `requestPermissions` result. |
| `SQLiteException: no such table` / `no such column` | DB schema does not match the query. | Review migrations and `onUpgrade` version. |
| `OutOfMemoryError` | Not enough memory (often bitmaps or a leak). | Downsample images (`inSampleSize`), release references, look for leaked activities. |
| `TransactionTooLargeException` | An `Intent`/`Bundle` exceeded the binder limit. | Do not pass large lists/bitmaps via Intent; use a repository or file. |
| `FATAL EXCEPTION: main` + `Fatal signal 11 (SIGSEGV)` | Native crash, not a Java exception. | Find the library in the tombstone; check ABIs and native memory. |
| `ANR` / `Input dispatching timed out` | The main thread was blocked. | Look for I/O, sleeps or long loops on the main thread just before the ANR. |

### Dart / Flutter

| Message | Meaning | Next step |
| --- | --- | --- |
| `Null check operator used on a null value` | `!` was applied to `null`. | Check the `package:` frame: replace `!` with `?.` or guard it. |
| `NoSuchMethodError: The getter 'x' was called on null` | A member was called on a null (or missing) object. | Trace where the object comes from; validate before the getter. |
| `type 'X' is not a subtype of type 'Y'` | A value has the wrong type, often from JSON parsing. | Print the value and validate with a model or `is` before casting. |
| `A RenderFlex overflowed by N pixels` | Content does not fit the available space. | Use `Expanded`/`Flexible`, `Wrap` or constrain the text; not a logic crash. |
| `_TypeError (type 'Null' is not a subtype of type 'String')` | A non-null value was expected but got `null`. | Check the JSON field or the missing required parameter. |
| `Bad state: Future already completed` | A `Completer` was completed twice. | Ensure a single `complete`/`completeError`; keep a flag. |
| `FormatException: Invalid date format` / `Unexpected character` | Date/number/JSON parsing failed. | Check the exact locale and format; validate input before parsing. |
| `SocketException: Failed host lookup` / `Could not resolve host` | DNS or connection failed. | Verify network, host and `INTERNET` permission; not a UI bug. |
| `PlatformException(...)` | Native code returned an error (permission, camera, etc.). | Read the `code` and `details`; check permissions. |
| `Another exception was thrown: ...` | Secondary error while handling the first one. | **Do not treat it as the cause**; find the original exception above. |
| `Lost connection to device` | The Flutter/Dart process died or disconnected. | Check native logs: usually OOM, native crash or invalid hot reload. |

### JavaScript / Node / browser

| Message | Meaning | Next step |
| --- | --- | --- |
| `Cannot read properties of undefined (reading 'x')` | A property was read from `undefined`. | Check the line: guard with `?.` or validate first. |
| `TypeError: x is not a function` | The value is not callable. | Check the import and real type; often default vs named export. |
| `ReferenceError: x is not defined` | The variable does not exist in this scope. | Missing declaration/import or a typo; check the project frame. |
| `UnhandledPromiseRejection` / `unhandled rejection` | A promise rejected with no `catch`. | Add `.catch`/`try-await-catch` at the call that originated it. |
| `RangeError: Maximum call stack size exceeded` | Infinite recursion or a call cycle. | Find the function calling itself in the repeated frames (×N). |
| `CORS policy: No 'Access-Control-Allow-Origin' header` | The server does not allow this origin. | Configure the server or use a proxy; not a browser bug. |
| `net::ERR_CONNECTION_REFUSED` / `ECONNREFUSED` | Nothing is listening on that host:port. | Check the server is up and the port is correct. |
| `ENOTFOUND` / `EAI_AGAIN` | DNS failed to resolve the host. | Verify the hostname and connectivity. |
| `ETIMEDOUT` | The connection took too long. | Review timeouts, network and server load. |
| `EADDRINUSE` | The port is already in use. | Change the port or stop the process using it. |
| `Cannot find module 'x'` | Missing dependency or wrong path. | Check `package.json`, `npm install` and the import path. |
| `ValidationError` / `ZodError` | Input data fails the schema. | Look at the exact field in the error and validate the source. |
| `Hydration failed` / `Text content did not match` | Server HTML differs from client (React/Next). | Avoid random values/`Date.now()` in the first render. |
| `Rendered more hooks than during the previous render` | Hooks are called conditionally. | Move all hooks to the top of the component, outside `if`. |

### Common HTTP codes

| Code | Meaning | Next step |
| --- | --- | --- |
| `400` | Malformed request. | Check body/params against the API schema. |
| `401` | Unauthenticated. | Check token, expiry and `Authorization` header. |
| `403` | Authenticated but unauthorised. | Check token roles/scopes. |
| `404` | Resource not found. | Verify URL, id and HTTP method. |
| `409` | Conflict (already exists / invalid state). | Handle the duplicate or state-transition case. |
| `429` | Too many requests. | Respect `Retry-After` and add backoff. |
| `500` / `502` / `503` | Server or gateway error. | If persistent, it is backend; check the server trace. |
