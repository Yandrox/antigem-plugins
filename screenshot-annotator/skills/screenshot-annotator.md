---
name: Anotador de capturas / Screenshot annotator
description: ES: Anota capturas sin tocar el original: genera un overlay SVG con flechas, rectángulos, números y texto, un visor HTML offline que muestra ambas capas y un informe Markdown bilingüe para reportar bugs. Híbrido y offline. / EN: Annotate screenshots without touching the original: generate an SVG overlay with arrows, rectangles, numbers and text, an offline HTML viewer showing both layers and a bilingual Markdown bug report. Hybrid and offline.
---

# Anotador de capturas / Screenshot annotator

## ES

Esta skill usa el plugin `screenshot-annotator` (3 tools, sin red). La captura original **nunca se modifica**: el plugin solo genera un SVG transparente con las anotaciones, una página HTML que superpone ese SVG sobre la imagen y un informe Markdown con el listado de anotaciones y una checklist. Es ideal para informes de bugs, revisiones de UI y documentación.

**Regla de oro:** guarda las anotaciones en archivos nuevos (`.svg`, `.html`, `.md`) y mantén la captura original como evidencia intacta.

### Cuándo usarla

- Señalar un elemento roto en una captura antes de abrir un issue.
- Numerar los pasos de un flujo directamente sobre la pantalla.
- Explicar a otra persona dónde mirar sin editar la prueba.
- Generar un visor que permita comparar la captura con y sin anotaciones.
- Adjuntar un informe reproducible con pasos, notas y verificación.

### Flujo recomendado

1. Identifica la ruta de la captura y, si puedes, sus dimensiones. Si omites `width`/`height`, el plugin las lee del PNG, JPEG, GIF o WebP.
2. Describe cada señal como una figura: `rect` para resaltar una zona, `arrow` para dirigir la mirada, `number` para ordenar pasos, `text` para una explicación corta y `ellipse` para un círculo de atención.
3. Llama a `annotation_svg` con `dry_run:true` para revisar el SVG y los avisos de coordenadas fuera del lienzo.
4. Llama a `annotation_page` con la ruta `.html` de salida. Por defecto la imagen se referencia por ruta relativa; usa `embed_image:true` si el HTML debe ser autocontenido (máximo 8 MiB).
5. Llama a `annotation_report` con `svg_path`, `html_path` y tus `notes`; escribe el `.md` con `dry_run:false`.

### Tools

| Tool | Salida | Parámetros clave |
| --- | --- | --- |
| `annotation_svg` | SVG transparente con las figuras. | `image`, `shapes`, `width`, `height`, `title`, `output`, `dry_run`. |
| `annotation_page` | HTML sin dependencias con original + capa + interruptor + comparación. | `image`, `shapes`, `output`, `embed_image`, `dry_run`. |
| `annotation_report` | Markdown ES/EN con tabla de anotaciones y checklist. | `image`, `shapes`, `svg_path`, `html_path`, `notes`, `output`, `dry_run`. |

### Figuras admitidas

| `type` | Campos | Uso |
| --- | --- | --- |
| `rect` | `x`, `y`, `width`/`w`, `height`/`h`, `color`, `dash`, `radius`, `label` | Rodear un botón o un panel. |
| `arrow` | `x1`, `y1`, `x2`, `y2`, `color`, `stroke_width`, `label` | Señalar un elemento desde lejos. |
| `number` | `x`, `y`, `value` (1-99), `color`, `size` | Numerar pasos con círculo. |
| `text` | `x`, `y`, `text`, `color`, `size` | Explicación corta con contorno blanco. |
| `ellipse` | `x`, `y`, `rx`, `ry`, `color` | Llamar la atención sin ángulos. |

Los alias `rectangle`, `box`, `badge`, `label` y `circle` también funcionan. Los colores aceptados son `#RGB`, `#RRGGBB` y una lista corta de nombres básicos; cualquier otro valor se rechaza para evitar inyección en el SVG/HTML.

### Reglas

- Las rutas empiezan por `~/`, `/sdcard/` o `/data/` y no pueden contener `..`.
- `dry_run` es `true` por defecto: la tool devuelve el contenido pero no escribe. Escribe solo cuando el usuario lo pida.
- Ninguna tool sobrescribe archivos: si la ruta ya existe, falla y hay que elegir otro nombre.
- Las coordenadas se ajustan al lienzo y se avisa cuando una figura sale de los límites. Revisa siempre `warnings`.
- Máximo 60 figuras y 200 caracteres por texto o etiqueta.
- La ruta de la imagen en el HTML es relativa al archivo `.html`, así que puedes mover ambos juntos sin romper el enlace.
- El visor no carga fuentes, scripts ni estilos remotos: funciona abriendo el `.html` directamente.
- La checklist del informe no sustituye la revisión humana de datos sensibles visibles en la captura.

Lee `figuras.md` para ejemplos de llamada, la tabla completa de campos, el formato del informe y la resolución de problemas.

## EN

This skill uses the `screenshot-annotator` plugin (3 tools, no network). The original screenshot is **never modified**: the plugin only generates a transparent SVG overlay, an HTML page that stacks that SVG over the image and a Markdown report listing the annotations plus a checklist. It is ideal for bug reports, UI reviews and documentation.

**Golden rule:** save annotations into new files (`.svg`, `.html`, `.md`) and keep the original screenshot as untouched evidence.

### When to use it

- Point at a broken element in a screenshot before opening an issue.
- Number the steps of a flow directly on the screen.
- Show someone where to look without editing the evidence.
- Produce a viewer that compares the screenshot with and without annotations.
- Attach a reproducible report with steps, notes and verification.

### Recommended flow

1. Identify the screenshot path and, if possible, its dimensions. If you omit `width`/`height`, the plugin reads them from PNG, JPEG, GIF or WebP.
2. Describe each cue as a shape: `rect` to highlight an area, `arrow` to direct attention, `number` to order steps, `text` for a short explanation and `ellipse` for a circle of attention.
3. Call `annotation_svg` with `dry_run:true` to review the SVG and warnings about out-of-canvas coordinates.
4. Call `annotation_page` with the `.html` output path. By default the image is referenced by relative path; use `embed_image:true` if the HTML must be self-contained (max 8 MiB).
5. Call `annotation_report` with `svg_path`, `html_path` and your `notes`; write the `.md` with `dry_run:false`.

### Tools

| Tool | Output | Key parameters |
| --- | --- | --- |
| `annotation_svg` | Transparent SVG with the shapes. | `image`, `shapes`, `width`, `height`, `title`, `output`, `dry_run`. |
| `annotation_page` | Dependency-free HTML with original + overlay + toggle + comparison. | `image`, `shapes`, `output`, `embed_image`, `dry_run`. |
| `annotation_report` | Bilingual Markdown with annotation table and checklist. | `image`, `shapes`, `svg_path`, `html_path`, `notes`, `output`, `dry_run`. |

### Supported shapes

| `type` | Fields | Use |
| --- | --- | --- |
| `rect` | `x`, `y`, `width`/`w`, `height`/`h`, `color`, `dash`, `radius`, `label` | Box a button or panel. |
| `arrow` | `x1`, `y1`, `x2`, `y2`, `color`, `stroke_width`, `label` | Point at an element from a distance. |
| `number` | `x`, `y`, `value` (1-99), `color`, `size` | Number steps inside a circle. |
| `text` | `x`, `y`, `text`, `color`, `size` | Short explanation with a white outline. |
| `ellipse` | `x`, `y`, `rx`, `ry`, `color` | Draw attention without corners. |

The aliases `rectangle`, `box`, `badge`, `label` and `circle` also work. Accepted colours are `#RGB`, `#RRGGBB` and a short list of basic names; anything else is rejected to prevent injection into the SVG/HTML.

### Rules

- Paths start with `~/`, `/sdcard/` or `/data/` and may not contain `..`.
- `dry_run` defaults to `true`: the tool returns the content but writes nothing. Write only when the user asks.
- No tool overwrites files: if the path exists, it fails and you must choose another name.
- Coordinates are clamped to the canvas and a warning is emitted when a shape goes out of bounds. Always review `warnings`.
- Maximum 60 shapes and 200 characters per text or label.
- The image path in the HTML is relative to the `.html` file, so you can move both together without breaking the link.
- The viewer loads no remote fonts, scripts or styles: open the `.html` directly and it works.
- The report checklist does not replace human review of sensitive data visible in the screenshot.

Read `figuras.md` for call examples, the full field table, report format and troubleshooting.
