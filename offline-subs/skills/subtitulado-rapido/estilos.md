# Estilos / Styles

## ES

`subs_style` devuelve tres cosas útiles: un bloque CSS con la clase `.subtitle-caption`, un bloque `STYLE` para WebVTT y una checklist de publicación.

| Preset | Aspecto |
| --- | --- |
| `bold` | Blanco con contorno negro grueso y caja semitransparente. |
| `neon` | Cian brillante con halo y fondo oscuro. |
| `minimal` | Blanco suave, contorno fino y caja ligera. |
| `karaoke` | Amarillo con contorno cálido, pensado para música. |
| `banner` | Banda inferior opaca, máxima legibilidad. |

Perfiles por plataforma:

- Shorts y TikTok: 9:16, ~32 caracteres por línea, zona baja al 18-20 %.
- Reels: 9:16, ~34 caracteres, zona baja al 16 %.
- YouTube: 16:9, ~60 caracteres, zona baja al 8 %.
- `all`: valores intermedios y marca `9:16 / 16:9`.

El CSS usa solo fuentes del sistema (`system-ui`, `-apple-system`, `Segoe UI`, `Roboto`), sin `@import` ni URLs remotas. Puedes cambiar `color`, `outline_color`, `background`, `font_size`, `position` y `max_chars`.

Para guardar el CSS: `{"output":"~/estilos/shorts.css","dry_run":false}`. Sin `dry_run:false` obtienes el CSS en la respuesta.

## EN

`subs_style` returns three useful things: a CSS block with the `.subtitle-caption` class, a WebVTT `STYLE` block and a publishing checklist.

| Preset | Look |
| --- | --- |
| `bold` | White with a thick black outline and a semi-transparent box. |
| `neon` | Bright cyan with a glow and dark background. |
| `minimal` | Soft white, thin outline and a light box. |
| `karaoke` | Yellow with a warm outline, designed for music. |
| `banner` | Opaque bottom band for maximum readability. |

Platform profiles:

- Shorts and TikTok: 9:16, ~32 characters per line, lower area at 18-20%.
- Reels: 9:16, ~34 characters, lower area at 16%.
- YouTube: 16:9, ~60 characters, lower area at 8%.
- `all`: in-between values and a `9:16 / 16:9` label.

The CSS uses system fonts only (`system-ui`, `-apple-system`, `Segoe UI`, `Roboto`), with no `@import` or remote URLs. You can change `color`, `outline_color`, `background`, `font_size`, `position` and `max_chars`.

To save the CSS: `{"output":"~/styles/shorts.css","dry_run":false}`. Without `dry_run:false` you only get the CSS in the response.
