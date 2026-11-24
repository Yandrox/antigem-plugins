---
name: Gráficos SVG para mini apps / SVG charts for mini apps
description: ES: Genera gráficos SVG offline (barras, líneas, áreas, donas, dispersión, sparklines) con ejes, tooltips accesibles y paletas de alto contraste; úsala para dashboards en mini apps sin CDN. EN: Generate offline SVG charts (bars, lines, areas, donuts, scatter, sparklines) with axes, accessible tooltips and high-contrast palettes; use it for mini-app dashboards without a CDN.
---

# Gráficos SVG para mini apps / SVG charts for mini apps

## ES

Usa esta skill cuando una mini app necesite **mostrar datos** y no puedas meter una librería de gráficos. Todo se genera en el worker: SVG puro, sin fuentes remotas, sin scripts externos y sin llamadas de red.

### Flujo

1. **Prepara los datos** como array de objetos `{label, value}`. Para dispersión usa `{x, y}`; para varias series añade `series:"Ventas"`. También se aceptan números sueltos. Máximo 500 puntos; el worker recorta el resto y avisa.
2. **Elige el tipo** con `chart_render`: `bar`, `line`, `area`, `donut`, `scatter` o `sparkline`. Consulta `tipos.md`.
3. **Elige colores**: llama a `chart_palette` primero si el contraste importa (dashboard público, modo claro). Pasa el resultado en `colors`. Consulta `accesibilidad.md`.
4. **Ajusta la legibilidad**: `width`, `height`, `show_axes`, `show_grid`, `show_labels`, `value_format` (`number`, `percent`, `currency`, `compact`) y `unit`.
5. **Recoge `svg` y `dataUri`**. El `svg` es el documento completo; el `dataUri` va directo en `background-image` o en un `<img>`. Consulta `miniapps.md`.
6. **Opcionalmente guarda** el SVG con `output` + `dry_run:false` bajo `~/` o `/sdcard/`.

### Reglas prácticas

- `dry_run: true` por defecto en las dos tools. Sin `dry_run:false` no se escribe nada.
- `sparkline` ignora ejes, título y rejilla: es una línea limpia de 240×72 por defecto.
- `donut` dibuja un anillo con el total en el centro. Si todos los valores son 0, dibuja un círculo vacío.
- Si dos puntos tienen la misma `label` y `series`, se suman. Útil para agrupar por día.
- Los tooltips son `<title>` nativos de SVG: funcionan sin JavaScript y los lee un lector de pantalla.
- `accessible: false` produce un SVG más corto, pero pierde `role="img"`, `aria-label`, `<title>`, `<desc>` y tooltips. Solo úsalo si ya provees tu propia accesibilidad.

### Salida

`chart_render` devuelve `svg`, `dataUri`, `stats` (`count`, `min`, `max`, `mean`, `total`), `series`, `colors`, `warnings`, `markdown`, `written` y `path`.

`chart_palette` devuelve `colors` con `{hex, ratio, usage}`, `cssVariables` (`--chart-color-1` ...), `swatch`, `warnings`, `markdown`, `written` y `path`.

Lee `tipos.md` para elegir bien, `accesibilidad.md` para contraste y `miniapps.md` para integrar el resultado.

## EN

Use this skill when a mini app needs to **display data** and you cannot add a chart library. Everything is generated in the worker: pure SVG, no remote fonts, no external scripts and no network calls.

### Flow

1. **Prepare the data** as an array of `{label, value}` objects. Use `{x, y}` for scatter and add `series:"Sales"` for multiple series. Bare numbers are accepted too. Maximum 500 points; extras are truncated with a warning.
2. **Pick the type** with `chart_render`: `bar`, `line`, `area`, `donut`, `scatter` or `sparkline`. See `tipos.md`.
3. **Pick colours**: call `chart_palette` first when contrast matters (public dashboard, light mode) and pass the result in `colors`. See `accesibilidad.md`.
4. **Tune readability**: `width`, `height`, `show_axes`, `show_grid`, `show_labels`, `value_format` (`number`, `percent`, `currency`, `compact`) and `unit`.
5. **Collect `svg` and `dataUri`**. `svg` is the full document; `dataUri` drops straight into `background-image` or an `<img>`. See `miniapps.md`.
6. **Optionally save** the SVG with `output` + `dry_run:false` under `~/` or `/sdcard/`.

### Practical rules

- `dry_run: true` by default in both tools. Nothing is written without `dry_run:false`.
- `sparkline` ignores axes, title and grid: a clean 240×72 line by default.
- `donut` draws a ring with the total in the centre. If every value is 0, it draws an empty circle.
- Points sharing `label` and `series` are summed. Useful for grouping by day.
- Tooltips are native SVG `<title>` elements: they work without JavaScript and screen readers announce them.
- `accessible: false` produces a shorter SVG but drops `role="img"`, `aria-label`, `<title>`, `<desc>` and tooltips. Only use it if you provide your own accessibility.

### Output

`chart_render` returns `svg`, `dataUri`, `stats` (`count`, `min`, `max`, `mean`, `total`), `series`, `colors`, `warnings`, `markdown`, `written` and `path`.

`chart_palette` returns `colors` with `{hex, ratio, usage}`, `cssVariables` (`--chart-color-1` ...), `swatch`, `warnings`, `markdown`, `written` and `path`.

Read `tipos.md` to choose well, `accesibilidad.md` for contrast and `miniapps.md` to integrate the result.
