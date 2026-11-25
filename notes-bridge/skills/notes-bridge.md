---
name: Puente de notas y tareas / Notes and to-dos bridge
description: ES: Exporta e importa notas y listas de notes_mcp a Markdown local con frontmatter, busca en todo el texto, detecta duplicados y deja un plan listo para aplicar con notes_update. Híbrido, offline y sin servicios externos. EN: Export and import notes_mcp notes and to-do lists to local Markdown with frontmatter, search full text, detect duplicates and leave a plan ready to apply with notes_update. Hybrid, offline and no external services.
---

# Puente de notas y tareas / Notes and to-dos bridge

## ES

Las notas y listas de `notes_mcp` viven dentro de la app: no se pueden buscar desde el terminal ni versionar con git. Esta skill las saca a **Markdown local con frontmatter**, permite búsqueda full-text y deduplicación, y prepara un **plan de cambios** para que el agente lo aplique con las tools de `notes_mcp`. Todo se guarda bajo `~/notes-bridge/`; no hay red ni servicios remotos.

**Arquitectura importante:** el worker de este plugin **no puede llamar a `notes_mcp`**. El agente lee las notas con `notes_list`/`notes_get`, se las pasa como JSON al worker, y el worker hace el trabajo determinista (frontmatter, hash, búsqueda, diff, dedupe). Para volver a aplicar cambios, el agente ejecuta el plan devuelto con `notes_update`, `notes_create` y `notes_todo_*`. Nada se aplica automáticamente.

### Cuándo usarla

- Hacer una copia local legible y versionable de las notas (con `git-hygiene`).
- Buscar una frase en todas las notas sin recorrerlas una por una.
- Encontrar notas duplicadas o casi iguales antes de fusionarlas.
- Importar notas desde Markdown editado a mano o desde otro dispositivo.
- Preparar un lote de cambios en notas y revisarlo antes de aplicarlo.

### Flujo de trabajo

1. **Lee el inventario.** Con `notes_list({include_body:true, limit:100})` obtén título, texto y tareas. Si hay más de 100 notas, usa `has_more`/`next_offset` o `page` para seguir. Para una nota concreta, `notes_get({id})` da cada tarea con su `item_id` e `index`.
2. **Exporta.** Llama a `notes_export` con `notes` (el array completo), `output` opcional y `dry_run:true` primero. Revisa `summary` y `warnings`: si una nota solo tenía `preview`, repite la lectura con `include_body:true`. Para escribir, vuelve a llamar con `dry_run:false`; se crea un archivo `<slug>-<hash>.md` por nota y un `_index.json`.
3. **Busca.** `notes_search({query, notes})` o `notes_search({query, path:'~/notes-bridge/export'})`. La búsqueda ignora mayúsculas y acentos; varios términos se combinan con AND. Devuelve fragmentos con la coincidencia y el campo donde aparece (`title`, `text`, `items`).
4. **Detecta duplicados.** `notes_dedupe({notes, threshold:0.9})`. Los grupos `exact` son idénticos tras normalizar; los `near` usan similitud Jaccard de tokens. Cada grupo propone `suggestedKeep` y acciones **solo para revisar**.
5. **Importa.** Si editaste los `.md` o vienen de otro dispositivo, llama a `notes_import({path, notes})` con el inventario **actual**. Devuelve un `plan` ordenado de `notes_create`, `notes_update`, `notes_todo_set_item` y, si hace falta, `notes_update({items})`. Revisa `destructive`, `notInExport` y `warnings` antes de aplicar nada.
6. **Aplica el plan.** Ejecuta los pasos con las tools reales de `notes_mcp`, en el orden de `sequence`. Pide confirmación antes de cualquier `notes_delete` o de reemplazar una lista de tareas. Las notas que están en `notInExport` **no** se borran: ese decide el usuario.
7. **Informa.** Pasa los resultados a `notes_report` con `operations`, `summary`, `findings` y `warnings`. Previsualiza (`dry_run:true`) y guarda con `dry_run:false` e `output` si quieres un Markdown persistente.

### Reglas

- **Privacidad primero.** Las notas pueden contener datos personales, contraseñas o tokens. No pegues el contenido en un repo público y no lo envíes a ningún servicio. El informe solo enlaza rutas locales.
- **Nada automático.** El worker nunca escribe en Notes. Solo el agente aplica el plan, y solo después de revisarlo.
- **`include_body:true` siempre.** Sin él, `notes_list` devuelve solo un `preview` y la exportación perderá texto.
- **IDs estables.** Si exportas e importas en el mismo dispositivo, conserva el `id` del frontmatter. Si el ID no existe, el worker empareja por `kind` + título normalizado.
- **Duplicados con cuidado.** La sugerencia de conservar se basa en `updatedAt` y longitud; revisa el contenido antes de borrar. Nunca fusiones notas de distintos temas solo porque se parezcan.
- **Exportar no es limpiar.** `notes_export` sobrescribe por defecto (`overwrite:true`) para regenerar instantáneas. Si editaste los `.md` a mano, pon `overwrite:false` o guarda otra carpeta.
- Las rutas `output`/`path` deben empezar por `~/`, `/sdcard/` o `/data/`, no contener `..` y, en `output` de informe, terminar en `.md`.

Lee `formato.md` para el esquema del frontmatter, la forma de las notas aceptadas, el detalle de `plan`, los límites y ejemplos.

## EN

Notes and to-do lists in `notes_mcp` live inside the app: you can't search them from the terminal or version them with git. This skill exports them to **local Markdown with frontmatter**, supports full-text search and deduplication, and prepares a **change plan** for the agent to apply with the `notes_mcp` tools. Everything lives under `~/notes-bridge/`; no network or remote services.

**Architecture matters:** this plugin's worker **cannot call `notes_mcp`**. The agent reads notes with `notes_list`/`notes_get`, passes them as JSON to the worker, and the worker does the deterministic work (frontmatter, hashing, search, diff, dedupe). To apply changes back, the agent runs the returned plan with `notes_update`, `notes_create` and `notes_todo_*`. Nothing is applied automatically.

### When to use it

- Make a readable, versionable local copy of your notes (with `git-hygiene`).
- Search a phrase across all notes instead of opening them one by one.
- Find exact or near-duplicate notes before merging.
- Import notes from hand-edited Markdown or from another device.
- Prepare a batch of note changes and review it before applying.

### Workflow

1. **Read the inventory.** Use `notes_list({include_body:true, limit:100})` to get title, text and items. If there are more than 100 notes, follow `has_more`/`next_offset` or `page`. For a single note, `notes_get({id})` returns every to-do with its `item_id` and `index`.
2. **Export.** Call `notes_export` with `notes` (the full array), optional `output` and `dry_run:true` first. Review `summary` and `warnings`: if a note only had a `preview`, read it again with `include_body:true`. To write, call again with `dry_run:false`; one `<slug>-<hash>.md` file is created per note plus an `_index.json`.
3. **Search.** `notes_search({query, notes})` or `notes_search({query, path:'~/notes-bridge/export'})`. Search ignores case and accents; multiple terms are ANDed. It returns snippets with the match and the field where it appeared (`title`, `text`, `items`).
4. **Find duplicates.** `notes_dedupe({notes, threshold:0.9})`. `exact` groups are identical after normalisation; `near` groups use token Jaccard similarity. Each group proposes a `suggestedKeep` and actions **for review only**.
5. **Import.** If you edited the `.md` files or they came from another device, call `notes_import({path, notes})` with the **current** inventory. It returns an ordered `plan` of `notes_create`, `notes_update`, `notes_todo_set_item` and, if needed, `notes_update({items})`. Review `destructive`, `notInExport` and `warnings` before applying anything.
6. **Apply the plan.** Run the steps with the real `notes_mcp` tools in `sequence` order. Ask for confirmation before any `notes_delete` or to-do list replacement. Notes in `notInExport` are **not** deleted: that's the user's call.
7. **Report.** Feed the results to `notes_report` with `operations`, `summary`, `findings` and `warnings`. Preview (`dry_run:true`) and save with `dry_run:false` plus `output` if you want a persistent Markdown.

### Rules

- **Privacy first.** Notes may contain personal data, passwords or tokens. Don't paste content into a public repo or send it anywhere. The report only links local paths.
- **Nothing automatic.** The worker never writes to Notes. Only the agent applies the plan, and only after review.
- **`include_body:true` always.** Without it `notes_list` returns only a `preview` and the export loses text.
- **Stable IDs.** When exporting and importing on the same device, keep the frontmatter `id`. If the ID is missing, the worker matches by `kind` + normalised title.
- **Duplicates need care.** The keep suggestion uses `updatedAt` and length; review the content before deleting. Never merge unrelated notes just because they look similar.
- **Export is not cleanup.** `notes_export` overwrites by default (`overwrite:true`) to regenerate snapshots. If you edited the `.md` files by hand, use `overwrite:false` or a different folder.
- `output`/`path` must start with `~/`, `/sdcard/` or `/data/`, contain no `..`, and a report `output` must end in `.md`.

Read `formato.md` for the frontmatter schema, accepted note shapes, the `plan` details, limits and examples.
