# Checklist final / Final checklist

## ES

Marca cada punto antes de dar la tool por terminada. Los doce primeros son obligatorios.

### Contrato de la tool

- [ ] El nombre es `snake_case` y sigue el prefijo de familia del plugin (`subs_*`, `a11y_*`, ...).
- [ ] La descripción empieza con `ES:` y contiene `EN:` en el mismo string.
- [ ] La descripción dice cuándo usarla **y** cuándo no.
- [ ] La descripción dice qué devuelve y si escribe archivos.
- [ ] `type: "object"` y `additionalProperties: false`.
- [ ] Todas las propiedades tienen `type` y descripción bilingüe.

### Tipos y valores

- [ ] Los `enum` están cerrados y cada valor se explica.
- [ ] Los números indican unidad, rango y valor por defecto.
- [ ] Los arrays tienen `items` tipados y un tope documentado.
- [ ] Los booleanos explican `true` y `false`, no solo el nombre.
- [ ] Las rutas usan `~/` o `/sdcard/`, nunca `/storage/emulated/0/`.

### Seguridad y alternativas

- [ ] Las tools que escriben tienen `dry_run` con default `true`.
- [ ] Si hay alternativas, la prioridad está escrita en la descripción.
- [ ] La tool devuelve un campo `source` si acepta varias entradas.
- [ ] El worker hace `clamp` aunque el schema ya limite el rango.
- [ ] Los permisos del manifest son solo los que el código usa.

### Salida y verificación

- [ ] El formato de salida está descrito en la tool o en la skill.
- [ ] Los errores usan códigos estables y el sobre `isError` bilingüe.
- [ ] Hay una llamada mínima, una completa y una inválida documentadas.
- [ ] `doctor_validate` pasa sin errores ni avisos.
- [ ] La versión coincide en `manifest.json` y `antigem-plugins.json`.

### Umbral mínimo para publicar

Si falla **cualquiera** de estos cinco, no publiques todavía:

1. Descripción bilingüe con cuándo no usarla.
2. `dry_run: true` por defecto si escribe.
3. Prioridad de alternativas escrita.
4. Errores bilingües con códigos estables.
5. `doctor_validate` en verde.

## EN

Tick every item before calling the tool done. The first twelve are mandatory.

### Tool contract

- [ ] The name is `snake_case` and follows the plugin's family prefix (`subs_*`, `a11y_*`, ...).
- [ ] The description starts with `ES:` and contains `EN:` in the same string.
- [ ] The description says when to use it **and** when not to.
- [ ] The description says what it returns and whether it writes files.
- [ ] `type: "object"` and `additionalProperties: false`.
- [ ] Every property has a `type` and a bilingual description.

### Types and values

- [ ] Enums are closed and each value is explained.
- [ ] Numbers state unit, range and default.
- [ ] Arrays have typed `items` and a documented cap.
- [ ] Booleans explain `true` and `false`, not just the name.
- [ ] Paths use `~/` or `/sdcard/`, never `/storage/emulated/0/`.

### Safety and alternatives

- [ ] Writing tools have `dry_run` defaulting to `true`.
- [ ] If alternatives exist, priority is written in the description.
- [ ] The tool returns a `source` field when it accepts several inputs.
- [ ] The worker clamps values even if the schema already limits them.
- [ ] Manifest permissions are only the ones the code uses.

### Output and verification

- [ ] Output format is described in the tool or the skill.
- [ ] Errors use stable codes and the bilingual `isError` envelope.
- [ ] A minimal, a full and an invalid call are documented.
- [ ] `doctor_validate` passes with no errors or warnings.
- [ ] Version matches in `manifest.json` and `antigem-plugins.json`.

### Minimum bar before publishing

If **any** of these five fails, do not publish yet:

1. Bilingual description with when-not-to-use.
2. `dry_run: true` by default if it writes.
3. Alternative priority written down.
4. Bilingual errors with stable codes.
5. `doctor_validate` green.
