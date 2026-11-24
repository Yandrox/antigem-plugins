# Comandos / Commands

## ES

`bot_command_spec` parte de una única lista de comandos y genera los dos formatos. Así evitas que Telegram y Discord se desincronicen.

### Estructura mínima

```json
[
  {
    "name": "resumen",
    "description_es": "Resume el último informe",
    "description_en": "Summarises the latest report"
  }
]
```

### Con opciones, alias y restricciones

```json
[
  {
    "name": "buscar",
    "description_es": "Busca en el archivo",
    "description_en": "Search the archive",
    "aliases": ["q", "find"],
    "admin_only": true,
    "dm_only": false,
    "options": [
      {
        "name": "texto",
        "type": "string",
        "required": true,
        "description_es": "Texto a buscar",
        "description_en": "Text to search for"
      },
      {
        "name": "limite",
        "type": "integer",
        "required": false,
        "description_es": "Número de resultados",
        "description_en": "Number of results",
        "choices": ["5", "10", "20"]
      }
    ]
  }
]
```

### Tipos de opción

| `type` | Código Discord | Uso |
| --- | --- | --- |
| `string` | 3 | texto libre o choices de texto |
| `integer` | 4 | números enteros |
| `boolean` | 5 | sí/no |
| `user` | 6 | menciona un usuario |
| `channel` | 7 | menciona un canal |
| `role` | 8 | menciona un rol |
| `number` | 10 | decimales |
| `attachment` | 11 | archivo adjunto |

`mentionable` (9) también es válido aunque no aparezca en la tabla.

### Salidas

- **Telegram**: texto para `/setcommands`, con `comando - descripción` por línea. Si pasas `telegram_bot_name`, se añade como cabecera. Los alias se emiten como comandos independientes con la misma descripción.
- **Discord**: array JSON de application commands. `admin_only` se traduce a `default_member_permissions: "8"`; `dm_only` a `dm_permission: false`. Los choices se convierten al tipo numérico o booleano correspondiente.

### Validación

La respuesta trae `validation.errors` y `validation.warnings`. Los errores impiden publicar; los avisos indican recortes o reordenaciones:

- Nombre inválido o duplicado.
- Descripción vacía o mayor de 100 caracteres (se recorta).
- Más de 25 opciones por comando o más de 25 choices.
- Opciones opcionales antes que obligatorias (se reordenan).
- Más de 100 comandos contando alias en Telegram.

### Errores frecuentes

- Escribir el comando con barra inicial en `name`: la barra se añade sola al publicar.
- Usar guiones en nombres de Telegram: Telegram solo acepta `a-z0-9_`; Discord acepta también `-`. Si quieres compatibilidad total, usa solo guion bajo.
- Olvidar `description_en` y pedir `language:"both"`: se reutiliza la descripción disponible, pero la ficha queda menos clara.

## EN

`bot_command_spec` starts from a single command list and emits both formats, so Telegram and Discord cannot drift apart.

### Minimal shape

Same JSON as above, with `name`, `description_es` and `description_en`.

### With options, aliases and restrictions

Same JSON as above. `aliases` generate extra Telegram commands, `admin_only` maps to Discord `default_member_permissions: "8"` and `dm_only` maps to `dm_permission: false`.

### Option types

See the table above. `string`=3, `integer`=4, `boolean`=5, `user`=6, `channel`=7, `role`=8, `mentionable`=9, `number`=10, `attachment`=11.

### Outputs

- **Telegram**: `/setcommands` text, one `command - description` line each. `telegram_bot_name` adds a header. Aliases become independent commands sharing the description.
- **Discord**: JSON array of application commands. Choices are coerced to the matching numeric or boolean type.

### Validation

The result includes `validation.errors` and `validation.warnings`:

- Invalid or duplicate name.
- Empty description or longer than 100 chars (truncated).
- More than 25 options or 25 choices.
- Optional options before required ones (reordered).
- More than 100 Telegram commands counting aliases.

### Common mistakes

- Adding a leading slash to `name`: it is added when publishing.
- Using hyphens in Telegram names: Telegram accepts only `a-z0-9_`; use underscores for full compatibility.
- Omitting `description_en` while requesting `language:"both"`: the available description is reused, but the card is less useful.
