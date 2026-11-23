---
name: Subtitulado rápido / Quick subtitling
description: ES: Genera SRT/VTT desde un guion, ajusta los tiempos a la duración real del vídeo y aplica estilos para Shorts, Reels y YouTube, sin API key. EN: Generate SRT/VTT from a script, align timings to real video duration and apply styles for Shorts, Reels and YouTube, with no API key.
---

# Subtitulado rápido / Quick subtitling

## ES

Esta skill sirve cuando ya tienes un vídeo o un guion y quieres subtítulos sin depender de Cartesia ni de ningún servicio remoto.

1. `subs_from_script`: pega el guion en `script` o usa `script_path`. Acepta marcas como `[00:03]`, `00:12-00:16` o texto plano; en texto plano estima los tiempos desde `wpm` (150 por defecto).
   - Si pasas `video_path`, se usa `antigem.mediaInfo` para leer la duración real. `duration` tiene prioridad.
   - Ajusta `max_chars`, `min_cue_ms`, `max_cue_ms`, `gap_ms` y `offset_ms`.
   - Devuelve `cues`, `srt`, `vtt` y estadísticas. Para guardar, da `srt_path`/`vtt_path` y usa `dry_run:false`; por defecto solo previsualiza.
2. `subs_align`: toma el último `generation`, un array `cues` o un `srt` en línea y lo ajusta a `video_path` o `duration`.
   - `mode:"scale"` reparte la diferencia de duración por toda la línea de tiempo; `mode:"shift"` solo aplica `offset_ms`.
   - Corrige solapes y recorta los cues que se pasan del final.
3. `subs_style`: genera CSS y un bloque `STYLE` de WebVTT con presets (`bold`, `neon`, `minimal`, `karaoke`, `banner`) y perfiles para Shorts, Reels, TikTok y YouTube. Sin fuentes remotas.

Los resultados se guardan en almacenamiento local (`subs.lastGeneration`, `subs.lastAlignment`, `subs.lastStyle`) para reutilizarlos.

Lee `formatos.md` para el formato de guion y `estilos.md` para los presets y el área segura.

## EN

Use this skill when you already have a video or script and want captions without Cartesia or any remote service.

1. `subs_from_script`: paste the script into `script` or use `script_path`. It accepts markers such as `[00:03]`, `00:12-00:16` or plain text; with plain text it estimates timings from `wpm` (150 by default).
   - With `video_path`, `antigem.mediaInfo` reads the real duration. `duration` takes priority.
   - Tune `max_chars`, `min_cue_ms`, `max_cue_ms`, `gap_ms` and `offset_ms`.
   - It returns `cues`, `srt`, `vtt` and stats. To save, pass `srt_path`/`vtt_path` and use `dry_run:false`; it previews by default.
2. `subs_align`: takes the latest `generation`, an inline `cues` array or inline `srt`, and fits it to `video_path` or `duration`.
   - `mode:"scale"` spreads the duration difference across the timeline; `mode:"shift"` only applies `offset_ms`.
   - It fixes overlaps and clamps cues past the end.
3. `subs_style`: generates CSS and a WebVTT `STYLE` block with presets (`bold`, `neon`, `minimal`, `karaoke`, `banner`) and profiles for Shorts, Reels, TikTok and YouTube. No remote fonts.

Results are stored locally (`subs.lastGeneration`, `subs.lastAlignment`, `subs.lastStyle`) for reuse.

Read `formatos.md` for the script format and `estilos.md` for presets and safe areas.
