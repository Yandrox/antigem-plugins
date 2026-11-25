# Contraste WCAG y parejas auditadas / WCAG contrast and audited pairs

## ES

El contraste se calcula con la fórmula WCAG 2.1 sobre el espacio sRGB: se linealiza cada canal, se obtiene la luminancia relativa `L` y se aplica `(L_claro + 0.05) / (L_oscuro + 0.05)`. El resultado va de 1:1 (idénticos) a 21:1 (blanco sobre negro).

### Umbrales

| Nivel | Texto normal | Texto grande (≥18 pt o ≥14 pt negrita) | UI / gráficos |
| --- | --- | --- | --- |
| AA | 4.5:1 | 3:1 | 3:1 |
| AAA | 7:1 | 4.5:1 | — |

`audit_theme` no conoce el tamaño real de la fuente en cada superficie. Por eso:

- `ratio ≥ min` → `pass`.
- `3 ≤ ratio < 4.5` con mínimo 4.5 → `LARGE_TEXT_ONLY` (**warning**): puede ser válido en títulos.
- `ratio < 3` con mínimo 4.5 → `FAIL_CONTRAST` (**error**).
- `ratio < 3` con mínimo 3 (bordes, cursores, ANSI) → `WEAK_UI` (**warning**).

AAA se menciona como referencia, pero el criterio de aprobado del informe es AA.

### Colores de entrada

Acepta `#RGB`, `#RRGGBB`, `#ARGB`, `#AARRGGBB` y `rgb()/rgba()`. Los temas de AntiGem usan `#AARRGGBB`, por ejemplo `#FF0A0B14`: `FF` es el alfa opaco y `0A0B14` es el color. Si el alfa es menor que 1, el contraste se calcula **ignorando la transparencia** y se emite `LOW_ALPHA`: el resultado es orientativo.

### Parejas por grupo

| Grupo | Parejas (texto → fondo) | Mínimo |
| --- | --- | --- |
| Interfaz | `on_background→background`, `on_surface→surface`, `on_surface→card`, `on_surface_variant→surface_variant`, `text_secondary→surface`, `on_primary→primary`, `on_secondary→secondary`, `on_tertiary→tertiary`, `on_*_container→*_container`, `inverse_on_surface→inverse_surface` | 4.5 |
| Interfaz (UI) | `outline→surface`, `outline_variant→surface_variant`, `border→card` | 3 |
| Estados | `on_error→error`, `on_error_container→error_container`, `success→surface`, `warning→surface`, `danger→surface`, `info→surface` | 4.5 |
| Código | `code_text`, `syntax_keyword`, `syntax_type`, `syntax_string`, `syntax_number`, `syntax_comment`, `syntax_function`, `syntax_annotation`, `syntax_punctuation`, `syntax_control`, `syntax_tag`, `syntax_attribute` → `code_bg` | 4.5 |
| Editor | `editor_text→editor_bg`, `editor_muted→editor_panel`, `editor_added_text→editor_added_bg`, `editor_removed_text→editor_removed_bg`, `editor_info_text→editor_info_bg`, `editor_text→editor_selection` | 4.5 |
| Editor (UI) | `editor_border→editor_panel` | 3 |
| Terminal | `terminal_fg→terminal_bg`, `terminal_cursor→terminal_bg`, `ansi_0…ansi_15→terminal_bg` | 4.5 / 3 |

Las parejas `syntax_control`, `syntax_tag` y `editor_*` pueden faltar: AntiGem las deriva de otras cuando no se definen. Si el token no existe, la pareja se omite silenciosamente; si falta todo el grupo, aparece `GROUP_MISSING`.

### Cómo se calcula una corrección

`suggested_update` conserva el tono del color original: mezcla el RGB del foreground con blanco (si el fondo es oscuro) o con negro (si el fondo es claro) en pasos del 2 % hasta superar el mínimo + 0.15. Devuelve `#RRGGBB` opaco.

- Es una **propuesta legible**, no una garantía estética: revísala antes de aplicar.
- Los colores que son `seed` se proponen al final. Cambiar un seed regenera contenedores, textos `on_*` y bordes: vuelve a auditar.
- `theme_update` solo cambia los tokens que le pasas; los dependientes se recalculan.
- Los temas integrados no se pueden editar: `theme_duplicate` primero.

### Ejemplo de aplicación segura

```text
1. audit_theme({theme: <theme_get>, tokens: <theme_tokens>})
   → errors: 2, warnings: 4
   → suggested_update.colors = {"syntax_comment":"#FF8E94B8","editor_muted":"#FF9BA1B8"}

2. theme_duplicate({id:"midnight_aurora", name:"Midnight Aurora legible"})

3. theme_update({id:"<copia>", colors: <suggested_update.colors>, apply:false})

4. Preguntar al usuario: "¿aplico estos dos colores?"

5. theme_update({id:"<copia>", apply:true})

6. theme_get({id:"<copia>"}) → audit_theme(...) → errors: 0
```

Si el usuario no confirma, el tema original queda intacto: `audit_theme` nunca lo ha tocado.

## EN

Contrast uses the WCAG 2.1 formula on sRGB: linearize each channel, compute relative luminance `L`, then `(L_light + 0.05) / (L_dark + 0.05)`. The result runs from 1:1 (identical) to 21:1 (white on black).

### Thresholds

| Level | Normal text | Large text (≥18 pt or ≥14 pt bold) | UI / graphics |
| --- | --- | --- | --- |
| AA | 4.5:1 | 3:1 | 3:1 |
| AAA | 7:1 | 4.5:1 | — |

`audit_theme` does not know the real font size on each surface, so:

- `ratio ≥ min` → `pass`.
- `3 ≤ ratio < 4.5` with a 4.5 minimum → `LARGE_TEXT_ONLY` (**warning**): valid for headings.
- `ratio < 3` with a 4.5 minimum → `FAIL_CONTRAST` (**error**).
- `ratio < 3` with a 3 minimum (borders, cursors, ANSI) → `WEAK_UI` (**warning**).

AAA is shown for reference; the report passes on AA.

### Input colors

Accepts `#RGB`, `#RRGGBB`, `#ARGB`, `#AARRGGBB` and `rgb()/rgba()`. AntiGem themes use `#AARRGGBB`, e.g. `#FF0A0B14`: `FF` is opaque alpha and `0A0B14` is the color. When alpha is below 1, contrast is computed **ignoring transparency** and `LOW_ALPHA` is emitted: the result is indicative.

### Pairs by group

| Group | Pairs (text → background) | Minimum |
| --- | --- | --- |
| Interface | `on_background→background`, `on_surface→surface`, `on_surface→card`, `on_surface_variant→surface_variant`, `text_secondary→surface`, `on_primary→primary`, `on_secondary→secondary`, `on_tertiary→tertiary`, `on_*_container→*_container`, `inverse_on_surface→inverse_surface` | 4.5 |
| Interface (UI) | `outline→surface`, `outline_variant→surface_variant`, `border→card` | 3 |
| Status | `on_error→error`, `on_error_container→error_container`, `success→surface`, `warning→surface`, `danger→surface`, `info→surface` | 4.5 |
| Code | `code_text`, `syntax_keyword`, `syntax_type`, `syntax_string`, `syntax_number`, `syntax_comment`, `syntax_function`, `syntax_annotation`, `syntax_punctuation`, `syntax_control`, `syntax_tag`, `syntax_attribute` → `code_bg` | 4.5 |
| Editor | `editor_text→editor_bg`, `editor_muted→editor_panel`, `editor_added_text→editor_added_bg`, `editor_removed_text→editor_removed_bg`, `editor_info_text→editor_info_bg`, `editor_text→editor_selection` | 4.5 |
| Editor (UI) | `editor_border→editor_panel` | 3 |
| Terminal | `terminal_fg→terminal_bg`, `terminal_cursor→terminal_bg`, `ansi_0…ansi_15→terminal_bg` | 4.5 / 3 |

Pairs such as `syntax_control`, `syntax_tag` and some `editor_*` may be absent: AntiGem derives them when undefined. Missing tokens are skipped; a whole missing group produces `GROUP_MISSING`.

### How a fix is computed

`suggested_update` keeps the original hue: it mixes the foreground RGB with white (on a dark background) or black (on a light one) in 2% steps until the ratio exceeds the minimum + 0.15. It returns an opaque `#RRGGBB`.

- It is a **readable proposal**, not an aesthetic guarantee: review it before applying.
- `seed` colors are proposed last. Changing a seed regenerates containers, `on_*` text and outlines: audit again.
- `theme_update` changes only the tokens you pass; dependent ones are recalculated.
- Built-in themes cannot be edited: use `theme_duplicate` first.

### Safe application example

```text
1. audit_theme({theme: <theme_get>, tokens: <theme_tokens>})
   → errors: 2, warnings: 4
   → suggested_update.colors = {"syntax_comment":"#FF8E94B8","editor_muted":"#FF9BA1B8"}

2. theme_duplicate({id:"midnight_aurora", name:"Legible Midnight Aurora"})

3. theme_update({id:"<copy>", colors: <suggested_update.colors>, apply:false})

4. Ask the user: "Should I apply these two colors?"

5. theme_update({id:"<copy>", apply:true})

6. theme_get({id:"<copy>"}) → audit_theme(...) → errors: 0
```

If the user does not confirm, the original theme stays untouched: `audit_theme` never changed it.
