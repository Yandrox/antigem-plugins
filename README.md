# Plugins comunitarios para AntiGem

Repositorio público con plugins y skills para AntiGem. Todo funciona offline: JavaScript incluido en cada plugin, sin CDNs ni servicios remotos.

## Instalar

En AntiGem: **Ajustes → Custom AntiGem Plugins → Repositories** y añade `Yandrox/antigem-plugins`.

## Plugins

| Plugin | ID | Versión | Descripción |
| --- | --- | --- | --- |
| [Plugin Doctor](./plugin-doctor/) | `plugin-doctor` | 1.1.2 | Valida y repara repositorios de plugins de AntiGem. / Validate and repair AntiGem plugin repositories. |

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
| [Plugin Doctor](./plugin-doctor/) | `plugin-doctor` | 1.1.2 | Valida y repara repositorios de plugins de AntiGem. / Validate and repair AntiGem plugin repositories. |

## Maintenance with Plugin Doctor

- `doctor_validate`: check manifests, skills, index, links and size limits.
- `doctor_fix_index`: rebuild `antigem-plugins.json` from every `manifest.json`.
- `doctor_generate_readme`: generate this bilingual README (Spanish and English).

## Per-plugin limits

- 5000 files maximum.
- 32 MiB per file and 128 MiB per plugin maximum.
- Raise the version in both `manifest.json` and the index when publishing changes.
