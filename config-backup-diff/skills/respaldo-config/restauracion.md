# Restauración segura / Safe restore

## ES

1. Crea un snapshot con `output` para tener una copia persistente, por ejemplo:
   `{"profile":"mcp","output":"~/backups/mcp-2026-11-23.json","dry_run":false}`.
2. Compara con `config_diff` antes de restaurar: pasa `base` (snapshot antiguo) y `target` (snapshot actual). Revisa los cambios `modified` y el diff unificado.
3. Restaura solo lo necesario:
   `{"snapshot":"~/backups/mcp-2026-11-23.json","files":[".antigem_bridge/opencode/mcp_servers.json"],"dry_run":true}`.
   El `dry_run:true` (por defecto) solo muestra la simulación.
4. Cuando el plan esté claro, repite con `dry_run:false`. Con `backup:true` se escribe `<archivo>.bak` antes de sobrescribir.

El campo `files` admite la `relative` del snapshot o la ruta completa. Si se omite, se restauran todos los archivos del snapshot. `target_dir` permite restaurar en otra carpeta bajo `~/` o `/sdcard/`.

No se borran archivos: solo se escriben los seleccionados y, opcionalmente, sus copias `.bak`.

## EN

1. Create a snapshot with `output` to keep a persistent copy, for example:
   `{"profile":"mcp","output":"~/backups/mcp-2026-11-23.json","dry_run":false}`.
2. Compare with `config_diff` before restoring: pass `base` (old snapshot) and `target` (current snapshot). Review `modified` changes and the unified diff.
3. Restore only what you need:
   `{"snapshot":"~/backups/mcp-2026-11-23.json","files":[".antigem_bridge/opencode/mcp_servers.json"],"dry_run":true}`.
   `dry_run:true` (the default) only shows the simulation.
4. When the plan is clear, repeat with `dry_run:false`. With `backup:true`, `<file>.bak` is written before overwriting.

`files` accepts the snapshot's `relative` path or the full path. If omitted, all snapshot files are restored. `target_dir` lets you restore into another folder under `~/` or `/sdcard/`.

No files are deleted: only selected files and, optionally, their `.bak` copies are written.
