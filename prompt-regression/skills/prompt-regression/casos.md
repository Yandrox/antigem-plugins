# Formato de casos / Case format

## ES

Un caso es un JSON con `caseId`, `skill`, `skillVersion`, `input`, `expect` y `notes`. Lo crea `case_record` y queda en almacenamiento local bajo `regressions.cases.<caseId>`.

### Estructura de `expect`

```json
{
  "format": {
    "contains": ["ES:", "EN:", "additionalProperties"],
    "not_contains": ["Lo siento", "No puedo"],
    "regex": "^# .*\\n",
    "json": false
  },
  "language": { "expected": "both" },
  "tool": {
    "expected": ["get_skill", "get_skills"],
    "forbidden": ["get_skill_file"]
  },
  "length": {
    "min_chars": 120,
    "max_chars": 3000,
    "min_words": 20,
    "max_words": 500
  }
}
```

| Grupo | Clave | Significado |
| --- | --- | --- |
| `format` | `contains` | cada frase debe aparecer (sin distinguir mayúsculas) |
| `format` | `not_contains` | ninguna frase debe aparecer |
| `format` | `regex` | patrón JS; admite `/patron/flags` o patrón suelto |
| `format` | `json` | `true` exige que la salida sea JSON válido |
| `language` | `expected` | `es`, `en` o `both` |
| `tool` | `expected` | herramienta o lista de herramientas aceptadas |
| `tool` | `forbidden` | herramientas que no deben aparecer |
| `length` | `min_chars` / `max_chars` | rango de caracteres de la salida |
| `length` | `min_words` / `max_words` | rango de palabras de la salida |

### Cómo elegir aserciones

- **Invariantes de formato**: el encabezado, el sobre `{isError, content}`, los prefijos `ES:`/`EN:`. Son las más baratas y las más estables.
- **Idioma**: usa `both` cuando la skill es bilingüe. El detector cuenta marcadores de español e inglés; tolera que aparezcan palabras del otro idioma.
- **Herramienta**: solo si la skill recomienda una herramienta concreta. Si la elección es legítimamente múltiple, pon todas en `expected`.
- **Longitud**: rangos amplios. Sirven para detectar respuestas vacías o desbordes, no para medir calidad.

### Errores comunes al diseñar casos

- Copiar la salida anterior como `contains` entera: se rompe con cualquier reordenación. Guarda solo frases clave.
- Poner `regex` con `.*` greedy sin ancla: puede coincidir con todo y no detectar nada.
- Olvidar `actual_tool` en `case_check`: la aserción `tool` fallará aunque la herramienta fuera correcta.
- Usar `case_id` autogenerado: no podrás actualizar el caso tras el cambio.

## EN

A case is JSON with `caseId`, `skill`, `skillVersion`, `input`, `expect` and `notes`. `case_record` creates it and stores it under `regressions.cases.<caseId>`.

### The `expect` structure

Same JSON shape as above.

| Group | Key | Meaning |
| --- | --- | --- |
| `format` | `contains` | each phrase must appear (case-insensitive) |
| `format` | `not_contains` | no phrase may appear |
| `format` | `regex` | JS pattern; accepts `/pattern/flags` or a bare pattern |
| `format` | `json` | `true` requires the output to be valid JSON |
| `language` | `expected` | `es`, `en` or `both` |
| `tool` | `expected` | accepted tool or list of tools |
| `tool` | `forbidden` | tools that must not appear |
| `length` | `min_chars` / `max_chars` | character range of the output |
| `length` | `min_words` / `max_words` | word range of the output |

### Choosing assertions

- **Format invariants**: heading, `{isError, content}` envelope, `ES:`/`EN:` prefixes. Cheapest and most stable.
- **Language**: use `both` for bilingual skills. The detector counts Spanish and English markers and tolerates some mixing.
- **Tool**: only when the skill recommends a concrete tool. If several are legitimate, list them all in `expected`.
- **Length**: wide ranges. They catch empty or runaway answers, not quality.

### Common mistakes

- Copying the whole previous output into `contains`: any reordering breaks it. Keep key phrases only.
- Using an unanchored greedy `.*` regex: it matches everything and detects nothing.
- Forgetting `actual_tool` in `case_check`: the `tool` assertion fails even if the choice was right.
- Letting `case_id` be generated: you will not be able to update the case after the change.
