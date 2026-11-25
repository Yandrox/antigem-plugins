---
name: Regresión de flujos del navegador / Browser flow regression
description: ES: Convierte acciones del navegador integrado (browser_mcp) en flujos reproducibles con aserciones, credenciales redactadas, capturas antes/después e informe bilingüe. Úsala para repetir y comparar flujos web sin servicios externos. EN: Turn built-in browser actions (browser_mcp) into reproducible flows with assertions, redacted credentials, before/after screenshots and a bilingual report. Use it to replay and compare web flows offline.
---

# Regresión de flujos del navegador / Browser flow regression

## ES

`browser_mcp` permite operar el navegador integrado, pero sus refs (`ref_12`) valen solo para la sesión en curso y las capturas quedan sueltas. Esta skill convierte una secuencia de acciones en un **flujo guardado**, comprueba el estado resultante con aserciones y compara capturas para detectar regresiones. Todo se guarda en `~/browser-flow-recorder/`; no hay red ni servicios remotos.

### Cuándo usarla

- Repetir un flujo web (login, búsqueda, formulario, publicación) tras un cambio en el sitio o en la app.
- Comparar el estado antes y después de una acción, o entre dos ejecuciones.
- Documentar un procedimiento del navegador sin dejar contraseñas ni tokens en el archivo.
- Detectar que un `ref_*` ya no apunta al elemento correcto.

### Flujo de trabajo

1. **Prepara el navegador.** Carga la skill `browser` si aún no está en contexto. Usa `browser_lock` una vez al principio para que tus toques y el zoom no se interpongan; suéltalo con `browser_lock({locked:false})` al terminar. Abre la página con `browser_open_url`.
2. **Ejecuta y anota.** Haz las acciones reales con `browser_find` (para obtener refs por descripción), `browser_read_page`, `browser_computer`, `browser_form_input`, `browser_batch`, etc. Tras cada paso anota: herramienta, acción, argumentos y una **referencia estable** (selector CSS o descripción textual). Nunca guardes un `ref_*` como identificador permanente.
3. **Captura la línea base.** Con `browser_computer({action:'screenshot'})` guarda la imagen anterior; si la herramienta devuelve una ruta de archivo, úsala después como `beforePath`. Obtén también `browser_get_page_text` y datos de `browser_read_page` para las observaciones.
4. **Guarda el flujo.** Llama a `flow_save` con `name`, `url`, `steps`, `expect` opcional y `sensitive` con los valores exactos que escribiste (contraseñas, códigos, tokens). La herramienta redacta clave/valor y patrones conocidos, convierte los `ref_*` en el selector/descripción indicado y devuelve un `hash`. Revisa los `warnings`: los pasos `unstable` necesitan una referencia estable antes de repetirlos.
5. **Repite con refs frescos.** Para cada paso, vuelve a localizar el elemento con `browser_find` en la nueva sesión y ejecuta la misma acción con el ref nuevo. No intentes reutilizar los refs del archivo: son de la sesión original.
6. **Comprueba el estado.** Recoge observaciones reales (`text`, `url`, `elements`, `counts`, `present`) y llama a `flow_check` con `name` y `observations`. Cada aserción devuelve ✅/❌ con valor esperado y real (redactados). Se guarda una ejecución con `runId`.
7. **Compara capturas.** Llama a `flow_compare` con `beforePath` y `afterPath` de los archivos guardados. La comparación es por bytes y dimensiones: si dice que cambió, abre ambas imágenes para decidir si es una regresión visual o un cambio esperado (hora, contador, publicidad).
8. **Informa.** `flow_report` con `name`, `run` opcional y las rutas de captura genera un Markdown bilingüe con pasos, aserciones, capturas y veredicto. Previsualiza primero (`dry_run:true`); para guardarlo usa `dry_run:false` e `output`.

### Reglas

- La redacción siempre está activa aunque pases `redact:false`; ese campo se conserva por compatibilidad.
- El agente nunca debe escribir credenciales reales en el informe ni en el archivo del flujo: usa `sensitive` y comprueba el resultado de `flow_save`.
- `browser_lock` se usa una sola vez por tarea y se libera al terminar; si la página abre un diálogo, respóndelo con `browser_handle_dialog`.
- Los elementos de una lista pueden cambiar de orden: prefiere descripciones y selectores semánticos (aria-label, role, tipo) antes que posiciones o coords.
- `flow_compare` no hace diff de píxeles: detecta cambios de archivo y de tamaño. Para diferencias sutiles, revisa las dos imágenes.
- No subas a un repo capturas que puedan contener datos personales; el informe solo enlaza las rutas locales.

Lee `formato.md` para la estructura exacta de pasos, los tipos de aserción, los ejemplos y los límites.

## EN

`browser_mcp` can drive the built-in browser, but its refs (`ref_12`) are valid only for the current session and screenshots end up scattered. This skill turns a sequence of actions into a **saved flow**, checks the resulting state with assertions and compares screenshots to catch regressions. Everything is stored under `~/browser-flow-recorder/`; no network or remote services.

### When to use it

- Repeating a web flow (login, search, form, publish) after a site or app change.
- Comparing state before/after an action, or between two runs.
- Documenting a browser procedure without leaving passwords or tokens in the file.
- Detecting that a `ref_*` no longer points at the right element.

### Workflow

1. **Prepare the browser.** Load the `browser` skill if it isn't in context. Call `browser_lock` once at the start so your touches and zoom don't interfere; release it with `browser_lock({locked:false})` when done. Open the page with `browser_open_url`.
2. **Act and note.** Perform the real actions with `browser_find` (to get refs by description), `browser_read_page`, `browser_computer`, `browser_form_input`, `browser_batch`, etc. After each step note: tool, action, arguments and a **stable reference** (CSS selector or text description). Never store a `ref_*` as a permanent identifier.
3. **Capture the baseline.** Save the before image with `browser_computer({action:'screenshot'})`; if the tool returns a file path, use it later as `beforePath`. Also collect `browser_get_page_text` and `browser_read_page` data for observations.
4. **Save the flow.** Call `flow_save` with `name`, `url`, `steps`, optional `expect` and `sensitive` containing the exact values you typed (passwords, codes, tokens). The tool redacts key/value pairs and known secret patterns, maps `ref_*` to the given selector/description and returns a `hash`. Review `warnings`: `unstable` steps need a stable reference before replay.
5. **Replay with fresh refs.** For each step, locate the element again with `browser_find` in the new session and run the same action with the new ref. Never reuse refs from the file: they belong to the original session.
6. **Check state.** Gather real observations (`text`, `url`, `elements`, `counts`, `present`) and call `flow_check` with `name` and `observations`. Every assertion returns ✅/❌ with expected and actual values (redacted). A run is saved with a `runId`.
7. **Compare screenshots.** Call `flow_compare` with `beforePath` and `afterPath` from the saved files. Comparison is by bytes and dimensions: if it reports a change, open both images to decide whether it's a visual regression or an expected change (clock, counter, ads).
8. **Report.** `flow_report` with `name`, optional `run` and screenshot paths produces a bilingual Markdown with steps, assertions, screenshots and verdict. Preview first (`dry_run:true`); use `dry_run:false` and `output` to save it.

### Rules

- Redaction is always on even if you pass `redact:false`; the field is kept for compatibility.
- Never write real credentials into the report or flow file: use `sensitive` and verify the `flow_save` result.
- Use `browser_lock` once per task and release it at the end; answer dialogs with `browser_handle_dialog`.
- List items may reorder: prefer descriptions and semantic selectors (aria-label, role, type) over positions or coordinates.
- `flow_compare` does no pixel diff: it detects file and size changes. Review both images for subtle differences.
- Don't upload screenshots that may contain personal data; the report only links local paths.

Read `formato.md` for the exact step structure, assertion types, examples and limits.
