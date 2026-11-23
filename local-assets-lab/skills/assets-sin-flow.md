---
name: Assets sin Flow / Assets without Flow
description: ES: Genera fondos, iconos, stickers y paletas SVG offline, sin Google Flow ni servicios remotos. EN: Generate offline SVG backgrounds, icons, stickers and palettes without Google Flow or remote services.
---

# Assets sin Flow / Assets without Flow

## ES

Usa esta skill cuando necesites visuales para un vídeo 2D, una mini app o una interfaz y no haya sesión de Google Flow. Todo se genera en SVG puro dentro del plugin; no hay CDNs, fuentes remotas ni llamadas de red.

Orden recomendado:

1. `asset_palette`: elige un preset o deriva una armonía desde un color base. Guarda los códigos devueltos.
2. `asset_background`: usa esos colores en `colors` (o pasa `palette`) y elige `style`. Para Shorts/Reels usa 1080×1920; para YouTube, 1920×1080.
3. `asset_icon` o `asset_sticker`: añade el elemento protagonista con la misma paleta.
4. Usa `dataUri` dentro de mini apps o `dataUriBase64` cuando el destino no acepte SVG escapado.
5. Si quieres archivos, pasa `output` con una ruta `~/...` o `/sdcard/...`; el plugin añade `.svg` si falta.

Para combinaciones listas, lee `recetas.md`. Para la lista de presets y armonías, lee `paletas.md`.

## EN

Use this skill when you need visuals for a 2D video, a mini app or an interface and there is no Google Flow session. Everything is generated as pure SVG inside the plugin: no CDNs, remote fonts or network calls.

Recommended order:

1. `asset_palette`: pick a preset or derive a harmony from a base color. Keep the returned codes.
2. `asset_background`: feed those colors into `colors` (or pass `palette`) and choose `style`. Use 1080×1920 for Shorts/Reels and 1920×1080 for YouTube.
3. `asset_icon` or `asset_sticker`: add the main element using the same palette.
4. Use `dataUri` inside mini apps or `dataUriBase64` when the destination does not accept escaped SVG.
5. For files, pass `output` with a `~/...` or `/sdcard/...` path; the plugin appends `.svg` if needed.

For ready-made combinations, read `recetas.md`. For presets and harmonies, read `paletas.md`.
