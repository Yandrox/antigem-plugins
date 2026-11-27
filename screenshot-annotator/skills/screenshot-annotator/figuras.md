# Figuras y referencia / Shapes and reference

## ES

### Campos por figura

| `type` | Obligatorios | Opcionales | Default |
| --- | --- | --- | --- |
| `rect` | `x`, `y` | `width`/`w`=40, `height`/`h`=40, `color`=#EF4444, `stroke_width`=3, `dash`, `radius`=0, `label` | sin relleno, borde rojo. |
| `arrow` | `x1`, `y1`, `x2`, `y2` | `color`=#F59E0B, `stroke_width`=4, `label` | punta rellena calculada automáticamente. |
| `number` | `x`, `y` | `value`=índice, `color`=#DC2626, `size`=16 | círculo rojo con número blanco. |
| `text` | `x`, `y`, `text` | `color`=#1D4ED8, `size`=16 | texto azul con contorno blanco. |
| `ellipse` | `x`, `y` | `rx`/`width`=40, `ry`/`height`=40, `color`=#7C3AED, `stroke_width`=3 | borde morado sin relleno. |

Alias: `rectangle` y `box` → `rect`; `badge` → `number`; `label` → `text`; `circle` → `ellipse`.

Todas las coordenadas están en píxeles de la imagen original, con el origen arriba-izquierda. Si un valor supera el lienzo se recorta y se añade un aviso. Los colores permitidos son `#RGB`, `#RRGGBB` y `red`, `orange`, `yellow`, `green`, `blue`, `navy`, `purple`, `magenta`, `cyan`, `teal`, `black`, `white`, `gray`, `grey`, `pink`, `brown`.

### Ejemplo de llamada

```json
{
  "name": "annotation_svg",
  "arguments": {
    "image": "~/bugs/captura.png",
    "title": "Error en el botón Guardar",
    "shapes": [
      {"type": "rect", "x": 120, "y": 200, "w": 180, "h": 60, "label": "Botón Guardar", "color": "#EF4444"},
      {"type": "arrow", "x1": 300, "y1": 90, "x2": 220, "y2": 205, "label": "Aquí falla", "color": "#F59E0B"},
      {"type": "number", "x": 60, "y": 230, "value": 1},
      {"type": "text", "x": 30, "y": 300, "text": "Revisar validación", "size": 18}
    ],
    "output": "~/bugs/captura.svg",
    "dry_run": false
  }
}
```

Visor HTML:

```json
{
  "name": "annotation_page",
  "arguments": {
    "image": "~/bugs/captura.png",
    "shapes": [{"type": "rect", "x": 120, "y": 200, "w": 180, "h": 60}],
    "output": "~/bugs/visor.html",
    "embed_image": false,
    "dry_run": false
  }
}
```

Informe Markdown:

```json
{
  "name": "annotation_report",
  "arguments": {
    "image": "~/bugs/captura.png",
    "shapes": [{"type": "rect", "x": 120, "y": 200, "w": 180, "h": 60}],
    "svg_path": "~/bugs/captura.svg",
    "html_path": "~/bugs/visor.html",
    "notes": "Ocurre en Android 14\nSolo con el tema oscuro",
    "output": "~/bugs/informe.md",
    "dry_run": false
  }
}
```

### Rutas relativas

Si el HTML está en `~/bugs/visor.html` y la imagen en `~/capturas/captura.png`, el atributo `src` queda `../capturas/captura.png`. El cálculo compara los segmentos comunes desde la raíz `~/`, `/sdcard/` o `/data/`. Si las raíces son distintas, se usa la ruta absoluta. Con `embed_image:true` se genera una URI `data:` y no hay dependencia de rutas.

### Estructura del SVG

El SVG es transparente y usa `viewBox="0 0 ancho alto"`, así que se puede superponer directamente sobre la imagen. Cada figura va en un `<g data-shape="N">` con un `<title>` accesible. Las etiquetas de texto usan `paint-order="stroke fill"` con contorno blanco para que se lean sobre fondos claros u oscuros. La punta de cada flecha es un polígono calculado a partir del ángulo, sin marcadores externos.

### Estructura del HTML

- Un checkbox con CSS (sin JavaScript) muestra u oculta la capa.
- Dos bloques: primero la imagen con anotaciones y después la imagen original.
- Una tabla con índice, tipo, descripción y posición de cada figura.
- Estilos en línea, sin fuentes ni scripts remotos.
- La imagen se incrusta en base64 solo si se pide; por defecto se usa una ruta relativa.

### Estructura del informe

`## ES` y `## EN` con ruta de la imagen, dimensiones, número de anotaciones, rutas de SVG/HTML, notas en viñetas, tabla de anotaciones y checklist de verificación. Los avisos se añaden como citas al final de cada idioma.

### Problemas comunes

| Síntoma | Causa | Acción |
| --- | --- | --- |
| `No se pudieron leer las dimensiones` | Formato no reconocido o archivo corrupto. | Pasa `width` y `height` a mano. |
| `La lista de anotaciones está vacía` | `shapes` vacío o solo figuras desconocidas. | Revisa los `type`. |
| `Color no permitido` | Color con formato raro o valor CSS complejo. | Usa `#RRGGBB` o un nombre básico. |
| Avisos de coordenadas | La figura sale del lienzo. | Ajusta `x`, `y`, `w`, `h`. |
| La imagen no aparece en el HTML | Ruta relativa rota al mover solo el HTML. | Mueve imagen y HTML juntos o usa `embed_image:true`. |
| `Ya existe ...` | La ruta de salida está ocupada. | Elige otro nombre; no se sobrescribe nada. |

## EN

### Fields per shape

| `type` | Required | Optional | Default |
| --- | --- | --- | --- |
| `rect` | `x`, `y` | `width`/`w`=40, `height`/`h`=40, `color`=#EF4444, `stroke_width`=3, `dash`, `radius`=0, `label` | no fill, red border. |
| `arrow` | `x1`, `y1`, `x2`, `y2` | `color`=#F59E0B, `stroke_width`=4, `label` | filled head computed automatically. |
| `number` | `x`, `y` | `value`=index, `color`=#DC2626, `size`=16 | red circle with white number. |
| `text` | `x`, `y`, `text` | `color`=#1D4ED8, `size`=16 | blue text with white outline. |
| `ellipse` | `x`, `y` | `rx`/`width`=40, `ry`/`height`=40, `color`=#7C3AED, `stroke_width`=3 | purple border, no fill. |

Aliases: `rectangle` and `box` → `rect`; `badge` → `number`; `label` → `text`; `circle` → `ellipse`.

All coordinates are pixels of the original image, origin at the top-left. Values beyond the canvas are clamped and a warning is added. Allowed colours are `#RGB`, `#RRGGBB` and `red`, `orange`, `yellow`, `green`, `blue`, `navy`, `purple`, `magenta`, `cyan`, `teal`, `black`, `white`, `gray`, `grey`, `pink`, `brown`.

### Example call

```json
{
  "name": "annotation_svg",
  "arguments": {
    "image": "~/bugs/screenshot.png",
    "title": "Save button error",
    "shapes": [
      {"type": "rect", "x": 120, "y": 200, "w": 180, "h": 60, "label": "Save button", "color": "#EF4444"},
      {"type": "arrow", "x1": 300, "y1": 90, "x2": 220, "y2": 205, "label": "Fails here", "color": "#F59E0B"},
      {"type": "number", "x": 60, "y": 230, "value": 1},
      {"type": "text", "x": 30, "y": 300, "text": "Check validation", "size": 18}
    ],
    "output": "~/bugs/screenshot.svg",
    "dry_run": false
  }
}
```

HTML viewer:

```json
{
  "name": "annotation_page",
  "arguments": {
    "image": "~/bugs/screenshot.png",
    "shapes": [{"type": "rect", "x": 120, "y": 200, "w": 180, "h": 60}],
    "output": "~/bugs/viewer.html",
    "embed_image": false,
    "dry_run": false
  }
}
```

Markdown report:

```json
{
  "name": "annotation_report",
  "arguments": {
    "image": "~/bugs/screenshot.png",
    "shapes": [{"type": "rect", "x": 120, "y": 200, "w": 180, "h": 60}],
    "svg_path": "~/bugs/screenshot.svg",
    "html_path": "~/bugs/viewer.html",
    "notes": "Happens on Android 14\nOnly with the dark theme",
    "output": "~/bugs/report.md",
    "dry_run": false
  }
}
```

### Relative paths

If the HTML is at `~/bugs/viewer.html` and the image at `~/captures/screenshot.png`, the `src` attribute becomes `../captures/screenshot.png`. The calculation compares common segments from the `~/`, `/sdcard/` or `/data/` root. If roots differ, the absolute path is used. With `embed_image:true` a `data:` URI is generated and there is no path dependency.

### SVG structure

The SVG is transparent and uses `viewBox="0 0 width height"`, so it can be stacked directly over the image. Every shape sits in a `<g data-shape="N">` with an accessible `<title>`. Text labels use `paint-order="stroke fill"` with a white outline so they stay readable on light or dark backgrounds. Each arrowhead is a polygon computed from the angle, with no external markers.

### HTML structure

- A checkbox with CSS (no JavaScript) shows or hides the layer.
- Two blocks: first the annotated image, then the original image.
- A table with index, type, description and position of each shape.
- Inline styles, no remote fonts or scripts.
- The image is embedded as base64 only when requested; a relative path is used by default.

### Report structure

`## ES` and `## EN` with the image path, dimensions, annotation count, SVG/HTML paths, notes as bullets, an annotation table and a verification checklist. Warnings are appended as quotes at the end of each language section.

### Common issues

| Symptom | Cause | Action |
| --- | --- | --- |
| `Could not read dimensions` | Unrecognised or corrupt format. | Pass `width` and `height` manually. |
| `The annotation list is empty` | Empty `shapes` or only unknown shapes. | Check the `type` values. |
| `Colour not allowed` | Odd colour format or complex CSS value. | Use `#RRGGBB` or a basic name. |
| Coordinate warnings | A shape falls outside the canvas. | Adjust `x`, `y`, `w`, `h`. |
| Image missing in the HTML | Relative path broke after moving only the HTML. | Move image and HTML together or use `embed_image:true`. |
| `Already exists ...` | Output path is occupied. | Choose another name; nothing is overwritten. |
