# Ejemplos anotados / Annotated examples

## ES

Esta es una tool real del repo (`offline-subs`), anotada. Cópiala como plantilla y cambia el dominio.

```json
{
  "name": "subs_from_script",
  "description": "ES: Convierte un guion con o sin marcas de tiempo en cues SRT/VTT; puede usar la duración real de un vídeo local. No transcribe audio. EN: Convert a script with or without timestamps into SRT/VTT cues; can use the real duration of a local video. It does not transcribe audio.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "script": {
        "type": "string",
        "description": "ES: Texto del guion; admite [00:03] o 00:00-00:04. EN: Script text; supports [00:03] or 00:00-00:04."
      },
      "script_path": {
        "type": "string",
        "description": "ES: Ruta ~/ o /sdcard a un archivo de texto. EN: ~/ or /sdcard path to a text file."
      },
      "video_path": {
        "type": "string",
        "description": "ES: Vídeo local del que leer la duración. EN: Local video to read the duration from."
      },
      "duration": {
        "type": "number",
        "description": "ES: Segundos; tiene prioridad sobre video_path. EN: Seconds; takes priority over video_path."
      },
      "max_chars": {
        "type": "integer",
        "description": "ES: Máximo de caracteres por cue, 12-160 (por defecto 48). EN: Maximum characters per cue, 12-160 (default 48)."
      },
      "language": {
        "type": "string",
        "enum": ["es", "en", "both"],
        "description": "ES: Idioma del resumen (por defecto both; both = ES y EN). EN: Summary language (default both; both = ES and EN)."
      },
      "dry_run": {
        "type": "boolean",
        "description": "ES: true = solo previsualizar (por defecto); false = escribir srt_path/vtt_path. EN: true = preview only (default); false = write srt_path/vtt_path."
      },
      "srt_path": {
        "type": "string",
        "description": "ES: Ruta .srt opcional bajo ~/ o /sdcard. EN: Optional .srt path under ~/ or /sdcard."
      }
    },
    "additionalProperties": false
  }
}
```

### Por qué está bien

| Parte | Regla que cumple |
| --- | --- |
| `ES:` / `EN:` en la descripción | bilingüe en el mismo string |
| `No transcribe audio` | dice cuándo **no** usarla |
| `script` o `script_path` | alternativas documentadas en cada descripción |
| `duration ... prioridad sobre video_path` | prioridad explícita |
| `12-160 (por defecto 48)` | rango + default |
| `enum` cerrado y `both` explicado | sin valores inventados |
| `true = previsualizar (por defecto)` | default seguro de escritura |
| `~/ o /sdcard` en las rutas | cumple el sandbox de archivos |
| `additionalProperties:false` | rechaza basura en vez de ignorarla |
| `integer` / `number` correctos | el modelo sabe si puede mandar decimales |

### Tres llamadas para probar

```json
{"script": "Hoy veremos tres ajustes. Primero, baja el brillo."}
```

```json
{"script_path": "~/guiones/kit.txt", "video_path": "~/videos/kit.mp4", "max_chars": 40,
 "language": "both", "srt_path": "~/subs/kit.srt", "dry_run": false}
```

```json
{"script": "", "duration": -5, "max_chars": 999999, "language": "fr"}
```

La tercera debe fallar con un mensaje útil, no con un `TypeError`.

### Tabla de errores de la respuesta

| Código | Cuándo | Mensaje |
| --- | --- | --- |
| `SCRIPT_EMPTY` | no hay `script` ni `script_path` con contenido | `El guion está vacío / Script is empty` |
| `FILE_MISSING` | la ruta no existe | `No existe ~/guiones/kit.txt / Missing ...` |
| `PATH_REJECTED` | la ruta no empieza por `~/` ni `/sdcard/` | `Usa ~/ o /sdcard/ / Use ~/ or /sdcard/` |
| `DURATION_ESTIMATED` | no se pasó vídeo ni duración | aviso informativo, no error |
| `NO_CUES` | el parser no produjo ningún cue | `No se obtuvieron cues / No cues were produced` |

### Sobre de error del worker

```js
throw {
  isError: true,
  content: [{ type: 'text', text: 'El guion está vacío / Script is empty' }]
};
```

Mejor aún: un helper `fail(es, en, code)` que construya este objeto siempre igual.

## EN

This is a real tool from the repo (`offline-subs`), annotated. Copy it as a template and swap the domain.

### Why it is good

| Part | Rule it satisfies |
| --- | --- |
| `ES:` / `EN:` in the description | bilingual in one string |
| `It does not transcribe audio` | says when **not** to use it |
| `script` or `script_path` | alternatives documented in each description |
| `duration ... takes priority over video_path` | explicit priority |
| `12-160 (default 48)` | range + default |
| closed `enum` with `both` explained | no invented values |
| `true = preview only (default)` | safe write default |
| `~/ or /sdcard` in paths | respects the file sandbox |
| `additionalProperties:false` | rejects junk instead of ignoring it |
| correct `integer` / `number` | the model knows if decimals are allowed |

### Three calls to test

Same three JSON payloads as above: minimal, full and invalid. The invalid one must fail with a useful message, not a `TypeError`.

### Response error table

Same codes as above, with the English message first where you prefer.

### Worker error envelope

```js
throw {
  isError: true,
  content: [{ type: 'text', text: 'Script is empty / El guion está vacío' }]
};
```

Even better: a `fail(es, en, code)` helper that always builds this object the same way.
