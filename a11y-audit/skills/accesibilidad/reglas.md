# Reglas y umbrales / Rules and thresholds

## ES

| Categoría | Peso | Reglas |
| --- | --- | --- |
| Contraste | 25 % | Texto normal ≥ 4.5:1; texto grande (≥ 24 px o ≥ 18.66 px en negrita) ≥ 3:1. Se compone el color con el primer fondo opaco ancestors. |
| Zonas táctiles | 20 % | Todo control interactivo visible debe medir al menos `min_tap_size` × `min_tap_size` px (44 por defecto). |
| Nombres accesibles | 20 % | Todo control interactivo debe tener texto visible, `aria-label`, `aria-labelledby`, `title`, `placeholder` o `<label>` asociado. |
| Texto alternativo | 10 % | `img` y `[role="img"]` necesitan `alt`. `alt=""` sin `aria-hidden="true"` se marca como decorativo ambiguo. |
| Orden de foco | 15 % | Sin `tabindex` positivo; ningún elemento enfocable con `aria-hidden="true"`; todo elemento con `onclick` o rol interactivo debe ser enfocable. |
| Estructura | 10 % | `<html lang>` presente e ids únicos. |

La puntuación por categoría empieza en 100 y resta 10 por error, 5 por aviso y 1 por información. La nota final es la media ponderada.

**Códigos**: `CONTRAST_LOW`, `TAP_TARGET_SMALL`, `NAME_MISSING`, `ALT_MISSING`, `ALT_EMPTY`, `ALT_TOO_LONG`, `POSITIVE_TABINDEX`, `INTERACTIVE_NOT_FOCUSABLE`, `ARIA_HIDDEN_FOCUSABLE`, `HTML_LANG_MISSING`, `DUPLICATE_ID`.

El modo HTML en línea es una aproximación: solo ve estilos en línea y no puede medir tamaños reales salvo que el `style` incluya `width`/`height`. Para una auditoría completa, usa la pestaña activa.

## EN

| Category | Weight | Rules |
| --- | --- | --- |
| Contrast | 25% | Normal text ≥ 4.5:1; large text (≥ 24 px or ≥ 18.66 px bold) ≥ 3:1. Colour is composited with the first opaque ancestor background. |
| Tap targets | 20% | Every visible interactive control should be at least `min_tap_size` × `min_tap_size` px (44 by default). |
| Accessible names | 20% | Every interactive control needs visible text, `aria-label`, `aria-labelledby`, `title`, `placeholder` or an associated `<label>`. |
| Alternative text | 10% | `img` and `[role="img"]` need `alt`. `alt=""` without `aria-hidden="true"` is flagged as ambiguous decoration. |
| Focus order | 15% | No positive `tabindex`; no focusable element with `aria-hidden="true"`; every `onclick` or interactive role must be focusable. |
| Structure | 10% | `<html lang>` present and unique ids. |

Each category starts at 100 and subtracts 10 per error, 5 per warning and 1 per info item. The final score is the weighted average.

**Codes**: `CONTRAST_LOW`, `TAP_TARGET_SMALL`, `NAME_MISSING`, `ALT_MISSING`, `ALT_EMPTY`, `ALT_TOO_LONG`, `POSITIVE_TABINDEX`, `INTERACTIVE_NOT_FOCUSABLE`, `ARIA_HIDDEN_FOCUSABLE`, `HTML_LANG_MISSING`, `DUPLICATE_ID`.

Inline HTML mode is an approximation: it only sees inline styles and cannot measure real sizes unless `style` includes `width`/`height`. For a full audit, scan the active tab.
