# Enlaces y anclas / Links and anchors

## ES

### Formas de enlace admitidas

| Forma | Ejemplo | Tratamiento |
| --- | --- | --- |
| Inline | `[Guía](./guia.md)` | Ruta relativa al archivo que contiene el enlace. |
| Imagen | `![Logo](./img/logo.png)` | Misma resolución; `image:true` en el hallazgo. |
| Con título o `<...>` | `[Guía](<./Mi guía.md> "Título")` | Se ignoran comillas y corchetes angulares. |
| Referencia | `[Guía][guia]` con `[guia]: ./guia.md` | La definición también se comprueba. |
| Collapsed / shortcut | `[Guía][]`, `[guia]` | Se resuelve si existe la definición. |
| Ancla local | `[Instalación](#instalacion)` | Se compara con los slugs del mismo archivo. |
| Ancla remota | `[Uso](./guia.md#uso)` | Se resuelve el archivo y luego el ancla. |
| Absoluta repo | `[README](/README.md)` | Se resuelve desde la carpeta raíz del escaneo. |
| Externa | `https://...`, `mailto:`, `//host/x` | Se cuenta, pero **no** se comprueba. |

No se analizan enlaces dentro de código inline `` `...` ``, bloques ``` fenced ``` ni comentarios `<!-- ... -->`.

### Cómo se calcula un ancla

`mdlink_anchors` aplica la convención de GitHub:

1. Toma el texto del encabezado (`## Instalación rápida`).
2. Elimina Markdown inline y etiquetas HTML; conserva el texto de enlaces e imágenes.
3. Pasa a minúsculas y normaliza Unicode (NFKC). Los acentos se conservan en el slug, pero la comparación los ignora: `#instalacion` también resuelve `## Instalación`.
4. Elimina puntuación, conserva letras, números, guiones, guiones bajos y espacios.
5. Convierte cada espacio en `-`: `#instalacion-rapida`.
6. Si el slug ya apareció, añade `-1`, `-2`, etc.

También se reconocen anclas explícitas `<a id="api"></a>` y `<a name="api"></a>`.

Ejemplo:

```
# Uso
## Instalación
## Instalación

[Instalación](#instalacion)        → ok
[Segunda](#instalacion-1)          → ok
[Antigua](#como-instalar)          → broken_anchor
```

### Severidades

| `kind` | Severidad | Significado |
| --- | --- | --- |
| `broken_link` | `error` | El archivo o carpeta destino no existe. |
| `broken_anchor` | `error` | El archivo existe pero no tiene ese slug. |
| `case_mismatch` | `warning` | Existe el destino, pero con distinta capitalización. Trae `suggestion`. |
| `directory_without_index` | `info` | El enlace apunta a una carpeta sin `README.md`. |

Un `case_mismatch` es una pista: en Android/ext4 la ruta probablemente **sí fallará**, así que conviene corregirla. Si trabajas en un sistema case-insensitive, usa `case_sensitive:false` para ignorarla.

### Interpretar el informe

- `file` y `line` son del **archivo que contiene el enlace**, no del destino.
- `target` es el destino tal como aparece escrito; `detail` incluye la ruta ya resuelta.
- Corrige el enlace o renombra el destino, y vuelve a ejecutar `mdlink_check`.
- Los enlaces externos se cuentan en `summary.external` pero nunca se visitan: no hay red.

### Límites

- 200 archivos `.md` como máximo (parámetro `limit`, 1-200).
- 200 hallazgos como máximo; `truncated:true` si se alcanza.
- 2 MiB por archivo.
- Rutas de entrada y salida: `~/`, `/sdcard/` o `/data/`; sin `..`. Informe solo `.md`.
- Ignorados por defecto: fragmentos `/.git/`, `/node_modules/` y `/dist/`.

### Problemas comunes

| Síntoma | Causa | Acción |
| --- | --- | --- |
| Muchos `broken_link` en `/...` | La ruta absoluta se resolvió desde la raíz del escaneo. | Escanea desde el repo, no desde una subcarpeta. |
| `broken_anchor` con tildes | La comparación ya ignora acentos y mayúsculas: el destino realmente no existe. | Usa el slug de `mdlink_anchors`. |
| Un enlace no aparece | Está en código o en un comentario HTML. | Es intencionado; muévelo a texto Markdown. |
| `case_mismatch` en Windows/macOS | Sistema de archivos case-insensitive. | Usa `case_sensitive:false` o corrige la ruta. |
| Faltan archivos | Están en una carpeta ignorada. | Ajusta `ignore` o pasa `files` explícitamente. |

## EN

### Supported link forms

| Form | Example | Handling |
| --- | --- | --- |
| Inline | `[Guide](./guide.md)` | Relative to the file containing the link. |
| Image | `![Logo](./img/logo.png)` | Same resolution; `image:true` in the finding. |
| Title or `<...>` | `[Guide](<./My guide.md> "Title")` | Quotes and angle brackets are stripped. |
| Reference | `[Guide][guide]` with `[guide]: ./guide.md` | The definition is checked too. |
| Collapsed / shortcut | `[Guide][]`, `[guide]` | Resolved when a definition exists. |
| Local anchor | `[Install](#installation)` | Compared with slugs in the same file. |
| Remote anchor | `[Usage](./guide.md#usage)` | Resolve the file, then the anchor. |
| Repo absolute | `[README](/README.md)` | Resolved from the scan root. |
| External | `https://...`, `mailto:`, `//host/x` | Counted but **not** checked. |

Links inside inline code `` `...` ``, ``` fenced ``` blocks and `<!-- ... -->` comments are not analysed.

### How an anchor is computed

`mdlink_anchors` follows GitHub's convention:

1. Take the heading text (`## Quick install`).
2. Strip inline Markdown and HTML tags; keep link and image text.
3. Lowercase and normalise Unicode (NFKC). Accents stay in the slug, but comparison folds them: `## Instalación` yields `instalación` and `#instalacion` also matches.
4. Remove punctuation, keeping letters, numbers, hyphens, underscores and spaces.
5. Replace each space with `-`: `#quick-install`.
6. If the slug already occurred, append `-1`, `-2`, etc.

Explicit `<a id="api"></a>` and `<a name="api"></a>` anchors are also recognised.

Example:

```
# Usage
## Installation
## Installation

[Installation](#installation)      → ok
[Second](#installation-1)          → ok
[Old](#how-to-install)             → broken_anchor
```

### Severities

| `kind` | Severity | Meaning |
| --- | --- | --- |
| `broken_link` | `error` | Target file or folder does not exist. |
| `broken_anchor` | `error` | File exists but has no such slug. |
| `case_mismatch` | `warning` | Target exists with different casing. Includes `suggestion`. |
| `directory_without_index` | `info` | Link points to a folder with no `README.md`. |

A `case_mismatch` is a hint: on Android/ext4 the path will likely **fail**, so it should be fixed. On a case-insensitive filesystem, pass `case_sensitive:false` to ignore it.

### Reading the report

- `file` and `line` refer to the **file containing the link**, not the target.
- `target` is the literal destination; `detail` includes the resolved path.
- Fix the link or rename the target, then re-run `mdlink_check`.
- External links are counted in `summary.external` but never visited: there is no network.

### Limits

- 200 `.md` files maximum (`limit` parameter, 1-200).
- 200 findings maximum; `truncated:true` when reached.
- 2 MiB per file.
- Input/output paths: `~/`, `/sdcard/` or `/data/`; no `..`. Report is `.md` only.
- Ignored by default: `/.git/`, `/node_modules/` and `/dist/` fragments.

### Common issues

| Symptom | Cause | Action |
| --- | --- | --- |
| Many `broken_link` on `/...` | Absolute path resolved from scan root. | Scan from the repo, not a subfolder. |
| `broken_anchor` with accents | Comparison already folds accents and case: the target really does not exist. | Use the slug from `mdlink_anchors`. |
| A link is missing | It is in code or an HTML comment. | Intentional; move it into Markdown text. |
| `case_mismatch` on Windows/macOS | Case-insensitive filesystem. | Use `case_sensitive:false` or fix the path. |
| Missing files | They are in an ignored folder. | Adjust `ignore` or pass `files` explicitly. |
