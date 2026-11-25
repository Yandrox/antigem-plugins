# Plantilla de traspaso / Handoff template

## ES

Copia el bloque siguiente y rellena los campos entre corchetes. Elimina las secciones que no apliquen, pero **no cambies el orden** de las que queden. Todo lo que escribas debe entenderse sin la conversación original. Los encabezados ya son bilingües: no los traduzcas de nuevo.

```markdown
# Handoff de sesión / Session handoff

- Fecha / Date: [YYYY-MM-DD]
- Origen / From: [OpenCode | Jarvis | Claude Code | Codex | AntiGem chat]
- Destino / To: [agente previsto, o "cualquiera" / intended agent, or "any"]
- Repo / Repo: [ruta absoluta o "N/A" / absolute path or "N/A"]

## Objetivo / Objective
[Una frase: qué se pidió y qué resultado se espera. / One sentence: what was asked and the expected outcome.]

## Decisiones / Decisions
- ✅ [Decisión] — [razón / reason]
- ❌ [Alternativa descartada] — [por qué / why]
- [Elimina las viñetas que no apliquen. / Remove bullets that do not apply.]

## Trabajo completado / Completed work
- [Archivo o ruta: qué cambió. Si aplica, `hash` del commit. / File or path: what changed. Commit hash when relevant.]
- [Validación: herramienta o comando y resultado exacto, p. ej. "doctor_validate: 21 plugins, 0 errores / 0 avisos". / Validation: tool or command and exact result.]

## Bloqueos / Blockers
- [Error exacto recortado, qué se intentó y qué se necesita. / Truncated exact error, what was tried and what is needed.]
- [Si no hay bloqueos: "Ninguno / None".]

## Estado del repo / Repo state
- Rama / Branch: [main | ...]
- `git status --short --branch`: [salida real, o "no verificada" / real output, or "not checked"]
- Último commit / Last commit: [hash y mensaje / hash and message]

## Rutas relevantes / Relevant paths
- `[ruta absoluta o ~/...]` — [por qué importa / why it matters]
- `[ruta]` — [por qué importa / why it matters]

## Pendientes / Open items
- [Tarea sin hacer o sin verificar. Marca "sin verificar / unverified" si no hay evidencia.]

## Siguiente paso / Next step
[Una sola acción concreta con comando o herramienta. / One concrete action with command or tool.]

## Convenciones / Conventions
- [Reglas del proyecto que el siguiente agente debe respetar: idioma, root del doctor, install string, permisos… / Project rules the next agent must respect: language, doctor root, install string, permissions…]
```

### Límites

- 30–60 líneas como objetivo; más solo si un bloqueo lo exige.
- Sin logs completos ni código copiado, salvo un fragmento mínimo y redactado.
- Sin secretos: `password=`, tokens y claves → `[REDACTED]`.
- Si un campo no aplica, pon `N/A` o elimina la sección; **nunca lo inventes**.
- Si no verificaste el repo, escribe «no verificada / not checked» en lugar de «limpio / clean».

### Ejemplo recortado

```markdown
# Handoff de sesión / Session handoff

- Fecha / Date: 2026-11-25
- Origen / From: OpenCode
- Destino / To: Jarvis
- Repo / Repo: /storage/emulated/0/GitHub/AntiGem Plugins/antigem-plugins

## Objetivo / Objective
Publicar el plugin `session-handoff` en el repo comunitario.

## Decisiones / Decisions
- ✅ Solo skills, sin worker — no necesita código determinista.
- ✅ Bilingüe ES/EN en skill y plantilla.

## Trabajo completado / Completed work
- `session-handoff/skills/session-handoff.md` — skill principal.
- `doctor_validate` previo: 20 plugins, 0 errores / 0 avisos.

## Bloqueos / Blockers
- Ninguno / None.

## Estado del repo / Repo state
- Rama / Branch: main
- `git status --short --branch`: limpio / clean
- Último commit / Last commit: `dc9322a Add mcp-health-check plugin v1.0.0`

## Rutas relevantes / Relevant paths
- `/storage/emulated/0/GitHub/AntiGem Plugins/antigem-plugins/` — repo a publicar.
- `/sdcard/GitHub/AntiGem Plugins/antigem-plugins` — root que aceptan las tools doctor.

## Pendientes / Open items
- Regenerar índice y README con vista previa, luego aplicar.

## Siguiente paso / Next step
Copiar `src/.` al repo, ejecutar `doctor_fix_index` con `dry_run:true`, revisar el diff y aplicar.

## Convenciones / Conventions
- Versión igual en `manifest.json` y `antigem-plugins.json`; install string `Yandrox/antigem-plugins`.
```

## EN

Copy the block above and fill the bracketed fields. Remove sections that do not apply, but **keep the order** of the ones that remain. Everything you write must be understandable without the original conversation. The headers are already bilingual: do not translate them again.

### Limits

- Aim for 30–60 lines; more only if a blocker requires it.
- No full logs or copied code, except a minimal redacted fragment.
- No secrets: `password=`, tokens and keys → `[REDACTED]`.
- If a field does not apply, write `N/A` or remove the section; **never invent it**.
- If you did not check the repo, write «no verificada / not checked» instead of «limpio / clean».

### Filled example

The short example above is already bilingual; use it as a model for tone and density. Keep the `✅ / ❌` decision markers and the exact validation numbers — they are what make a handoff verifiable instead of a vague summary.
