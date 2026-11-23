# Recetas / Recipes

Todas las recetas son offline y usan solo las cuatro herramientas del plugin. / All recipes are offline and use only the four plugin tools.

## ES — Shorts / Reels (9:16)

1. `asset_palette` con `{"name":"candy"}`.
2. `asset_background` con `{"style":"halftone","width":1080,"height":1920,"palette":"candy","spacing":72,"seed":4}`.
3. `asset_sticker` con `{"shape":"burst","text":"TOP 3","subtext":"EN 30 SEG","color":"#FF477E","width":900,"height":900,"background":"none","rotation":-8}`.
4. Guarda ambos con `output` si los vas a importar en el estudio 2D.

## ES — YouTube (16:9)

1. `asset_palette` con `{"base":"#0B132B","harmony":"analogous","count":5}`.
2. `asset_background` con `{"style":"waves","width":1920,"height":1080,"palette":"ocean","seed":12}`.
3. `asset_icon` con `{"shape":"play","color":"#6FFFE9","background":"circle","size":512}`.

## ES — Mini app offline

- Pide siempre `dataUri` e insértalo en `src` de una etiqueta `<img>`.
- Si el WebView o el runtime no acepta `%` escapado, usa `dataUriBase64`.
- Para botones, genera `asset_icon` con `background:"none"` y el color del tema; el SVG hereda el color porque está incrustado.

## EN — Shorts / Reels (9:16)

1. `asset_palette` with `{"name":"candy"}`.
2. `asset_background` with `{"style":"halftone","width":1080,"height":1920,"palette":"candy","spacing":72,"seed":4}`.
3. `asset_sticker` with `{"shape":"burst","text":"TOP 3","subtext":"IN 30 SEC","color":"#FF477E","width":900,"height":900,"background":"none","rotation":-8}`.
4. Save both with `output` if you plan to import them into the 2D studio.

## EN — YouTube (16:9)

1. `asset_palette` with `{"base":"#0B132B","harmony":"analogous","count":5}`.
2. `asset_background` with `{"style":"waves","width":1920,"height":1080,"palette":"ocean","seed":12}`.
3. `asset_icon` with `{"shape":"play","color":"#6FFFE9","background":"circle","size":512}`.

## EN — Offline mini app

- Always request `dataUri` and place it in the `src` of an `<img>` tag.
- If the WebView or runtime rejects escaped `%`, use `dataUriBase64`.
- For buttons, generate `asset_icon` with `background:"none"` and your theme color; the embedded SVG keeps the chosen color.
