# Formatos y referencia / Formats and reference

## ES

### Metadatos que se detectan

| Origen | Elementos | Riesgo |
| --- | --- | --- |
| `EXIF` / `GPS` | `Make`, `Model`, `BodySerialNumber`, `LensSerialNumber`, `CameraOwnerName`, `Software`, `DateTime`, `DateTimeOriginal`, `Artist`, `Copyright`, `GPSLatitude`, `GPSLongitude`, `GPSAltitude`, `GPSDateStamp` | `high` para GPS y números de serie; `medium` para fechas, cámara y software. |
| `XMP` | Bloque `http://ns.adobe.com/xap/1.0/`; se buscan `CreatorTool`, `ModifyDate`, `Author`, `GPS`, `Serial` | `medium`. |
| `IPTC` / Photoshop | Segmento APP13 (`0xED`) | `medium`. |
| `COM` | Comentario JPEG (segmento `0xFE`) | `medium`. |
| `JFIF` | Densidad y miniatura del segmento APP0 (`0xE0`) | `low`. |
| `ICC` | Perfil de color (`ICC_PROFILE` en JPEG, `iCCP` en PNG) | `low`. |
| `PNG tEXt` / `zTXt` / `iTXt` | Pares clave/valor, comprimidos o internacionales | según la clave. |
| `PNG eXIf` | Un bloque TIFF con las mismas etiquetas EXIF/GPS | igual que `EXIF`. |
| `PNG tIME` | Fecha de modificación | `medium`. |

### Qué se elimina por defecto

- **JPEG:** APP0 (JFIF), APP1 con `Exif` o XMP, APP13 (IPTC), COM y segmentos `0xE0`-`0xEF` en modo `aggressive`. Se conservan la cabecera, las tablas de Huffman/cuantización, los marcadores de reinicio, SOS y los datos escaneados hasta EOI.
- **PNG:** `tEXt`, `zTXt`, `iTXt`, `eXIf`, `tIME`, `oFFs`, `sCAL` y `pCAL`. En modo `aggressive` también se quitan los chunks auxiliares salvo `tRNS`, `bKGD`, `gAMA`, `sRGB`, `cHRM`, `pHYs`, `sBIT` e `hIST`. Se conservan `IHDR`, `IDAT` e `IEND`.

El contenido de píxeles se copia tal cual: la imagen limpia no se recomprime y mantiene sus dimensiones.

### Coordenadas GPS

`GPSLatitude`/`GPSLongitude` son arrays de tres racionales (grados, minutos, segundos). El plugin los convierte a grados decimales y aplica el signo según `GPSLatitudeRef`/`GPSLongitudeRef`. Por ejemplo `37° 27' 36"` con referencia `N` se muestra como `37.460000 (N 37° 27' 36")`.

### Ejemplos de llamada

Inspeccionar una foto:

```json
{"name":"image_meta_inspect","arguments":{"path":"~/fotos/vacaciones.jpg","max_entries":100}}
```

Previsualizar la limpieza:

```json
{"name":"image_meta_scrub","arguments":{"path":"~/fotos/vacaciones.jpg","dry_run":true}}
```

Escribir la copia limpia y el backup:

```json
{"name":"image_meta_scrub","arguments":{"path":"~/fotos/vacaciones.jpg","output":"~/fotos/vacaciones.limpia.jpg","backup":"~/fotos/vacaciones.original.jpg","dry_run":false,"strip_icc":true}}
```

Informe comparativo:

```json
{"name":"image_meta_report","arguments":{"path":"~/fotos/vacaciones.jpg","after_path":"~/fotos/vacaciones.limpia.jpg","output":"~/fotos/informe.md","dry_run":false}}
```

### Interpretar la respuesta

- `summary.total`: elementos de metadatos encontrados; `high`, `medium` y `low`: desglose por gravedad; `gps`: si hay coordenadas.
- `removed`: cada hallazgo con `removed:true` si no aparece en la imagen limpia.
- `verified`: `true` solo si la imagen limpia no tiene metadatos reconocidos y conserva las dimensiones. No equivale a una auditoría forense de todos los bytes.
- `warnings`: segmentos truncados, cabeceras TIFF desconocidas o datos fuera de rango. Si aparecen, no des la imagen por limpia sin revisarlos.

### Problemas comunes

| Síntoma | Causa | Acción |
| --- | --- | --- |
| `Formato no soportado` | El archivo no es JPEG/PNG o está corrupto. | Comprueba la firma con `file`. |
| `El tamaño leído no coincide` | El archivo cambió durante la lectura. | Vuelve a intentarlo. |
| `Ya existe la salida` | La ruta elegida está ocupada. | Elige otro nombre; la tool nunca sobrescribe. |
| `verified:false` sin avisos | Queda un perfil ICC o un chunk auxiliar. | Prueba `strip_icc:true` o `aggressive:true`. |
| Metadatos de fecha siguen apareciendo | La imagen tiene EXIF dentro de un chunk PNG no reconocido. | Usa `aggressive:true` y vuelve a inspeccionar. |
| `Imagen demasiado grande` | Supera 24 MiB. | Reduce la imagen fuera del plugin. |

## EN

### Metadata detected

| Source | Items | Risk |
| --- | --- | --- |
| `EXIF` / `GPS` | `Make`, `Model`, `BodySerialNumber`, `LensSerialNumber`, `CameraOwnerName`, `Software`, `DateTime`, `DateTimeOriginal`, `Artist`, `Copyright`, `GPSLatitude`, `GPSLongitude`, `GPSAltitude`, `GPSDateStamp` | `high` for GPS and serial numbers; `medium` for dates, camera and software. |
| `XMP` | `http://ns.adobe.com/xap/1.0/` block; searches for `CreatorTool`, `ModifyDate`, `Author`, `GPS`, `Serial` | `medium`. |
| `IPTC` / Photoshop | APP13 segment (`0xED`) | `medium`. |
| `COM` | JPEG comment (segment `0xFE`) | `medium`. |
| `JFIF` | Density and thumbnail in APP0 (`0xE0`) | `low`. |
| `ICC` | Colour profile (`ICC_PROFILE` in JPEG, `iCCP` in PNG) | `low`. |
| `PNG tEXt` / `zTXt` / `iTXt` | Key/value pairs, compressed or international | depends on the key. |
| `PNG eXIf` | A TIFF block with the same EXIF/GPS tags | same as `EXIF`. |
| `PNG tIME` | Modification time | `medium`. |

### What is stripped by default

- **JPEG:** APP0 (JFIF), APP1 with `Exif` or XMP, APP13 (IPTC), COM and `0xE0`-`0xEF` segments in `aggressive` mode. The header, Huffman/quantisation tables, restart markers, SOS and scanned data up to EOI are kept.
- **PNG:** `tEXt`, `zTXt`, `iTXt`, `eXIf`, `tIME`, `oFFs`, `sCAL` and `pCAL`. In `aggressive` mode all ancillary chunks are also removed except `tRNS`, `bKGD`, `gAMA`, `sRGB`, `cHRM`, `pHYs`, `sBIT` and `hIST`. `IHDR`, `IDAT` and `IEND` are kept.

Pixel content is copied verbatim: the clean image is not recompressed and keeps its dimensions.

### GPS coordinates

`GPSLatitude`/`GPSLongitude` are arrays of three rationals (degrees, minutes, seconds). The plugin converts them to decimal degrees and applies the sign from `GPSLatitudeRef`/`GPSLongitudeRef`. For example `37° 27' 36"` with reference `N` is shown as `37.460000 (N 37° 27' 36")`.

### Example calls

Inspect a photo:

```json
{"name":"image_meta_inspect","arguments":{"path":"~/photos/holiday.jpg","max_entries":100}}
```

Preview the scrub:

```json
{"name":"image_meta_scrub","arguments":{"path":"~/photos/holiday.jpg","dry_run":true}}
```

Write the clean copy and the backup:

```json
{"name":"image_meta_scrub","arguments":{"path":"~/photos/holiday.jpg","output":"~/photos/holiday.clean.jpg","backup":"~/photos/holiday.original.jpg","dry_run":false,"strip_icc":true}}
```

Comparison report:

```json
{"name":"image_meta_report","arguments":{"path":"~/photos/holiday.jpg","after_path":"~/photos/holiday.clean.jpg","output":"~/photos/report.md","dry_run":false}}
```

### Reading the response

- `summary.total`: metadata items found; `high`, `medium` and `low`: severity breakdown; `gps`: whether coordinates were found.
- `removed`: each finding with `removed:true` if it is absent from the clean image.
- `verified`: `true` only when the clean image has no recognised metadata items and keeps its dimensions. It is not a forensic audit of every byte.
- `warnings`: truncated segments, unknown TIFF headers or out-of-range data. If present, review them before calling the image clean.

### Common issues

| Symptom | Cause | Action |
| --- | --- | --- |
| `Unsupported format` | File is not JPEG/PNG or is corrupt. | Check the signature with `file`. |
| `Read size does not match` | The file changed during reading. | Retry. |
| `Output already exists` | Chosen path is occupied. | Pick another name; the tool never overwrites. |
| `verified:false` with no warnings | An ICC profile or ancillary chunk remains. | Try `strip_icc:true` or `aggressive:true`. |
| Date metadata still appears | EXIF inside an unrecognised PNG chunk. | Use `aggressive:true` and inspect again. |
| `Image too large` | Over 24 MiB. | Resize the image outside the plugin. |
