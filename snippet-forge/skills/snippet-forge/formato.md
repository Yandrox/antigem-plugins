# Formato de Snippet Forge / Snippet Forge format

## ES

### Biblioteca JSON

Por defecto `~/snippet-forge/snippets.json`. Se puede cambiar con el parámetro `library` de cualquier tool (debe terminar en `.json`).

```json
{
  "version": 1,
  "updatedAt": "2026-11-27T10:00:00.000Z",
  "snippets": [
    {
      "id": "fetch-timeout-1a2b3c4d",
      "title": "Fetch con timeout",
      "language": "javascript",
      "tags": ["fetch", "red"],
      "description": "Petición con abort por tiempo.",
      "body": "const controller = new AbortController();\nsetTimeout(() => controller.abort(), {{ms:5000}});\nconst res = await fetch('{{url}}', { signal: controller.signal });",
      "variables": [{"name": "ms", "default": "5000"}, {"name": "url", "default": null}],
      "createdAt": "2026-11-27T10:00:00.000Z",
      "updatedAt": "2026-11-27T10:00:00.000Z"
    }
  ]
}
```

`variables` se recalcula desde `body` en cada lectura: no hace falta editarlo a mano. Si el archivo no existe, las tools de lectura devuelven una biblioteca vacía y `exists:false`. Si el JSON es inválido, la tool devuelve un error con la ruta.

### Variables

| Forma | Resultado |
| --- | --- |
| `{{name}}` | Usa `values.name`; si falta, se conserva el marcador y se añade `missing`. |
| `{{name:default}}` | Usa `values.name` si existe; si no, usa `default` y lo registra en `defaultsUsed`. |
| `{{ name : default }}` | Se permiten espacios alrededor del nombre y del valor. |

Los nombres válidos empiezan por letra o `_` y contienen letras, números, `_` o `-`. Los valores numéricos y booleanos se convierten a texto. Con `strict:true`, cualquier variable sin valor hace fallar `snippet_render`. Los marcadores sin valor se devuelven tal cual en modo no estricto para que no se pierda información.

### Renderizado

Ejemplo:

```
snippet_render({
  id: "fetch-timeout-1a2b3c4d",
  values: {url: "https://example.test/api"},
  strict: false
})
```

Devuelve `rendered` con `{{ms}}` resuelto a `5000` y `{{url}}` sustituido. Si falta `url`, aparece en `missing` y en `warnings`. Si además das `output:"~/snippet-forge/out.js"` y `dry_run:false`, escribe el resultado en ese archivo; el valor por defecto `dry_run:true` solo lo previsualiza.

### Export Markdown

`snippet_export` agrupa por lenguaje y produce:

````markdown
# Snippet Forge

Biblioteca de fragmentos exportada. No edites esta sección de encabezado. / Exported snippet library. Do not edit this header section.

- Snippets: 1
- Actualizado: 2026-11-27T10:00:00.000Z

## javascript

### Fetch con timeout (`fetch-timeout-1a2b3c4d`)

Petición con abort por tiempo.

Etiquetas: fetch, red

Variables: `ms` = `5000`, `url`

```javascript
const controller = new AbortController();
...
```
````

El export es de solo lectura por diseño: no hay tool que vuelva a importarlo. La fuente de verdad es el JSON.

### Límites

- 500 snippets como máximo.
- 64 000 caracteres por cuerpo.
- 4 MiB por biblioteca.
- 100 resultados como máximo por búsqueda.
- 20 etiquetas por snippet.
- Las rutas deben empezar por `~/`, `/sdcard/` o `/data/`; sin `..`.

## EN

### JSON library

Default: `~/snippet-forge/snippets.json`. Any tool accepts a `library` parameter to change it (must end in `.json`).

```json
{
  "version": 1,
  "updatedAt": "2026-11-27T10:00:00.000Z",
  "snippets": [
    {
      "id": "fetch-timeout-1a2b3c4d",
      "title": "Fetch with timeout",
      "language": "javascript",
      "tags": ["fetch", "network"],
      "description": "Request with an abort timeout.",
      "body": "const controller = new AbortController();\nsetTimeout(() => controller.abort(), {{ms:5000}});\nconst res = await fetch('{{url}}', { signal: controller.signal });",
      "variables": [{"name": "ms", "default": "5000"}, {"name": "url", "default": null}],
      "createdAt": "2026-11-27T10:00:00.000Z",
      "updatedAt": "2026-11-27T10:00:00.000Z"
    }
  ]
}
```

`variables` is recomputed from `body` on every read: no need to edit it by hand. If the file is missing, read tools return an empty library with `exists:false`. Invalid JSON produces a tool error with the path.

### Variables

| Form | Result |
| --- | --- |
| `{{name}}` | Use `values.name`; if missing, keep the marker and add `missing`. |
| `{{name:default}}` | Use `values.name` if present; otherwise use `default` and record it in `defaultsUsed`. |
| `{{ name : default }}` | Spaces around the name and value are allowed. |

Valid names start with a letter or `_` and contain letters, numbers, `_` or `-`. Numeric and boolean values are converted to text. With `strict:true`, any missing value fails `snippet_render`. Unresolved markers are returned as-is in non-strict mode so no information is lost.

### Rendering

Example:

```
snippet_render({
  id: "fetch-timeout-1a2b3c4d",
  values: {url: "https://example.test/api"},
  strict: false
})
```

It returns `rendered` with `{{ms}}` resolved to `5000` and `{{url}}` replaced. If `url` is missing, it appears in `missing` and `warnings`. Adding `output:"~/snippet-forge/out.js"` with `dry_run:false` writes the result; the default `dry_run:true` only previews it.

### Markdown export

`snippet_export` groups by language and produces:

````markdown
# Snippet Forge

Biblioteca de fragmentos exportada. No edites esta sección de encabezado. / Exported snippet library. Do not edit this header section.

- Snippets: 1
- Updated: 2026-11-27T10:00:00.000Z

## javascript

### Fetch with timeout (`fetch-timeout-1a2b3c4d`)

Request with an abort timeout.

Tags: fetch, network

Variables: `ms` = `5000`, `url`

```javascript
const controller = new AbortController();
...
```
````

The export is read-only by design: there is no tool to import it back. The JSON is the source of truth.

### Limits

- 500 snippets maximum.
- 64 000 characters per body.
- 4 MiB per library.
- 100 results maximum per search.
- 20 tags per snippet.
- Paths must start with `~/`, `/sdcard/` or `/data/`; no `..`.
