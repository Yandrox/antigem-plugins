---
name: Regresión de prompts / Prompt regression
description: ES: Detecta deriva en las skills de AntiGem guardando casos entrada→salida con aserciones y comparando formato, idioma, herramienta elegida y longitud tras editar una skill. Úsala antes y después de cambiar el frontmatter o las instrucciones. EN: Detect drift in AntiGem skills by storing input→output cases with assertions and comparing format, language, tool choice and length after editing a skill. Use it before and after changing frontmatter or instructions.
---

# Regresión de prompts / Prompt regression

## ES

Usa esta skill cuando vayas a **editar una skill existente** (frontmatter, instrucciones, archivos de detalle) y quieras saber si sigue resolviendo los mismos casos. También para crear la red de seguridad antes de tocar nada.

Un worker no puede invocar al modelo, así que la repetición del caso la haces tú: lees la skill modificada, la sigues con la entrada guardada y pasas el resultado a `case_check`. Las tools guardan, comparan y reportan; tú produces la salida.

### Flujo

1. **Antes del cambio, registra casos** con `case_record`. Elige entradas que representen el uso normal, un caso límite y un caso que antes fallaba. Guarda `skill`, `skill_version`, `input` y `expect`.
2. **Define aserciones estables**, no prosa exacta: frases que deben aparecer, un regex para la estructura, idioma esperado (`es`/`en`/`both`), herramienta esperada y rango de caracteres/palabras. Consulta `casos.md`.
3. **Edita la skill** como tenías previsto.
4. **Repite cada caso** siguiendo la skill modificada. Anota la salida literal y la herramienta que elegiste. Consulta `ejecucion.md`.
5. **Evalúa** con `case_check`: `{"case":"<id>","actual":"...","actual_tool":"get_skill"}`.
6. **Reporta** con `case_report` y decide: si la deriva es intencionada, actualiza el caso con `case_record` (mismo `case_id`) y escribe en `notes` por qué cambió la expectativa.
7. Repite `doctor_validate` al final: esta skill detecta deriva de comportamiento, no errores de manifiesto.

### Tolerancia semántica

No compares la salida completa con un string idéntico. El modelo puede cambiar el orden de las palabras y seguir siendo correcto. Separa cuatro dimensiones independientes:

| Dimensión | Qué comprueba | Fallo típico |
| --- | --- | --- |
| `format` | Frases obligatorias, ausencias, regex, JSON válido | perdió el encabezado o el sobre de error |
| `language` | `es`, `en` o `both` | dejó de responder en los dos idiomas |
| `tool` | herramienta elegida / prohibida | empezó a llamar `get_skill_file` sin necesidad |
| `length` | caracteres y palabras | se pasó de largo o quedó vacío |

Cada dimensión se puntúa por separado y `case_check` devuelve `drift` con `category` y `name`, para que sepas **qué** se rompió, no solo que algo falló.

### Reglas prácticas

- Un caso con cero aserciones falla a propósito (`NO_ASSERTIONS`): fuerza a definir qué significa "correcto".
- Usa `case_id` estables (`mcp-schemas-basico`, `accesibilidad-error`) para poder actualizarlos.
- Guarda un caso por versión si el cambio es grande; la versión vieja queda como evidencia.
- `dry_run: true` por defecto en las tres tools; `output` + `dry_run:false` escribe el JSON o el Markdown.
- `case_record` siempre guarda en almacenamiento local aunque el `dry_run` sea `true`.

Lee `casos.md` para el formato exacto de `expect`, `ejecucion.md` para cómo repetir un caso sin contaminar la memoria, y `deriva.md` para decidir si un fallo es bug o cambio aceptado.

## EN

Use this skill when you are about to **edit an existing skill** (frontmatter, instructions, detail files) and want to know whether it still solves the same cases. Also use it to build the safety net before touching anything.

A worker cannot invoke the model, so you replay the case yourself: read the modified skill, follow it with the stored input, and pass the result to `case_check`. The tools store, compare and report; you produce the output.

### Flow

1. **Before the change, record cases** with `case_record`. Pick normal-use inputs, one edge case and one case that used to fail. Save `skill`, `skill_version`, `input` and `expect`.
2. **Define stable assertions**, not exact prose: phrases that must appear, a regex for structure, expected language (`es`/`en`/`both`), expected tool and character/word range. See `casos.md`.
3. **Edit the skill** as planned.
4. **Replay each case** by following the modified skill. Write down the literal output and the tool you chose. See `ejecucion.md`.
5. **Evaluate** with `case_check`: `{"case":"<id>","actual":"...","actual_tool":"get_skill"}`.
6. **Report** with `case_report` and decide: if the drift is intentional, re-record the case with `case_record` (same `case_id`) and explain in `notes` why the expectation changed.
7. Run `doctor_validate` at the end: this skill detects behaviour drift, not manifest errors.

### Semantic tolerance

Do not compare the whole output to an identical string. The model can reorder words and still be correct. Keep four independent dimensions:

| Dimension | What it checks | Typical failure |
| --- | --- | --- |
| `format` | Required phrases, absences, regex, valid JSON | lost the heading or the error envelope |
| `language` | `es`, `en` or `both` | stopped answering in both languages |
| `tool` | chosen / forbidden tool | started calling `get_skill_file` unnecessarily |
| `length` | characters and words | ran too long or came back empty |

Each dimension is scored separately and `case_check` returns `drift` with `category` and `name`, so you know **what** broke, not just that something failed.

### Practical rules

- A case with zero assertions fails on purpose (`NO_ASSERTIONS`): it forces you to define what "correct" means.
- Use stable `case_id` values (`mcp-schemas-basico`, `a11y-error`) so you can update them.
- Keep a case per version when the change is large; the old version stays as evidence.
- `dry_run: true` by default in all three tools; `output` + `dry_run:false` writes the JSON or Markdown.
- `case_record` always saves to local storage even when `dry_run` is `true`.

Read `casos.md` for the exact `expect` format, `ejecucion.md` for replaying without contaminating memory, and `deriva.md` for deciding whether a failure is a bug or an accepted change.
