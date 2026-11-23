---
name: Limpieza segura / Safe cleanup
description: ES: Escanea almacenamiento, detecta duplicados y restos, y genera un plan revisable sin borrar nada. EN: Scan storage, find duplicates and leftovers, and generate a reviewable plan without deleting anything.
---

# Limpieza segura / Safe cleanup

## ES

Este plugin **nunca borra archivos**. Solo analiza y genera texto (un script `sh` y un informe Markdown) para que revises y ejecutes manualmente.

1. `storage_scan`: escanea `~/` y `/sdcard/` por defecto. Ajusta `roots`, `min_size_bytes`, `max_files`, `max_depth`, `max_hash_bytes`, `max_hashes` y `exclude`. Devuelve duplicados confirmados por hash, archivos grandes, restos de proyectos y un resumen.
2. `storage_plan`: convierte el último escaneo en acciones. `keep` elige qué duplicado conservar (`oldest`, `newest`, `shortest`). Las acciones de archivos grandes y temporales salen como comentarios `# REVISAR`. Por defecto solo previsualiza; usa `output` + `dry_run:false` para guardar el `.sh`.
3. `storage_report`: informe Markdown bilingüe con escaneo y plan. También previsualiza por defecto.

Por defecto se excluyen rutas peligrosas (`/extensions/`, `/extension-projects/`, `/.antigem/`, `/mini-apps/`, `/Android/data/`, `/Android/obb/`). El plan vuelve a proteger esas rutas y las raíces del escaneo, para que el script nunca sugiera borrarlas.

Lee `criterios.md` para los criterios de duplicados, límites y cómo revisar el script.

## EN

This plugin **never deletes files**. It only analyses and produces text (a `sh` script and a Markdown report) for you to review and run manually.

1. `storage_scan`: scans `~/` and `/sdcard/` by default. Tune `roots`, `min_size_bytes`, `max_files`, `max_depth`, `max_hash_bytes`, `max_hashes` and `exclude`. It returns hash-confirmed duplicates, large files, project leftovers and a summary.
2. `storage_plan`: turns the latest scan into actions. `keep` chooses which duplicate to keep (`oldest`, `newest`, `shortest`). Large and temporary files appear as `# REVIEW` comments. It previews by default; use `output` + `dry_run:false` to save the `.sh`.
3. `storage_report`: bilingual Markdown report with scan and plan. It also previews by default.

Dangerous paths are excluded by default (`/extensions/`, `/extension-projects/`, `/.antigem/`, `/mini-apps/`, `/Android/data/`, `/Android/obb/`). The plan protects those paths and the scan roots again, so the script never suggests deleting them.

Read `criterios.md` for duplicate criteria, limits and how to review the script.
