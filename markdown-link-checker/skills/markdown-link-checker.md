---
name: Comprobador de enlaces Markdown / Markdown link checker
description: ES: Recorre los .md de un directorio y detecta enlaces relativos rotos, imágenes inexistentes, anclas desactualizadas y rutas con mayúsculas incorrectas, con informe por archivo y línea. Complementa a skill-linter y plugin-doctor. Híbrido, offline y sin red. EN: Walks the .md files in a directory and detects broken relative links, missing images, stale anchors and wrong-case paths, with a file-and-line report. Complements skill-linter and plugin-doctor. Hybrid, offline and no network.
---

# Comprobador de enlaces Markdown / Markdown link checker

## ES

Los README, índices y documentación de skills acumulan enlaces relativos y anclas que se rompen al mover o renombrar archivos. Esta skill recorre los `.md` de una carpeta, resuelve cada destino y avisa de **rutas inexistentes, mayúsculas incorrectas y anclas que ya no existen**, indicando siempre archivo y línea. Todo se lee con `chrome.antigem`; **no se comprueban URL externas ni se usa la red**.

No sustituye a `plugin-doctor` (estructura del repo de plugins) ni a `skill-linter` (contenido de skills): complementa a ambos revisando la documentación en general, incluidos README e índices.

**Arquitectura:** el worker hace el trabajo determinista: ignora frontmatter, comentarios HTML y bloques de código, extrae enlaces inline y de referencia, normaliza rutas y calcula slugs de encabezados como GitHub. El agente elige la tool y decide qué corregir; el plugin **no edita** tus Markdown.

### Cuándo usarla

- Después de renombrar o mover un `.md`, para encontrar referencias huérfanas.
- Antes de publicar docs, para verificar índices y tablas de contenido.
- Al revisar una skill con archivos de detalle, para comprobar `get_skill_file` refers.
- Para listar las anclas reales de un documento y arreglar un `#cabecera` roto.
- Para detectar enlaces que funcionan solo en sistemas sensibles a mayúsculas.

### Flujo de trabajo

1. **Revisar.** `mdlink_check({directory:"~/proyecto"})` o `mdlink_check({files:[...]})`. Devuelve `summary` y `findings` con `severity`, `kind`, `file`, `line`, `target` y `detail`.
2. **Entender un error.** Si es `broken_anchor`, usa `mdlink_anchors({path:"~/proyecto/docs-guia.md"})` para ver los slugs reales (`#instalación`, `#uso-basico`). El slug se deriva del encabezado, no del texto literal del enlace; la comparación ignora mayúsculas y acentos.
3. **Ajustar la sensibilidad.** Por defecto se avisa de diferencias de mayúsculas (`case_mismatch`) con la ruta correcta en `suggestion`. Si tu sistema es case-insensitive y no te interesa, pass `case_sensitive:false`.
4. **Reducir ruido.** `ignore:["/node_modules/", "/build/"]` excluye fragmentos de ruta. `recursive:false` limita la revisión a la carpeta raíz.
5. **Informar.** `mdlink_report({directory, output:"~/proyecto/enlaces.md"})` con `dry_run:true`; revisa y repite con `dry_run:false` para escribir. El informe es bilingüe y tiene una tabla por idioma.
6. **Corregir a mano.** Aplica los cambios en tus archivos y vuelve a ejecutar `mdlink_check` hasta que `summary.error` sea 0.

### Reglas

- Se comprueban rutas relativas, rutas que empiezan por `/` (resueltas desde la carpeta raíz del escaneo) y anclas `#...`. Se omiten `http(s)`, `mailto:`, `tel:`, `data:` y protocol-relative `//`.
- Se reconocen los formatos estándar: enlace inline, imagen, definición de referencia, usos abreviados y destinos entre corchetes angulares. La sintaxis exacta está en `enlaces.md`.
- El código inline, los bloques fenced y los comentarios HTML **no** se analizan: los enlaces ahí se ignoran a propósito.
- Un enlace a una carpeta es válido si la carpeta existe; se añade una nota informativa si no tiene `README.md`.
- Los encabezados duplicados siguen la convención de GitHub: el segundo `## Uso` genera `#uso-1`.
- No hay auto-fix: el plugin solo avisa. Nunca reescribe tus documentos.
- El límite es 200 archivos `.md` y 200 hallazgos; el resumen indica `truncated` si se alcanza.

Lee `enlaces.md` para el algoritmo de anclas, la tabla de severidades, ejemplos y límites exactos.

## EN

READMEs, indexes and skill docs accumulate relative links and anchors that break when files move or are renamed. This skill walks the `.md` files in a folder, resolves every target and reports **missing paths, wrong casing and stale anchors**, always with file and line. Everything is read with `chrome.antigem`; **external URLs are not checked and no network is used**.

It does not replace `plugin-doctor` (plugin repo structure) or `skill-linter` (skill content): it complements both by checking general documentation, including READMEs and indexes.

**Architecture:** the worker does the deterministic work: it skips frontmatter, HTML comments and code blocks, extracts inline and reference links, normalises paths and computes GitHub-style heading slugs. The agent picks the tool and decides what to fix; the plugin **never edits** your Markdown.

### When to use it

- After renaming or moving a `.md`, to find orphan references.
- Before publishing docs, to verify indexes and tables of contents.
- When reviewing a skill with detail files, to check `get_skill_file` references.
- To list the real anchors of a document and repair a broken `#heading`.
- To detect links that only work on case-insensitive filesystems.

### Workflow

1. **Check.** `mdlink_check({directory:"~/project"})` or `mdlink_check({files:[...]})`. Returns `summary` and `findings` with `severity`, `kind`, `file`, `line`, `target` and `detail`.
2. **Understand an error.** For `broken_anchor`, call `mdlink_anchors({path:"~/project/docs-guide.md"})` to see real slugs (`#installation`, `#basic-usage`). The slug comes from the heading, not from the literal link text; comparison ignores case and accents.
3. **Adjust sensitivity.** By default it warns about casing (`case_mismatch`) with the correct path in `suggestion`. On a case-insensitive filesystem, pass `case_sensitive:false`.
4. **Reduce noise.** `ignore:["/node_modules/", "/build/"]` excludes path fragments. `recursive:false` limits the check to the top folder.
5. **Report.** `mdlink_report({directory, output:"~/project/links.md"})` with `dry_run:true`; review and repeat with `dry_run:false` to write it. The report is bilingual with one table per language.
6. **Fix manually.** Apply changes in your files and re-run `mdlink_check` until `summary.error` is 0.

### Rules

- Relative paths, paths starting with `/` (resolved from the scan root) and `#...` anchors are checked. `http(s)`, `mailto:`, `tel:`, `data:` and protocol-relative `//` are skipped.
- It recognises standard Markdown forms: inline links, images, reference definitions, shorthand uses and angle-bracket targets. Exact syntax is in `enlaces.md`.
- Inline code, fenced blocks and HTML comments are **not** analysed: links there are intentionally ignored.
- A link to a folder is valid when the folder exists; an info note is added if it has no `README.md`.
- Duplicate headings follow GitHub's convention: the second `## Usage` produces `#usage-1`.
- There is no auto-fix: the plugin only warns and never rewrites your documents.
- Limit: 200 `.md` files and 200 findings; the summary shows `truncated` when reached.

Read `enlaces.md` for the anchor algorithm, severity table, examples and exact limits.
