---
name: Caja de herramientas PDF / PDF toolkit
description: ES: Recetas locales en proot para dividir, unir, comprimir, rotar, reparar y extraer texto o imágenes de PDF con qpdf, poppler-utils y ghostscript. Verifica páginas y errores antes y después, sin subir el documento a ningún servicio. Solo skills. EN: Local proot recipes to split, merge, compress, rotate, repair and extract text or images from PDFs with qpdf, poppler-utils and ghostscript. Checks pages and errors before and after, without uploading the document anywhere. Skills only.
---

# Caja de herramientas PDF / PDF toolkit

## ES

Esta skill **no tiene tools propias**: usa el terminal local dentro de proot (Ubuntu) y herramientas estándar (`qpdf`, `poppler-utils`, `ghostscript`). Divide, une, comprime, rota y extrae contenido **sin subir el PDF a ningún sitio**. Antes y después de cada operación comprueba el número de páginas y la integridad del archivo.

**Regla de oro:** trabaja siempre sobre una **copia**, escribe la salida en un archivo nuevo y verifica. Nunca ejecutes `gs` ni `qpdf` sobrescribiendo el original.

### Cuándo usarla

- Separar un PDF en páginas o quedarse con un rango concreto.
- Unir varios PDF en uno manteniendo el orden.
- Reducir el tamaño de un documento para enviarlo por email o guardarlo.
- Rotar páginas escaneadas al revés.
- Extraer el texto buscable o las imágenes incrustadas.
- Reparar un PDF que otras herramientas dicen que está dañado.

### Comprobar el entorno

Antes de dar recetas, comprueba qué hay instalado:

```bash
proot-distro login ubuntu -- bash -lc 'for c in qpdf pdfinfo pdftotext pdfimages pdftoppm gs; do printf "%-12s " "$c"; command -v "$c" || echo FALTA; done'
```

Si falta alguna herramienta, la instalación es **única y manual** dentro de proot (requiere red una vez; la manipulación del PDF sigue siendo offline):

```bash
proot-distro login ubuntu -- bash -lc 'apt-get update && apt-get install -y qpdf poppler-utils ghostscript'
```

Si no hay proot, las mismas recetas funcionan en cualquier terminal con esos paquetes.

### Elegir herramienta

| Necesidad | Herramienta | Por qué |
| --- | --- | --- |
| Verificar estado y contar páginas | `qpdf --check`, `pdfinfo` | Detecta errores estructurales antes de tocar nada. |
| Dividir por páginas / separar todas | `qpdf` | Sin pérdida, mantiene texto y marcadores. |
| Unir documentos | `qpdf --empty --pages` | Orden explícito, sin re-codificar. |
| Rotar páginas | `qpdf --rotate` | Cambia metadatos de página; no degrada imágenes. |
| Comprimir tamaño | `gs -sDEVICE=pdfwrite` | Re-codifica imágenes y fuentes; revisa el resultado. |
| Extraer texto | `pdftotext -layout` | Conserva columnas y saltos. |
| Extraer imágenes incrustadas | `pdfimages -all` | Sin renderizar la página completa. |
| Convertir páginas a PNG | `pdftoppm -png` | Para previsualizar o compartir. |
| Reparar / linealizar | `qpdf --linearize` | Reordena el archivo y valida la estructura. |

### Flujo de trabajo

1. **Pide la ruta y la operación.** No adivines ni elijas un rango de páginas por tu cuenta. Si hay varios PDF, pide el orden exacto.
2. **Verifica el original** (`pdfinfo`, `qpdf --check`, `sha256sum`). Guarda `pages_before` y el tamaño.
3. **Ejecuta la receta** de `recetas.md` con salida en un archivo nuevo. Usa comillas si la ruta tiene espacios.
4. **Verifica la salida**: `pdfinfo` → `pages_after`, `qpdf --check`, tamaño y, si procede, comparación visual de una página con `pdftoppm`.
5. **Informa** con: comando usado, páginas antes/después, tamaños, avisos y ruta de salida. No borres ni reemplaces el original sin confirmación.

### Reglas

- `qpdf` es **sin pérdida** para dividir, unir y rotar: `gs` solo cuando el objetivo sea comprimir/reducir tamaño.
- `gs` re-codifica: puede cambiar fuentes, transparencias o capas. Compara el resultado antes de darlo por bueno.
- Los PDF cifrados necesitan contraseña (`qpdf --password=...`). Pídela al usuario; no la escribas en documentos ni la reutilices.
- Espacio insuficiente: revisa `df -h` antes de trabajar con archivos grandes.
- Si `qpdf --check` falla, repara primero y vuelve a verificar; no encadenes operaciones sobre un archivo dañado.
- Todo ocurre en el teléfono: ningún comando de esta skill sube el documento a internet.

Lee `recetas.md` para los comandos exactos, la plantilla de verificación y la resolución de problemas.

## EN

This skill **has no tools of its own**: it uses the local terminal inside proot (Ubuntu) and standard tools (`qpdf`, `poppler-utils`, `ghostscript`). It splits, merges, compresses, rotates and extracts content **without uploading the PDF anywhere**. Before and after each operation it checks the page count and file integrity.

**Golden rule:** always work on a **copy**, write to a new file and verify. Never run `gs` or `qpdf` over the original.

### When to use it

- Split a PDF into pages or keep a specific range.
- Merge several PDFs in a given order.
- Shrink a document for email or storage.
- Rotate scanned pages that are upside down.
- Extract searchable text or embedded images.
- Repair a PDF that other tools report as damaged.

### Check the environment

Before giving recipes, check what is installed:

```bash
proot-distro login ubuntu -- bash -lc 'for c in qpdf pdfinfo pdftotext pdfimages pdftoppm gs; do printf "%-12s " "$c"; command -v "$c" || echo MISSING; done'
```

If a tool is missing, installation is **one-off and manual** inside proot (needs network once; PDF manipulation stays offline):

```bash
proot-distro login ubuntu -- bash -lc 'apt-get update && apt-get install -y qpdf poppler-utils ghostscript'
```

Without proot, the same recipes work in any terminal with those packages.

### Pick a tool

| Need | Tool | Why |
| --- | --- | --- |
| Check status and count pages | `qpdf --check`, `pdfinfo` | Detects structural errors before touching anything. |
| Split by pages / split all | `qpdf` | Lossless; keeps text and bookmarks. |
| Merge documents | `qpdf --empty --pages` | Explicit order, no re-encoding. |
| Rotate pages | `qpdf --rotate` | Changes page metadata; images are not degraded. |
| Reduce file size | `gs -sDEVICE=pdfwrite` | Re-encodes images and fonts; review the result. |
| Extract text | `pdftotext -layout` | Preserves columns and line breaks. |
| Extract embedded images | `pdfimages -all` | No need to render whole pages. |
| Render pages to PNG | `pdftoppm -png` | For previewing or sharing. |
| Repair / linearise | `qpdf --linearize` | Reorders the file and validates structure. |

### Workflow

1. **Ask for the path and operation.** Do not guess the file or the page range. With several PDFs, ask for the exact order.
2. **Verify the original** (`pdfinfo`, `qpdf --check`, `sha256sum`). Record `pages_before` and size.
3. **Run the recipe** from `recetas.md` with a new output file. Quote paths containing spaces.
4. **Verify the output**: `pdfinfo` → `pages_after`, `qpdf --check`, size and, when relevant, a visual check of one page with `pdftoppm`.
5. **Report**: command used, pages before/after, sizes, warnings and output path. Do not delete or replace the original without confirmation.

### Rules

- `qpdf` is **lossless** for splitting, merging and rotating: use `gs` only when the goal is compression/size reduction.
- `gs` re-encodes: fonts, transparency or layers may change. Compare the result before accepting it.
- Encrypted PDFs need a password (`qpdf --password=...`). Ask the user; never write it into documents or reuse it.
- Low disk space: check `df -h` before working with large files.
- If `qpdf --check` fails, repair first and verify again; never chain operations on a damaged file.
- Everything happens on the phone: no command in this skill uploads the document.

Read `recetas.md` for exact commands, the verification template and troubleshooting.
