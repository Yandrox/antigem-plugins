---
name: Explorador seguro de archivos comprimidos / ZIP archive explorer
description: ES: Inspecciona ZIP, TAR y TAR.GZ locales sin extraerlos: lista rutas, tamaños y fechas, detecta path traversal, rutas absolutas, symlinks, cifrado y duplicados, y propone comandos seguros de extracción con control de sobrescritura. Híbrido, offline y sin red. EN: Inspect local ZIP, TAR and TAR.GZ archives without extracting: list paths, sizes and dates, detect traversal, absolute paths, symlinks, encryption and duplicates, and propose safe extraction commands with overwrite control. Hybrid, offline and no network.
---

# Explorador seguro de archivos comprimidos / ZIP archive explorer

## ES

Antes de extraer un paquete conviene saber **qué contiene**. Esta skill abre `.zip`, `.tar` y `.tar.gz` locales, lista cada entrada con ruta, tipo, tamaño y fecha, y marca las que son peligrosas: `..`, rutas absolutas, enlaces simbólicos, archivos de dispositivo, cifrado o nombres duplicados. Si el paquete es seguro, propone comandos de extracción; **nunca extrae ni ejecuta nada por ti**.

Todo se hace en JS dentro del worker: el ZIP se lee desde su directorio central, el TAR bloque a bloque y el gzip se descomprime con un inflador propio. No hay librerías, no hay `unzip`/`tar` llamados desde el plugin y **no se usa la red**.

### Cuándo usarla

- Antes de descomprimir un plugin, un backup o un paquete recibido por email.
- Cuando un `unzip` falla y quieres saber si hay rutas raras o entradas cifradas.
- Para revisar si un TAR trae enlaces, uid/gid o archivos especiales.
- Para estimar cuánto ocupará la extracción y detectar posibles bombas de compresión.
- Para generar un informe revisable antes de compartir o instalar el paquete.

### Tools

| Tool | Qué hace |
| --- | --- |
| `archive_list` | Abre el archivo y devuelve `entries`, `summary` y `risks` con `severity`, `kind`, `name` y `detail`. |
| `archive_plan` | Con `destination` y `overwrite` propone comandos seguros; con entradas peligrosas devuelve `safe:false` y ningún comando. |
| `archive_report` | Informe Markdown bilingüe con la tabla de hallazgos y de entradas; `dry_run:true` por defecto. |

### Flujo de trabajo

1. **Lista.** `archive_list({path:"~/Descargas/paquete.zip"})`. Revisa `summary`: entradas, tamaño sin comprimir y recuento de errores/avisos.
2. **Examina los riesgos.** Cada hallazgo trae `kind`, `severity` y una sugerencia. Los `error` bloquean la extracción; los `warning` requieren criterio.
3. **Pide un plan.** `archive_plan({path,destination:"~/extraido",overwrite:"skip"})`. Devuelve `commands` ya citados entre comillas simples, listos para pegar en proot.
4. **Ejecuta tú los comandos.** El plugin no tiene permiso para extraer. Comprueba `df -h` y el `sha256sum` que incluye el plan.
5. **Informa si hace falta.** `archive_report({path,output:"~/revision.md",dry_run:false})` escribe un informe ES/EN con una tabla por idioma.
6. **Vuelve a listar** si rearmaz el paquete, hasta que `summary.errors` sea 0.

### Reglas

- Nunca extraigas un paquete con `parent_traversal`, `absolute_path`, `special_file`, `encrypted` o caracteres de control en el nombre.
- `overwrite:"skip"` es el valor por defecto: conserva archivos existentes. Usa `"overwrite"` solo si el destino es nuevo o descartable.
- En TAR, `--no-same-owner` evita aplicar uid/gid ajenos; `--no-absolute-names` neutraliza rutas absolutas residuales.
- Los enlaces simbólicos se marcan: comprueba que no apunten fuera del destino.
- El límite es 32 MiB por archivo y 96 MiB de contenido expandido; se muestran como máximo 200 entradas, aunque el análisis usa todas.
- Los ficheros se leen con `antigemFiles`; los informes se escriben solo si pasas `dry_run:false`.

Lee `seguridad.md` para la tabla de riesgos, los comandos de extracción y los límites exactos.

## EN

Before extracting an archive you should know **what is inside**. This skill opens local `.zip`, `.tar` and `.tar.gz` files, lists every entry with path, type, size and date, and flags dangerous ones: `..`, absolute paths, symlinks, device files, encryption or duplicate names. If the archive looks safe it proposes extraction commands; **it never extracts or executes anything for you**.

Everything runs as JavaScript inside the worker: ZIP is read from its central directory, TAR block by block, and gzip is decompressed with a built-in inflate implementation. No libraries, no `unzip`/`tar` calls from the plugin and **no network**.

### When to use it

- Before unpacking a plugin, a backup or a package received by email.
- When `unzip` fails and you want to know whether there are odd paths or encrypted entries.
- To check whether a TAR carries links, uid/gid or special files.
- To estimate the extracted size and spot possible compression bombs.
- To produce a reviewable report before sharing or installing the package.

### Tools

| Tool | What it does |
| --- | --- |
| `archive_list` | Opens the archive and returns `entries`, `summary` and `risks` with `severity`, `kind`, `name` and `detail`. |
| `archive_plan` | With `destination` and `overwrite` proposes safe commands; with dangerous entries it returns `safe:false` and no commands. |
| `archive_report` | Bilingual Markdown report with the findings and entry tables; `dry_run:true` by default. |

### Workflow

1. **List.** `archive_list({path:"~/Downloads/package.zip"})`. Review `summary`: entries, uncompressed size and error/warning counts.
2. **Review risks.** Every finding has `kind`, `severity` and a suggestion. `error` findings block extraction; `warning` findings need judgement.
3. **Request a plan.** `archive_plan({path,destination:"~/extracted",overwrite:"skip"})`. It returns shell-quoted `commands` ready to paste into proot.
4. **Run the commands yourself.** The plugin has no extraction permission. Check `df -h` and the `sha256sum` included in the plan.
5. **Report if needed.** `archive_report({path,output:"~/review.md",dry_run:false})` writes an ES/EN report with one table per language.
6. **List again** after rebuilding the archive, until `summary.errors` is 0.

### Rules

- Never extract a package with `parent_traversal`, `absolute_path`, `special_file`, `encrypted` or control characters in names.
- `overwrite:"skip"` is the default: it keeps existing files. Use `"overwrite"` only when the destination is new or disposable.
- On TAR, `--no-same-owner` avoids applying foreign uid/gid; `--no-absolute-names` neutralises leftover absolute paths.
- Symlinks are flagged: check that they do not point outside the destination.
- Limit: 32 MiB per archive and 96 MiB of expanded content; at most 200 entries are shown, although analysis covers all.
- Files are read with `antigemFiles`; reports are written only when you pass `dry_run:false`.

Read `seguridad.md` for the risk table, extraction commands and exact limits.
