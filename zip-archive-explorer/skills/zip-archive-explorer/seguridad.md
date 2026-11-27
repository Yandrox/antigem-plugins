# Seguridad y formatos / Security and formats

## ES

### Formatos admitidos

| Formato | Detección | Origen de la lista |
| --- | --- | --- |
| `.zip` | Firma `PK` al inicio y registro EOCD al final. | Directorio central; tolera ZIP64 y bandera UTF-8. |
| `.tar` | Bloques de 512 bytes con marca `ustar`. | Cabeceras TAR; admite GNU longname y PAX. |
| `.tar.gz`, `.tgz` | Firma gzip `1f 8b`. | Se descomprime en memoria y se parsea como TAR. |

La detección usa las firmas, no la extensión: un `.zip` renombrado se reconoce igual.

### Tabla de riesgos

| `kind` | Gravedad | Qué significa |
| --- | --- | --- |
| `parent_traversal` | `error` | Un componente `..` puede escribir fuera del destino. |
| `absolute_path` | `error` | La entrada empieza por `/`, por `\` o por letra de unidad. |
| `special_file` | `error` | Dispositivo, FIFO o socket: no tiene sentido en el teléfono. |
| `encrypted` | `error` | Entrada cifrada; hace falta contraseña. |
| `control_char` | `error` | Carácter de control en el nombre. |
| `symlink`, `hardlink` | `warning` | Enlace: revisa el destino, puede salir del destino. |
| `backslash_path` | `warning` | Separador Windows en una ruta; puede colisionar en Android. |
| `duplicate`, `case_collision` | `warning` | Dos entradas con el mismo nombre o distinta capitalización. |
| `windows_reserved` | `warning` | Nombre reservado (`CON`, `NUL`, `COM1`...). |
| `compression_method` | `warning` | Método poco habitual (AES, LZMA, deflate64...). |
| `large_entry`, `large_archive`, `high_ratio` | `warning` | Tamaño o ratio sospechoso: posible bomba. |
| `directory_without_index` | no aplica | Solo lo emite el comprobador de enlaces. |

### Comandos que propone el plan

Los comandos se entregan entre comillas simples; pégalos en proot:

```bash
mkdir -p 'destino'
df -h 'destino'
sha256sum 'paquete.zip'
unzip -l 'paquete.zip'
unzip -n 'paquete.zip' -d 'destino'
du -sh 'destino'
```

Para TAR y TAR.GZ:

```bash
tar -tf 'paquete.tar'
tar --no-same-owner --no-same-permissions --no-absolute-names -k -xf 'paquete.tar' -C 'destino'
tar -tzf 'paquete.tar.gz'
tar --no-same-owner --no-same-permissions --no-absolute-names -k -xzf 'paquete.tar.gz' -C 'destino'
```

`-k` conserva archivos existentes; `--overwrite` los reemplaza. `--strip-components=N` quita N niveles iniciales. El plan **no se ejecuta**: el worker no tiene herramientas de shell.

### Leer el resultado de `archive_list`

- `summary.entries`: entradas reales, incluso si solo se muestran 80 por defecto.
- `summary.uncompressed`: suma de tamaños; compárala con `df -h`.
- `summary.errors` y `summary.warnings`: recuento de hallazgos.
- `risks[].suggestion`: acción concreta cuando existe.
- `warnings`: incidencias de lectura (CRC gzip incorrecto, checksum TAR, índice incompleto).

### Límites

- 32 MiB por archivo leído; 96 MiB de contenido expandido.
- 5000 entradas analizadas; 200 hallazgos como máximo.
- `max_entries` entre 1 y 200 (por defecto 80); el informe incluye las primeras 100.
- Rutas de entrada/salida: `~/`, `/sdcard/` o `/data/`, sin `..`.
- El informe solo se escribe con `output` terminado en `.md` y `dry_run:false`.

### Problemas comunes

| Síntoma | Causa | Acción |
| --- | --- | --- |
| `No se encontró el final del ZIP` | Archivo truncado o no ZIP. | Comprueba `sha256sum` y vuelve a descargarlo. |
| `falta la marca ustar` | TAR muy antiguo o gzip que no contiene TAR. | Lista con `tar -tf` en proot. |
| `Código Huffman inválido` | gzip dañado. | Verifica el archivo; el informe avisará si el CRC falla. |
| Muchos `case_collision` | Paquete creado en Windows/macOS. | Rearma el paquete en una carpeta limpia. |
| `safe:false` sin comandos | Hay al menos un hallazgo `error`. | Repara el paquete; no intentes esquivar el bloqueo. |

## EN

### Supported formats

| Format | Detection | Listing source |
| --- | --- | --- |
| `.zip` | `PK` signature and an EOCD record at the end. | Central directory; handles ZIP64 and UTF-8 flag. |
| `.tar` | 512-byte blocks with `ustar` magic. | TAR headers; supports GNU longname and PAX. |
| `.tar.gz`, `.tgz` | gzip signature `1f 8b`. | Decompressed in memory, then parsed as TAR. |

Detection uses signatures, not extensions: a renamed `.zip` is still recognised.

### Risk table

| `kind` | Severity | Meaning |
| --- | --- | --- |
| `parent_traversal` | `error` | A `..` component can write outside the destination. |
| `absolute_path` | `error` | Entry starts with `/`, `\` or a drive letter. |
| `special_file` | `error` | Device, FIFO or socket: meaningless on the phone. |
| `encrypted` | `error` | Encrypted entry; a password is required. |
| `control_char` | `error` | Control character in the name. |
| `symlink`, `hardlink` | `warning` | Link: review its target, it may escape the destination. |
| `backslash_path` | `warning` | Windows separator in a path; may collide on Android. |
| `duplicate`, `case_collision` | `warning` | Two entries with the same name or different casing. |
| `windows_reserved` | `warning` | Reserved name (`CON`, `NUL`, `COM1`...). |
| `compression_method` | `warning` | Uncommon method (AES, LZMA, deflate64...). |
| `large_entry`, `large_archive`, `high_ratio` | `warning` | Suspicious size or ratio: possible bomb. |

### Commands proposed by the plan

Commands are single-quoted and ready to paste into proot:

```bash
mkdir -p 'destination'
df -h 'destination'
sha256sum 'archive.zip'
unzip -l 'archive.zip'
unzip -n 'archive.zip' -d 'destination'
du -sh 'destination'
```

For TAR and TAR.GZ:

```bash
tar -tf 'archive.tar'
tar --no-same-owner --no-same-permissions --no-absolute-names -k -xf 'archive.tar' -C 'destination'
tar -tzf 'archive.tar.gz'
tar --no-same-owner --no-same-permissions --no-absolute-names -k -xzf 'archive.tar.gz' -C 'destination'
```

`-k` keeps existing files; `--overwrite` replaces them. `--strip-components=N` drops N leading levels. The plan is **not executed**: the worker has no shell tools.

### Reading `archive_list`

- `summary.entries`: real entries, even when only 80 are shown by default.
- `summary.uncompressed`: sum of sizes; compare it with `df -h`.
- `summary.errors` and `summary.warnings`: finding counts.
- `risks[].suggestion`: concrete action when available.
- `warnings`: read issues (bad gzip CRC, TAR checksum, incomplete index).

### Limits

- 32 MiB per read file; 96 MiB of expanded content.
- 5000 entries analysed; 200 findings maximum.
- `max_entries` between 1 and 200 (default 80); the report includes the first 100.
- Input/output paths: `~/`, `/sdcard/` or `/data/`, no `..`.
- The report is written only with an `.md` `output` and `dry_run:false`.

### Common issues

| Symptom | Cause | Action |
| --- | --- | --- |
| `ZIP end-of-central-directory not found` | Truncated or non-ZIP file. | Check `sha256sum` and download again. |
| `missing ustar magic` | Very old TAR or gzip without TAR. | List with `tar -tf` in proot. |
| `invalid Huffman code` | Damaged gzip. | Verify the file; the report warns if CRC fails. |
| Many `case_collision` | Package created on Windows/macOS. | Rebuild the archive from a clean folder. |
| `safe:false` with no commands | At least one `error` finding. | Repair the package; do not bypass the block. |
