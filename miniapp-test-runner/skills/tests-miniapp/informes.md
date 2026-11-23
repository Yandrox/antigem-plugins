# Ejecuciones, comparación e informes / Runs, comparison and reports

## ES

Cada `test_run` guarda una ejecución en `mtr.runs.<runId>` y la marca como `mtr.lastRun`. Un `runId` tiene este aspecto: `run_1732381200000_ab12c`.

- `test_compare` sin argumentos usa `mtr.lastRun` y compara `before` contra `after`.
- Con `{"run":"run_...","against":"run_..."}` compara los estados finales de dos ejecuciones.
- Con `beforePath`/`afterPath` lee dos archivos base64 (por ejemplo, dos PNG capturados).
- `threshold` (0-1, por defecto 0.02) decide si el cambio visual cuenta. El resultado incluye `changeRatio`, `changedChunks`, hashes y `changedFields` del DOM.
- `test_report` incluye la comparación salvo que pases `includeComparison:false`.
- Para guardar el informe: `{"output":"~/informes/test.md","dry_run":false}`. Sin `dry_run:false` solo obtienes el Markdown en la respuesta.

Las capturas se guardan como archivos si pasas `artifacts_dir` a `test_record` o `test_run`; si no, quedan como data URL dentro de la ejecución.

## EN

Every `test_run` stores a run at `mtr.runs.<runId>` and marks it as `mtr.lastRun`. A `runId` looks like `run_1732381200000_ab12c`.

- `test_compare` with no arguments uses `mtr.lastRun` and compares `before` against `after`.
- With `{"run":"run_...","against":"run_..."}` it compares the final states of two runs.
- With `beforePath`/`afterPath` it reads two base64 files (for example, two captured PNGs).
- `threshold` (0-1, default 0.02) decides whether the visual change counts. The result includes `changeRatio`, `changedChunks`, hashes and changed DOM fields.
- `test_report` includes the comparison unless you pass `includeComparison:false`.
- To save the report: `{"output":"~/reports/test.md","dry_run":false}`. Without `dry_run:false` you only get the Markdown in the response.

Screenshots are written to files when you pass `artifacts_dir` to `test_record` or `test_run`; otherwise they remain as data URLs inside the run.
