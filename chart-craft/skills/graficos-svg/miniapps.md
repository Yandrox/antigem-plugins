# Integrar en mini apps / Embedding in mini apps

## ES

El SVG generado no necesita runtime: es un archivo de texto. Tienes tres formas de usarlo en una mini app.

### 1. `dataUri` en una imagen

```html
<img src="DATA_URI_AQUI" alt="Ventas semanales">
```

Es la opción más simple. El `dataUri` ya viene codificado con `encodeURIComponent`, así que puedes pegarlo tal cual. Úsala cuando el gráfico sea estático.

### 2. `svg` en línea

```html
<div id="grafico"></div>
<script>
  document.getElementById('grafico').innerHTML = SVG_AQUI;
</script>
```

Úsalo si necesitas cambiar colores o etiquetas desde CSS. El SVG incluye `role="img"` y `aria-label`, así que mantiene su accesibilidad.

### 3. Archivo guardado

Con `output:"~/assets/ventas.svg"` y `dry_run:false` el SVG queda en disco. Cárgalo con la ruta relativa que use tu mini app. Es lo mejor cuando el gráfico se reutiliza en varias pantallas.

### CSS sin dependencias

`chart_palette` devuelve `cssVariables` con `--chart-color-1` ... `--chart-color-12` y `--chart-bg`. Pégalo en tu hoja de estilos:

```css
:root { /* pega el bloque cssVariables */ }
.stat { border-left: 4px solid var(--chart-color-1); }
```

No hay `@import`, ni `url()` remota, ni `fetch`. La mini app funciona con el avión en modo avión.

### Tamaño

Un gráfico de 500 puntos puede pasar de 100 KiB de SVG. Para tarjetas pequeñas usa `sparkline` (por defecto 240×72) o reduce los puntos antes de llamar a `chart_render`. El `dataUri` es aproximadamente un 30 % más grande que el SVG por la codificación.

### Errores típicos

- Pegar el `svg` dentro de un `<img src>`: no funciona; usa `dataUri` o `innerHTML`.
- Olvidar las comillas al pegar el `dataUri`: contiene `;` y `,`, va entre comillas.
- Poner `width` mayor que el ancho de la mini app: el SVG no escala solo; baja `width` o ajusta el contenedor con CSS.

## EN

The generated SVG needs no runtime: it is a text file. Three ways to use it in a mini app.

### 1. `dataUri` in an image

```html
<img src="DATA_URI_HERE" alt="Weekly sales">
```

Simplest option. The `dataUri` is already encoded with `encodeURIComponent`, so paste it as-is. Use it for static charts.

### 2. Inline `svg`

```html
<div id="chart"></div>
<script>
  document.getElementById('chart').innerHTML = SVG_HERE;
</script>
```

Use it when you need to change colours or labels from CSS. The SVG keeps `role="img"` and `aria-label`, so accessibility survives.

### 3. Saved file

With `output:"~/assets/sales.svg"` and `dry_run:false`, the SVG lands on disk. Load it with the relative path your mini app uses. Best when the chart is reused across screens.

### Dependency-free CSS

`chart_palette` returns `cssVariables` with `--chart-color-1` ... `--chart-color-12` and `--chart-bg`. Paste the block into your stylesheet:

```css
:root { /* paste the cssVariables block */ }
.stat { border-left: 4px solid var(--chart-color-1); }
```

No `@import`, no remote `url()`, no `fetch`. The mini app works in airplane mode.

### Size

A 500-point chart can exceed 100 KiB of SVG. For small cards use `sparkline` (240×72 by default) or reduce the points before calling `chart_render`. The `dataUri` is roughly 30% larger than the SVG because of encoding.

### Common mistakes

- Pasting `svg` into `<img src>`: does not work; use `dataUri` or `innerHTML`.
- Dropping the quotes around `dataUri`: it contains `;` and `,`, so keep it quoted.
- Setting `width` larger than the mini app viewport: the SVG will not scale by itself; lower `width` or size the container with CSS.
