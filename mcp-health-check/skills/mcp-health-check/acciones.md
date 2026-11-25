# Actuación segura / Safe remediation

## ES

`mcp_health` **no ejecuta nada**: recomienda. Antes de tocar un MCP, explica al usuario qué pasa, qué se propone y qué puede salir mal. Espera confirmación explícita para desactivar, reautorizar, reinstalar o recargar.

### Orden recomendado

1. **Leer**: entiende el `finding` y confirma que `target` es el servidor correcto.
2. **Explicar**: di en una frase qué está mal y por qué importa.
3. **Proponer**: ofrece una acción concreta y reversible.
4. **Confirmar**: pregunta antes de cambiar permisos o estado.
5. **Verificar**: vuelve a recoger observaciones, ejecuta `mcp_health` de nuevo y compara `score`.

### Por estado

| Estado del informe | Acción propuesta | Reversible |
| --- | --- | --- |
| `declined` (`high`) | Abrir Ajustes → MCP y reautorizar el namespace. Si no se usa, desactivarlo. | Sí: se puede reactivar. |
| `unreachable` (`high`) | Comprobar que la tool existe, recargar la extensión con `webview_extension_reload` y volver a intentar una llamada mínima. | Sí. |
| `worker-missing` (`high`) | Reinstalar el plugin o corregir `background.service_worker` en el manifest y volver a empaquetar. | Sí, reinstalando la versión anterior. |
| `mcp-slow` (`medium`) | Reducir el tamaño de la consulta, dividir el trabajo o desactivar temporalmente. Medir de nuevo antes de culpar al servidor. | Sí. |
| `mcp-log-error` (`medium`) | Leer `webview_extension_logs` con más líneas, identificar la causa y arreglar el manifest o el permiso. | Según el cambio. |
| `tool-duplicate` (`info`) | Solo actuar si el modelo confunde las tools: renombrar en un manifest con `mcp-schema-designer`. | Sí. |
| `version-drift` (`medium`) | Actualizar la extensión instalada desde el borrador, regenerar índice y README con `plugin-doctor` y verificar. | Sí, reinstalando la versión anterior. |
| `storage-size` (`low`) | Revisar con `storage-cleaner`, hacer backup con `config-backup-diff` y limpiar solo previa revisión. | El backup lo permite. |
| `state-unavailable` (`info`) | Aceptar que el tamaño de storage es desconocido; pasar otro `state_dir` solo si sabes que existe. | No aplica. |
| `no-observations` (`info`) | Recoger observaciones con `recoleccion.md` y repetir el diagnóstico. | No aplica. |

### Servidor declinado: guion de explicación

> "El namespace `custom_plugin_developer_mcp` devolvió `Permission.DeclinedError`. Mientras siga declinado, no podré crear ni instalar plugins. Puedo reautorizarlo desde Ajustes → MCP; ¿lo hago o prefieres que continúe sin él?"

No digas "ya está arreglado" hasta haber vuelto a llamar con éxito a una tool de ese namespace.

### Deriva de versión: orden seguro

1. Confirmar que el borrador está listo: `doctor_validate` → 0 errores y 0 avisos.
2. Verificar que la versión coincide en `manifest.json` y en `antigem-plugins.json`.
3. Regenerar `README.md` con vista previa y después aplicar.
4. Instalar/actualizar la extensión desde el borrador.
5. Volver a ejecutar `mcp_health` y comprobar que `versionDrift` bajó a 0.

### Límites

- El `score` es una guía: una extensión con muchos plugins puede perder puntos por duplicados informativos.
- Un informe con `warnings` es parcial: no afirmes que "todo está sano".
- La tool no sabe si un permiso está activo en Android; eso lo decide el sistema y el usuario.
- Nunca actives, desactives ni borres nada "porque sí": cada cambio necesita una razón del informe.

## EN

`mcp_health` **does nothing itself**: it recommends. Before touching an MCP, explain to the user what is wrong, what is proposed and what could go wrong. Wait for explicit confirmation before disabling, re-authorising, reinstalling or reloading.

### Recommended order

1. **Read**: understand the `finding` and confirm `target` is the right server.
2. **Explain**: say in one sentence what is wrong and why it matters.
3. **Propose**: offer one concrete, reversible action.
4. **Confirm**: ask before changing permissions or state.
5. **Verify**: collect observations again and re-run `mcp_health`; compare `score`.

### By status

| Report state | Proposed action | Reversible |
| --- | --- | --- |
| `declined` (`high`) | Open Settings → MCP and re-authorise the namespace. If unused, disable it. | Yes: it can be re-enabled. |
| `unreachable` (`high`) | Check the tool exists, reload the extension with `webview_extension_reload` and retry a minimal call. | Yes. |
| `worker-missing` (`high`) | Reinstall the plugin or fix `background.service_worker` in the manifest and repackage. | Yes, by reinstalling the old version. |
| `mcp-slow` (`medium`) | Reduce query size, split work or temporarily disable. Measure again before blaming the server. | Yes. |
| `mcp-log-error` (`medium`) | Read `webview_extension_logs` with more lines, find the cause and fix the manifest or permission. | Depends on the fix. |
| `tool-duplicate` (`info`) | Only act if the model confuses tools: rename in one manifest with `mcp-schema-designer`. | Yes. |
| `version-drift` (`medium`) | Update the installed extension from the draft, regenerate index and README with `plugin-doctor`, verify. | Yes, by reinstalling the old version. |
| `storage-size` (`low`) | Review with `storage-cleaner`, back up with `config-backup-diff`, clean only after review. | The backup allows it. |
| `state-unavailable` (`info`) | Accept storage size as unknown; pass another `state_dir` only if you know it exists. | N/A. |
| `no-observations` (`info`) | Collect observations with `recoleccion.md` and repeat the diagnosis. | N/A. |

### Declined server: explanation script

> "The `custom_plugin_developer_mcp` namespace returned `Permission.DeclinedError`. While it stays declined I cannot create or install plugins. I can re-authorise it from Settings → MCP; should I, or would you rather continue without it?"

Do not say "it's fixed" until a tool in that namespace has succeeded again.

### Version drift: safe order

1. Confirm the draft is ready: `doctor_validate` → 0 errors, 0 warnings.
2. Verify the version matches in `manifest.json` and `antigem-plugins.json`.
3. Regenerate `README.md` with a preview, then apply.
4. Install/update the extension from the draft.
5. Re-run `mcp_health` and confirm `versionDrift` dropped to 0.

### Limits

- The `score` is a guide: an extension with many plugins may lose points for informational duplicates.
- A report with `warnings` is partial: do not claim "everything is healthy".
- The tool cannot know whether an Android permission is active; the system and the user decide that.
- Never enable, disable or delete anything "just because": every change needs a reason from the report.
