# Formato de flujo y aserciones / Flow and assertion format

## ES

### Pasos

Cada entrada de `steps` es un objeto. Campos reconocidos:

| Campo | Tipo | Uso |
| --- | --- | --- |
| `tool` | string | Herramienta de `browser_mcp`: `browser_open_url`, `browser_find`, `browser_computer`, `browser_form_input`, `browser_read_page`, `browser_batch`… Si falta, se asume `browser_computer`. |
| `action` | string | Acción concreta: `left_click`, `type`, `fill`, `key`, `hover`, `scroll_to`, `screenshot`… |
| `args` | object | Argumentos de la herramienta. Se redactan antes de guardarse. |
| `selector` / `description` | string | Referencia estable. Si `args` contiene `ref_12`, se sustituye por este valor y se avisa. Sin él, el paso se marca `unstable`. |
| `target` | string | Objetivo legible para el informe; por defecto se toma de `selector` o `description`. |
| `expect` | object | Aserción opcional ligada al paso; se guarda tal cual (redactada). |
| `note` | string | Comentario libre (redactado). |

Ejemplo:

```json
{
  "name": "login_ejemplo",
  "url": "https://ejemplo.com/login",
  "steps": [
    {
      "tool": "browser_open_url",
      "action": "open",
      "args": {"url": "https://ejemplo.com/login"}
    },
    {
      "tool": "browser_form_input",
      "action": "fill",
      "args": {"selector": "input[name=user]", "value": "usuario-demo"}
    },
    {
      "tool": "browser_computer",
      "action": "left_click",
      "selector": "button[type=submit]",
      "description": "botón Entrar",
      "args": {"ref": "ref_12"},
      "expect": {"type": "contains", "key": "text", "value": "Bienvenido"}
    }
  ],
  "expect": [
    {"type": "contains", "key": "url", "value": "/dashboard"}
  ],
  "sensitive": ["usuario-demo", "clave-real-123"]
}
```

Los tipos válidos son los de la tabla siguiente.

### Aserciones

`flow_check` evalúa cada objeto de `expect` contra las `observations` que tú recoges del navegador:

| `type` | Comportamiento | Campos |
| --- | --- | --- |
| `contains` | El valor observado contiene `value` (o `pattern`). | `key`, `value`, `case_insensitive` (por defecto `true`). |
| `not_contains` | Lo contrario. | Igual que `contains`. |
| `regex` | `pattern` coincide con el valor observado. | `key`, `pattern`, `flags` (por defecto `i`). |
| `equals` | Comparación JSON exacta. | `key`, `value`. |
| `exists` | `value` aparece en un array de elementos (`elements`, `visible`, `items`, `labels`) o como clave verdadera en `present`. | `key` (nombre del array), `value`. |
| `count` | `observations.counts[key]` es igual a `value`. | `key`, `value`. |

Observaciones de ejemplo:

```json
{
  "text": "Bienvenido, Ana",
  "url": "https://ejemplo.com/dashboard",
  "elements": ["botón Entrar", "panel principal"],
  "counts": {"resultados": 12},
  "present": {"panel principal": true}
}
```

Si no indicas `key`, se usa `text`. El resultado incluye `expected`, `actual`, `passed` y `detail`; valores y observaciones se redactan antes de guardarse.

### Redacción

Siempre activa. Se ocultan:

- Claves que coinciden con `password`, `passwd`, `pwd`, `secret`, `token`, `api_key`, `authorization`, `cookie`, `session`, `otp`, `pin`, `credential` (y variantes).
- Patrones `Bearer …`, `sk-…`, `ghp_…`, `AIza…`, `xox…`, JWT `eyJ…`.
- Cadenas `clave=valor` o `token: valor`.
- Cada valor exacto que pases en `sensitive` (por ejemplo lo que escribiste en un campo).

Comprueba siempre el campo `redactions` de `flow_save`: si es `0` y escribiste credenciales, revisa el flujo antes de guardarlo.

### Comparación y archivos

- `flow_save` escribe `~/browser-flow-recorder/flows/<name>.json` y calcula `hash` (SHA-256 del contenido canónico). El hash detecta cambios en la definición del flujo, no en la página.
- `flow_check` guarda ejecuciones en `~/browser-flow-recorder/runs/<id>.json`. `flow_report` usa la última si no le pasas `run`.
- `flow_compare`: imágenes → tamaño, dimensiones PNG y SHA-256 de bytes; observaciones → claves añadidas, eliminadas o cambiadas; `baseline` + `hash` → deriva del flujo. No hay diff de píxeles.
- `flow_report` previsualiza por defecto. Con `dry_run:false` escribe en `output` o en `~/browser-flow-recorder/reports/<flujo>-<run>.md`. Las rutas `output` deben empezar por `~/`, `/sdcard/` o `/data/`, terminar en `.md` y no contener `..`.

### Límites

- Máximo 200 pasos por flujo y 64 caracteres en `name` (letras, dígitos, `_`, `-`).
- Capturas de hasta 8 MiB; archivos más grandes se rechazan.
- `flow_list` lee como máximo 2000 entradas.
- Cada llamada MCP tiene un plazo de 180 s: haz los pasos del navegador en lotes y guarda el flujo al terminar.
- No guardes capturas con datos personales en repositorios públicos.

## EN

### Steps

Each entry in `steps` is an object. Recognised fields:

| Field | Type | Use |
| --- | --- | --- |
| `tool` | string | `browser_mcp` tool: `browser_open_url`, `browser_find`, `browser_computer`, `browser_form_input`, `browser_read_page`, `browser_batch`… Defaults to `browser_computer`. |
| `action` | string | Concrete action: `left_click`, `type`, `fill`, `key`, `hover`, `scroll_to`, `screenshot`… |
| `args` | object | Tool arguments. Redacted before saving. |
| `selector` / `description` | string | Stable reference. If `args` contains `ref_12`, it is replaced by this value with a warning. Without it, the step is marked `unstable`. |
| `target` | string | Readable target for the report; taken from `selector` or `description` by default. |
| `expect` | object | Optional assertion attached to the step; saved redacted. |
| `note` | string | Free comment (redacted). |

Example:

```json
{
  "name": "login_example",
  "url": "https://example.com/login",
  "steps": [
    {
      "tool": "browser_open_url",
      "action": "open",
      "args": {"url": "https://example.com/login"}
    },
    {
      "tool": "browser_form_input",
      "action": "fill",
      "args": {"selector": "input[name=user]", "value": "demo-user"}
    },
    {
      "tool": "browser_computer",
      "action": "left_click",
      "selector": "button[type=submit]",
      "description": "Sign in button",
      "args": {"ref": "ref_12"},
      "expect": {"type": "contains", "key": "text", "value": "Welcome"}
    }
  ],
  "expect": [
    {"type": "contains", "key": "url", "value": "/dashboard"}
  ],
  "sensitive": ["demo-user", "real-password-123"]
}
```

### Assertions

`flow_check` evaluates every `expect` object against the `observations` you collect from the browser:

| `type` | Behaviour | Fields |
| --- | --- | --- |
| `contains` | Observed value contains `value` (or `pattern`). | `key`, `value`, `case_insensitive` (default `true`). |
| `not_contains` | The inverse. | As `contains`. |
| `regex` | `pattern` matches the observed value. | `key`, `pattern`, `flags` (default `i`). |
| `equals` | Exact JSON comparison. | `key`, `value`. |
| `exists` | `value` appears in an element array (`elements`, `visible`, `items`, `labels`) or is a true key in `present`. | `key` (array name), `value`. |
| `count` | `observations.counts[key]` equals `value`. | `key`, `value`. |

Example observations:

```json
{
  "text": "Welcome, Ana",
  "url": "https://example.com/dashboard",
  "elements": ["Sign in button", "main panel"],
  "counts": {"results": 12},
  "present": {"main panel": true}
}
```

Without `key`, `text` is used. The result includes `expected`, `actual`, `passed` and `detail`; values and observations are redacted before saving.

### Redaction

Always on. It hides:

- Keys matching `password`, `passwd`, `pwd`, `secret`, `token`, `api_key`, `authorization`, `cookie`, `session`, `otp`, `pin`, `credential` (and variants).
- Patterns `Bearer …`, `sk-…`, `ghp_…`, `AIza…`, `xox…`, JWT `eyJ…`.
- `key=value` or `token: value` strings.
- Every exact value passed in `sensitive` (e.g. what you typed into a field).

Always check `redactions` from `flow_save`: if it is `0` and you typed credentials, review the flow before saving.

### Comparison and files

- `flow_save` writes `~/browser-flow-recorder/flows/<name>.json` and computes `hash` (SHA-256 of the canonical content). The hash detects flow-definition drift, not page changes.
- `flow_check` saves runs to `~/browser-flow-recorder/runs/<id>.json`. `flow_report` uses the latest one unless you pass `run`.
- `flow_compare`: images → size, PNG dimensions and SHA-256 of bytes; observations → added, removed or changed keys; `baseline` + `hash` → flow drift. No pixel diff.
- `flow_report` previews by default. With `dry_run:false` it writes to `output` or `~/browser-flow-recorder/reports/<flow>-<run>.md`. `output` paths must start with `~/`, `/sdcard/` or `/data/`, end in `.md` and contain no `..`.

### Limits

- Up to 200 steps per flow and 64 characters in `name` (letters, digits, `_`, `-`).
- Screenshots up to 8 MiB; larger files are rejected.
- `flow_list` reads at most 2000 entries.
- Each MCP call has a 180 s deadline: do browser steps in batches and save the flow when finished.
- Don't commit screenshots containing personal data to public repositories.
