---
name: Guía de acceso shell en Android / Android shell access guide
description: ES: Detecta con android_get_status si hay ADB, Shizuku, root o ningún acceso, explica el riesgo de cada nivel y genera el comando exacto (adb shell, rish -c, su -c, android-su -c) con sus pasos de activación. Solo skills, offline. EN: Use android_get_status to detect ADB, Shizuku, root or no access, explain the risk of each level and produce the exact command (adb shell, rish -c, su -c, android-su -c) with activation steps. Skills only, offline.
---

# Guía de acceso shell en Android / Android shell access guide

## ES

Cuando una tarea necesita shell en Android, la respuesta no puede ser "prueba `su` a ver". Esta skill convierte el estado real del dispositivo en **un modo, un riesgo concreto y un comando exacto**, con los pasos de activación que el usuario debe hacer en el teléfono. Todo se decide con datos locales; no se consulta ningún servicio externo.

### Primer paso: detectar, nunca suponer

Llama a `android_get_status` del MCP `android_automation_mcp` si está disponible. Es la fuente de verdad: indica si hay acceso ADB, Shizuku, root o ninguno, y suele incluir el estado del servicio y la identidad (`id`). **No deduzcas el modo solo porque exista un ejecutable**: `su` puede estar instalado sin permiso concedido, y `adb` puede estar en PATH sin dispositivo autorizado.

Si `android_get_status` no está en tu catálogo de tools, dilo explícitamente y usa solo las sondas locales de `comandos.md` (`id`, `adb devices`, `rish -c id`, `su -c id`, `command -v android-su`). No afirmes un modo sin evidencia: escribe `desconocido` y pide al usuario que active el MCP o ejecute una sonda.

### Niveles de acceso y riesgo

| Modo | Identidad típica | Qué permite | Qué NO permite | Riesgo y aviso |
| --- | --- | --- | --- | --- |
| **Ninguno** | `u0_aNNN` (app) | Archivos propios de la app y `/sdcard` con permiso de almacenamiento; comandos sin privilegios (`id`, `getprop`). | Leer `/data/data` de otras apps, `pm`, `am`, `dumpsys`, modificar ajustes del sistema. | 🟢 Seguro. Los fallos son `Permission denied` o `Not allowed`. No escales "por si acaso". |
| **ADB** | `shell` | `pm`, `am`, `input`, `dumpsys`, `screencap`, `logcat`, instalar APK; leer `/sdcard`. | Root: no lee datos privados de otras apps ni escribe particiones del sistema. | 🟡 Medio. Requiere Depuración USB/inalámbrica aceptada por el usuario; deja depuración activa si la abriste para la tarea. |
| **Shizuku** | `shell` vía binder | Casi lo mismo que ADB desde la app, sin cable y con permiso revocable por app. | Root. El servicio puede detenerse al reiniciar. | 🟡 Medio. El usuario debe iniciar Shizuku y conceder permiso a la app que ejecuta el comando. Revocable. |
| **Root** | `uid=0(root)` | Todo: leer cualquier dato, cambiar ajustes del sistema, montar, instalar módulos. | Nada lo bloquea; por eso es peligroso. | 🔴 Alto. Un comando de escritura mal copiado puede borrar datos o dejar el teléfono sin arrancar. Solo con confirmación explícita y empezando por una sonda de solo lectura. |

`android-su -c` es el envoltorio de AntiGem para root cuando la app lo expone. **Comprueba que existe** (`command -v android-su`) antes de usarlo; si no está, no lo inventes. No es un sinónimo mágico de ADB ni de Shizuku.

### Regla de mínimo privilegio

1. Elige el modo **menos privilegiado** que pueda hacer el trabajo. Si `id` y `getprop` bastan, quédate en ninguno.
2. Explica al usuario en una frase el modo detectado y el riesgo antes de mostrar el comando.
3. Muestra **un solo comando exacto**, ya citado, y los pasos de activación si faltan permisos.
4. Ejecuta primero una sonda de solo lectura (`id`, `pm list packages`, `getprop`) y solo después la acción.
5. Pide confirmación explícita antes de activar depuración, conceder root o ejecutar cualquier escritura con root.
6. Al terminar, limpia: `adb disconnect`, desactiva la depuración que abriste y revoca permisos temporales.

Si un comando falla, lee el error y cambia de estrategia una sola vez. No encadenes `adb` → `rish` → `su` automáticamente: cada escalada necesita una razón y, si es root, permiso del usuario.

### Salida esperada

```markdown
## Acceso shell — <modo detectado>

- **Evidencia:** <salida de android_get_status o de la sonda>.
- **Modo:** ninguno / ADB / Shizuku / root / desconocido.
- **Riesgo:** 🟢/🟡/🔴 — <una frase concreta>.
- **Comando:** `adb shell 'pm list packages | grep antigem'`
- **Activación:** <pasos en el teléfono, si hacen falta>.
- **Verificación:** `adb shell id` → `uid=2000(shell) ...`.
- **Limpieza:** <qué desactivar o revocar al terminar>.
```

Nunca incluyas contraseñas, tokens ni datos privados del teléfono en esta salida; si un volcado los contiene, redáctalos antes de pegarlos.

El recetario con comandos por modo, citación, activación, errores comunes y limpieza está en `comandos.md`.

## EN

When a task needs a shell on Android, "try `su` and see" is not an answer. This skill turns the device's real state into **one mode, one concrete risk and one exact command**, with the activation steps the user must perform on the phone. Everything is decided from local data; no external service is consulted.

### First step: detect, never assume

Call `android_get_status` from the `android_automation_mcp` MCP if it is available. It is the source of truth: it reports whether ADB, Shizuku, root or no access is available, usually including service state and identity (`id`). **Do not infer the mode just because an executable exists**: `su` may be installed without permission being granted, and `adb` may be on PATH with no authorised device.

If `android_get_status` isn't in your tool catalog, say so explicitly and use only the local probes in `comandos.md` (`id`, `adb devices`, `rish -c id`, `su -c id`, `command -v android-su`). Never claim a mode without evidence: write `unknown` and ask the user to enable the MCP or run a probe.

### Access levels and risk

| Mode | Typical identity | Allows | Does NOT allow | Risk and warning |
| --- | --- | --- | --- | --- |
| **None** | `u0_aNNN` (app) | The app's own files and `/sdcard` with storage permission; unprivileged commands (`id`, `getprop`). | Reading other apps' `/data/data`, `pm`, `am`, `dumpsys`, changing system settings. | 🟢 Safe. Failures are `Permission denied` or `Not allowed`. Don't escalate "just in case". |
| **ADB** | `shell` | `pm`, `am`, `input`, `dumpsys`, `screencap`, `logcat`, APK installs; reading `/sdcard`. | Root: no reading other apps' private data or writing system partitions. | 🟡 Medium. Requires USB/wireless debugging authorised by the user; disable debugging you opened for the task. |
| **Shizuku** | `shell` via binder | Almost the same as ADB from inside the app, no cable, per-app revocable permission. | Root. The service may stop after a reboot. | 🟡 Medium. The user must start Shizuku and grant permission to the app running the command. Revocable. |
| **Root** | `uid=0(root)` | Everything: read any data, change system settings, mount, install modules. | Nothing blocks it; that is the danger. | 🔴 High. A mistyped write command can delete data or leave the phone unbootable. Only with explicit confirmation and a read-only probe first. |

`android-su -c` is AntiGem's root wrapper when the app exposes it. **Check it exists** (`command -v android-su`) before using it; never invent it. It is not a magic synonym for ADB or Shizuku.

### Least-privilege rule

1. Pick the **least privileged** mode that can do the job. If `id` and `getprop` are enough, stay at none.
2. Explain the detected mode and its risk in one sentence before showing the command.
3. Show **one exact command**, already quoted, plus activation steps if permissions are missing.
4. Run a read-only probe first (`id`, `pm list packages`, `getprop`), then the action.
5. Ask for explicit confirmation before enabling debugging, granting root or running any root write.
6. Clean up when done: `adb disconnect`, disable debugging you opened, revoke temporary permissions.

If a command fails, read the error and change strategy once. Don't chain `adb` → `rish` → `su` automatically: every escalation needs a reason and, for root, the user's permission.

### Expected output

```markdown
## Shell access — <detected mode>

- **Evidence:** <output from android_get_status or the probe>.
- **Mode:** none / ADB / Shizuku / root / unknown.
- **Risk:** 🟢/🟡/🔴 — <one concrete sentence>.
- **Command:** `adb shell 'pm list packages | grep antigem'`
- **Activation:** <steps on the phone, if needed>.
- **Verification:** `adb shell id` → `uid=2000(shell) ...`.
- **Cleanup:** <what to disable or revoke when finished>.
```

Never include passwords, tokens or private phone data in this output; if a dump contains them, redact before pasting.

The command cookbook per mode, quoting, activation, common errors and cleanup is in `comandos.md`.
