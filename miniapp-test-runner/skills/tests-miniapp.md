---
name: Probar mini apps / Test mini apps
description: ES: Graba flujos de una mini app, los repite con aserciones, compara capturas y genera un informe Markdown. EN: Record mini app flows, replay them with assertions, compare screenshots and generate a Markdown report.
---

# Probar mini apps / Test mini apps

## ES

Usa esta skill cuando quieras verificar una mini app o una WebView desde AntiGem, sin servicios externos.

1. Abre la mini app en una pestaña y deja esa pestaña activa.
2. `test_record`: graba interacciones reales durante `duration_ms` (por defecto 8000). Pasa un `name` corto y, si quieres archivos, `artifacts_dir` (`~/...` o `/sdcard/...`). Mientras graba, haz clics, escribe y pulsa teclas en la app.
3. `test_run`: repite la prueba con `{"name":"mi_prueba"}`, o pasa `steps` en línea. Devuelve `runId`, fallos, capturas y estado del DOM.
4. `test_compare`: compara antes/después del último `runId`, dos ejecuciones (`run` + `against`) o dos archivos (`beforePath` + `afterPath`).
5. `test_report`: genera el Markdown bilingüe. Por defecto solo previsualiza; usa `dry_run:false` y `output` para guardarlo.

La grabación usa un content script incluido y un puente de mensajes, con fallback automático a CDP (`chrome.debugger`) cuando el WebView no puede inyectar por scripting. Si otra extensión tiene el debugger de esa pestaña, cierra esa conexión antes de repetir la prueba. No hace falta permiso de red ni Chrome de escritorio.

Para el formato de pasos, lee `pasos.md`. Para ejecuciones, comparaciones e informes, lee `informes.md`.

## EN

Use this skill when you want to verify a mini app or a WebView from AntiGem, without external services.

1. Open the mini app in a tab and leave that tab active.
2. `test_record`: record real interactions for `duration_ms` (default 8000). Pass a short `name` and, if you want files, `artifacts_dir` (`~/...` or `/sdcard/...`). While it records, click, type and press keys in the app.
3. `test_run`: replay the test with `{"name":"my_test"}`, or pass inline `steps`. It returns `runId`, failures, screenshots and DOM state.
4. `test_compare`: compare before/after of the latest `runId`, two runs (`run` + `against`), or two files (`beforePath` + `afterPath`).
5. `test_report`: generate the bilingual Markdown. It previews by default; use `dry_run:false` and `output` to save it.

Recording uses a bundled content script and a messaging bridge, with an automatic CDP fallback (`chrome.debugger`) when this WebView cannot inject through scripting. If another extension owns the tab debugger, close that connection before replaying. No network permission or desktop Chrome is needed.

For the step format, read `pasos.md`. For runs, comparisons and reports, read `informes.md`.
