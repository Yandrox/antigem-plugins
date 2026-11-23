---
name: Respaldo y diff de configuración / Config backup and diff
description: ES: Crea snapshots JSON de skills, ajustes de MCP y archivos de configuración accesibles; compara versiones y restaura selectivamente. EN: Create JSON snapshots of skills, MCP settings and reachable config files; compare versions and restore selectively.
---

# Respaldo y diff de configuración / Config backup and diff

## ES

Este plugin funciona solo con archivos bajo `~/` o `/sdcard/`. No tiene acceso a las preferencias privadas de la app, así que los temas y las notas reales deben exportarse primero a un archivo accesible.

1. `config_snapshot`: crea un snapshot JSON.
   - `profile:"all"` reúne skills, ajustes de MCP, archivos `theme`/`tema` accesibles y notas exportadas.
   - `profile:"skills"|"mcp"|"themes"|"notes"` limita la captura.
   - `profile:"custom"` solo incluye lo que pases en `files` y `roots`.
   - Ajusta `max_files`, `max_file_bytes` y `max_total_bytes`.
   - Devuelve `files` con `path`, `relative`, `hash` y `content`; `output` + `dry_run:false` guarda el JSON.
2. `config_diff`: compara dos snapshots (`base` y `target` pueden ser IDs, rutas `.json` u objetos en línea). Devuelve `added`, `removed`, `modified`, `unchanged` y un diff unificado por archivo. `output` + `dry_run:false` guarda el Markdown.
3. `config_restore`: restaura archivos selectivos desde un snapshot. Por defecto solo simula; usa `dry_run:false` para escribir. Con `backup:true` (por defecto) guarda una copia `.bak` antes de sobrescribir.

Los resultados se guardan en almacenamiento local (`lastSnapshot`, `lastDiff`, `lastRestore`).

Lee `perfiles.md` para las rutas exactas y `restauracion.md` para el flujo seguro de restauración.

## EN

This plugin only works with files under `~/` or `/sdcard/`. It cannot access the app's private preferences, so real themes and notes must be exported to an accessible file first.

1. `config_snapshot`: creates a JSON snapshot.
   - `profile:"all"` gathers skills, MCP settings, reachable `theme`/`tema` files and exported notes.
   - `profile:"skills"|"mcp"|"themes"|"notes"` narrows the capture.
   - `profile:"custom"` only includes what you pass in `files` and `roots`.
   - Tune `max_files`, `max_file_bytes` and `max_total_bytes`.
   - It returns `files` with `path`, `relative`, `hash` and `content`; `output` + `dry_run:false` saves the JSON.
2. `config_diff`: compares two snapshots (`base` and `target` can be IDs, `.json` paths or inline objects). It returns `added`, `removed`, `modified`, `unchanged` and a unified diff per file. `output` + `dry_run:false` saves the Markdown.
3. `config_restore`: restores selected files from a snapshot. It simulates by default; use `dry_run:false` to write. With `backup:true` (default) it saves a `.bak` copy before overwriting.

Results are stored locally (`lastSnapshot`, `lastDiff`, `lastRestore`).

Read `perfiles.md` for exact paths and `restauracion.md` for the safe restore flow.
