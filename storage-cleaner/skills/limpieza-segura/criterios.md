# Criterios y revisión / Criteria and review

## ES

### Duplicados

- Solo se comparan archivos con el mismo tamaño y `size >= min_size_bytes`.
- Se calcula un hash ligero FNV-1a de los primeros 64 KiB del contenido base64 (máximo `max_hash_bytes`, hasta `max_hashes` lecturas).
- `confirmed: true` significa que el hash coincide; `confirmed: false` significa que solo coincide el tamaño. El plan ignora los no confirmados salvo `include_unconfirmed:true`.
- En cada grupo se conserva un archivo según `keep` y el resto se propone borrar.

### Límites

- `min_size_bytes`: 0-1 GiB (por defecto 1 MiB).
- `max_files`: 100-20000 (por defecto 5000).
- `max_depth`: 1-20 (por defecto 8).
- `max_hash_bytes`: 0-64 MiB, 0 desactiva el hash (por defecto 8 MiB).
- Si se alcanza un límite, aparece un aviso en `issues` y el informe puede ser parcial.

### Restos y protección

- Carpetas detectadas: `node_modules`, `dist`, `build`, `__pycache__`, `tmp`, `temp`, `.cache`, `.gradle`, `coverage`, `.next`, `.nuxt`, `venv`, `.venv`, `pods`, `bin`, `obj`.
- Extensiones detectadas: `.zip`, `.log`, `.tmp`, `.pyc`, `.bak`, `.old`, `.crdownload`.
- El plan nunca propone borrar las raíces del escaneo ni rutas dentro de `/extensions/`, `/extension-projects/`, `/.antigem/`, `/mini-apps/` o `/Android/`.

### Revisar el script

El script usa comandos `rm` y `rm -rf` con rutas entrecomilladas. Las líneas de revisión empiezan por `# REVIEW:`; las acciones reales no. Si un archivo ya está marcado para borrar, no aparece además como revisión. Antes de ejecutarlo:

1. Lee cada ruta y comprueba que el archivo conservado (el de `keep`) es el correcto.
2. Quita el `#` solo a las líneas que hayas verificado.
3. Ejecútalo desde una terminal, nunca desde este plugin.

## EN

### Duplicates

- Only files with the same size and `size >= min_size_bytes` are compared.
- A light FNV-1a hash is computed over the first 64 KiB of base64 content (capped by `max_hash_bytes`, up to `max_hashes` reads).
- `confirmed: true` means hashes match; `confirmed: false` means only sizes match. The plan ignores unconfirmed groups unless `include_unconfirmed:true`.
- One file per group is kept according to `keep`; the rest are proposed for deletion.

### Limits

- `min_size_bytes`: 0-1 GiB (default 1 MiB).
- `max_files`: 100-20000 (default 5000).
- `max_depth`: 1-20 (default 8).
- `max_hash_bytes`: 0-64 MiB, 0 disables hashing (default 8 MiB).
- If a cap is reached, an issue is reported and the result may be partial.

### Leftovers and protection

- Detected folders: `node_modules`, `dist`, `build`, `__pycache__`, `tmp`, `temp`, `.cache`, `.gradle`, `coverage`, `.next`, `.nuxt`, `venv`, `.venv`, `pods`, `bin`, `obj`.
- Detected extensions: `.zip`, `.log`, `.tmp`, `.pyc`, `.bak`, `.old`, `.crdownload`.
- The plan never proposes deleting scan roots or paths inside `/extensions/`, `/extension-projects/`, `/.antigem/`, `/mini-apps/` or `/Android/`.

### Reviewing the script

The script uses `rm` and `rm -rf` with quoted paths. Review lines start with `# REVIEW:`; real actions do not. A file already marked for removal is not repeated as a review. Before running it:

1. Read every path and confirm the kept file (`keep`) is the right one.
2. Remove `#` only from lines you have verified.
3. Run it from a terminal, never from this plugin.
