---
name: Receta OCR offline / Offline OCR recipe
description: ES: Receta local en proot para extraer texto de capturas, fotos y PDFs escaneados con Tesseract: comprueba idiomas, preprocesa con ImageMagick/ffmpeg, escribe TXT o JSON con coordenadas y verifica la salida. Avisa si falta el idioma. Solo skills, sin red. / EN: Local proot recipe to extract text from screenshots, photos and scanned PDFs with Tesseract: checks languages, preprocesses with ImageMagick/ffmpeg, writes TXT or JSON with coordinates and verifies the output. Warns when a language is missing. Skills only, no network.
---

# Receta OCR offline / Offline OCR recipe

## ES

Esta skill **no tiene tools propias**: da recetas para el terminal local dentro de proot (Ubuntu) usando `tesseract`, `imagemagick`, `poppler-utils`, `ffmpeg` y `python3`. Convierte capturas y documentos escaneados en texto buscable **sin enviar la imagen a ningún servicio**. Comprueba que el idioma esté instalado y verifica siempre la salida.

**Regla de oro:** nunca pases la imagen original como destino. Preprocesa en un archivo nuevo, haz OCR a otro archivo nuevo y revisa el texto antes de darlo por bueno.

### Cuándo usarla

- Buscar texto dentro de una captura de pantalla o una foto.
- Extraer el contenido de un PDF escaneado (imagen sin capa de texto).
- Obtener las posiciones de las palabras para resaltarlas después en una imagen.
- Determinar la orientación de una foto antes de girarla.
- Procesar varios archivos por lotes sin subirlos a la nube.

### Comprobar el entorno

Antes de dar cualquier receta, comprueba qué hay instalado:

```bash
proot-distro login ubuntu -- bash -lc 'for c in tesseract convert magick pdftoppm ffmpeg python3; do printf "%-11s " "$c"; command -v "$c" || echo FALTA; done; tesseract --version | head -n 1; tesseract --list-langs 2>&1'
```

Si falta algo, la instalación es **única y manual** dentro de proot (requiere red una vez; el OCR posterior es offline):

```bash
proot-distro login ubuntu -- bash -lc 'apt-get update && apt-get install -y tesseract-ocr tesseract-ocr-eng tesseract-ocr-spa tesseract-ocr-osd imagemagick poppler-utils ffmpeg python3'
```

Para otro idioma añade su paquete, por ejemplo `tesseract-ocr-fra` (francés) o `tesseract-ocr-deu` (alemán). Si `tesseract --list-langs` no muestra el idioma pedido, **avisa antes de ejecutar**: no sustituyas `spa` por `eng` sin decirlo.

### Elegir herramienta

| Necesidad | Herramienta | Por qué |
| --- | --- | --- |
| Ver idiomas instalados | `tesseract --list-langs` | Detecta `spa.traineddata` ausente antes del OCR. |
| Extraer texto | `tesseract ... -l spa+eng --psm 3` | Auto-detección de diseño; `+` combina idiomas. |
| Texto con coordenadas | `tesseract ... tsv` | TSV con `left`, `top`, `width`, `height` y `conf`. |
| TSV a JSON | `python3` + `csv`/`json` | Estructura portable sin dependencias. |
| Escala, umbral, recorte | `convert` de ImageMagick | Mejora el contraste antes del OCR. |
| Enderezar | `convert -deskew` | Corrige fotos torcidas. |
| PDF escaneado a imagen | `pdftoppm -r 300` | Tesseract no lee PDFs multipágina directamente. |
| Fotogramas de vídeo | `ffmpeg` | Extrae cuadros para OCR de vídeo. |
| Orientación de la página | `tesseract -l osd --psm 0` | Indica los grados de giro. |

### Flujo de trabajo

1. **Pide la ruta, el idioma y el tipo.** No adivines si es `spa` o `eng`. Pregunta si necesita solo texto o también coordenadas.
2. **Verifica el original** con `file` e `identify`. Guarda dimensiones y tamaño.
3. **Comprueba el idioma** con `tesseract --list-langs`. Si falta, di qué paquete instalar y para ahí.
4. **Preprocesa si hace falta** (escala al 300 %, gris, umbral, enderezar, recortar) escribiendo un PNG nuevo.
5. **Ejecuta la receta** de `recetas.md` con `-l` y `--psm` explícitos y salida nueva.
6. **Verifica**: `wc -w`, `head`, errores en `stderr` y confianza media del TSV. Si está vacío, cambia `--psm` o el preprocesado y repite.
7. **Informa** con idioma, `--psm`, comando usado, archivos antes/después, avisos y ruta de salida. No borres ni reemplaces el original.

### Reglas

- Los códigos de idioma son los de Tesseract: `spa`, `eng`, `spa+eng`. Se comprueban con `--list-langs`.
- `--psm 3` es el punto de partida; `--psm 6` va bien para capturas y bloques uniformes, `--psm 11` para texto disperso.
- Tesseract rinde mejor a ~300 dpi con texto oscuro sobre fondo claro. Usa `-negate` si es al revés.
- Un PDF escaneado se renderiza primero con `pdftoppm -r 300`; un PDF con texto ya no necesita OCR.
- El TSV usa píxeles con origen arriba-izquierda; la confianza es `-1` en filas que no son palabras.
- Todo ocurre en el teléfono: ninguna receta de esta skill sube la imagen ni usa API keys.
- Si tu ImageMagick es v7, sustituye `convert` por `magick` en las recetas.

Lee `recetas.md` para los comandos exactos, la tabla de `--psm`, la conversión TSV a JSON, el procesado por lotes y la resolución de problemas.

## EN

This skill **has no tools of its own**: it provides recipes for the local proot (Ubuntu) terminal using `tesseract`, `imagemagick`, `poppler-utils`, `ffmpeg` and `python3`. It turns screenshots and scanned documents into searchable text **without sending the image to any service**. It checks that the language is installed and always verifies the output.

**Golden rule:** never use the original image as the destination. Preprocess into a new file, run OCR into another new file and review the text before accepting it.

### When to use it

- Find text inside a screenshot or a photo.
- Extract the content of a scanned PDF (an image with no text layer).
- Get word positions to highlight them later on an image.
- Detect page orientation before rotating a photo.
- Batch-process files without uploading them to the cloud.

### Check the environment

Before giving any recipe, check what is installed:

```bash
proot-distro login ubuntu -- bash -lc 'for c in tesseract convert magick pdftoppm ffmpeg python3; do printf "%-11s " "$c"; command -v "$c" || echo MISSING; done; tesseract --version | head -n 1; tesseract --list-langs 2>&1'
```

If something is missing, installation is **one-off and manual** inside proot (needs network once; OCR itself stays offline):

```bash
proot-distro login ubuntu -- bash -lc 'apt-get update && apt-get install -y tesseract-ocr tesseract-ocr-eng tesseract-ocr-spa tesseract-ocr-osd imagemagick poppler-utils ffmpeg python3'
```

For another language add its package, e.g. `tesseract-ocr-fra` (French) or `tesseract-ocr-deu` (German). If `tesseract --list-langs` does not show the requested language, **warn before running**: do not silently swap `spa` for `eng`.

### Pick a tool

| Need | Tool | Why |
| --- | --- | --- |
| List installed languages | `tesseract --list-langs` | Detects a missing `spa.traineddata` before OCR. |
| Extract text | `tesseract ... -l spa+eng --psm 3` | Auto page layout; `+` combines languages. |
| Text with coordinates | `tesseract ... tsv` | TSV with `left`, `top`, `width`, `height` and `conf`. |
| TSV to JSON | `python3` + `csv`/`json` | Portable structure with no dependencies. |
| Scale, threshold, crop | ImageMagick `convert` | Improves contrast before OCR. |
| Deskew | `convert -deskew` | Fixes tilted photos. |
| Scanned PDF to image | `pdftoppm -r 300` | Tesseract does not read multipage PDFs directly. |
| Video frames | `ffmpeg` | Extract frames for video OCR. |
| Page orientation | `tesseract -l osd --psm 0` | Reports rotation in degrees. |

### Workflow

1. **Ask for the path, language and type.** Do not guess `spa` or `eng`. Ask whether they need plain text or coordinates too.
2. **Verify the original** with `file` and `identify`. Record dimensions and size.
3. **Check the language** with `tesseract --list-langs`. If missing, say which package to install and stop.
4. **Preprocess when needed** (300% scale, greyscale, threshold, deskew, crop) into a new PNG.
5. **Run the recipe** from `recetas.md` with explicit `-l` and `--psm` and a new output file.
6. **Verify**: `wc -w`, `head`, `stderr` and mean TSV confidence. If empty, change `--psm` or preprocessing and retry.
7. **Report**: language, `--psm`, command used, files before/after, warnings and output path. Never delete or replace the original.

### Rules

- Language codes are Tesseract's: `spa`, `eng`, `spa+eng`. Check them with `--list-langs`.
- `--psm 3` is the starting point; `--psm 6` suits screenshots and uniform blocks, `--psm 11` sparse text.
- Tesseract works best around 300 dpi with dark text on a light background. Use `-negate` if reversed.
- Render a scanned PDF first with `pdftoppm -r 300`; a PDF that already has text does not need OCR.
- TSV coordinates are pixels with the origin at the top-left; confidence is `-1` on non-word rows.
- Everything happens on the phone: no recipe here uploads the image or uses API keys.
- If your ImageMagick is v7, replace `convert` with `magick` in the recipes.

Read `recetas.md` for exact commands, the `--psm` table, TSV-to-JSON conversion, batch processing and troubleshooting.
