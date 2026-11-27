# Recetas OCR / OCR recipes

## ES

Sustituye `<entrada.png>` y `<salida>` por rutas reales entre comillas. Todas las recetas escriben archivos **nuevos**. Si tu ImageMagick es v7, cambia `convert` por `magick`.

### 1. Idiomas

```bash
tesseract --list-langs 2>&1
```

Si el idioma pedido no aparece, el error típico al ejecutar es `Error opening data file .../spa.traineddata`. Instálalo una vez:

```bash
proot-distro login ubuntu -- bash -lc 'apt-get install -y tesseract-ocr-spa'
```

Códigos habituales: `spa`, `eng`, `spa+eng`, `fra`, `deu`, `por`, `ita`. Se pueden combinar con `+`.

### 2. OCR básico a TXT

```bash
tesseract "<entrada.png>" "<salida>" -l spa+eng --psm 3 txt 2>"<salida>.err"
cat "<salida>.txt"
cat "<salida>.err"
```

A pantalla, sin archivo intermedio:

```bash
tesseract "<entrada.png>" stdout -l spa --psm 6 txt
```

### 3. Modos de segmentación (`--psm`)

| Valor | Uso |
| --- | --- |
| `3` | Automático; punto de partida para páginas completas. |
| `4` | Una columna de texto de tamaño variable. |
| `6` | Un bloque uniforme; ideal para capturas y recibos. |
| `7` | Una sola línea. |
| `8` | Una sola palabra. |
| `10` | Un solo carácter. |
| `11` | Texto disperso sin orden concreto. |
| `12` | Texto disperso con detección de orientación. |
| `13` | Línea raw, sin análisis de diseño. |

### 4. Texto con coordenadas (TSV)

```bash
tesseract "<entrada.png>" "<salida>" -l spa+eng --psm 6 tsv
head -n 3 "<salida>.tsv"
```

Columnas útiles: `left`, `top`, `width`, `height` (píxeles, origen arriba-izquierda), `conf` (confianza 0-100, `-1` si no es palabra) y `text`.

Convertir a JSON con `python3`:

```bash
python3 - <<'PY' > "<salida>.json"
import csv, json
rows = list(csv.DictReader(open('<salida>.tsv', encoding='utf-8'), delimiter='\t'))
words = []
for row in rows:
    text = row.get('text', '').strip()
    if not text:
        continue
    words.append({
        'text': text,
        'conf': float(row['conf']),
        'left': int(row['left']),
        'top': int(row['top']),
        'width': int(row['width']),
        'height': int(row['height'])
    })
print(json.dumps({'engine': 'tesseract', 'words': words}, ensure_ascii=False, indent=2))
PY
```

Para quedarse solo con palabras fiables, añade `if float(row['conf']) < 60: continue` dentro del bucle.

### 5. Preprocesado con ImageMagick

Escalar al 300 %, pasar a gris, enderezar y aplicar umbral:

```bash
convert "<entrada.jpg>" -resize 300% -colorspace Gray -deskew 40% -threshold 60% "preprocesado.png"
```

Recorte a una región concreta (`ancho x alto + x + y`):

```bash
convert "<entrada.png>" -crop 1200x800+100+50 +repage "recorte.png"
```

Invertir texto claro sobre fondo oscuro:

```bash
convert "<entrada.png>" -negate "invertido.png"
```

Recortar márgenes y nitidez:

```bash
convert "<entrada.png>" -trim +repage -sharpen 0x1.0 "limpio.png"
```

Después aplica el OCR sobre el PNG resultante, no sobre el original.

### 6. Orientación y giro

```bash
tesseract "<entrada.png>" stdout -l osd --psm 0 2>/dev/null
convert "<entrada.png>" -rotate 180 "girada.png"
```

Si no está `osd.traineddata`, instala `tesseract-ocr-osd`.

### 7. PDF escaneado por lotes

```bash
file "<escaneado.pdf>"
mkdir -p paginas
pdftoppm -png -r 300 "<escaneado.pdf>" "paginas/pagina"
for img in paginas/*.png; do
  base="${img%.png}"
  tesseract "$img" "$base" -l spa+eng --psm 6 txt
done
cat paginas/*.txt > "texto-completo.txt"
```

Si el PDF ya tiene capa de texto, `pdftotext -layout` es más rápido y exacto; no hace falta OCR.

### 8. Cuadros de vídeo

```bash
ffmpeg -i "<entrada.mp4>" -vf fps=1/2 "cuadro-%03d.png"
tesseract "cuadro-001.png" stdout -l spa --psm 11 txt
```

### 9. Verificación antes/después

```bash
IN="<entrada.png>"
OUT="<salida>"

identify "$IN"
tesseract "$IN" "$OUT" -l spa+eng --psm 6 txt 2>"$OUT.err"

wc -w -c "$OUT.txt"
head -n 5 "$OUT.txt"
cat "$OUT.err"
[ -s "$OUT.txt" ] || echo 'REVISA: salida vacía; prueba --psm 11 o más preprocesado'
```

Para TSV, comprueba la confianza media:

```bash
awk -F '\t' 'NR>1 && $11!="-1" {n++; s+=$11} END {if (n) printf "palabras=%d conf_media=%.1f\n", n, s/n; else print "sin palabras"}' "<salida>.tsv"
```

### Problemas comunes

| Síntoma | Causa | Acción |
| --- | --- | --- |
| `Error opening data file ... spa.traineddata` | Falta el idioma. | Instala `tesseract-ocr-spa` una vez. |
| Salida vacía | Resolución baja o `--psm` incorrecto. | Escala al 300 %, usa `--psm 11`. |
| Texto con caracteres raros | Contraste o antialias. | `-colorspace Gray -threshold 60%`. |
| `convert: command not found` | ImageMagick v7 o no instalado. | Usa `magick` o instala `imagemagick`. |
| `osd.traineddata` missing | Falta el paquete OSD. | Instala `tesseract-ocr-osd`. |
| Tesseract con un PDF | No lee PDFs multipágina. | Renderiza con `pdftoppm -r 300`. |
| Coordenadas desplazadas | Se recortó sin `+repage`. | Añade `+repage` al recortar. |

## EN

Replace `<input.png>` and `<output>` with real quoted paths. Every recipe writes **new** files. If your ImageMagick is v7, use `magick` instead of `convert`.

### 1. Languages

```bash
tesseract --list-langs 2>&1
```

If the requested language is missing, the typical error is `Error opening data file .../spa.traineddata`. Install it once:

```bash
proot-distro login ubuntu -- bash -lc 'apt-get install -y tesseract-ocr-spa'
```

Common codes: `spa`, `eng`, `spa+eng`, `fra`, `deu`, `por`, `ita`. Combine them with `+`.

### 2. Basic OCR to TXT

```bash
tesseract "<input.png>" "<output>" -l spa+eng --psm 3 txt 2>"<output>.err"
cat "<output>.txt"
cat "<output>.err"
```

To stdout, without an intermediate file:

```bash
tesseract "<input.png>" stdout -l spa --psm 6 txt
```

### 3. Page segmentation modes (`--psm`)

| Value | Use |
| --- | --- |
| `3` | Automatic; starting point for full pages. |
| `4` | Single column of variable-size text. |
| `6` | Uniform block; good for screenshots and receipts. |
| `7` | A single line. |
| `8` | A single word. |
| `10` | A single character. |
| `11` | Sparse text with no specific order. |
| `12` | Sparse text with orientation detection. |
| `13` | Raw line, no layout analysis. |

### 4. Text with coordinates (TSV)

```bash
tesseract "<input.png>" "<output>" -l spa+eng --psm 6 tsv
head -n 3 "<output>.tsv"
```

Useful columns: `left`, `top`, `width`, `height` (pixels, origin at top-left), `conf` (0-100, `-1` for non-words) and `text`.

Convert to JSON with `python3`:

```bash
python3 - <<'PY' > "<output>.json"
import csv, json
rows = list(csv.DictReader(open('<output>.tsv', encoding='utf-8'), delimiter='\t'))
words = []
for row in rows:
    text = row.get('text', '').strip()
    if not text:
        continue
    words.append({
        'text': text,
        'conf': float(row['conf']),
        'left': int(row['left']),
        'top': int(row['top']),
        'width': int(row['width']),
        'height': int(row['height'])
    })
print(json.dumps({'engine': 'tesseract', 'words': words}, ensure_ascii=False, indent=2))
PY
```

To keep only reliable words, add `if float(row['conf']) < 60: continue` inside the loop.

### 5. Preprocessing with ImageMagick

Scale to 300%, greyscale, deskew and threshold:

```bash
convert "<input.jpg>" -resize 300% -colorspace Gray -deskew 40% -threshold 60% "preprocessed.png"
```

Crop a region (`width x height + x + y`):

```bash
convert "<input.png>" -crop 1200x800+100+50 +repage "crop.png"
```

Invert light text on a dark background:

```bash
convert "<input.png>" -negate "inverted.png"
```

Trim margins and sharpen:

```bash
convert "<input.png>" -trim +repage -sharpen 0x1.0 "clean.png"
```

Then run OCR on the resulting PNG, not on the original.

### 6. Orientation and rotation

```bash
tesseract "<input.png>" stdout -l osd --psm 0 2>/dev/null
convert "<input.png>" -rotate 180 "rotated.png"
```

If `osd.traineddata` is missing, install `tesseract-ocr-osd`.

### 7. Scanned PDF in batch

```bash
file "<scanned.pdf>"
mkdir -p pages
pdftoppm -png -r 300 "<scanned.pdf>" "pages/page"
for img in pages/*.png; do
  base="${img%.png}"
  tesseract "$img" "$base" -l spa+eng --psm 6 txt
done
cat pages/*.txt > "full-text.txt"
```

If the PDF already has a text layer, `pdftotext -layout` is faster and more accurate; no OCR needed.

### 8. Video frames

```bash
ffmpeg -i "<input.mp4>" -vf fps=1/2 "frame-%03d.png"
tesseract "frame-001.png" stdout -l spa --psm 11 txt
```

### 9. Before/after verification

```bash
IN="<input.png>"
OUT="<output>"

identify "$IN"
tesseract "$IN" "$OUT" -l spa+eng --psm 6 txt 2>"$OUT.err"

wc -w -c "$OUT.txt"
head -n 5 "$OUT.txt"
cat "$OUT.err"
[ -s "$OUT.txt" ] || echo 'REVIEW: empty output; try --psm 11 or more preprocessing'
```

For TSV, check mean confidence:

```bash
awk -F '\t' 'NR>1 && $11!="-1" {n++; s+=$11} END {if (n) printf "words=%d mean_conf=%.1f\n", n, s/n; else print "no words"}' "<output>.tsv"
```

### Common issues

| Symptom | Cause | Action |
| --- | --- | --- |
| `Error opening data file ... spa.traineddata` | Language missing. | Install `tesseract-ocr-spa` once. |
| Empty output | Low resolution or wrong `--psm`. | Scale to 300%, use `--psm 11`. |
| Odd characters | Contrast or antialiasing. | `-colorspace Gray -threshold 60%`. |
| `convert: command not found` | ImageMagick v7 or not installed. | Use `magick` or install `imagemagick`. |
| `osd.traineddata` missing | OSD package missing. | Install `tesseract-ocr-osd`. |
| Tesseract on a PDF | Cannot read multipage PDFs. | Render with `pdftoppm -r 300`. |
| Shifted coordinates | Crop without `+repage`. | Add `+repage` when cropping. |
