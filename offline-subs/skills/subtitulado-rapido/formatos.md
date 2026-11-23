# Formatos / Formats

## ES

### Guion con marcas

Cada línea puede empezar con una marca de inicio o un rango:

```text
[00:00] ¿Sabías que esto pasa?
00:04-00:08 Primero, abre el ajuste.
(00:09) Segundo, cambia el valor.
```

- `[00:00]`, `(00:00)` y `00:00` son equivalentes.
- `00:04-00:08` fija inicio y fin; también funciona con `-`, `–` o `—`.
- Las líneas sin marca se añaden al cue anterior.
- Si no hay rangos, el fin de cada cue se calcula con `wpm` y se recorta antes del siguiente inicio.

### Guion plano

Sin marcas, el plugin separa por frases (` . ! ? … `), divide las frases largas en líneas de `max_chars` y estima la duración con `wpm`. Si conoces la duración, el timeline se escala para terminar en ella.

### SRT y VTT

- SRT: `HH:MM:SS,mmm --> HH:MM:SS,mmm`, con coma decimal.
- VTT: `HH:MM:SS.mmm --> HH:MM:SS.mmm`, con punto decimal y cabecera `WEBVTT`.
- `subs_align` acepta SRT en `srt`, cues en `cues`, o un `generation` guardado.

### Avisos

- `CUES_SHIFTED`: se movieron cues para evitar solapes.
- `CUES_CLAMPED`: se recortaron por `max_cue_ms` o por el final del vídeo.
- `DURATION_ESTIMATED`: no se pasó vídeo ni duración.
- `TIMELINE_SHORT`: los subtítulos acaban antes del 90 % del vídeo.
- `NO_TARGET_DURATION`, `LARGE_DRIFT`: avisos de alineación.

## EN

### Script with markers

Each line may start with a start marker or a range:

```text
[00:00] Did you know this happens?
00:04-00:08 First, open the setting.
(00:09) Second, change the value.
```

- `[00:00]`, `(00:00)` and `00:00` are equivalent.
- `00:04-00:08` fixes start and end; `-`, `–` and `—` all work.
- Lines without a marker are appended to the previous cue.
- Without ranges, each cue ends based on `wpm` and is trimmed before the next start.

### Plain script

With no markers, the plugin splits on sentences (`. ! ? …`), wraps long sentences into `max_chars` lines and estimates duration from `wpm`. If you provide a duration, the timeline is scaled to end there.

### SRT and VTT

- SRT: `HH:MM:SS,mmm --> HH:MM:SS,mmm`, decimal comma.
- VTT: `HH:MM:SS.mmm --> HH:MM:SS.mmm`, decimal point and a `WEBVTT` header.
- `subs_align` accepts SRT in `srt`, cues in `cues`, or a stored `generation`.

### Warnings

- `CUES_SHIFTED`: cues were moved to avoid overlaps.
- `CUES_CLAMPED`: cues were trimmed by `max_cue_ms` or the video end.
- `DURATION_ESTIMATED`: no video or duration was provided.
- `TIMELINE_SHORT`: subtitles end before 90% of the video.
- `NO_TARGET_DURATION`, `LARGE_DRIFT`: alignment warnings.
