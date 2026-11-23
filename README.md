# Plugins comunitarios para AntiGem

Repositorio público con plugins y skills para AntiGem. Todo funciona offline: JavaScript incluido en cada plugin, sin CDNs ni servicios remotos.

## Instalar

En AntiGem: **Ajustes → Custom AntiGem Plugins → Repositories** y añade `Yandrox/antigem-plugins`.

## Plugins

| Plugin | ID | Versión | Descripción |
| --- | --- | --- | --- |
| [A11y Audit](./a11y-audit/) | `a11y-audit` | 1.0.2 | Audita accesibilidad de mini apps y WebViews: contraste, zonas táctiles, ARIA, alt, foco y nombres; genera informe y correcciones. / Audit mini apps and WebViews for accessibility: contrast, tap targets, ARIA, alt, focus and names; generate report and fixes. |
| [Config Backup & Diff](./config-backup-diff/) | `config-backup-diff` | 1.0.2 | Exporta y compara configuraciones locales (skills, MCP, temas y notas exportadas), muestra diferencias y restaura archivos de forma selectiva, sin red. / Export and compare local config (skills, MCP, themes and exported notes), show diffs and restore files selectively, offline. |
| [Local Assets Lab](./local-assets-lab/) | `local-assets-lab` | 1.1.0 | Genera fondos, iconos, stickers y paletas SVG sin conexión. / Generate SVG backgrounds, icons, stickers and palettes offline. |
| [MiniApp Test Runner](./miniapp-test-runner/) | `miniapp-test-runner` | 1.1.4 | Graba, repite, compara e informa pruebas de mini apps sin servicios externos. / Record, replay, compare and report mini app tests without external services. |
| [Offline Subs](./offline-subs/) | `offline-subs` | 1.0.1 | Genera SRT/VTT desde guiones, alinea subtítulos con la duración real del vídeo y crea estilos listos para Shorts, Reels y YouTube, sin red. / Generate SRT/VTT from scripts, align subtitles to real video duration and create ready styles for Shorts, Reels and YouTube, offline. |
| [Plugin Doctor](./plugin-doctor/) | `plugin-doctor` | 1.1.2 | Valida y repara repositorios de plugins de AntiGem. / Validate and repair AntiGem plugin repositories. |
| [Storage Cleaner](./storage-cleaner/) | `storage-cleaner` | 1.1.1 | Escanea duplicados, archivos grandes y restos de proyectos; genera un plan y un informe sin borrar nada. / Scan duplicates, large files and project leftovers; generate a plan and report without deleting anything. |
| [Viral Script Lab](./viral-script-lab/) | `viral-script-lab` | 1.0.2 | Analiza guiones cortos (gancho, cortes, ritmo, 3 actos y CTA) y genera títulos y hashtags sin servicios externos. / Analyse short-form scripts (hook, cuts, pace, 3 acts and CTA) and generate titles and hashtags offline. |

## Mantenimiento con Plugin Doctor

- `doctor_validate`: revisa manifiestos, skills, índice, enlaces y límites de tamaño.
- `doctor_fix_index`: regenera `antigem-plugins.json` desde los `manifest.json`.
- `doctor_generate_readme`: genera este README en español e inglés.

## Límites por plugin

- Máximo 5000 archivos.
- Máximo 32 MiB por archivo y 128 MiB por plugin.
- Sube la versión en el `manifest.json` y en el índice al publicar cambios.

---

# AntiGem community plugins

Public repository with plugins and skills for AntiGem. Everything works offline: JavaScript is bundled in each plugin, with no CDNs or remote services.

## Install

In AntiGem: **Settings → Custom AntiGem Plugins → Repositories** and add `Yandrox/antigem-plugins`.

## Plugins

| Plugin | ID | Version | Description |
| --- | --- | --- | --- |
| [A11y Audit](./a11y-audit/) | `a11y-audit` | 1.0.2 | Audita accesibilidad de mini apps y WebViews: contraste, zonas táctiles, ARIA, alt, foco y nombres; genera informe y correcciones. / Audit mini apps and WebViews for accessibility: contrast, tap targets, ARIA, alt, focus and names; generate report and fixes. |
| [Config Backup & Diff](./config-backup-diff/) | `config-backup-diff` | 1.0.2 | Exporta y compara configuraciones locales (skills, MCP, temas y notas exportadas), muestra diferencias y restaura archivos de forma selectiva, sin red. / Export and compare local config (skills, MCP, themes and exported notes), show diffs and restore files selectively, offline. |
| [Local Assets Lab](./local-assets-lab/) | `local-assets-lab` | 1.1.0 | Genera fondos, iconos, stickers y paletas SVG sin conexión. / Generate SVG backgrounds, icons, stickers and palettes offline. |
| [MiniApp Test Runner](./miniapp-test-runner/) | `miniapp-test-runner` | 1.1.4 | Graba, repite, compara e informa pruebas de mini apps sin servicios externos. / Record, replay, compare and report mini app tests without external services. |
| [Offline Subs](./offline-subs/) | `offline-subs` | 1.0.1 | Genera SRT/VTT desde guiones, alinea subtítulos con la duración real del vídeo y crea estilos listos para Shorts, Reels y YouTube, sin red. / Generate SRT/VTT from scripts, align subtitles to real video duration and create ready styles for Shorts, Reels and YouTube, offline. |
| [Plugin Doctor](./plugin-doctor/) | `plugin-doctor` | 1.1.2 | Valida y repara repositorios de plugins de AntiGem. / Validate and repair AntiGem plugin repositories. |
| [Storage Cleaner](./storage-cleaner/) | `storage-cleaner` | 1.1.1 | Escanea duplicados, archivos grandes y restos de proyectos; genera un plan y un informe sin borrar nada. / Scan duplicates, large files and project leftovers; generate a plan and report without deleting anything. |
| [Viral Script Lab](./viral-script-lab/) | `viral-script-lab` | 1.0.2 | Analiza guiones cortos (gancho, cortes, ritmo, 3 actos y CTA) y genera títulos y hashtags sin servicios externos. / Analyse short-form scripts (hook, cuts, pace, 3 acts and CTA) and generate titles and hashtags offline. |

## Maintenance with Plugin Doctor

- `doctor_validate`: check manifests, skills, index, links and size limits.
- `doctor_fix_index`: rebuild `antigem-plugins.json` from every `manifest.json`.
- `doctor_generate_readme`: generate this bilingual README (Spanish and English).

## Per-plugin limits

- 5000 files maximum.
- 32 MiB per file and 128 MiB per plugin maximum.
- Raise the version in both `manifest.json` and the index when publishing changes.
