# Accesibilidad y contraste / Accessibility and contrast

## ES

`chart_palette` calcula el ratio WCAG de cada color sobre el fondo indicado. Ese ratio es entre el color y el fondo, no entre colores adyacentes.

| Ratio | `usage` | Uso recomendado |
| --- | --- | --- |
| ≥ 4.5 | `texto y gráfico` / `text and graphic` | líneas, texto, etiquetas |
| 3 – 4.5 | `solo gráfico` / `graphic only` | barras y rellenos grandes |
| < 3 | `bajo contraste` / `low contrast` | solo decoración; aparece en `warnings` |

El esquema `accessible` solo contiene colores claros pensados para el fondo oscuro por defecto (`#0B1020`). Si cambias el `background`, vuelve a pedir la paleta: los ratios se recalculan.

### Accesibilidad del SVG

Con `accessible: true` (por defecto) el SVG incluye:

- `role="img"` y un `aria-label` que resume tipo, número de puntos y rango.
- `<title>` con el título del gráfico y `<desc>` con una descripción del total.
- Un `<title>` dentro de cada barra, punto o porción con `etiqueta: valor formateado`. Es el tooltip nativo: no necesita JavaScript y lo anuncia un lector de pantalla.
- Textos con relleno del tema (`text`, `axis`, `muted`) que también se calculan para contraste.

### Checklist

- [ ] El `aria-label` menciona el tipo de dato, no solo "gráfico".
- [ ] Si el gráfico es bilingüe, `language:"both"` da etiquetas ES/EN en el mismo SVG.
- [ ] Las series tienen nombres (`series`) en vez de "Series 1", "Series 2".
- [ ] El fondo elegido deja las líneas por encima de 4.5:1.
- [ ] No se usa el color como único canal: acompaña las porciones con `label`.
- [ ] En modo claro, usa el esquema `categorical` en vez de `contrast`.

### Limitaciones

El plugin no genera patrones ni texturas para daltonismo: solo colores y sus ratios. Si dos series tienen ratios parecidos y se solapan, cambia el tipo de gráfico (barras agrupadas en vez de áreas) en lugar de confiar en el matiz.

## EN

`chart_palette` computes each colour's WCAG ratio against the given background. That ratio is colour-to-background, not colour-to-colour.

| Ratio | `usage` | Recommended use |
| --- | --- | --- |
| ≥ 4.5 | `text and graphic` | lines, text, labels |
| 3 – 4.5 | `graphic only` | bars and large fills |
| < 3 | `low contrast` | decoration only; reported in `warnings` |

The `accessible` scheme contains only light colours designed for the default dark background (`#0B1020`). If you change `background`, request the palette again: ratios are recalculated.

### SVG accessibility

With `accessible: true` (default) the SVG includes:

- `role="img"` and an `aria-label` summarising type, point count and range.
- `<title>` with the chart title and `<desc>` with a total description.
- A `<title>` inside every bar, point or slice with `label: formatted value`. This is the native tooltip: no JavaScript needed and screen readers announce it.
- Text fills from the theme (`text`, `axis`, `muted`), also chosen for contrast.

### Checklist

- [ ] The `aria-label` names the data, not just "chart".
- [ ] For bilingual charts, `language:"both"` puts ES/EN labels in the same SVG.
- [ ] Series have names (`series`) instead of "Series 1", "Series 2".
- [ ] The chosen background keeps lines above 4.5:1.
- [ ] Colour is not the only channel: pair slices with `label`.
- [ ] In light mode, prefer the `categorical` scheme over `contrast`.

### Limitations

The plugin does not generate patterns or textures for colour blindness: only colours and their ratios. If two overlapping series have similar ratios, change the chart type (grouped bars instead of areas) rather than relying on hue.
