# Recolección de observaciones / Collecting observations

## ES

La tool lee archivos, pero **no puede preguntar a otros MCP si están vivos**. Tú eres quien observa el estado real con las tools nativas y se lo pasa en `observed`. No rellenes nada con suposiciones: un dato inventado convierte el informe en mentira.

### 1. Inventario de extensiones

```js
const t = tools.custom_plugin_developer_mcp;
const list = await t.webview_extension_list({refresh:true});
```

De cada entrada de `list.extensions` guarda: `id`, `name`, `version`, `isEnabled`, `toolCount`, `skillCount`, `hostError` y `dirPath`. De `list.projects` guarda los IDs de borradores.

- Si no puedes llamar a esta tool, **dilo**; no sustituyas el inventario por una lista imaginaria.
- La tool `mcp_health` ya lee `~/extensions` y `~/extension-projects` por su cuenta: este paso aporta el estado `enabled/loaded` y los errores del host, que los archivos no contienen.

### 2. Servidores declinados

Cuando el catálogo de tools en Code Mode devuelva `Permission.DeclinedError`, anota el namespace exacto:

```json
{"declined":[{"server":"custom_plugin_developer_mcp","error":"Permission.DeclinedError"}]}
```

- Usa el **namespace**, no el nombre de una tool suelta.
- No deduzcas que un servidor está declinado porque no aparece en una búsqueda: puede estar desactivado o sin tools.

### 3. Servidores no disponibles

Si una llamada falla por timeout, conexión o "unknown tool", regístralo:

```json
{"unreachable":[{"server":"jarvis_mcp","error":"timeout after 30s"}]}
```

### 4. Latencia

Solo si has medido el tiempo de una llamada:

```json
{"latency_ms":{"jarvis_mcp":2100,"browser_mcp":240}}
```

El umbral de "lento" es 1500 ms. Un valor inventado o estimado deforma el `score`: omítelo si no lo mediste.

### 5. Errores en logs

```js
const logs = await t.webview_extension_logs({extension_id:'git-hygiene', lines:50});
```

Pasa las entradas relevantes:

```json
{"logs":[{"server":"git-hygiene","level":"error","message":"worker failed to start: ..."}]}
```

- La tool filtra por `level` y por palabras como `error`, `fail`, `timeout`, `denied`.
- Los mensajes se recortan a 220 caracteres y se les quitan tokens parecidos a claves. Aun así, **no pegues secretos reales**.

### 6. Llamada completa

```json
mcp_health {
  "extensions_dir": "~/extensions",
  "drafts_dir": "~/extension-projects",
  "state_dir": "~/browser-extensions/.antigem-state",
  "max_extensions": 120,
  "max_bytes_per_file": 262144,
  "storage_warn_bytes": 1048576,
  "observed": {
    "declined": [],
    "unreachable": [],
    "latency_ms": {},
    "logs": []
  },
  "language": "both"
}
```

Todos los parámetros tienen valor por defecto; `root`-style no existe aquí. Si el directorio de storage no existe, la tool lo avisa y sigue con el resto.

### Qué NO hacer

- No escribir `{"server":"todo bien"}` ni valores de relleno.
- No confundir "no aparece en `search`" con "declinado".
- No copiar un error de otra sesión como si fuera actual.
- No incluir tokens, contraseñas ni rutas privadas en `error` o `message`.

## EN

The tool reads files but **cannot ask other MCPs whether they are alive**. You observe the real state with the native tools and pass it in `observed`. Never fill it with guesses: an invented datum turns the report into a lie.

### 1. Extension inventory

```js
const t = tools.custom_plugin_developer_mcp;
const list = await t.webview_extension_list({refresh:true});
```

For each entry in `list.extensions` keep: `id`, `name`, `version`, `isEnabled`, `toolCount`, `skillCount`, `hostError` and `dirPath`. From `list.projects` keep the draft IDs.

- If you cannot call this tool, **say so**; do not replace the inventory with an imaginary list.
- `mcp_health` already reads `~/extensions` and `~/extension-projects` itself: this step adds `enabled/loaded` state and host errors, which files do not contain.

### 2. Declined servers

When the Code Mode tool catalogue returns `Permission.DeclinedError`, note the exact namespace:

```json
{"declined":[{"server":"custom_plugin_developer_mcp","error":"Permission.DeclinedError"}]}
```

- Use the **namespace**, not a single tool name.
- Do not assume a server is declined because it did not appear in a search: it may be disabled or have no tools.

### 3. Unreachable servers

If a call fails with timeout, connection or "unknown tool", record it:

```json
{"unreachable":[{"server":"jarvis_mcp","error":"timeout after 30s"}]}
```

### 4. Latency

Only if you actually timed a call:

```json
{"latency_ms":{"jarvis_mcp":2100,"browser_mcp":240}}
```

The "slow" threshold is 1500 ms. An invented or estimated value distorts the `score`: omit it if you did not measure it.

### 5. Log errors

```js
const logs = await t.webview_extension_logs({extension_id:'git-hygiene', lines:50});
```

Pass the relevant entries:

```json
{"logs":[{"server":"git-hygiene","level":"error","message":"worker failed to start: ..."}]}
```

- The tool filters by `level` and words like `error`, `fail`, `timeout`, `denied`.
- Messages are truncated to 220 characters and stripped of key-like tokens. Even so, **do not paste real secrets**.

### 6. Full call

```json
mcp_health {
  "extensions_dir": "~/extensions",
  "drafts_dir": "~/extension-projects",
  "state_dir": "~/browser-extensions/.antigem-state",
  "max_extensions": 120,
  "max_bytes_per_file": 262144,
  "storage_warn_bytes": 1048576,
  "observed": {
    "declined": [],
    "unreachable": [],
    "latency_ms": {},
    "logs": []
  },
  "language": "both"
}
```

Every parameter has a default; there is no `root` parameter here. If the storage directory is missing, the tool warns and continues with the rest.

### What NOT to do

- Do not write `{"server":"all good"}` or filler values.
- Do not confuse "not in `search`" with "declined".
- Do not copy an error from another session as if it were current.
- Do not include tokens, passwords or private paths in `error` or `message`.
