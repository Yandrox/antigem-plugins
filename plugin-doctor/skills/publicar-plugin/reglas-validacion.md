# Reglas de validación / Validation rules

`doctor_validate` devuelve `issues` con `severity` (`error`, `warning`, `info`), `code`, `path` y mensajes en inglés y español (`message`, `message_es`). Un repo pasa cuando `ok: true`, es decir, cuando no hay errores.

`doctor_validate` returns `issues` with `severity` (`error`, `warning`, `info`), `code`, `path`, and messages in English and Spanish (`message`, `message_es`). A repository passes when `ok: true`, meaning there are no errors.

## Errores / Errors

| Código | Significado / Meaning |
| --- | --- |
| `JSON_INVALID` | JSON malformado / malformed JSON |
| `MANIFEST_MISSING`, `INDEX_NO_MANIFEST` | Falta `manifest.json` / missing manifest |
| `MV_INVALID`, `NAME_INVALID`, `VERSION_INVALID`, `ID_INVALID` | Metadatos inválidos / invalid metadata |
| `TOOLS_EMPTY`, `TOOL_INVALID`, `TOOL_NAME_INVALID`, `TOOL_DUPLICATE`, `TOOL_DESCRIPTION_MISSING` | Problema en `mcp_tools` / problem in `mcp_tools` |
| `TOOL_SCHEMA_INVALID`, `TOOL_SCHEMA_REQUIRED` | `inputSchema` incorrecto / incorrect `inputSchema` |
| `WORKER_MISSING`, `WORKER_NOT_FOUND`, `WORKER_UNSAFE` | Worker ausente o ruta inválida / missing worker or invalid path |
| `EMPTY_PLUGIN` | No hay tools ni skills / no tools or skills |
| `INDEX_PLUGINS_INVALID`, `INDEX_ENTRY_INVALID`, `INDEX_DUPLICATE_PATH`, `INDEX_PATH_MISSING` | Índice roto / broken index |
| `ID_MISMATCH`, `VERSION_MISMATCH`, `DUPLICATE_ID` | Desincronización entre índice y manifiesto / index-manifest mismatch |
| `PATH_UNSAFE`, `ICON_UNSAFE`, `INDEX_ICON_INVALID`, `INDEX_ICON_NOT_FOUND`, `ICON_NOT_FOUND` | Ruta peligrosa o archivo inexistente / unsafe path or missing file |
| `FILE_TOO_LARGE`, `TOO_MANY_FILES`, `PACKAGE_TOO_LARGE` | Límites de tamaño excedidos / size limits exceeded |
| `LIST_FAILED` | No se pudo listar una carpeta / could not list a folder |

## Avisos / Warnings

| Código | Significado / Meaning |
| --- | --- |
| `MV2`, `ID_MISSING`, `DESCRIPTION_MISSING`, `INDEX_ID_MISSING`, `INDEX_VERSION_MISSING` | Recomendaciones / recommendations |
| `SKILL_FRONTMISSING`, `SKILL_FM_NAME`, `SKILL_FM_DESCRIPTION` | Frontmatter incompleto / incomplete frontmatter |
| `SKILL_NAME_INVALID`, `SKILL_DETAIL_NAME`, `SKILL_ORPHAN_DETAIL` | Nombres de skill o carpetas de detalle / skill or detail folder names |
| `BROKEN_LINK`, `LINK_UNSAFE` | Enlaces Markdown relativos / relative Markdown links |
| `ICON_MISSING`, `ICON_FORMAT`, `TOOL_SCHEMA_ADDITIONAL`, `PERMISSION_UNKNOWN` | Mejoras sugeridas / suggested improvements |
| `UNLISTED_PLUGIN`, `INDEX_MISSING` | Plugins o índice no registrados / unlisted plugins or missing index |
| `LIST_TRUNCATED`, `DEPTH_LIMIT` | El listado pudo ser incompleto / listing may be incomplete |

## Notas / Notes

- `README_MISSING` es informativo: `doctor_generate_readme` puede crearlo.
- `README_MISSING` is informational: `doctor_generate_readme` can create it.
- `doctor_fix_index` y `doctor_generate_readme` son de solo previsualización salvo que pases `dry_run: false`.
- `doctor_fix_index` and `doctor_generate_readme` are preview-only unless you pass `dry_run: false`.
