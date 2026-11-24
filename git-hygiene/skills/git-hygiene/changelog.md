# Generar CHANGELOG.md / Generating CHANGELOG.md

## ES

Genera el changelog **solo con datos locales**: `git log` y los archivos del repo. No consultes GitHub ni ninguna API. El resultado es texto para que el usuario lo revise y lo escriba; **esta skill no modifica archivos**.

### 1. Obtén los commits

```bash
# Desde el último tag hasta HEAD
ULTIMO=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
git log --no-merges --pretty=format:'%h|%s|%b' "$ULTIMO..HEAD"

# Si no hay tags, últimos N commits
git log --no-merges -n 30 --pretty=format:'%h|%s|%b'
```

Cada línea tiene `hash|cabecera|cuerpo`. Los pies `BREAKING CHANGE:` y `Refs:` van en el cuerpo.

### 2. Agrupa por tipo

Clasifica cada cabecera con el mismo vocabulario de la skill principal:

|Tipo|Sección ES|Sección EN|
|---|---|---|
|`feat`|Añadido|Added|
|`fix`|Corregido|Fixed|
|`perf`|Rendimiento|Performance|
|`refactor`|Refactor|Refactored|
|`docs`|Documentación|Documentation|
|`test`|Pruebas|Tests|
|`build`, `ci`|Construcción y CI|Build and CI|
|`chore`, `style`|Mantenimiento|Maintenance|
|`revert`|Revertido|Reverted|

Omite los commits que no aporten al changelog (por ejemplo `chore: bump version` duplicado) y los `merge` (ya los excluye `--no-merges`).

### 3. Escribe el formato

Usa Keep a Changelog + SemVer. Encabezados bilingües cuando el repo lo sea:

```markdown
# Changelog / Registro de cambios

Todos los cambios notables se documentan en este archivo.
All notable changes to this project are documented in this file.

El formato sigue Keep a Changelog y el proyecto adhiere a Semantic Versioning.
The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

## [1.1.0] - 2026-11-24

### Añadido / Added
- `secret-scanner`: tool `secrets_scan` con hallazgos `ruta:línea`, confianza y redacción (`abc123`).

### Corregido / Fixed
- `license-audit`: orden correcto de los modos de informe (`abc124`).

### Cambios rompientes / Breaking changes
- `mcp-schema-designer`: el campo `root` ahora es obligatorio (`abc125`).
```

Reglas de redacción:

- Una línea por commit, en imperativo, con el hash corto entre paréntesis.
- Si el repo es bilingüe, escribe `ES / EN` en cada línea o agrupa por sección bilingüe; sé consistente.
- **Nunca pegues secretos**: si un diff menciona una clave real, sustitúyela por `[REDACTED]`.
- Los cambios rompientes van en su propia sección, aunque el tipo sea `feat` o `fix`.
- La fecha es la del tag o la del día si aún no hay tag; usa ISO `YYYY-MM-DD`.
- El orden dentro de cada sección es el mismo que `git log` (más reciente primero) o el que el usuario prefiera; indícalo.

### 4. Vincula versiones (opcional)

Si el repo tiene remote, puedes añadir enlaces de comparación **sin abrir la red**, construyendo la URL a partir de `git remote get-url origin`:

```markdown
[1.1.0]: https://github.com/Yandrox/antigem-plugins/compare/1.0.2...1.1.0
[1.0.2]: https://github.com/Yandrox/antigem-plugins/releases/tag/1.0.2
```

Si no hay remote o el usuario no quiere enlaces, omítelos.

### 5. Verificación antes de entregar

- [ ] La versión del encabezado coincide con `manifest.json` y con `antigem-plugins.json`.
- [ ] No aparece ningún secreto ni dato local-only del repo.
- [ ] Todos los commits del rango están representados o hay una razón explícita para omitirlos.
- [ ] Los cambios rompientes tienen su propia sección.
- [ ] El texto es bilingüe si el repo lo es.
- [ ] No se ha escrito ningún archivo: el usuario decide si aplica el changelog.

Entrega el Markdown como propuesta. **No ejecutes `git tag` ni escribas `CHANGELOG.md` sin que el usuario lo pida.**

## EN

Generate the changelog **from local data only**: `git log` and repo files. Do not query GitHub or any API. The output is text for the user to review and write; **this skill does not modify files**.

### 1. Get the commits

```bash
# From the last tag to HEAD
LAST=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
git log --no-merges --pretty=format:'%h|%s|%b' "$LAST..HEAD"

# If there are no tags, the last N commits
git log --no-merges -n 30 --pretty=format:'%h|%s|%b'
```

Each line is `hash|subject|body`. `BREAKING CHANGE:` and `Refs:` footers are in the body.

### 2. Group by type

Classify each subject with the same vocabulary as the main skill:

|Type|Section|
|---|---|
|`feat`|Added|
|`fix`|Fixed|
|`perf`|Performance|
|`refactor`|Refactored|
|`docs`|Documentation|
|`test`|Tests|
|`build`, `ci`|Build and CI|
|`chore`, `style`|Maintenance|
|`revert`|Reverted|

Skip commits that add nothing to the changelog (for example a duplicate `chore: bump version`) and merges (already excluded by `--no-merges`).

### 3. Write the format

Use Keep a Changelog + SemVer. Bilingual headers when the repo is bilingual:

```markdown
# Changelog / Registro de cambios

All notable changes to this project are documented in this file.
Todos los cambios notables se documentan en este archivo.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.
El formato sigue Keep a Changelog y el proyecto adhiere a Semantic Versioning.

## [1.1.0] - 2026-11-24

### Added / Añadido
- `secret-scanner`: `secrets_scan` tool with `file:line` findings, confidence and redaction (`abc123`).

### Fixed / Corregido
- `license-audit`: correct report mode ordering (`abc124`).

### Breaking changes / Cambios rompientes
- `mcp-schema-designer`: `root` is now required (`abc125`).
```

Writing rules:

- One line per commit, imperative mood, short hash in parentheses.
- In a bilingual repo, write `ES / EN` on each line or use bilingual sections; be consistent.
- **Never paste secrets**: if a diff mentions a real key, replace it with `[REDACTED]`.
- Breaking changes get their own section even when the type is `feat` or `fix`.
- Use the tag date, or today's date if there is no tag yet, in ISO `YYYY-MM-DD`.
- Order inside each section follows `git log` (newest first) or the user's preference; state which one you used.

### 4. Link versions (optional)

If the repo has a remote, you can add comparison links **without opening the network**, building the URL from `git remote get-url origin`:

```markdown
[1.1.0]: https://github.com/Yandrox/antigem-plugins/compare/1.0.2...1.1.0
[1.0.2]: https://github.com/Yandrox/antigem-plugins/releases/tag/1.0.2
```

Skip them if there is no remote or the user does not want links.

### 5. Verify before delivering

- [ ] The header version matches `manifest.json` and `antigem-plugins.json`.
- [ ] No secret or repo local-only data appears.
- [ ] Every commit in the range is represented or there is an explicit reason to omit it.
- [ ] Breaking changes have their own section.
- [ ] Text is bilingual if the repo is bilingual.
- [ ] No file was written: the user decides whether to apply the changelog.

Deliver the Markdown as a proposal. **Do not run `git tag` or write `CHANGELOG.md` unless the user asks.**
