# Español y Unicode / Spanish and Unicode

## ES

### `u` no es opcional con acentos

`\p{L}` exige la bandera `u`. Sin ella, JavaScript no compila. Un literal `ñ` en el patrón compila sin `u`, pero puede no equivaler a `Ñ` sin `i`, y los rangos tipo `[a-z]` nunca incluyen la eñe.

```text
patrón: ^\p{L}+$
flags:  u        → válido
flags:  (vacío)  → inválido: propiedad Unicode sin u
```

`flagsSuggested.u` y `flagsSuggested.iu` te dan la versión corregida sin tener que reescribir el patrón.

### `\w` no incluye acentos

`\w` significa `[A-Za-z0-9_]`, con o sin `u`. Para nombres en español usa:

```text
[\p{L}\p{N}_]+
```

Con `u`, `\p{L}` cubre letras de todos los idiomas y `\p{M}` los diacríticos compuestos. Si el texto viene de teclados distintos, `café` puede llegar como `cafe` + `U+0301`; `\p{M}` lo detecta.

### `\b` rompe en español

`\b` usa la definición ASCII de palabra: en `año` hay una frontera entre `ñ` y `o`. Para palabras Unicode, sustituye `\b` por aserciones:

```text
(?<![\p{L}\p{N}_])palabra(?![\p{L}\p{N}_])
```

### Mayúsculas

Con `iu`, `Á` equivale a `á` y `Ñ` a `ñ`. Sin `u`, el plegado de mayúsculas acentuadas no es fiable. Con `i` pero sin `u`, los literales ASCII (`ABC` frente a `abc`) sí funcionan.

### Casos generados

El generador añade siempre sondas: `áéíóú`, `ñ`, `ÁÉ`, `中文`, `123`, `😀` y `a\nb`. Si el patrón usa `\p{L}`, las sondas de letras se marcan como coincidencia esperada. En cualquier otro caso se marcan como `expect:false`: si coinciden, aparecen en `summary.falsePositives`.

## EN

### `u` is not optional with accents

`\p{L}` requires the `u` flag; without it JavaScript does not compile. A literal `ñ` compiles without `u`, but may not equal `Ñ` without `i`, and ranges like `[a-z]` never include ñ.

`flagsSuggested.u` and `flagsSuggested.iu` give you the corrected version without rewriting the pattern.

### `\w` excludes accents

`\w` means `[A-Za-z0-9_]`, with or without `u`. For Spanish names use `[\p{L}\p{N}_]+`. With `u`, `\p{L}` covers letters in all languages and `\p{M}` covers combining diacritics, so `café` and `cafe` + `U+0301` can both be handled.

### `\b` breaks in Spanish

`\b` uses the ASCII word definition: `año` has a boundary between ñ and o. For Unicode words use `(?<![\p{L}\p{N}_])palabra(?![\p{L}\p{N}_])`.

### Case

With `iu`, `Á` equals `á` and `Ñ` equals `ñ`. Without `u`, accented case folding is unreliable. With `i` but no `u`, ASCII case folding still works.

### Generated cases

The generator always adds probes: `áéíóú`, `ñ`, `ÁÉ`, `中文`, `123`, `😀` and `a\nb`. With `\p{L}`, letter probes are expected to match; otherwise they are `expect:false` and any match shows up in `summary.falsePositives`.
