# Métricas y umbrales / Metrics and thresholds

## ES

| Métrica | Cálculo | Objetivo |
| --- | --- | --- |
| Gancho | Primera frase o ventana de `hook_seconds` (3 s por defecto). Suma preguntas, números, palabras de fuerza, trato directo, negación y concisión. | 60+ / 100 |
| Cortes | Marcadores `[CUT]`, saltos de línea y cambios de frase; se convierte a cortes por minuto. | Shorts 18-40, Reels 16-36, TikTok 22-48 |
| Ritmo | Palabras reales entre duración; si no hay duración, se estima con `wpm`. | Shorts/Reels 140-180, TikTok 150-190 |
| 3 actos | Planteamiento en el primer tercio, conflicto en el segundo, resolución o CTA en el tercero. | 70+ / 100 |
| CTA | `follow`, `subscribe`, `comment`, `save`, `share` o `link en bio` en el último 25 % del guion. | Presente al final |

La puntuación final es `gancho×0.30 + cortes×0.20 + ritmo×0.20 + actos×0.20 + CTA×0.10`.

Códigos habituales: `HOOK_WEAK`, `HOOK_GENERIC`, `HOOK_TOO_LONG`, `PACE_SLOW`, `PACE_FAST`, `CUTS_LOW`, `CUTS_HIGH`, `ACTS_WEAK`, `CTA_MISSING`, `CTA_NOT_FINAL`, `LENGTH_LONG`. Cada hallazgo trae una sugerencia en español y en inglés.

## EN

| Metric | Calculation | Target |
| --- | --- | --- |
| Hook | First sentence or `hook_seconds` window (3 s by default). Rewards questions, numbers, power words, direct address, negation and concision. | 60+ / 100 |
| Cuts | `[CUT]` markers, line breaks and sentence changes, converted to cuts per minute. | Shorts 18-40, Reels 16-36, TikTok 22-48 |
| Pace | Actual words over duration; estimated from `wpm` when no duration is given. | Shorts/Reels 140-180, TikTok 150-190 |
| 3 acts | Setup in the first third, conflict in the second, payoff or CTA in the third. | 70+ / 100 |
| CTA | `follow`, `subscribe`, `comment`, `save`, `share` or `link in bio` in the last 25% of the script. | Present at the end |

Final score is `hook×0.30 + cuts×0.20 + pace×0.20 + acts×0.20 + CTA×0.10`.

Common codes: `HOOK_WEAK`, `HOOK_GENERIC`, `HOOK_TOO_LONG`, `PACE_SLOW`, `PACE_FAST`, `CUTS_LOW`, `CUTS_HIGH`, `ACTS_WEAK`, `CTA_MISSING`, `CTA_NOT_FINAL`, `LENGTH_LONG`. Every finding includes a suggestion in Spanish and English.
