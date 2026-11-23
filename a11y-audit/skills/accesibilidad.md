---
name: Accesibilidad / Accessibility
description: ES: Audita contraste, zonas táctiles, ARIA, texto alternativo, foco y nombres en mini apps y WebViews; genera informe y correcciones. EN: Audit contrast, tap targets, ARIA, alt text, focus and names in mini apps and WebViews; generate report and fixes.
---

# Accesibilidad / Accessibility

## ES

Usa esta skill antes de publicar una mini app o cuando quieras revisar una WebView desde AntiGem. Todo se procesa en el dispositivo.

1. `a11y_scan`:
   - Sin argumentos, inspecciona la pestaña activa.
   - Con `html`, analiza HTML en línea.
   - Con `html_path`, lee un archivo local (`~/...` o `/sdcard/...`).
   - Ajusta `min_tap_size` (44 px por defecto), `contrast_normal` (4.5), `contrast_large` (3) y `max_elements` (2000).
2. Revisa `score`, `grade`, `categoryScores` y `findings`. Cada hallazgo trae sugerencia en español e inglés y, cuando aplica, el selector del elemento.
3. `a11y_fix_suggestions`: prioriza las correcciones y muestra fragmentos de código. Previsualiza por defecto; `output` + `dry_run:false` guarda el `.md`.
4. `a11y_report`: informe Markdown bilingüe con puntuación, tabla de hallazgos y correcciones. También previsualiza por defecto.

Para escanear una pestaña, déjala activa. El plugin intenta primero el puente del content script, luego CDP (`chrome.debugger`) y finalmente `scripting.executeScript`. Si otra extensión tiene el debugger de esa pestaña, ciérralo antes de repetir el escaneo.

Lee `reglas.md` para los códigos y umbrales, e `informes.md` para guardar y reutilizar resultados.

## EN

Use this skill before publishing a mini app or when reviewing a WebView from AntiGem. Everything is processed on the device.

1. `a11y_scan`:
   - With no arguments, inspects the active tab.
   - With `html`, analyses inline HTML.
   - With `html_path`, reads a local file (`~/...` or `/sdcard/...`).
   - Tune `min_tap_size` (44 px by default), `contrast_normal` (4.5), `contrast_large` (3) and `max_elements` (2000).
2. Review `score`, `grade`, `categoryScores` and `findings`. Every finding includes a Spanish and English suggestion and, when available, the element selector.
3. `a11y_fix_suggestions`: prioritises fixes with code snippets. It previews by default; `output` + `dry_run:false` saves the `.md`.
4. `a11y_report`: bilingual Markdown report with score, findings table and fixes. It also previews by default.

For tab scanning, leave the tab active. The plugin tries the content-script bridge first, then CDP (`chrome.debugger`) and finally `scripting.executeScript`. If another extension owns the tab debugger, close that connection before scanning again.

Read `reglas.md` for codes and thresholds, and `informes.md` for saving and reusing results.
