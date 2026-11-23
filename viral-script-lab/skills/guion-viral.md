---
name: Guion viral / Viral script
description: ES: Audita guiones de Shorts, Reels y TikTok (gancho, cortes, ritmo, 3 actos y CTA) y genera títulos y hashtags. EN: Audit Shorts, Reels and TikTok scripts (hook, cuts, pace, 3 acts and CTA) and generate titles and hashtags.
---

# Guion viral / Viral script

## ES

Usa esta skill para revisar un guion de formato corto antes de grabar, o para crear variantes de título y hashtags. Todo funciona offline, con reglas incluidas en el plugin.

1. `viral_analyze`: pega el guion en `script`. Elige `platform` (`shorts`, `reels`, `tiktok` o `all`). Si sabes la duración real, pasa `duration_seconds`; si no, se estima desde las palabras y `wpm` (por defecto 150).
2. Revisa `score`, `grade`, `issues` y el gancho extraído. Un buen guion suele tener gancho en los primeros 3 segundos, 18-40 cortes por minuto y un CTA final.
3. `viral_variants`: genera títulos, ganchos alternativos y hashtags. Puedes pasar `topic` para forzar el tema; si no, se extrae del guion.
4. `viral_report`: combina ambas cosas en Markdown. Previsualiza por defecto; usa `output` + `dry_run:false` para guardar el `.md`.

Los análisis y variantes se guardan en almacenamiento local (`lastAnalysis`, `lastVariants`) para que `viral_report` los reutilice.

Lee `metricas.md` para los umbrales y `variantes.md` para las plantillas de títulos y hashtags.

## EN

Use this skill to review a short-form script before recording, or to create title and hashtag variants. Everything runs offline with rules bundled in the plugin.

1. `viral_analyze`: paste the script into `script`. Choose `platform` (`shorts`, `reels`, `tiktok` or `all`). Pass `duration_seconds` if known; otherwise it is estimated from words and `wpm` (default 150).
2. Review `score`, `grade`, `issues` and the extracted hook. A strong script usually has a hook in the first 3 seconds, 18-40 cuts per minute and a final CTA.
3. `viral_variants`: generate titles, alternative hooks and hashtags. Pass `topic` to force the subject; otherwise it is extracted from the script.
4. `viral_report`: combine both into Markdown. It previews by default; use `output` + `dry_run:false` to save the `.md`.

Analyses and variants are stored locally (`lastAnalysis`, `lastVariants`) so `viral_report` can reuse them.

Read `metricas.md` for thresholds and `variantes.md` for title and hashtag templates.
