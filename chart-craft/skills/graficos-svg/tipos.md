# Tipos de gráfico / Chart types

## ES

| Tipo | Datos | Cuándo usarlo |
| --- | --- | --- |
| `bar` | `{label,value}` | comparar categorías discretas; hasta ~12 etiquetas legibles |
| `line` | `{label,value,series?}` | tendencias temporales; una línea por `series` |
| `area` | igual que `line` | tendencias donde también importa el volumen acumulado |
| `donut` | `{label,value}` | proporciones de un total; máximo ~6 porciones |
| `scatter` | `{x,y,label?}` | correlación entre dos variables |
| `sparkline` | números o `{value}` | mini-tendencia dentro de una tarjeta, sin ejes |

### Forma de los datos

```json
[
  {"label":"Lun","value":12,"series":"Ventas"},
  {"label":"Lun","value":7,"series":"Costes"},
  {"label":"Mar","value":18,"series":"Ventas"},
  {"label":"Mar","value":9,"series":"Costes"}
]
```

- Un mismo `label` + `series` se suma. Puedes mandar varias filas por día sin preagrupar.
- Si falta `series`, todo cae en una serie única y no aparece la leyenda.
- Si falta `label`, se usa el índice (1, 2, 3...).
- En `scatter`, `x` y `y` son numéricos; `label` solo aparece en el tooltip.
- En `donut`, los valores negativos se tratan como 0.

### Escalas y ejes

El eje Y parte de 0 cuando todos los valores son positivos; si hay negativos, usa el mínimo real. La rejilla tiene 4 divisiones y sus etiquetas usan `value_format`. Si `max === min`, el worker ensancha el dominio para evitar una división por cero.

`value_format` acepta `number`, `percent` (el valor se muestra tal cual + `%`, así que 0.25 → `25%` solo si mandas 25), `currency` (`$`) y `compact` (`1.2k`, `3.4M`). El sufijo `unit` se añade al final de todos los valores y ejes.

### Errores frecuentes

- Mandar porcentajes como `0.25` con `value_format:"percent"`: sale `0.3%`. Manda `25`.
- Usar `donut` con 15 porciones: el anillo se vuelve ilegible. Agrupa las pequeñas en "Otros".
- Pedir `line` con una sola serie y esperar leyenda: la leyenda solo aparece con dos o más.
- Olvidar `show_labels:false` en un gráfico con 40 categorías: las etiquetas se solapan. El worker ya muestra como máximo 12.

## EN

| Type | Data | When to use it |
| --- | --- | --- |
| `bar` | `{label,value}` | comparing discrete categories; up to ~12 readable labels |
| `line` | `{label,value,series?}` | time trends; one line per `series` |
| `area` | same as `line` | trends where accumulated volume also matters |
| `donut` | `{label,value}` | proportions of a whole; at most ~6 slices |
| `scatter` | `{x,y,label?}` | correlation between two variables |
| `sparkline` | numbers or `{value}` | tiny trend inside a card, no axes |

### Data shape

Same JSON as above.

- The same `label` + `series` is summed. You can send several rows per day without pre-aggregating.
- Without `series`, everything falls into one series and no legend appears.
- Without `label`, the index is used (1, 2, 3...).
- For `scatter`, `x` and `y` are numeric; `label` only appears in the tooltip.
- For `donut`, negative values are treated as 0.

### Scales and axes

The Y axis starts at 0 when all values are positive; with negatives it uses the real minimum. The grid has 4 divisions and its labels use `value_format`. If `max === min`, the worker widens the domain to avoid division by zero.

`value_format` accepts `number`, `percent` (the value is shown as-is plus `%`, so send 25 for 25%), `currency` (`$`) and `compact` (`1.2k`, `3.4M`). The `unit` suffix is appended to every value and axis label.

### Common mistakes

- Sending `0.25` with `value_format:"percent"`: you get `0.3%`. Send `25`.
- Using `donut` with 15 slices: unreadable. Group small ones into "Other".
- Expecting a legend from a single-series `line`: legends only appear with two or more series.
- Forgetting `show_labels:false` with 40 categories: labels overlap. The worker already caps at 12.
