# Backtracking catastrófico / Catastrophic backtracking

## ES

Un motor regex vuelve atrás (*backtracking*) cuando una coincidencia parcial falla y prueba otra combinación. Con algunos patrones el número de combinaciones crece de forma exponencial y una entrada corta bloquea el hilo: eso es **backtracking catastrófico**.

`regex_explain` y `regex_test` calculan `risk.level` (`low`, `medium`, `high`) con `risk.reasons`. No es un demostrador formal: es una red de seguridad heurística.

### Niveles

| Nivel | Qué hace el plugin |
| --- | --- |
| `low` | Ejecuta las muestras sin límite de longitud, con tope de coincidencias. |
| `medium` | Cada muestra se corta a 200 caracteres y se añade un aviso. |
| `high` | **No ejecuta nada.** Devuelve `summary.skipped` y explica por qué. |

### Señales que detecta

- **Cuantificador anidado** dentro de un grupo cuantificado: `(a+)+`, `(\d*)*`, `(x{2,})+`. Es la causa clásica. Solución: usa un solo cuantificador, o haz las alternativas mutuamente excluyentes.
- **Mirada adelante cuantificada y repetida**: `(?=a+)+`. Solución: elimina el cuantificador exterior o rewrite la aserción.
- **Alternancia con ramas que se solapan** dentro de un cuantificador: `(a|aa)+`. Solución: ordena de más específico a más general, `(aa|a)+`, o usa `a+`.
- **Varios cuantificadores ambiguos seguidos** de la misma clase: `\s+\s+`. Solución: combínalos en uno, `\s+`.
- **Referencia numérica con cuantificador**: `(a)\1+`. Revisa el coste con entradas largas.
- **Repetición acotada muy alta**: `{10000}`. El coste es lineal pero elevado.

### Cómo reescribir un patrón peligroso

```text
Peligroso:  ^(a+)+$          sobre "aaaaaaaaaaaaaaaaaaaaaaaaaX"
Seguro:     ^a+$

Peligroso:  ^(a|aa)+$        sobre "aaaaaaaaaaaaaaaaaaaX"
Seguro:     ^(aa|a)+$   o   ^a+$

Peligroso:  (\w+\s?)*$       sobre una frase larga con espacios
Seguro:     ^[\w\s]*$
```

La clave: **evita que el mismo carácter pueda ser consumido de dos maneras distintas** por cuantificadores anidados o alternativas solapadas.

### Flujo seguro

1. `regex_explain` con el patrón: mira `risk.level` y `risk.reasons`.
2. Si es `high`, reescribe hasta que baje a `medium` o `low`.
3. Solo entonces `regex_test` con muestras reales y largas.
4. Si necesitas rendimientoreal, añade un límite de longitud en la capa que llama al motor, no solo en la regex.

## EN

A regex engine backtracks when a partial match fails and it retries a different combination. With certain patterns the number of combinations grows exponentially and a short input freezes the thread: that is **catastrophic backtracking**.

`regex_explain` and `regex_test` compute `risk.level` (`low`, `medium`, `high`) with `risk.reasons`. It is not a formal proof: it is a heuristic safety net.

### Levels

| Level | What the plugin does |
| --- | --- |
| `low` | Runs samples with no length cap, only a match cap. |
| `medium` | Each sample is capped at 200 characters and a warning is added. |
| `high` | **Executes nothing.** Returns `summary.skipped` with an explanation. |

### Signals detected

- **Nested quantifier** inside a quantified group: `(a+)+`, `(\d*)*`, `(x{2,})+`. The classic cause. Fix: use a single quantifier, or make alternatives mutually exclusive.
- **Quantified, repeated lookahead**: `(?=a+)+`. Fix: drop the outer quantifier or rewrite the assertion.
- **Overlapping alternation** inside a quantifier: `(a|aa)+`. Fix: order from most to least specific, `(aa|a)+`, or just use `a+`.
- **Several ambiguous quantifiers** of the same class in a row: `\s+\s+`. Fix: merge into one, `\s+`.
- **Quantified numeric backreference**: `(a)\1+`. Review the cost on long inputs.
- **Very high bounded repetition**: `{10000}`. Linear but expensive.

### Rewriting a dangerous pattern

```text
Dangerous:  ^(a+)+$          on "aaaaaaaaaaaaaaaaaaaaaaaaaX"
Safe:       ^a+$

Dangerous:  ^(a|aa)+$        on "aaaaaaaaaaaaaaaaaaaX"
Safe:       ^(aa|a)+$   or   ^a+$

Dangerous:  (\w+\s?)*$       on a long sentence with spaces
Safe:       ^[\w\s]*$
```

The rule: **do not let the same character be consumable in two different ways** by nested quantifiers or overlapping alternatives.

### Safe flow

1. `regex_explain` with the pattern: check `risk.level` and `risk.reasons`.
2. If it is `high`, rewrite until it drops to `medium` or `low`.
3. Only then `regex_test` with real, long samples.
4. If performance matters, enforce a length limit in the calling layer, not only in the regex.
