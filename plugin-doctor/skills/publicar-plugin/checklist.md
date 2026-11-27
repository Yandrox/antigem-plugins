# Checklist de release / Release checklist

## ES — antes de publicar

- [ ] Ejecutar `doctor_validate` con `root` del repo y confirmar `summary.errors === 0`.
- [ ] Revisar los avisos (`warning`): ids o versiones ausentes, skills sin frontmatter, iconos no declarados, enlaces rotos.
- [ ] Si el índice está desincronizado, ejecutar `doctor_fix_index` primero en preview y después escribiéndolo.
- [ ] Comprobar que `id` y `version` del índice coinciden con los de cada `manifest.json`.
- [ ] Generar los README con `doctor_generate_readme`: raíz en inglés y copia ES en `docs/README.es.md` (ambos con una sola tabla).
- [ ] Subir la versión en **todos** los `manifest.json` y en `antigem-plugins.json`.
- [ ] Empaquetar, instalar y probar cada plugin con el MCP de desarrollo antes de copiarlo al repo.
- [ ] Copiar el contenido de `src/.` en la carpeta del plugin (no la carpeta `src` dentro).
- [ ] Verificar límites: 5000 archivos, 32 MiB por archivo, 128 MiB total por plugin, sin symlinks.
- [ ] El repo debe ser público y `antigem-plugins.json` debe estar en la raíz.
- [ ] `git add . && git commit -m "..." && git push`.
- [ ] Probar la instalación desde **Ajustes → Custom AntiGem Plugins → Repositories**.

## EN — before publishing

- [ ] Run `doctor_validate` on the repository `root` and confirm `summary.errors === 0`.
- [ ] Review warnings: missing ids or versions, skills without frontmatter, undeclared icons, broken links.
- [ ] If the index is out of sync, run `doctor_fix_index` in preview mode first, then write it.
- [ ] Check that every index `id` and `version` matches its `manifest.json`.
- [ ] Generate the READMEs with `doctor_generate_readme`: English root and ES copy in `docs/README.es.md` (one table each).
- [ ] Raise the version in **every** `manifest.json` and in `antigem-plugins.json`.
- [ ] Package, install and test each plugin with the developer MCP before copying it into the repo.
- [ ] Copy the contents of `src/.` into the plugin folder (not the `src` folder itself).
- [ ] Verify limits: 5000 files, 32 MiB per file, 128 MiB total per plugin, no symlinks.
- [ ] The repository must be public and `antigem-plugins.json` must live at its root.
- [ ] `git add . && git commit -m "..." && git push`.
- [ ] Test installation from **Settings → Custom AntiGem Plugins → Repositories**.

## Errores frecuentes / Common mistakes

| Síntoma / Symptom | Causa / Cause |
| --- | --- |
| Actualización que nunca desaparece / Update never disappears | `version` distinta en índice y manifiesto / different version in index and manifest |
| `manifest not found` | Copiaste `src` dentro de otra carpeta / copied `src` into another folder |
| Herramientas sin registrar / Tools not registered | Falta `mcp_tools` o el worker no arranca / missing `mcp_tools` or worker failed to start |
| Skills invisibles / Skills not visible | Los `.md` están en subcarpetas / `.md` files are in subfolders |
| Repo sin plugins listados / No plugins listed | Repo privado o sin índice / private repo or missing index |
