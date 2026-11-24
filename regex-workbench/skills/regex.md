---
name: Banco de trabajo de regex / Regex workbench
description: ES: Valida, explica y prueba expresiones regulares sin salir de la app, con acentos, ñ y Unicode de primera clase; detecta backtracking catastrófico y convierte entre JavaScript, PCRE y POSIX. Úsala antes de escribir un parser o una validación con regex. EN: Validate, explain and test regular expressions offline with accents, ñ and first-class Unicode; flag catastrophic backtracking and convert between JavaScript, PCRE and POSIX. Use it before writing a regex parser or validator.
---

# Banco de trabajo de regex / Regex workbench

## ES

Usa esta skill siempre que vayas a **escribir, revisar o depurar una expresión regular**, sobre todo si el texto puede contener español, acentos o ñ. El plugin corre en el worker: no pega tu patrón en una web, no hace llamadas de red y no guarda tus datos fuera del teléfono.

### Las dos tools

| Tool | Qué hace |
| --- | --- |
| `regex_explain` | Comprueba que el patrón compila, lo explica token a token, genera casos (incluidos sondeos para falsos positivos), calcula el riesgo de backtracking y devuelve JS/PCRE/POSIX con banderas `u`/`i` sugeridas. **No ejecuta el patrón contra texto arbitrario.** |
| `regex_test` | Ejecuta el patrón contra tus muestras y contra los casos generados. Marca fallos y falsos positivos. Se niega a ejecutar patrones con riesgo alto de backtracking. |

### Flujo recomendado

1. **Escribe el patrón sin delimitadores** (`\b(\p{L}+)\b`, no `/\b(\p{L}+)\b/g`) y las banderas en `flags` (`gimsuy`).
2. **Explica antes de probar**: `regex_explain`. Revisa tres cosas: que `valid` sea `true`, que `risk.level` no sea `high`, y las recomendaciones de `unicode`.
3. **Corrige con `flagsSuggested`**: si el patrón tiene acentos o `ñ`, casi siempre necesitas `u`; si además quieres ignorar mayúsculas, `iu`.
4. **Prueba** con `regex_test`: pasa tus muestras como strings o como objetos `{text, expect:true|false, label}`. Añade casos propios para lo que el generador no cubre.
5. **Mira los falsos positivos**: un caso con `expect:false` que coincide es una alerta. En español los más habituales son mayúsculas sin `i`, `ñ` tratada como `n`, y `\w` que excluye acentos.
6. **Guarda el informe** con `output` + `dry_run:false` bajo `~/` o `/sdcard/` si quieres dejar evidencia. Por defecto `dry_run:true`.

### Reglas prácticas

- `flags` se normaliza: caracteres no válidos se descartan y las banderas repetidas se eliminan.
- `max_matches` por muestra va de 1 a 100 (por defecto 20). El contador de coincidencias evita bucles con patrones de ancho cero.
- Con riesgo `medium`, cada muestra se corta a 200 caracteres. Con riesgo `high`, no se ejecuta nada y se explica por qué.
- Los casos generados son una red de seguridad, no una especificación: no prueban que el patrón sea correcto, solo que no coincide con lo obvio que no debería.
- `regex_explain` devuelve `tokens` con posición, fragmento y explicación bilingüe; úsalos para localizar el fragmento que hay que cambiar.

### Qué mirar en el informe

- `risk.reasons`: cada señal de backtracking con su nivel.
- `unicode`: recomendaciones `required` frente a `suggested`. Las `required` (como `\p{...}` sin `u`) impiden que compile.
- `flavors.posix.*.notes`: lo que no tiene traducción directa (miradas adelante, cuantificadores perezosos, propiedades Unicode).
- `summary.falsePositives`: el número que más importa en validaciones.

Lee `unicode.md` para el trato de acentos y ñ, `sabores.md` para las diferencias entre motores y `riesgos.md` para el backtracking.

## EN

Use this skill whenever you are **writing, reviewing or debugging a regular expression**, especially when the text may contain Spanish, accents or ñ. The plugin runs in the worker: it does not paste your pattern into a website, make network calls or store your data outside the phone.

### The two tools

| Tool | What it does |
| --- | --- |
| `regex_explain` | Checks that the pattern compiles, explains it token by token, generates cases (including false-positive probes), computes backtracking risk and returns JS/PCRE/POSIX with suggested `u`/`i` flags. **It does not run the pattern against arbitrary text.** |
| `regex_test` | Runs the pattern against your samples and the generated cases, flagging failures and false positives. Refuses to execute high-backtracking-risk patterns. |

### Recommended flow

1. **Write the pattern without delimiters** (`\b(\p{L}+)\b`, not `/\b(\p{L}+)\b/g`) and put flags in `flags` (`gimsuy`).
2. **Explain before testing**: `regex_explain`. Check three things: `valid` is `true`, `risk.level` is not `high`, and the `unicode` recommendations.
3. **Apply `flagsSuggested`**: patterns with accents or `ñ` almost always need `u`; add `i` too for case-insensitive matching (`iu`).
4. **Test** with `regex_test`: pass samples as strings or `{text, expect:true|false, label}` objects. Add your own cases for anything the generator does not cover.
5. **Inspect false positives**: a case with `expect:false` that matches is an alert. In Spanish the usual causes are uppercase without `i`, `ñ` treated as `n`, and `\w` excluding accents.
6. **Save the report** with `output` + `dry_run:false` under `~/` or `/sdcard/` if you want evidence. Preview is the default.

### Practical rules

- `flags` is normalised: invalid characters are dropped and duplicates removed.
- `max_matches` per sample is 1-100 (default 20). The match counter avoids loops with zero-width patterns.
- With `medium` risk, each sample is capped at 200 chars. With `high` risk, nothing is executed and the reason is reported.
- Generated cases are a safety net, not a specification: they do not prove correctness, only that obvious non-matches stay non-matches.
- `regex_explain` returns `tokens` with position, fragment and bilingual explanation; use them to locate what to change.

### What to read in the report

- `risk.reasons`: each backtracking signal with its level.
- `unicode`: `required` versus `suggested` recommendations. `required` ones (such as `\p{...}` without `u`) prevent compilation.
- `flavors.posix.*.notes`: constructs with no direct translation (lookarounds, lazy quantifiers, Unicode properties).
- `summary.falsePositives`: the number that matters most in validators.

Read `unicode.md` for accents and ñ, `sabores.md` for engine differences and `riesgos.md` for backtracking.
