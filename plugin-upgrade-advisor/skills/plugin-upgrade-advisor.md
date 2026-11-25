---
name: Asesor de actualizaciones de plugins / Plugin upgrade advisor
description: ES: Compara el inventario local de plugins con el índice del repo, lee los changelogs del git log, clasifica el riesgo de cada salto de versión y propone un orden seguro de actualización con verificación y rollback. Solo skills, offline. EN: Compare the local plugin inventory with the repo index, read changelogs from git log, classifies version-bump risk and proposes a safe upgrade order with verification and rollback. Skills only, offline.
---

# Asesor de actualizaciones de plugins / Plugin upgrade advisor

## ES

El instalador de AntiGem muestra la versión instalada frente a la del ZIP, pero no dice qué plugins están desactualizados ni qué cambió. Esta skill convierte tres fuentes **locales** en un plan: el inventario de `webview_extension_list`, el índice `antigem-plugins.json` del repo y el historial `git log`. No consulta GitHub ni APIs: si no hay dato, lo marca como desconocido.

### Cuándo usarla

- Antes de actualizar varios plugins del repo `Yandrox/antigem-plugins`.
- Cuando un plugin deja de funcionar tras una actualización y quieres saber qué cambió.
- Para decidir si un salto de versión merece prueba completa o solo una comprobación rápida.
- Para detectar plugins instalados con versión mayor que la del índice (local por delante).

### Fuentes y cómo leerlas

| Fuente | Cómo obtenerla | Qué da |
| --- | --- | --- |
| Inventario instalado | `webview_extension_list({refresh:true})` | `extensions` con `id`, `version`, `enabled`, `loaded`, `skillCount`, `toolCount`; `projects` con los borradores. |
| Borradores | Manifiestos en `~/extension-projects/<id>/src/manifest.json` | Versión del borrador, distinta de la instalada (deriva). `mcp_health` también la detecta. |
| Índice del repo | `antigem-plugins.json` en la raíz del checkout local | Versión publicada de cada plugin y descripción. Verifica que coincida con cada `manifest.json`. |
| Changelog | `git log --no-merges` del repo; o la skill `git-hygiene` y su guía de changelog | Commits `hash|asunto|cuerpo` entre la versión instalada y la publicada. Si no hay tags, usa los últimos N commits y di que es **inferido**. |
| Estado de salud | `mcp_health` de `mcp-health-check` | Deriva instalado/borrador, workers ausentes, logs y tools duplicadas (informativas). |

Regla: **nunca inventes un changelog**. Si no hay commits entre dos versiones, escribe "sin cambios identificables / no identifiable changes" y no rellenes con suposiciones.

### Clasificación del salto

Compara `instalada → publicada` con SemVer (`mayor.menor.parche`):

| Situación | Riesgo | Qué revisar |
| --- | --- | --- |
| Igual versión | ✅ Ninguno | Solo reinstalar si hay síntomas; el instalador ofrecerá **Reinstall** y conserva datos. |
| `parche` (`1.0.2 → 1.0.3`) | 🟢 Bajo | Asunto de los commits; confirma que son `fix`/`docs`. Prueba rápida de la tool principal. |
| `menor` (`1.0.2 → 1.1.0`) | 🟡 Medio | Nuevas tools o skills, cambios de descripción y permisos del manifest. Prueba las tools nuevas. |
| `mayor` (`1.0.2 → 2.0.0`) | 🔴 Alto | Busca `BREAKING CHANGE:` o cambios en nombres de tool, argumentos y permisos. Lee la skill antes de actualizar. |
| Sin versión instalada o sin versión en el índice | ⚠️ Desconocido | Trátalo como alto hasta leer el `manifest.json` de ambos sitios. |
| Instalada > publicada | ⚠️ Local por delante | No actualices: el índice puede estar desactualizado. Verifica el repo local antes de decidir. |

Una entrada `feat` puede ser rompiente si cambia un nombre de tool; una entrada `fix` puede serlo si cambia un esquema. **El número manda, el changelog matiza.**

### Orden seguro de instalación

1. **Registra el estado actual.** Guarda `webview_extension_list` y el `git status --short --branch` del repo. Si hay datos de usuario en juego, usa `config-backup-diff` antes de tocar nada.
2. **Valida la fuente.** En el checkout: `doctor_validate` → 0 errores y 0 avisos; versión igual en `manifest.json` y `antigem-plugins.json`. Regenera índice y README con `plugin-doctor` si hiciera falta (vista previa y después aplicar).
3. **Actualiza primero la herramienta de trabajo.** `plugin-doctor` y, si los usas, `skill-linter` y `mcp-health-check`. Así las comprobaciones posteriores usan la versión nueva.
4. **Después los plugins sin worker** (solo skills). No cambian código ejecutado: actualízalos en lotes pequeños y comprueba `get_skills`.
5. **Luego los híbridos**, de uno en uno. Tras cada uno: `webview_extension_logs`, `webview_extension_test` de una tool representativa y `mcp_health`. Si aparece un error, para y no sigas con el lote.
6. **Al final, los sensibles**: plugins con permisos amplios, automatización de página o tools con nombres parecidos. Pide confirmación explícita antes de actualizarlos.
7. **Verifica y cierra.** Repite `webview_extension_list`, confirma versiones, ejecuta `doctor_validate` de nuevo y anota lo que cambió. Si algo falló, reinstala el ZIP de la versión anterior con `extension_id` para conservar ID, carpeta y datos.

Para instalar/actualizar desde un borrador usa `webview_extension_install({project_id, extension_id})`: mantiene el ID estable, la carpeta, los datos y el estado habilitado. El usuario confirma la instalación en la pantalla del teléfono; una versión igual ofrece **Reinstall** y una menor **Downgrade** (no es una actualización).

### Informe

```markdown
## Plan de actualización — <fecha>

| # | Plugin | Instalada → publicada | Salto | Riesgo | Evidencia del changelog | Acción |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | plugin-doctor | 1.1.2 → 1.2.0 | menor | 🟡 Medio | `8d3dbfb` genera una sola tabla y badges | Actualizar primero |
| 2 | … | … | parche | 🟢 Bajo | `abc123` corrección … | Lote de skills |

**Orden:** herramientas → solo skills → híbridos → sensibles.
**Verificación:** doctor_validate, get_skills, logs, mcp_health.
**Rollback:** ZIP anterior + `extension_id` (conserva datos).
```

Reglas del informe: una fila por plugin, evidencia con hash o "inferido de `git log`", riesgo con la leyenda de arriba y ninguna acción ejecutada sin confirmación. Si un dato falta, escribe `desconocido`, no `0` ni "sin cambios".

## EN

AntiGem's installer shows the installed version versus the ZIP version, but not which plugins are outdated or what changed. This skill turns three **local** sources into a plan: the `webview_extension_list` inventory, the repo's `antigem-plugins.json` index and `git log`. It never queries GitHub or APIs: missing data is marked as unknown.

### When to use it

- Before upgrading several plugins from the `Yandrox/antigem-plugins` repo.
- When a plugin broke after an upgrade and you want to know what changed.
- To decide whether a version bump needs a full test or a quick check.
- To spot plugins installed at a version newer than the index (local ahead).

### Sources and how to read them

| Source | How to get it | What it gives |
| --- | --- | --- |
| Installed inventory | `webview_extension_list({refresh:true})` | `extensions` with `id`, `version`, `enabled`, `loaded`, `skillCount`, `toolCount`; `projects` with drafts. |
| Drafts | Manifests at `~/extension-projects/<id>/src/manifest.json` | Draft version, possibly different from installed (drift). `mcp_health` also detects it. |
| Repo index | `antigem-plugins.json` at the local checkout root | Published version and description per plugin. Check it matches each `manifest.json`. |
| Changelog | `git log --no-merges` in the repo; or the `git-hygiene` skill and its changelog guide | `hash|subject|body` commits between installed and published versions. Without tags, use the last N commits and say it is **inferred**. |
| Health state | `mcp_health` from `mcp-health-check` | Installed/draft drift, missing workers, logs and duplicate tools (informational). |

Rule: **never invent a changelog**. If there are no commits between versions, write "no identifiable changes" and do not fill in guesses.

### Classifying the bump

Compare `installed → published` with SemVer (`major.minor.patch`):

| Situation | Risk | What to review |
| --- | --- | --- |
| Same version | ✅ None | Reinstall only if there are symptoms; the installer offers **Reinstall** and keeps data. |
| `patch` (`1.0.2 → 1.0.3`) | 🟢 Low | Commit subjects; confirm `fix`/`docs`. Quick test of the main tool. |
| `minor` (`1.0.2 → 1.1.0`) | 🟡 Medium | New tools or skills, changed descriptions and manifest permissions. Test the new tools. |
| `major` (`1.0.2 → 2.0.0`) | 🔴 High | Look for `BREAKING CHANGE:` or changes in tool names, arguments and permissions. Read the skill before upgrading. |
| No installed version or no index version | ⚠️ Unknown | Treat as high until you read both `manifest.json` files. |
| Installed > published | ⚠️ Local ahead | Don't upgrade: the index may be stale. Verify the local repo first. |

A `feat` may be breaking if it renames a tool; a `fix` may be breaking if it changes a schema. **The number leads, the changelog qualifies.**

### Safe install order

1. **Record the current state.** Save `webview_extension_list` and the repo's `git status --short --branch`. If user data is involved, use `config-backup-diff` first.
2. **Validate the source.** In the checkout: `doctor_validate` → 0 errors and 0 warnings; same version in `manifest.json` and `antigem-plugins.json`. Regenerate index and README with `plugin-doctor` if needed (preview, then apply).
3. **Upgrade the tooling first.** `plugin-doctor`, and `skill-linter` / `mcp-health-check` if you use them. Later checks then run on the new versions.
4. **Then skills-only plugins.** They change no executed code: upgrade in small batches and check `get_skills`.
5. **Then hybrid plugins**, one at a time. After each: `webview_extension_logs`, `webview_extension_test` on a representative tool and `mcp_health`. If something fails, stop the batch.
6. **Sensitive ones last**: plugins with broad permissions, page automation or similarly named tools. Ask for explicit confirmation before upgrading them.
7. **Verify and close.** Repeat `webview_extension_list`, confirm versions, run `doctor_validate` again and note what changed. If something failed, reinstall the previous ZIP with `extension_id` to keep ID, folder and data.

To install/update from a draft use `webview_extension_install({project_id, extension_id})`: it preserves the stable ID, folder, data and enabled state. The user confirms installation on the phone; an equal version offers **Reinstall** and a lower one **Downgrade** (neither is an upgrade).

### Report

```markdown
## Upgrade plan — <date>

| # | Plugin | Installed → published | Bump | Risk | Changelog evidence | Action |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | plugin-doctor | 1.1.2 → 1.2.0 | minor | 🟡 Medium | `8d3dbfb` single table and local badges | Upgrade first |
| 2 | … | … | patch | 🟢 Low | `abc123` fix … | Skills batch |

**Order:** tooling → skills-only → hybrid → sensitive.
**Verification:** doctor_validate, get_skills, logs, mcp_health.
**Rollback:** previous ZIP + `extension_id` (keeps data).
```

Report rules: one row per plugin, evidence with a hash or "inferred from `git log`", risk using the legend above, and no action executed without confirmation. If data is missing, write `unknown`, not `0` or "no changes".
