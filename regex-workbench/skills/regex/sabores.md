# Sabores de regex / Regex flavours

## ES

`regex_explain` devuelve `flavors` con cuatro destinos. Son traducciones **automáticas y aproximadas**: úsalas como punto de partida y revisa las notas.

| Destino | Campo | Características |
| --- | --- | --- |
| JavaScript | `flavors.js` | RegExp nativa. Banderas `gimsuydv` válidas; el informe quita `g`/`y` para la versión lógica. |
| PCRE2 | `flavors.pcre` | Grupos con nombre convertidos a `(?P<name>...)`. Acepta `u` cuando hay Unicode o propiedades. |
| POSIX ERE | `flavors.posix.ere` | Sin miradas adelante, sin cuantificadores perezosos, sin propiedades Unicode. |
| POSIX BRE | `flavors.posix.bre` | Además, `() {} + ? |` van escapados. |

### Traducciones automáticas

```text
\d  → [0-9]              \w  → [[:alnum:]_]       \s  → [[:space:]]
\D  → [^0-9]             \W  → [^[:alnum:]_]      \S  → [^[:space:]]
\p{L} → [[:alpha:]]      \P{L} → [^[:alpha:]]
(?<nombre>...) → (...)   (?P<nombre>...) → (...)
a*? → a*                (cuantificadores perezosos no existen en POSIX)
```

### Lo que no se traduce solo

Lee siempre `flavors.posix.ere.notes`. El generador avisa cuando el patrón contiene:

- grupos o aserciones `(?...)`: no existen en POSIX ERE;
- propiedades `\p{...}`: no existen en POSIX;
- cuantificadores perezosos `*?`, `+?`, `??`: no existen en POSIX;
- `\1`: en POSIX es retroceso, no dígito.

### Banderas sugeridas

`flagsSuggested` contiene dos variantes del patrón original:

- `u`: la misma `flags` con `u` añadida si faltaba;
- `iu`: con `i` y `u` garantizadas.

No cambia el patrón, solo las banderas. Si el patrón usa `\\p{...}`, la variante sin `u` sigue siendo inválida: usa `flagsSuggested.u` o `flagsSuggested.iu`.

## EN

`regex_explain` returns `flavors` with four targets. These are **automatic, approximate translations**: treat them as a starting point and read the notes.

| Target | Field | Notes |
| --- | --- | --- |
| JavaScript | `flavors.js` | Native RegExp. Valid `gimsuydv` flags; the report drops `g`/`y` for the logical version. |
| PCRE2 | `flavors.pcre` | Named groups converted to `(?P<name>...)`. Keeps `u` with Unicode/properties. |
| POSIX ERE | `flavors.posix.ere` | No lookarounds, no lazy quantifiers, no Unicode properties. |
| POSIX BRE | `flavors.posix.bre` | Also escapes `() {} + ? |`. |

### Automatic translations

```text
\d  → [0-9]              \w  → [[:alnum:]_]       \s  → [[:space:]]
\D  → [^0-9]             \W  → [^[:alnum:]_]      \S  → [^[:space:]]
\p{L} → [[:alpha:]]      \P{L} → [^[:alpha:]]
(?<name>...) → (...)     (?P<name>...) → (...)
a*? → a*                (lazy quantifiers do not exist in POSIX)
```

### What is not translated automatically

Always read `flavors.posix.ere.notes`. The generator warns when the pattern contains:

- `(?...)` groups or assertions: unsupported in POSIX ERE;
- `\p{...}` properties: unsupported in POSIX;
- lazy quantifiers `*?`, `+?`, `??`: unsupported in POSIX;
- `\1`: a backreference in POSIX, not a digit.

### Suggested flags

`flagsSuggested` holds two variants of your original pattern:

- `u`: the same `flags` with `u` appended if missing;
- `iu`: with both `i` and `u` guaranteed.

Only flags change, never the pattern. If the pattern uses `\p{...}`, the variant without `u` is still invalid: use `flagsSuggested.u` or `flagsSuggested.iu`.
