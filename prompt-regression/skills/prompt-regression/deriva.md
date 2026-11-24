# Triar la deriva / Triaging drift

## ES

`case_check` devuelve `drift` con `category` (`format`, `language`, `tool`, `length`) y `name`. Cada categoría tiene una causa distinta y una respuesta distinta.

| Categoría | Señal | Causa probable | Acción |
| --- | --- | --- | --- |
| `format` | falta un encabezado, un prefijo `ES:`/`EN:` o el sobre de error | se recortó una instrucción del frontmatter o del skill principal | restaura la instrucción; si el formato cambió a propósito, actualiza el caso |
| `language` | detectado `es` cuando se esperaba `both` | se eliminó la frase bilingüe o se movió al archivo de detalle que el modelo ya no lee | vuelve a poner la regla en el skill principal |
| `tool` | aparece una herramienta prohibida | el skill dice "lee el detalle" pero no nombra la herramienta | nombra la herramienta exacta en el skill |
| `length` | demasiado corto | el modelo encontró una salida atajo; añade un criterio de completitud | añade una lista de secciones obligatorias |
| `length` | demasiado largo | se eliminó el límite de líneas o el consejo de ser breve | restaura el límite o acota el caso |

### Señales de alerta

- **Un solo caso con deriva**: probablemente el caso es frágil, no la skill. Revisa sus aserciones antes de tocar el skill.
- **Todos los casos fallan en la misma categoría**: cambio global. Busca la instrucción en el skill principal, no en los archivos de detalle.
- **La deriva aparece solo en cases con `actual_tool`**: el modelo eligió otra herramienta; revisa las descripciones de las tools, no el skill.
- **`NO_ASSERTIONS`**: el caso está mal construido. No es una regresión.

### Cambio aceptado vs bug

Antes de actualizar un caso, responde:

1. ¿El nuevo comportamiento es mejor para el usuario?
2. ¿Sigue cumpliendo la descripción del frontmatter?
3. ¿Sigue pasando los otros casos?
4. ¿Puedo explicar el cambio en `notes` en una frase?

Si las cuatro son sí, re-registra el caso con el mismo `case_id` y escribe el motivo. Si alguna es no, revierte la edición de la skill.

### Señales de que la skill empeoró aunque los casos pasen

- Las salidas son correctas pero mucho más largas.
- El modelo necesita más herramientas para lo mismo.
- Aparecen frases de relleno o disclaimers que antes no estaban.
- El orden de las secciones cambió en todos los casos.

Añade un caso nuevo para cada una de estas señales. Una batería que solo cubre el comportamiento antiguo no detecta mejoras falsas.

## EN

`case_check` returns `drift` with `category` (`format`, `language`, `tool`, `length`) and `name`. Each category has a different cause and a different response.

| Category | Signal | Likely cause | Action |
| --- | --- | --- | --- |
| `format` | missing heading, `ES:`/`EN:` prefix or error envelope | an instruction was trimmed from the frontmatter or main skill | restore it; if the format changed on purpose, update the case |
| `language` | `es` detected when `both` was expected | the bilingual rule was removed or moved to a detail file the model no longer reads | put the rule back in the main skill |
| `tool` | a forbidden tool appears | the skill says "read the detail" but never names the tool | name the exact tool in the skill |
| `length` | too short | the model found a shortcut answer; add a completeness criterion | add a list of required sections |
| `length` | too long | the line limit or brevity advice was removed | restore the limit or narrow the case |

### Warning signs

- **One case with drift**: the case is probably brittle, not the skill. Review its assertions first.
- **Every case fails in the same category**: a global change. Look in the main skill, not the detail files.
- **Drift only appears in cases with `actual_tool`**: the model chose another tool; review tool descriptions, not the skill.
- **`NO_ASSERTIONS`**: the case is badly built. This is not a regression.

### Accepted change vs bug

Before updating a case, answer:

1. Is the new behaviour better for the user?
2. Does it still match the frontmatter description?
3. Do the other cases still pass?
4. Can I explain the change in `notes` in one sentence?

If all four are yes, re-record the case with the same `case_id` and write why. If any is no, revert the skill edit.

### Signs the skill got worse even when cases pass

- Outputs are correct but much longer.
- The model needs more tools for the same task.
- Filler phrases or disclaimers appear that were not there before.
- Section order changed in every case.

Add a new case for each of these signals. A suite that only covers old behaviour will not catch false improvements.
