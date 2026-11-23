# Perfiles / Profiles

## ES

| Perfil | Rutas incluidas |
| --- | --- |
| `skills` | `~/extensions/**/*.md` y `*.skill`, `~/extension-projects/**/skills/*.md`, `~/.codex/skills/**/*.md`. |
| `mcp` | `~/.antigem_bridge/opencode/*.json`, `~/.gemini/config/*.json`, `~/.config/antigem/**/*.json`. |
| `themes` | JSON con `theme` o `tema` en el nombre bajo `~/.antigem` y `~/.config`. |
| `notes` | `.md`, `.txt` y `.json` bajo `~/notes` y `/sdcard/AntiGem/notes`. |
| `custom` | Solo los archivos y carpetas que pases explícitamente. |
| `all` | Todos los anteriores. |

Cuando `profile:"all"`, el límite `max_files` se reparte entre las fuentes para que no se agote todo en skills; si una fuente se llena aparece el aviso `SOURCE_CAP`. Cada archivo incluye `writablePath` (forma `~/` o `/sdcard/`), que es la ruta que usa `config_restore` para escribir con seguridad.

**Importante**: los temas personalizados de la app se guardan en `shared_prefs/app_themes.xml`, fuera del sandbox de archivos del plugin, y las notas reales están en `files/notes`, también fuera. El plugin avisa con `THEMES_PRIVATE_STORE` o `NOTES_PRIVATE_STORE` cuando no los encuentra. Para incluirlos:

- Exporta un tema a un JSON con `theme` en el nombre y guárdalo en `~/.antigem/`.
- Exporta tus notas a `~/notes/mis-notas.md` o pásalas en `files`.

## EN

| Profile | Included paths |
| --- | --- |
| `skills` | `~/extensions/**/*.md` and `*.skill`, `~/extension-projects/**/skills/*.md`, `~/.codex/skills/**/*.md`. |
| `mcp` | `~/.antigem_bridge/opencode/*.json`, `~/.gemini/config/*.json`, `~/.config/antigem/**/*.json`. |
| `themes` | JSON with `theme` or `tema` in the name under `~/.antigem` and `~/.config`. |
| `notes` | `.md`, `.txt` and `.json` under `~/notes` and `/sdcard/AntiGem/notes`. |
| `custom` | Only the files and folders you pass explicitly. |
| `all` | All of the above. |

With `profile:"all"`, the `max_files` cap is shared across sources so skills do not consume it all; a full source reports `SOURCE_CAP`. Each file includes `writablePath` (a `~/` or `/sdcard/` form), which is the path `config_restore` uses to write safely.

**Important**: the app's custom themes are stored in `shared_prefs/app_themes.xml`, outside the plugin's file sandbox, and real notes live in `files/notes`, also outside. The plugin reports `THEMES_PRIVATE_STORE` or `NOTES_PRIVATE_STORE` when it cannot find them. To include them:

- Export a theme to a JSON with `theme` in its name and save it under `~/.antigem/`.
- Export your notes to `~/notes/my-notes.md` or pass them in `files`.
