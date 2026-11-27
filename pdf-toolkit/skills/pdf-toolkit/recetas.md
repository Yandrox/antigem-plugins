# Recetas PDF / PDF recipes

## ES

Sustituye `<entrada.pdf>` y `<salida.pdf>` por rutas reales entre comillas. Todas las recetas escriben un archivo **nuevo**.

### Verificación base (antes de cualquier operación)

```bash
pdfinfo "<entrada.pdf>" | grep -E '^(Pages|Page size|Encrypted|File size)'
qpdf --show-npages "<entrada.pdf>"
qpdf --check "<entrada.pdf>"
sha256sum "<entrada.pdf>"
```

`qpdf --check` debe terminar sin errores. Guarda el número de páginas y el hash para compararlos después.

### Dividir por páginas

Rango concreto:

```bash
qpdf --empty --pages "<entrada.pdf>" 1-3 -- "<salida.pdf>"
```

Una página:

```bash
qpdf --empty --pages "<entrada.pdf>" 5 -- "pagina-5.pdf"
```

Separar todas las páginas en archivos individuales (`%d` es obligatorio en el patrón):

```bash
mkdir -p paginas
qpdf --split-pages "<entrada.pdf>" "paginas/pagina-%d.pdf"
```

De dos en dos páginas:

```bash
qpdf --split-pages=2 "<entrada.pdf>" "paginas/bloque-%d.pdf"
```

### Unir documentos

```bash
qpdf --empty --pages "primero.pdf" 1-z "segundo.pdf" 1-z -- "unido.pdf"
```

`1-z` significa «todas las páginas». Para invertir el orden, invierte los argumentos.

### Rotar páginas

```bash
qpdf --rotate=+90:1-z "<entrada.pdf>" "<salida.pdf>"
qpdf --rotate=-90:1-z "<entrada.pdf>" "<salida-antihorario.pdf>"
qpdf --rotate=180:1-z "<entrada.pdf>" "<salida-180.pdf>"
```

El signo `+`/`-` indica rotación relativa; sin signo, ángulo absoluto. El sufijo `:1-z` delimita las páginas afectadas.

### Comprimir

```bash
gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook \
   -dNOPAUSE -dQUIET -dBATCH \
   -sOutputFile="<salida.pdf>" "<entrada.pdf>"
```

| `PDFSETTINGS` | Uso aproximado |
| --- | --- |
| `/screen` | Máxima reducción, baja resolución; para pantalla. |
| `/ebook` | Equilibrio habitual; buena para email. |
| `/printer` | Alta calidad; tamaño mayor. |
| `/prepress` | Calidad de impresión; tamaño mayor. |

Opciones extra útiles: `-dDetectDuplicateImages=true`, `-dColorImageResolution=150`, `-dGrayImageResolution=150`, `-dMonoImageResolution=300`.

**Aviso:** `gs` re-codifica. Compara una página renderizada antes y después si el documento tiene fuentes, transparencias o capas importantes.

### Extraer texto

```bash
pdftotext -layout -enc UTF-8 "<entrada.pdf>" "<salida.txt>"
```

Solo un rango, a pantalla:

```bash
pdftotext -layout -enc UTF-8 -f 2 -l 5 "<entrada.pdf>" -
```

Si el PDF es escaneado (imagen sin texto), `pdftotext` devolverá poco o nada: no hay OCR en esta receta.

### Extraer imágenes

```bash
pdfimages -list "<entrada.pdf>"
pdfimages -all "<entrada.pdf>" "img"
```

`-all` conserva el formato original de cada imagen (`img-000.jpg`, `img-001.png`, ...). Sin `-all`, se exporta como PPM.

### Renderizar páginas a PNG

```bash
pdftoppm -png -r 150 -f 1 -l 3 "<entrada.pdf>" "pagina"
```

Genera `pagina-1.png`, `pagina-2.png`, etc. Sube `-r` a 200/300 para más detalle; bájalo para previsualizar rápido.

### Reparar o linealizar

```bash
qpdf --check "<entrada.pdf>"
qpdf --linearize "<entrada.pdf>" "<reparado.pdf>"
qpdf --check "<reparado.pdf>"
```

Si `qpdf` no puede abrirlo, prueba una reconstrucción con `gs` (puede perder marcadores o formularios):

```bash
gs -o "<reparado.pdf>" -sDEVICE=pdfwrite -dPDFSETTINGS=/prepress \
   -dNOPAUSE -dBATCH -dQUIET "<entrada.pdf>"
qpdf --check "<reparado.pdf>"
```

### Plantilla de verificación antes/después

```bash
IN="<entrada.pdf>"
OUT="<salida.pdf>"

antes=$(qpdf --show-npages "$IN")
qpdf --check "$IN"
tam_antes=$(stat -c %s "$IN")

# ... ejecutar aquí la receta ...

despues=$(qpdf --show-npages "$OUT")
qpdf --check "$OUT"
tam_despues=$(stat -c %s "$OUT")

printf 'páginas: %s -> %s\n' "$antes" "$despues"
printf 'bytes:   %s -> %s\n' "$tam_antes" "$tam_despues"
[ "$antes" = "$despues" ] || echo 'REVISA: el número de páginas cambió'
```

Para dividir, rotar, comprimir o reparar, el número de páginas **debe** permanecer igual. Al unir o extraer un rango, el cambio esperado debe explicarse en el informe.

### Problemas comunes

| Síntoma | Causa | Acción |
| --- | --- | --- |
| `command not found` | Falta el paquete en proot. | Instala `qpdf poppler-utils ghostscript` una vez. |
| `qpdf --check` con errores | PDF dañado o cifrado. | Repara con `--linearize` o pide la contraseña. |
| `pdftotext` devuelve texto vacío | PDF escaneado sin capa de texto. | Usa `pdftoppm` para verificar; hace falta OCR fuera de esta skill. |
| `gs` apenas reduce el tamaño | Imágenes ya optimizadas o fuentes incrustadas. | Prueba `/screen` o `pdfimages -all` y recomprime las imágenes. |
| Rutas con espacios | Comandos sin comillas. | Envuelve cada ruta entre comillas dobles. |

## EN

Replace `<entrada.pdf>` and `<salida.pdf>` with real quoted paths. Every recipe writes a **new** file.

### Baseline check (before any operation)

```bash
pdfinfo "<input.pdf>" | grep -E '^(Pages|Page size|Encrypted|File size)'
qpdf --show-npages "<input.pdf>"
qpdf --check "<input.pdf>"
sha256sum "<input.pdf>"
```

`qpdf --check` must finish without errors. Record the page count and hash for later comparison.

### Split by pages

Specific range:

```bash
qpdf --empty --pages "<input.pdf>" 1-3 -- "<output.pdf>"
```

One page:

```bash
qpdf --empty --pages "<input.pdf>" 5 -- "page-5.pdf"
```

Split every page into individual files (`%d` is required in the pattern):

```bash
mkdir -p pages
qpdf --split-pages "<input.pdf>" "pages/page-%d.pdf"
```

Two pages at a time:

```bash
qpdf --split-pages=2 "<input.pdf>" "pages/batch-%d.pdf"
```

### Merge documents

```bash
qpdf --empty --pages "first.pdf" 1-z "second.pdf" 1-z -- "merged.pdf"
```

`1-z` means «all pages». Reverse the arguments to reverse the order.

### Rotate pages

```bash
qpdf --rotate=+90:1-z "<input.pdf>" "<output.pdf>"
qpdf --rotate=-90:1-z "<input.pdf>" "<output-counterclockwise.pdf>"
qpdf --rotate=180:1-z "<input.pdf>" "<output-180.pdf>"
```

`+`/`-` means relative rotation; no sign means absolute angle. The `:1-z` suffix limits affected pages.

### Compress

```bash
gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook \
   -dNOPAUSE -dQUIET -dBATCH \
   -sOutputFile="<output.pdf>" "<input.pdf>"
```

| `PDFSETTINGS` | Typical use |
| --- | --- |
| `/screen` | Maximum reduction, low resolution; screen use. |
| `/ebook` | Common balance; good for email. |
| `/printer` | High quality; larger file. |
| `/prepress` | Print quality; larger file. |

Useful extra options: `-dDetectDuplicateImages=true`, `-dColorImageResolution=150`, `-dGrayImageResolution=150`, `-dMonoImageResolution=300`.

**Warning:** `gs` re-encodes. Render one page before and after if fonts, transparency or layers matter.

### Extract text

```bash
pdftotext -layout -enc UTF-8 "<input.pdf>" "<output.txt>"
```

Only a range, to stdout:

```bash
pdftotext -layout -enc UTF-8 -f 2 -l 5 "<input.pdf>" -
```

If the PDF is scanned (image without a text layer), `pdftotext` returns little or nothing: there is no OCR in this recipe.

### Extract images

```bash
pdfimages -list "<input.pdf>"
pdfimages -all "<input.pdf>" "img"
```

`-all` keeps each image's original format (`img-000.jpg`, `img-001.png`, ...). Without `-all`, images are exported as PPM.

### Render pages to PNG

```bash
pdftoppm -png -r 150 -f 1 -l 3 "<input.pdf>" "page"
```

Produces `page-1.png`, `page-2.png`, etc. Raise `-r` to 200/300 for detail; lower it for a quick preview.

### Repair or linearise

```bash
qpdf --check "<input.pdf>"
qpdf --linearize "<input.pdf>" "<repaired.pdf>"
qpdf --check "<repaired.pdf>"
```

If `qpdf` cannot open it, try a rebuild with `gs` (bookmarks or forms may be lost):

```bash
gs -o "<repaired.pdf>" -sDEVICE=pdfwrite -dPDFSETTINGS=/prepress \
   -dNOPAUSE -dBATCH -dQUIET "<input.pdf>"
qpdf --check "<repaired.pdf>"
```

### Before/after verification template

```bash
IN="<input.pdf>"
OUT="<output.pdf>"

before=$(qpdf --show-npages "$IN")
qpdf --check "$IN"
size_before=$(stat -c %s "$IN")

# ... run the recipe here ...

after=$(qpdf --show-npages "$OUT")
qpdf --check "$OUT"
size_after=$(stat -c %s "$OUT")

printf 'pages: %s -> %s\n' "$before" "$after"
printf 'bytes: %s -> %s\n' "$size_before" "$size_after"
[ "$before" = "$after" ] || echo 'REVIEW: page count changed'
```

For splitting, rotating, compressing or repairing, the page count **must** stay the same. When merging or extracting a range, explain the expected change in the report.

### Common issues

| Symptom | Cause | Action |
| --- | --- | --- |
| `command not found` | Package missing in proot. | Install `qpdf poppler-utils ghostscript` once. |
| `qpdf --check` errors | Damaged or encrypted PDF. | Repair with `--linearize` or ask for the password. |
| Empty `pdftotext` output | Scanned PDF without text layer. | Check with `pdftoppm`; OCR is outside this skill. |
| `gs` barely reduces size | Images already optimised or embedded fonts. | Try `/screen` or `pdfimages -all` and recompress images. |
| Paths with spaces | Unquoted commands. | Wrap each path in double quotes. |
