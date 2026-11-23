# Formato de pasos / Step format

Los pasos grabados y los pasos en línea usan el mismo formato. / Recorded and inline steps share the same format.

## ES

| `type` | Campos | Qué hace |
| --- | --- | --- |
| `click` | `selector`, `text?`, `index?` | Busca el elemento y llama a `click()`. |
| `type` | `selector`, `value` | Escribe en un input/textarea y dispara `input` + `change`. |
| `select` | `selector`, `value` | Selecciona un valor en un `<select>`. |
| `key` | `key`, `selector?` | Envía `keydown`/`keyup` (útil para Enter o Escape). |
| `scroll` | `selector?`, `x?`, `y?` | Desplaza la página o centra el elemento. |
| `wait` | `ms` | Espera antes del siguiente paso. |
| `tap` | `selector`, `trusted?: true` | Calcula el rectángulo y usa un toque nativo de Android vía `chrome.antigem.automation`. |
| `assert` | `selector`, `exists?`, `text?`, `value?`, `attr?`, `attrValue?` | Valida el estado del DOM. |

`selector` es CSS. `text` filtra por texto visible. `index` elige entre varias coincidencias (empieza en 0).

Ejemplo en línea:

```json
[
  {"type":"type","selector":"#nombre","value":"Ada"},
  {"type":"click","selector":"button[type=submit]"},
  {"type":"wait","ms":500},
  {"type":"assert","selector":".mensaje","text":"Hola Ada"}
]
```

Para un toque de confianza: `{"type":"tap","selector":"#enviar"}`. La pestaña se activa automáticamente antes de la captura y del toque.

## EN

| `type` | Fields | What it does |
| --- | --- | --- |
| `click` | `selector`, `text?`, `index?` | Finds the element and calls `click()`. |
| `type` | `selector`, `value` | Types into an input/textarea and fires `input` + `change`. |
| `select` | `selector`, `value` | Selects a value in a `<select>`. |
| `key` | `key`, `selector?` | Sends `keydown`/`keyup` (handy for Enter or Escape). |
| `scroll` | `selector?`, `x?`, `y?` | Scrolls the page or centres the element. |
| `wait` | `ms` | Waits before the next step. |
| `tap` | `selector`, `trusted?: true` | Computes the rectangle and uses a native Android touch via `chrome.antigem.automation`. |
| `assert` | `selector`, `exists?`, `text?`, `value?`, `attr?`, `attrValue?` | Checks DOM state. |

`selector` is CSS. `text` filters by visible text. `index` picks among multiple matches (zero-based).

Inline example:

```json
[
  {"type":"type","selector":"#name","value":"Ada"},
  {"type":"click","selector":"button[type=submit]"},
  {"type":"wait","ms":500},
  {"type":"assert","selector":".message","text":"Hello Ada"}
]
```

For a trusted touch: `{"type":"tap","selector":"#send"}`. The tab is activated automatically before capture and tapping.
