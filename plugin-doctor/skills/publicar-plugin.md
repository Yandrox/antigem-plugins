---
name: Publicar un plugin / Publish a plugin
description: ES: Valida, corrige el índice y genera el README antes de publicar un repo de plugins en AntiGem. EN: Validate, fix the index and generate the README before publishing an AntiGem plugin repository.
---

# Publicar un plugin / Publish a plugin

## ES

Usa esta skill antes de publicar o actualizar un repositorio de plugins de AntiGem.

1. Llama a `doctor_validate` con la `root` del repo (ruta absoluta o `~/`). Revisa `summary` y la lista de `issues`.
2. Si hay errores de índice o versiones, llama a `doctor_fix_index` con `dry_run: true` y revisa `changes`. Cuando todo esté bien, repite con `dry_run: false` (se crea una copia `.bak`).
3. Llama a `doctor_generate_readme` con `dry_run: true` y después con `dry_run: false`. Escribe el README raíz en inglés (`README.md`) y una copia en español (`docs/README.es.md`), cada uno con **una sola tabla** de plugins y badges SVG locales en `assets/badges/`. En la vista previa comprueba que `tableCount` y `spanishTableCount` sean `1`. No edites los README a mano para añadir o quitar tablas: corrige el generador.
4. Vuelve a `doctor_validate`: debe terminar con `ok: true` y sin errores.
5. Sube la `version` en cada `manifest.json` y en `antigem-plugins.json` (la misma en ambos sitios), haz commit y push.

Antes de publicar, lee `checklist.md`. Para interpretar los códigos de los hallazgos, lee `reglas-validacion.md`.

## EN

Use this skill before publishing or updating an AntiGem plugin repository.

1. Call `doctor_validate` with the repository `root` (absolute or `~/` path). Review `summary` and the `issues` list.
2. For index or version errors, call `doctor_fix_index` with `dry_run: true` and inspect `changes`. When satisfied, call it again with `dry_run: false` (a `.bak` copy is created).
3. Call `doctor_generate_readme` with `dry_run: true`, then with `dry_run: false`. It writes the English root README (`README.md`) and a Spanish copy (`docs/README.es.md`), each with **one plugin table only** and local SVG badges in `assets/badges/`; in the preview check that `tableCount` and `spanishTableCount` are `1`. Do not hand-edit the READMEs to add or remove tables: fix the generator instead.
4. Run `doctor_validate` again: it should finish with `ok: true` and no errors.
5. Raise `version` in every `manifest.json` and in `antigem-plugins.json` (identical in both places), then commit and push.

Read `checklist.md` before publishing. To interpret finding codes, read `reglas-validacion.md`.
