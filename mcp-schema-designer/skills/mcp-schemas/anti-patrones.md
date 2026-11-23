# Anti-patrones / Anti-patterns

## ES

Doce fallos vistos de verdad en plugins publicados. Cada uno lleva el síntoma, por qué rompe y el arreglo.

### 1. Descripción que solo dice qué hace

- **Síntoma:** `"Audita HTML"`.
- **Por qué rompe:** el modelo la elige también para validar HTML del servidor o para arreglar CSS, donde no aplica.
- **Arreglo:** añade cuándo no usarla: `"ES: Audita la pestaña activa o HTML local. No valida HTML remoto. EN: Audits the active tab or local HTML. Does not validate remote HTML."`

### 2. `dry_run` sin valor por defecto escrito

- **Síntoma:** `"dry_run": {"type":"boolean"}` y el worker escribe si `args.dry_run` es `undefined`.
- **Por qué rompe:** una llamada innocua deja archivos modificados.
- **Arreglo:** `"true = solo previsualizar (por defecto); false = escribir"` y en el worker `if (args.dry_run === false) { ... }`.

### 3. Alternativas sin prioridad

- **Síntoma:** `duration`, `video_path` y `script_path` conviven sin decir cuál gana.
- **Por qué rompe:** el modelo manda los tres con valores distintos y el resultado depende del orden del código.
- **Arreglo:** escribe la regla en la descripción: `"duration tiene prioridad sobre video_path / takes priority over video_path"`.

### 4. Rango en la descripción pero sin `clamp`

- **Síntoma:** `"px, 12-160"` en la descripción, pero el worker usa `args.max_chars` directamente.
- **Por qué rompe:** `max_chars: 999999` genera un informe enorme o un bucle largo.
- **Arreglo:** función `clamp(value, min, max, fallback)` en el worker y usarla siempre, incluso si el schema ya lo limita.

### 5. `enum` convertido en texto libre

- **Síntoma:** `"platform": {"type":"string"}` y la descripción dice "shorts, reels, ...".
- **Por qué rompe:** llega `"Shorts"`, `"short"`, `"YouTube Shorts"` y el worker cae al default.
- **Arreglo:** `"enum":["shorts","reels","tiktok","youtube","all"]` y explica cada valor en la descripción.

### 6. Array sin `items`

- **Síntoma:** `"roots": {"type":"array"}`.
- **Por qué rompe:** el modelo manda `["~/a", 5, {"path":"~/b"}]` y el worker revienta.
- **Arreglo:** `"items":{"type":"string"}` y documenta el tope: `"máx. 2000 entradas / up to 2000 entries"`.

### 7. Rutas bajo `/storage/emulated/0/`

- **Síntoma:** un ejemplo usa la ruta absoluta real del teléfono.
- **Por qué rompe:** la API responde `File must be inside the app home or shared storage`.
- **Arreglo:** usa siempre `~/...` o `/sdcard/...` en ejemplos, descripciones y mensajes de error.

### 8. Error de una sola lengua o `TypeError` escapado

- **Síntoma:** `throw new Error("No existe el archivo")`.
- **Por qué rompe:** el modelo no sabe si es un fallo de ruta, de permiso o de formato, y repite la llamada igual.
- **Arreglo:** códigos estables y bilingües: `FILE_MISSING`, `PATH_REJECTED`, `INVALID_JSON`, con sobre `{isError:true, content:[...]}`.

### 9. Mutuamente excluyentes sin documentar

- **Síntoma:** `subs_align` acepta `generation`, `cues` y `srt` "por si acaso".
- **Por qué rompe:** no sabes cuál se usó y el informe miente sobre el origen.
- **Arreglo:** escribe el orden: `"generation > cues > srt / takes precedence"` y devuelve un campo `source` en la respuesta.

### 10. Escritura sin simulación previa

- **Síntoma:** una tool que borra o sobrescribe no tiene modo preview.
- **Por qué rompe:** no se puede revisar el plan antes de aplicarlo.
- **Arreglo:** `dry_run` por defecto `true` y, si aplica, `backup:true` para copias `.bak`.

### 11. Nombres de tools cambiantes de estilo

- **Síntoma:** `getSkillFile` junto a `get_skill`.
- **Por qué rompe:** el modelo inventa `getskillfile` y falla el descubrimiento.
- **Arreglo:** un solo estilo por plugin: `snake_case` y prefijo de familia (`subs_*`, `a11y_*`, `doctor_*`).

### 12. Versión desincronizada

- **Síntoma:** subes `manifest.json` a 1.2.0 pero `antigem-plugins.json` sigue en 1.1.0.
- **Por qué rompe:** el repo dice una cosa y el plugin instalada otra; `doctor_validate` marca el índice.
- **Arreglo:** actualiza versión en los dos sitios en el mismo commit y ejecuta `doctor_fix_index` antes de publicar.

## EN

Twelve mistakes seen for real in published plugins. Each has the symptom, why it breaks and the fix.

### 1. A description that only says what it does

- **Symptom:** `"Audits HTML"`.
- **Why it breaks:** the model also picks it to validate server HTML or fix CSS, where it does not apply.
- **Fix:** add when not to use it: `"Audits the active tab or local HTML. Does not validate remote HTML."`

### 2. `dry_run` with no documented default

- **Symptom:** `"dry_run": {"type":"boolean"}` and the worker writes when `args.dry_run` is `undefined`.
- **Why it breaks:** an innocent call modifies files.
- **Fix:** `"true = preview only (default); false = write files"` and in the worker `if (args.dry_run === false) { ... }`.

### 3. Alternatives with no priority

- **Symptom:** `duration`, `video_path` and `script_path` coexist with no rule.
- **Why it breaks:** the model sends all three with different values and the result depends on code order.
- **Fix:** write the rule: `"duration takes priority over video_path"`.

### 4. Range in the description but no `clamp`

- **Symptom:** `"px, 12-160"` in the description, but the worker uses `args.max_chars` raw.
- **Why it breaks:** `max_chars: 999999` produces a huge report or a long loop.
- **Fix:** a `clamp(value, min, max, fallback)` helper in the worker and use it always.

### 5. `enum` turned into free text

- **Symptom:** `"platform": {"type":"string"}` with "shorts, reels, ..." in the description.
- **Why it breaks:** you get `"Shorts"`, `"short"`, `"YouTube Shorts"` and the worker falls back to the default.
- **Fix:** `"enum":["shorts","reels","tiktok","youtube","all"]` and explain each value.

### 6. Array without `items`

- **Symptom:** `"roots": {"type":"array"}`.
- **Why it breaks:** the model sends `["~/a", 5, {"path":"~/b"}]` and the worker crashes.
- **Fix:** `"items":{"type":"string"}` plus a documented cap.

### 7. Paths under `/storage/emulated/0/`

- **Symptom:** an example uses the phone's real absolute path.
- **Why it breaks:** the API replies `File must be inside the app home or shared storage`.
- **Fix:** always use `~/...` or `/sdcard/...` in examples, descriptions and errors.

### 8. Single-language error or escaped `TypeError`

- **Symptom:** `throw new Error("File not found")`.
- **Why it breaks:** the model cannot tell a path, permission or format failure apart and repeats the same call.
- **Fix:** stable bilingual codes: `FILE_MISSING`, `PATH_REJECTED`, `INVALID_JSON`, with the `{isError:true, content:[...]}` envelope.

### 9. Mutually exclusive parameters left undocumented

- **Symptom:** `subs_align` accepts `generation`, `cues` and `srt` "just in case".
- **Why it breaks:** you cannot tell which one was used and the report lies about the source.
- **Fix:** write the order (`generation` > `cues` > `srt`) and return a `source` field.

### 10. Write with no preview mode

- **Symptom:** a tool that deletes or overwrites has no dry-run.
- **Why it breaks:** you cannot review the plan before applying it.
- **Fix:** `dry_run` defaulting to `true` and, where relevant, `backup:true` for `.bak` copies.

### 11. Inconsistent tool naming styles

- **Symptom:** `getSkillFile` next to `get_skill`.
- **Why it breaks:** the model invents `getskillfile` and discovery fails.
- **Fix:** one style per plugin: `snake_case` with a family prefix (`subs_*`, `a11y_*`, `doctor_*`).

### 12. Desynced version

- **Symptom:** `manifest.json` goes to 1.2.0 but `antigem-plugins.json` stays at 1.1.0.
- **Why it breaks:** the repo says one thing, the installed plugin another; `doctor_validate` flags the index.
- **Fix:** update the version in both places in the same commit and run `doctor_fix_index` before publishing.
