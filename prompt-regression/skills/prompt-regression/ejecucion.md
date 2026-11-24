# Repetir un caso / Replaying a case

## ES

La repetición no la hace un script: la haces tú siguiendo la skill modificada. El objetivo es que la comparación sea justa, no que la memoria contamine el resultado.

### Paso a paso

1. **Lee el caso**: `case_check` sin `actual` no sirve; primero consulta el caso con el ID guardado. Si hace falta, guarda una copia local con `case_record` + `output` + `dry_run:false`.
2. **Aísla la entrada**: usa solo el campo `input` del caso como entrada de la skill. No le pases el `expect`, las notas ni la salida anterior: son respuestas.
3. **Carga la skill modificada** con `get_skill {name}` y sus archivos de detalle con `get_skill_file` si la skill lo indica. No uses una copia en tu contexto: lee del disco.
4. **Sigue la skill literalmente** con la entrada aislada. Anota la salida completa y la herramienta que elegiste en `actual_tool`.
5. **Llama a `case_check`** con `case`, `actual` y `actual_tool`. Si el caso es nuevo y aún no lo registraste, usa `case_inline`.
6. **Repite para cada caso** antes de mirar el informe; así evitas ajustar la interpretación a mitad de la batería.

### Cómo evitar sesgos

- No releas la definición de `expect` hasta haber escrito la salida. Si la ves antes, te adaptas a ella.
- Ejecuta primero los casos que antes fallaban: son los más sensibles a una regresión silenciosa.
- Si la skill usa otras tools, anota la primera que elegiste (`actual_tool`), no todas las que usaste después.
- Si la salida depende del estado (archivos, storage), reinicia ese estado o usa un `target_dir` nuevo.

### Cuándo guardar la salida real

Con `case_check` + `output` + `dry_run:false` se guarda un Markdown por comprobación. Es útil cuando la deriva es larga y quieres comparar versiones. El informe agregado de `case_report` no incluye la salida completa, solo el `drift` por categoría.

## EN

Replay is not done by a script: you do it by following the modified skill. The goal is a fair comparison, not a memory-contaminated one.

### Steps

1. **Read the case**: `case_check` without `actual` is useless; first look up the case by ID. If needed, save a local copy with `case_record` + `output` + `dry_run:false`.
2. **Isolate the input**: use only the case's `input` field as the skill input. Do not pass `expect`, notes or the previous output: those are answers.
3. **Load the modified skill** with `get_skill {name}` and its detail files with `get_skill_file` when instructed. Read from disk, not from a copy in your context.
4. **Follow the skill literally** with the isolated input. Record the full output and the tool you chose in `actual_tool`.
5. **Call `case_check`** with `case`, `actual` and `actual_tool`. For a brand-new case, use `case_inline`.
6. **Replay every case** before reading the report; otherwise you risk adjusting your interpretation mid-suite.

### Avoiding bias

- Do not re-read `expect` until you have written the output. Seeing it first makes you adapt to it.
- Replay previously failing cases first: they are the most sensitive to silent regressions.
- If the skill uses other tools, record the first one you chose (`actual_tool`), not everything you called later.
- If output depends on state (files, storage), reset it or use a fresh `target_dir`.

### When to save the real output

`case_check` + `output` + `dry_run:false` saves a Markdown per check. Useful when drift is long and you want to compare versions. The aggregate `case_report` does not include full outputs, only `drift` by category.
