# Variantes / Variants

## ES

`viral_variants` extrae palabras clave del `topic` y del guion, descarta vacíos (`de`, `la`, `the`, `and`, ...) y ordena por frecuencia y longitud. Con ese tema rellena plantillas como:

- `${topic}: lo que nadie te cuenta`
- `Los 3 secretos de ${topic}`
- `No hagas esto con ${topic}`
- `${topic} en ${seconds} segundos`
- `¿Sabías que ${topic} tiene un truco?`

Con `language: "both"` alterna plantillas en español e inglés y mezcla hashtags de ambos idiomas. Con `es` o `en` usa solo ese conjunto. `count` controla el número de títulos (3-20) y `hashtag_count` el de hashtags (1-20).

Los hashtags combinan tres fuentes: etiqueta de plataforma (`#YouTubeShorts`, `#InstagramReels`, `#TikTokMadeMeTryIt`), palabras clave del tema y etiquetas genéricas (`#Viral`, `#FYP`, `#Consejos`, `#Tips`). Se eliminan duplicados y acentos antes de devolverlos.

Ejemplo:

```json
{
  "script": "Hola, hoy te explico cómo ahorrar batería en Android...",
  "topic": "ahorrar batería",
  "platform": "shorts",
  "count": 6,
  "hashtag_count": 5,
  "language": "both"
}
```

## EN

`viral_variants` extracts keywords from `topic` and the script, drops stopwords (`de`, `la`, `the`, `and`, ...) and sorts by frequency and length. It fills templates such as:

- `${topic}: what nobody tells you`
- `The 3 secrets of ${topic}`
- `Stop doing this with ${topic}`
- `${topic} in ${seconds} seconds`
- `Did you know ${topic} has a trick?`

With `language: "both"` it interleaves Spanish and English templates and mixes hashtags from both languages. With `es` or `en` it uses only that set. `count` controls the number of titles (3-20) and `hashtag_count` the number of hashtags (1-20).

Hashtags combine three sources: a platform tag (`#YouTubeShorts`, `#InstagramReels`, `#TikTokMadeMeTryIt`), topic keywords and generic tags (`#Viral`, `#FYP`, `#Tips`, `#Education`). Duplicates and accents are removed before returning them.

Example:

```json
{
  "script": "Today I'll show you how to save battery on Android...",
  "topic": "save battery",
  "platform": "shorts",
  "count": 6,
  "hashtag_count": 5,
  "language": "both"
}
```
