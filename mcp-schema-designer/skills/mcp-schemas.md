---
name: Diseñar esquemas MCP / Design MCP schemas
description: ES: Diseña o revisa las tools de un manifest.json de plugin AntiGem: nombres, descripciones bilingües, tipos, rangos, exclusión mutua, defaults seguros, ejemplos de llamada y tabla de errores. Úsala antes de escribir la tool. EN: Design or review the tools in an AntiGem plugin manifest.json: names, bilingual descriptions, types, ranges, mutual exclusion, safe defaults, call examples and an error table. Use it before writing the tool.
---

# Diseñar esquemas MCP / Design MCP schemas

## ES

Usa esta skill cuando vayas a **crear una tool**, **añadir parámetros** a una existente o **revisar un `manifest.json` antes de publicarlo**. No la uses para auditar un repo ya publicado: para eso está `plugin-doctor` y su `doctor_validate`. Esta skill es la parte de diseño; doctor es la parte de chequeo.

### Principio rector

Un `inputSchema` no es un formulario: es un contrato con un modelo que no te puede preguntar. Si un parámetro admite dos interpretaciones, el modelo elegirá la equivocada. Todo campo debe responder a cuatro preguntas:

1. ¿Qué es y en qué unidad?
2. ¿Qué ocurre si se omite?
3. ¿Con qué otro parámetro no se puede combinar?
4. ¿Qué rango es válido y qué hace el worker si se sale de él?

### Flujo en seis pasos

1. **Inventario.** Lista las tools que resuelven el mismo problema y decide si hacen falta todas. Una tool con diez parámetros casi siempre son dos tools.
2. **Nombres.** `verbo_sustantivo` en `snake_case`, con prefijo de familia común: `subs_from_script`, `subs_align`, `subs_style`. Nunca mezcles `camelCase` con `snake_case` en el mismo plugin.
3. **Descripción.** Empieza con `ES:` y `EN:` en el mismo string. Di **cuándo usarla** y **cuándo no**. Di qué devuelve y qué efecto tiene (¿escribe archivos?).
4. **Schema.** Tipos explícitos, `enum` cerrado, rangos con valor por defecto documentado, `additionalProperties:false`, `items` tipados en arrays, y prioridad escrita cuando haya alternativas.
5. **Ejemplos y errores.** Escribe una llamada mínima, una completa y una inválida. Documenta los códigos de error/devolución que puede devolver el worker.
6. **Verificación.** Pasa `doctor_validate` y comprueba que la versión del `manifest.json` coincide con `antigem-plugins.json`.

### Reglas rápidas

| Regla | Mal | Bien |
| --- | --- | --- |
| Descripción bilingüe | `"Genera subtítulos"` | `"ES: Genera SRT/VTT desde un guion. EN: Generate SRT/VTT from a script."` |
| Cuándo no usarla | solo positivo | `"; no la uses para transcribir audio /; do not use it to transcribe audio"` |
| Rango en la descripción | `"tamaño"` | `"px, 16-160; por defecto 48 / px, 16-160; default 48"` |
| Booleano de escritura | `overwrite` sin más | `dry_run` con `"true = solo previsualizar (por defecto); false = escribir"` |
| Alternativas | tres parámetros sueltos | `"duration tiene prioridad sobre video_path / takes priority over video_path"` |
| Array | `"type":"array"` | `"items":{"type":"object"}` + tope documentado |
| Propiedades extra | omitir | `"additionalProperties": false` |
| Idioma de salida | `language` sin enumerar | `"enum":["es","en","both"]` y explicar `both` |
| Rutas de archivo | `/storage/emulated/0/...` | `~/...` o `/sdcard/...` |
| Permisos | pedirlo todo | solo `antigemFiles` si se leen/escriben archivos |

### Errores del worker

Todas las tools devuelven el mismo sobre cuando fallan:

```js
{ isError: true, content: [{ type: 'text', text: 'Mensaje ES / English message' }] }
```

Nunca lances un `throw` con un mensaje de una sola lengua ni dejes que escape un `TypeError`. Un error con dos idiomas ahorra una iteración completa.

### Antes de dar por terminado el diseño

- [ ] Cada parámetro tiene tipo y descripción en los dos idiomas.
- [ ] Los `enum` están cerrados y cada valor se explica.
- [ ] Los números tienen rango y default, y el worker hace `clamp`.
- [ ] Hay un `dry_run: true` si la tool escribe archivos.
- [ ] La prioridad entre alternativas está escrita en la descripción.
- [ ] El formato de salida está descrito en la tool o en la skill.
- [ ] Existe una tabla de errores con códigos estables (`PATH_REJECTED`, `FILE_MISSING`, ...).

Lee `anti-patrones.md` para los diez fallos más frecuentes, `ejemplos.md` para una tool completa anotada y `checklist.md` para la revisión final.

## EN

Use this skill when you are about to **create a tool**, **add parameters** to an existing one, or **review a `manifest.json` before publishing**. Do not use it to audit an already published repo: that is `plugin-doctor` and its `doctor_validate`. This skill is the design phase; doctor is the check phase.

### Guiding principle

An `inputSchema` is not a form: it is a contract with a model that cannot ask you a question. If a parameter can be read two ways, the model will pick the wrong one. Every field must answer four questions:

1. What is it, and in what unit?
2. What happens if it is omitted?
3. Which other parameter can it not be combined with?
4. What is the valid range, and what does the worker do when the value is outside it?

### Six-step flow

1. **Inventory.** List the tools that solve the same problem and decide whether all are needed. A tool with ten parameters is usually two tools.
2. **Names.** `verb_noun` in `snake_case`, with a shared family prefix: `subs_from_script`, `subs_align`, `subs_style`. Never mix `camelCase` and `snake_case` in one plugin.
3. **Description.** Start with `ES:` and `EN:` in the same string. Say **when to use it** and **when not to**. Say what it returns and what it does (does it write files?).
4. **Schema.** Explicit types, closed `enum`, ranges with documented default, `additionalProperties:false`, typed `items` in arrays, and written priority when alternatives exist.
5. **Examples and errors.** Write a minimal call, a full call and an invalid call. Document the return/error codes the worker can produce.
6. **Verification.** Run `doctor_validate` and check that the `manifest.json` version matches `antigem-plugins.json`.

### Quick rules

| Rule | Bad | Good |
| --- | --- | --- |
| Bilingual description | `"Generates subtitles"` | `"ES: Genera SRT/VTT desde un guion. EN: Generate SRT/VTT from a script."` |
| When not to use | positive only | `"; do not use it to transcribe audio"` |
| Range in description | `"size"` | `"px, 16-160; default 48"` |
| Write flag | `overwrite` alone | `dry_run` with `"true = preview only (default); false = write files"` |
| Alternatives | three loose parameters | `"duration takes priority over video_path"` |
| Array | `"type":"array"` | `"items":{"type":"object"}` plus a documented cap |
| Extra properties | omitted | `"additionalProperties": false` |
| Output language | `language` unenumerated | `"enum":["es","en","both"]` and explain `both` |
| File paths | `/storage/emulated/0/...` | `~/...` or `/sdcard/...` |
| Permissions | ask for everything | only `antigemFiles` if files are read/written |

### Worker errors

All tools return the same envelope when they fail:

```js
{ isError: true, content: [{ type: 'text', text: 'English message / Mensaje ES' }] }
```

Never throw a single-language message and never let a `TypeError` escape. A bilingual error saves a whole iteration.

### Before calling the design done

- [ ] Every parameter has a type and a description in both languages.
- [ ] Enums are closed and each value is explained.
- [ ] Numbers have range and default, and the worker clamps them.
- [ ] There is a `dry_run: true` if the tool writes files.
- [ ] Priority between alternatives is written in the description.
- [ ] Output format is described in the tool or the skill.
- [ ] There is an error table with stable codes (`PATH_REJECTED`, `FILE_MISSING`, ...).

Read `anti-patrones.md` for the ten most frequent mistakes, `ejemplos.md` for a fully annotated tool and `checklist.md` for the final review.
