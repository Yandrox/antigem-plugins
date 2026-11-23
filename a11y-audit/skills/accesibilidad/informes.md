# Informes y correcciones / Reports and fixes

## ES

Cada `a11y_scan` guarda el resultado en `a11y.scans.<scanId>` y lo marca como `a11y.lastScan`. Un `scanId` se parece a `a11y_1732381200000_ab12c`.

- `a11y_fix_suggestions` sin argumentos usa el último escaneo. Ordena por gravedad (error, aviso, información) y peso de la categoría. Cada corrección incluye `priority`, pasos y un fragmento de código.
- Filtra con `categories` (por ejemplo `["contrast","tap"]`) y limita con `max`.
- `a11y_report` usa el último escaneo y las últimas correcciones si pertenecen a ese mismo escaneo. Con `include_fixes:false` omite la sección de correcciones.
- Para guardar: `{"output":"~/informes/a11y.md","dry_run":false}`. Sin `dry_run:false` solo obtienes el Markdown en la respuesta.

Los archivos se escriben con la API de archivos de AntiGem, así que la ruta debe empezar por `~/` o `/sdcard/`.

## EN

Every `a11y_scan` stores the result at `a11y.scans.<scanId>` and marks it as `a11y.lastScan`. A `scanId` looks like `a11y_1732381200000_ab12c`.

- `a11y_fix_suggestions` with no arguments uses the latest scan. It sorts by severity (error, warning, info) and category weight. Each fix includes `priority`, steps and a code snippet.
- Filter with `categories` (for example `["contrast","tap"]`) and limit with `max`.
- `a11y_report` uses the latest scan and latest fixes if they belong to that same scan. With `include_fixes:false` it omits the fixes section.
- To save: `{"output":"~/reports/a11y.md","dry_run":false}`. Without `dry_run:false` you only get the Markdown in the response.

Files are written with AntiGem's file API, so the path must start with `~/` or `/sdcard/`.
