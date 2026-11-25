# Formato de notas, frontmatter y planes / Note format, frontmatter and plans

## ES

### Nota de entrada

`notes_export`, `notes_search` y `notes_dedupe` aceptan un array `notes` con objetos como los devuelve `notes_list({include_body:true})` o `notes_get`:

| Campo | Alias aceptados | Uso |
| --- | --- | --- |
| `id` | `_id`, `note_id` | ID estable de la nota. Si falta, se genera `local_<slug>_<hash>`. |
| `kind` | — | `note` o `todo` (`list` se trata como `todo`). |
| `title` | — | Título; si falta se toma la primera línea del texto. |
| `text` | `body`, `content`, `preview` | Cuerpo. `preview` genera un aviso: usa `include_body:true`. |
| `items` | — | Array de strings o de objetos `{text, done, item_id, index}`. |
| `pinned` | — | Booleano. |
| `createdAt` | `created_at`, `created` | ISO o texto; se guarda tal cual. |
| `updatedAt` | `updated_at`, `updated` | ISO o texto; se usa para sugerir cuál conservar. |

### Markdown exportado

Cada archivo se llama `<slug>-<hash8>.md` y empieza con un frontmatter mínimo, sin dependencias:

```markdown
---
id: "abc123"
kind: "todo"
title: "Compras de la semana"
pinned: false
created: "2026-11-01T09:00:00.000Z"
updated: "2026-11-20T18:30:00.000Z"
source: "notes_mcp"
content_hash: "1a2b3c4d"
---

# Compras de la semana

Leche y café.

## Tareas / To-dos
- [x] Leche
- [ ] Café
```

`content_hash` es FNV-1a de 8 dígitos sobre `kind`, `title`, `text`, `items` y `pinned`. Cada archivo también tiene un SHA-256 completo en el resultado y en `_index.json`. El parser acepta comillas dobles o simples, booleanos, números y arrays; ignora un BOM inicial y el primer `# Título` al leer el cuerpo.

### Estructura del plan de importación

`notes_import` devuelve `plan` con pasos numerados en `sequence`, listos para ejecutar con `notes_mcp` en orden:

| Paso | Cuándo | Argumentos |
| --- | --- | --- |
| `notes_create` | El ID/título no existe en el inventario actual. | `kind`, `title`, `text`, `items` (solo todo), `pinned`. |
| `notes_update` | Cambian `title`, `text` o `pinned`. | `id` + solo los campos cambiados (`changes`). |
| `notes_update` | Cambia la lista de tareas. | `id`, `items` con el texto completo; `destructive:true`. |
| `notes_todo_set_item` | Una tarea debe quedar marcada. | `id`, `index`, `done:true`. |

`summary` cuenta `create`, `update`, `unchanged`, `todoOperations` y `destructive`. `notInExport` lista notas actuales que no aparecen en los `.md`: **informativo, nunca se borran**. Aplica los pasos con `sequence` ascendente; los `destructive` piden confirmación.

### Coincidencias y duplicados

- `notes_search`: sin `regex`, cada término (AND, acentos e ignores de mayúsculas) debe aparecer en al menos uno de los campos pedidos. `score` prioriza `title` (3) sobre `text`/`items` (1). Con `regex:true` se usa `new RegExp(query, flags)`; un regex inválido produce error.
- `notes_dedupe`: `exact` normaliza título + texto + tareas (sin acentos, sin puntuación, minúsculas); `near` calcula Jaccard sobre tokens de >= 2 caracteres y agrupa con `threshold` (0.5-1, por defecto 0.9). `suggestedKeep` es la nota con `updatedAt` más reciente; en empate, la de texto más largo. Las `suggestedActions` requieren revisión: `notes_delete` siempre lleva `destructive:true`.

### Límites y rutas

- Hasta 2000 notas por llamada; `notes_import` lee como máximo 500 `.md` (`maxFiles`) y `search`/`dedupe` hasta 1000.
- Archivos de hasta 4 MiB; por encima se omiten con un aviso. El texto leído se limita a 2 M caracteres.
- `notes_export` previsualiza por defecto (`dry_run:true`). Con `dry_run:false` escribe los `.md` y `_index.json`. `overwrite:false` deja los archivos existentes como `skipped`.
- `notes_report` también previsualiza por defecto; con `dry_run:false` e `output` escribe el Markdown.
- Rutas válidas: `~/…`, `/sdcard/…`, `/data/…`, sin `..`. Un `output` de informe debe terminar en `.md`.
- Cada llamada MCP tiene un plazo de 180 s: procesa los lotes en varias llamadas si tienes miles de notas.

## EN

### Input note

`notes_export`, `notes_search` and `notes_dedupe` accept a `notes` array of objects like those returned by `notes_list({include_body:true})` or `notes_get`:

| Field | Accepted aliases | Use |
| --- | --- | --- |
| `id` | `_id`, `note_id` | Stable ID. If missing, `local_<slug>_<hash>` is generated. |
| `kind` | — | `note` or `todo` (`list` is treated as `todo`). |
| `title` | — | Title; falls back to the first line of the text. |
| `text` | `body`, `content`, `preview` | Body. `preview` raises a warning: use `include_body:true`. |
| `items` | — | Array of strings or `{text, done, item_id, index}` objects. |
| `pinned` | — | Boolean. |
| `createdAt` | `created_at`, `created` | ISO or text; stored as given. |
| `updatedAt` | `updated_at`, `updated` | ISO or text; used to suggest which to keep. |

### Exported Markdown

Each file is named `<slug>-<hash8>.md` and starts with a minimal, dependency-free frontmatter:

```markdown
---
id: "abc123"
kind: "todo"
title: "Weekly shopping"
pinned: false
created: "2026-11-01T09:00:00.000Z"
updated: "2026-11-20T18:30:00.000Z"
source: "notes_mcp"
content_hash: "1a2b3c4d"
---

# Weekly shopping

Milk and coffee.

## Tareas / To-dos
- [x] Milk
- [ ] Coffee
```

`content_hash` is an 8-digit FNV-1a over `kind`, `title`, `text`, `items` and `pinned`. Each file also has a full SHA-256 in the result and in `_index.json`. The parser accepts single or double quotes, booleans, numbers and arrays; it ignores a leading BOM and the first `# Title` when reading the body.

### Import plan shape

`notes_import` returns a `plan` with steps numbered in `sequence`, ready to run with `notes_mcp` in order:

| Step | When | Arguments |
| --- | --- | --- |
| `notes_create` | ID/title not in the current inventory. | `kind`, `title`, `text`, `items` (to-dos only), `pinned`. |
| `notes_update` | `title`, `text` or `pinned` changed. | `id` plus only changed fields (`changes`). |
| `notes_update` | To-do list changed. | `id`, `items` with the full text; `destructive:true`. |
| `notes_todo_set_item` | An item should be checked. | `id`, `index`, `done:true`. |

`summary` counts `create`, `update`, `unchanged`, `todoOperations` and `destructive`. `notInExport` lists current notes absent from the `.md` files: **informational, never deleted**. Apply steps in ascending `sequence`; confirm the `destructive` ones.

### Matches and duplicates

- `notes_search`: without `regex`, every term (AND, accents and case ignored) must appear in at least one requested field. `score` favours `title` (3) over `text`/`items` (1). With `regex:true`, `new RegExp(query, flags)` is used; an invalid regex errors out.
- `notes_dedupe`: `exact` normalises title + text + items (no accents or punctuation, lowercase); `near` uses Jaccard over tokens of >= 2 characters with `threshold` (0.5-1, default 0.9). `suggestedKeep` is the note with the newest `updatedAt`; ties go to the longest text. `suggestedActions` need review: `notes_delete` always carries `destructive:true`.

### Limits and paths

- Up to 2000 notes per call; `notes_import` reads at most 500 `.md` (`maxFiles`) and `search`/`dedupe` up to 1000.
- Files up to 4 MiB; larger ones are skipped with a warning. Read text is capped at 2 M characters.
- `notes_export` previews by default (`dry_run:true`). With `dry_run:false` it writes the `.md` files and `_index.json`. `overwrite:false` leaves existing files as `skipped`.
- `notes_report` also previews by default; with `dry_run:false` and `output` it writes the Markdown.
- Valid paths: `~/…`, `/sdcard/…`, `/data/…`, no `..`. A report `output` must end in `.md`.
- Each MCP call has a 180 s deadline: split large batches across calls if you have thousands of notes.
