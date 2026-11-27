---
name: Forja de snippets / Snippet forge
description: ES: Guarda fragmentos de código reutilizables en una biblioteca JSON local con variables {{nombre:valor}}, los busca por lenguaje o etiqueta, los renderiza con valores concretos y los exporta a Markdown. Híbrido, offline y sin red. EN: Save reusable code snippets in a local JSON library with {{name:default}} variables, search them by language or tag, render them with concrete values and export them to Markdown. Hybrid, offline and no network.
---

# Forja de snippets / Snippet forge

## ES

Los snippets útiles se pierden en el chat o en notas sueltas, y rellenar sus parámetros a mano es lento. Esta skill convierte fragmentos en **plantillas reutilizables**: se guardan en `~/snippet-forge/snippets.json`, se recuperan por lenguaje, etiqueta o texto, y se renderizan sustituyendo `{{variable}}` por valores concretos. Todo es local: no hay CDN, login ni servicio remoto. El worker solo usa `chrome.antigem` para leer y escribir archivos.

**Arquitectura:** el agente elige la tool, el worker hace el trabajo determinista (normalizar, buscar, sustituir, exportar). La biblioteca es un JSON legible; las escrituras crean una copia `.bak` antes de sobrescribir. Las tools que escriben usan `dry_run:true` por defecto: primero se revisa la vista previa y solo se escribe con `dry_run:false`.

### Cuándo usarla

- Guardar una receta de código que se repite (fetch con timeout, query SQL, plantilla de log, comando git).
- Recuperar snippets de un lenguaje concreto sin abrir cada archivo.
- Generar una variante de un snippet con datos del momento (nombre de función, ruta, tabla).
- Compartir una colección de snippets como Markdown versionable con `git-hygiene`.
- Preparar un fragmento listo para pegar o escribir en un archivo del proyecto.

### Flujo de trabajo

1. **Guardar.** `snippet_save({title, body, language, tags, description})` con `dry_run:true`; revisa `snippet.variables` (el worker detecta automáticamente los `{{...}}`). Repite con `dry_run:false` para persistir. Si no das `id` y ya existe el mismo título+lenguaje, lo actualiza en lugar de duplicarlo.
2. **Encontrar.** `snippet_search({query, language, tag, limit})`. La búsqueda ignora mayúsculas y acentos, y combina términos con AND. Devuelve resúmenes; usa `snippet_get({id})` cuando necesites el cuerpo completo.
3. **Renderizar.** `snippet_render({id, values, strict})`. Los valores pueden ser texto, número o booleano. Las variables con valor por defecto (`{{nombre:por_defecto}}`) se resuelven solas; las que falten se listan en `missing`. Con `strict:true` la tool falla si falta cualquiera.
4. **Guardar el resultado.** Añade `output` y `dry_run:false` a `snippet_render` para escribir el texto final en un archivo; con `dry_run:true` solo lo devuelve. Si quieres pegarlo, copia el campo `rendered`.
5. **Mantener.** `snippet_delete({id, dry_run:false})` elimina con respaldo. `snippet_export({output, language})` genera un Markdown con bloques de código agrupados por lenguaje; pásalo a `git-hygiene` si quieres versionarlo.

### Reglas

- Usa `{{nombre}}` o `{{nombre:valor_por_defecto}}`; los nombres deben empezar por letra o `_` y pueden contener números, `-` y `_`.
- No pongas secretos, tokens ni datos personales en los snippets: la biblioteca y el export son archivos locales legibles.
- Las rutas `library`, `output` deben empezar por `~/`, `/sdcard/` o `/data/`, no contener `..`; `library` debe terminar en `.json` y el export en `.md`.
- `snippet_save` rechaza cuerpos vacíos o de más de 64 000 caracteres; la biblioteca está limitada a 500 snippets y 4 MiB.
- El `.bak` se crea con `copyFile` antes de cada escritura; si ya existía, se sobrescribe. Conserva copias externas si necesitas historial.
- Los snippets con el mismo título y lenguaje se tratan como una sola entrada (upsert). Para conservar dos variantes, cambia el título o el lenguaje.

Lee `formato.md` para el esquema del JSON, ejemplos de variables, el formato del export y los límites exactos.

## EN

Useful snippets get lost in chat or scattered notes, and filling their parameters by hand is slow. This skill turns fragments into **reusable templates**: they live in `~/snippet-forge/snippets.json`, can be retrieved by language, tag or text, and are rendered by replacing `{{variable}}` with concrete values. Everything is local: no CDN, login or remote service. The worker only uses `chrome.antigem` to read and write files.

**Architecture:** the agent picks the tool; the worker does the deterministic work (normalising, searching, substituting, exporting). The library is readable JSON; writes create a `.bak` copy before overwriting. Writing tools default to `dry_run:true`: review the preview first and pass `dry_run:false` only when ready to write.

### When to use it

- Save a recurring code recipe (fetch with timeout, SQL query, log template, git command).
- Retrieve snippets for one language without opening every file.
- Produce a variant with current data (function name, path, table).
- Share a collection as versionable Markdown with `git-hygiene`.
- Prepare a fragment ready to paste or write into a project file.

### Workflow

1. **Save.** `snippet_save({title, body, language, tags, description})` with `dry_run:true`; review `snippet.variables` (the worker detects every `{{...}}`). Repeat with `dry_run:false` to persist. Without an `id`, an existing title+language is updated instead of duplicated.
2. **Find.** `snippet_search({query, language, tag, limit})`. Search ignores case and accents and ANDs terms. It returns summaries; use `snippet_get({id})` for the full body.
3. **Render.** `snippet_render({id, values, strict})`. Values may be strings, numbers or booleans. Defaults (`{{name:default}}`) resolve automatically; missing ones are listed in `missing`. With `strict:true` the tool fails if any are missing.
4. **Save the result.** Add `output` and `dry_run:false` to `snippet_render` to write the final text to a file; with `dry_run:true` it only returns it. Copy the `rendered` field to paste it.
5. **Maintain.** `snippet_delete({id, dry_run:false})` removes with a backup. `snippet_export({output, language})` produces Markdown with code blocks grouped by language; hand it to `git-hygiene` if you want it versioned.

### Rules

- Use `{{name}}` or `{{name:default}}`; names start with a letter or `_` and may contain numbers, `-` and `_`.
- Never put secrets, tokens or personal data in snippets: the library and export are readable local files.
- `library` and `output` must start with `~/`, `/sdcard/` or `/data/` and contain no `..`; `library` must end in `.json` and exports in `.md`.
- `snippet_save` rejects empty bodies or bodies over 64 000 characters; the library is capped at 500 snippets and 4 MiB.
- A `.bak` is created with `copyFile` before each write; an older backup is overwritten. Keep external copies if you need history.
- Same title and language means one entry (upsert). To keep two variants, change the title or language.

Read `formato.md` for the JSON schema, variable examples, the export format and exact limits.
