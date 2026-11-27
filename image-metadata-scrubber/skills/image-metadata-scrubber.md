---
name: Limpieza de metadatos de imágenes / Image metadata scrubber
description: ES: Inspecciona y limpia metadatos privados de JPEG y PNG locales sin red: EXIF y GPS, XMP, IPTC, comentarios, tEXt/eXIf y tIME. Guarda copia del original, escribe una imagen nueva y verifica el resultado. Híbrido y offline. / EN: Inspect and strip private metadata from local JPEG and PNG files without network: EXIF and GPS, XMP, IPTC, comments, tEXt/eXIf and tIME. Backs up the original, writes a new image and verifies the result. Hybrid and offline.
---

# Limpieza de metadatos de imágenes / Image metadata scrubber

## ES

Esta skill usa el plugin `image-metadata-scrubber` (3 tools, sin red). Los parseadores de JPEG y PNG están en JS puro dentro del worker: no invocan `exiftool`, no suben la imagen a ningún servicio y **nunca modifican el original**. Sirve antes de publicar capturas o fotos en un repositorio, un foro o una red social.

**Regla de oro:** inspecciona primero, limpia en una ruta **nueva** y verifica después. Si vas a compartirla, comparte solo el archivo limpio.

### Cuándo usarla

- Antes de adjuntar una foto a un issue o a un commit: quitar GPS, modelo de cámara, número de serie y fecha.
- Al compartir capturas que contienen `Software`, `Artist` o comentarios con datos internos.
- Para auditar un lote de imágenes y saber cuáles filtran información.
- Para generar un informe privado del contenido de EXIF sin exponer la imagen.
- Para comprobar que una imagen ya limpia no conserva metadatos residuales.

### Flujo recomendado

1. `image_meta_inspect` sobre la imagen original. Explica los hallazgos agrupados por origen (`EXIF`, `GPS`, `XMP`, `IPTC`, `PNG tEXt`, `PNG eXIf`, `COM`, `JFIF`) y destaca los de riesgo `high`.
2. `image_meta_scrub` con `dry_run:true` (por defecto) para ver cuántos elementos se quitarían y cuánto cambiaría el tamaño.
3. `image_meta_scrub` con `dry_run:false` y rutas nuevas para `output` y `backup`. El original queda intacto.
4. `image_meta_report` con `after_path` apuntando a la imagen limpia: lista lo eliminado y genera un `.md` bilingüe.
5. Si `verified` es `false`, revisa `warnings`: puede quedar un perfil ICC (usa `strip_icc:true`) o un chunk auxiliar (usa `aggressive:true`).

### Tools

| Tool | Qué hace | Parámetros clave |
| --- | --- | --- |
| `image_meta_inspect` | Lista metadatos, dimensiones y resumen sin escribir nada. | `path`, `max_entries` (1-200, default 80). |
| `image_meta_scrub` | Escribe imagen limpia + copia del original y verifica. | `path`, `output`, `backup`, `dry_run`, `strip_icc`, `aggressive`. |
| `image_meta_report` | Informe Markdown ES/EN del antes y el después. | `path`, `after_path`, `output`, `dry_run`. |

### Reglas

- Las rutas empiezan por `~/`, `/sdcard/` o `/data/` y no pueden contener `..`. Se usan rutas de archivo, no URLs.
- Las tres rutas de `image_meta_scrub` (entrada, salida, copia) deben ser distintas. Si la salida o la copia ya existen, la tool falla en lugar de sobrescribirlas: elige otro nombre.
- `dry_run` es `true` por defecto en las tools que escriben. Escribe solo cuando el usuario lo pida explícitamente.
- `backup:null` desactiva la copia; úsalo solo si el usuario ya tiene otra copia.
- `strip_icc:true` elimina también el perfil de color; puede cambiar ligeramente los colores en Visores que no usen gestión de color.
- `aggressive:true` quita todos los segmentos/chunks auxiliares excepto los esenciales para mostrar la imagen. Es útil para privacidad estricta.
- Las coordenadas GPS se muestran en grados decimales y también en grados/minutos/segundos con su referencia N/S/E/W.
- Un JPEG `verified:true` no tiene elementos de metadatos reconocidos y conserva las mismas dimensiones. Un PNG limpio solo conserva `IHDR`/`IDAT`/`IEND` y los chunks esenciales.

### Límites

- Máximo 24 MiB por imagen y 200 elementos de metadatos. Los valores largos se recortan a 240 caracteres.
- Solo JPEG y PNG. Un GIF, WebP o HEIC devuelve error de formato.
- Se detectan metadatos; no se garantiza que un editor externo no reinserte nuevos datos al volver a guardar la imagen.
- La imagen limpia se genera copiando los bloques originales de píxeles: no se recomprime, por lo que no pierde calidad.

Lee `formatos.md` para la tabla de etiquetas EXIF/GPS, los chunks PNG, ejemplos de llamada y resolución de problemas.

## EN

This skill uses the `image-metadata-scrubber` plugin (3 tools, no network). The JPEG and PNG parsers are plain JS inside the worker: they do not call `exiftool`, never upload the image and **never modify the original**. Use it before publishing screenshots or photos to a repository, a forum or a social network.

**Golden rule:** inspect first, scrub into a **new** path and verify afterwards. Share only the clean file.

### When to use it

- Before attaching a photo to an issue or a commit: remove GPS, camera model, serial number and date.
- When sharing screenshots that contain `Software`, `Artist` or comments with internal data.
- To audit a batch of images and learn which ones leak information.
- To produce a private report of EXIF content without exposing the image.
- To confirm that an already-clean image has no residual metadata.

### Recommended flow

1. `image_meta_inspect` on the original. Explain findings grouped by source (`EXIF`, `GPS`, `XMP`, `IPTC`, `PNG tEXt`, `PNG eXIf`, `COM`, `JFIF`) and highlight `high` risk items.
2. `image_meta_scrub` with `dry_run:true` (default) to see how many items would be removed and how the size changes.
3. `image_meta_scrub` with `dry_run:false` and new paths for `output` and `backup`. The original stays intact.
4. `image_meta_report` with `after_path` pointing at the clean image: list what was removed and write a bilingual `.md`.
5. If `verified` is `false`, check `warnings`: an ICC profile may remain (use `strip_icc:true`) or an ancillary chunk (use `aggressive:true`).

### Tools

| Tool | What it does | Key parameters |
| --- | --- | --- |
| `image_meta_inspect` | Lists metadata, dimensions and a summary without writing anything. | `path`, `max_entries` (1-200, default 80). |
| `image_meta_scrub` | Writes a clean image + a backup of the original and verifies. | `path`, `output`, `backup`, `dry_run`, `strip_icc`, `aggressive`. |
| `image_meta_report` | Bilingual Markdown before/after report. | `path`, `after_path`, `output`, `dry_run`. |

### Rules

- Paths start with `~/`, `/sdcard/` or `/data/` and may not contain `..`. These are file paths, not URLs.
- The three paths in `image_meta_scrub` (input, output, backup) must differ. If the output or backup already exists, the tool fails instead of overwriting: choose another name.
- `dry_run` defaults to `true` on writing tools. Write only when the user explicitly asks.
- `backup:null` disables the backup; use it only when the user already has another copy.
- `strip_icc:true` also removes the colour profile; colors may shift slightly in viewers without colour management.
- `aggressive:true` strips every ancillary segment/chunk except those needed to display the image. Use it for strict privacy.
- GPS coordinates are shown as decimal degrees and also as degrees/minutes/seconds with their N/S/E/W reference.
- A JPEG with `verified:true` has no recognised metadata items and keeps the same dimensions. A clean PNG keeps only `IHDR`/`IDAT`/`IEND` and essential chunks.

### Limits

- 24 MiB per image and 200 metadata items. Long values are clipped to 240 characters.
- JPEG and PNG only. GIF, WebP or HEIC return a format error.
- Metadata is detected; there is no guarantee an external editor will not insert new data when saving the image again.
- The clean image is built by copying the original pixel blocks: no recompression, so no quality loss.

Read `formatos.md` for the EXIF/GPS tag table, PNG chunks, call examples and troubleshooting.
