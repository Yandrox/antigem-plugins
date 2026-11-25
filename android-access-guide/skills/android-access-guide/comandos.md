# Comandos, activación y limpieza / Commands, activation and cleanup

## ES

Fuente de verdad: `android_get_status` cuando el MCP `android_automation_mcp` está disponible. Este archivo es el recetario para interpretar ese estado y actuar con el mínimo privilegio.

### Sondas locales (solo lectura)

| Sonda | Qué comprueba |
| --- | --- |
| `id` | Identidad del proceso actual (`uid=(?2000)` para app, `uid=2000(shell)` para ADB/Shizuku, `uid=0(root)` para root). |
| `getprop ro.product.model` | Modelo del dispositivo, sin datos personales. |
| `adb devices` | Estado del bridge: `device`, `unauthorized`, `offline` o vacío. |
| `adb shell id` | Identidad real de la sesión ADB. |
| `rish -c id` | Identidad a través de Shizuku. |
| `su -c id` | Identidad root, si la solución de root está instalada **y** concedida. |
| `command -v android-su` | Si AntiGem expone su envoltorio de root. |

Una sonda que falla **no** prueba que el modo sea imposible: prueba que en este momento no funciona. Di exactamente qué salió.

### Forma exacta de invocar

| Modo | Patrón | Ejemplo |
| --- | --- | --- |
| Ninguno | `<comando>` | `id` |
| ADB | `adb shell '<comando>'` | `adb shell 'pm list packages \| grep antigem'` |
| ADB con varios dispositivos | `adb -s <serial> shell '<comando>'` | `adb -s 127.0.0.1:5555 shell id` |
| Shizuku | `rish -c '<comando>'` | `rish -c 'pm list packages \| grep antigem'` |
| Root (Magisk/KernelSU) | `su -c '<comando>'` | `su -c 'dumpsys battery'` |
| Root (envoltorio de AntiGem) | `android-su -c '<comando>'` | `android-su -c 'dumpsys battery'` |

Cita el comando remoto entre comillas simples para que el shell local no expanda `$`, `*` ni `;`. Si el comando remoto contiene una comilla simple, escríbela como `'\''`. Ejemplo: `adb shell 'pm clear com.example.app'` (esto **borra datos** de esa app: solo con confirmación).

No interpole entradas del usuario directamente dentro de esas comillas: valida primero que sean un nombre de paquete, una ruta conocida o un valor permitido.

### Activación paso a paso

**Ninguno.** No hay que activar nada. Si la tarea pide `pm`, `am`, `dumpsys` o `/data/data`, explica que hace falta elevación y pregunta antes de continuar.

**ADB (depuración inalámbrica).**

1. En el teléfono: **Ajustes → Opciones de desarrollador → Depuración inalámbrica** (y, si hace falta, **Vincular dispositivo con código PIN/QR**).
2. El usuario introduce el PIN en el teléfono o lo usa para el emparejamiento; no lo pegues en el chat ni lo guardes.
3. Desde el terminal: `adb pair <ip>:<puerto_de_vinculación>` y después `adb connect <ip>:<puerto>`. Si usas USB, conecta el cable y acepta la huella RSA en el teléfono.
4. Verifica `adb devices` → el serial debe decir `device`.
5. Comprueba la identidad: `adb shell id` → `uid=2000(shell) ...`.

**Shizuku.**

1. Instala Shizuku desde su fuente oficial y abre la app.
2. Activa **Opciones de desarrollador → Depuración inalámbrica** y pulsa **Iniciar** dentro de Shizuku; sigue el emparejamiento si lo pide.
3. En Shizuku, concede permiso a la app que ejecutará el comando (AntiGem o Terminal).
4. Si `rish` no existe, instala el componente de shell de Shizuku desde la propia app; no adivines rutas ni descargues scripts de internet.
5. Verifica `rish -c id` → `uid=2000(shell) ...`. Si el servicio se detuvo tras un reinicio, vuelve a abrir Shizuku.

**Root.**

1. Comprueba que hay una solución de root instalada y que el manager permite a la app/shell pedir root.
2. Verifica con una sonda: `su -c id` → `uid=0(root) ...`. Si AntiGem ofrece `android-su`, comprueba `command -v android-su` y prueba `android-su -c id`.
3. Ejecuta primero solo lectura (`dumpsys`, `pm list packages`, `getprop`). cualquier escritura (`pm clear`, `mount`, `rm`, flashing) necesita confirmación explícita del usuario.
4. No modifiques particiones del sistema ni instales módulos salvo que el usuario lo pida con todas las palabras.

### Errores frecuentes

| Error | Significado | Siguiente paso |
| --- | --- | --- |
| `error: no devices/emulators found` | ADB no ve el teléfono. | Revisa IP/puerto o cable y la depuración; repite `adb devices`. |
| `device unauthorized` | Falta aceptar la autorización RSA. | Acepta el aviso en el teléfono; si persiste, revoca las autorizaciones de depuración y vuelve a conectar. |
| `Permission denied` | El modo actual no tiene ese permiso. | Explica qué falta; no escales automáticamente a root. |
| `rish: not found` | Falta el componente de Shizuku o el servicio no está activo. | Instala el componente desde Shizuku y verifica `rish -c id`. |
| `su: not found` / `su: Permission denied` | No hay root o no está concedido a esta app. | Pregunta al usuario; no insistas con otros comandos. |
| `read-only file system` | Hace falta root y remontar. | Para y pide confirmación antes de cualquier escritura. |
| `... is protected` / `open failed: EACCES` | Ni siquiera `shell` puede leer esa ruta de otra app. | Necesitas root o una app depurable; explícalo. |
| `command not found` dentro de `adb shell` | Android usa toybox, no las utilidades de Ubuntu. | Prueba `toybox --list` y usa el applet disponible. |

### Limpieza

- Si abriste ADB: `adb disconnect <ip>:<puerto>` y desactiva **Depuración inalámbrica/USB** en el teléfono.
- Si usaste Shizuku: **Detener** en la app Shizuku; el permiso concedido se puede revocar desde la propia app.
- Si usaste root: revoca el permiso concedido al shell en el manager si era temporal.
- No dejes sesiones de depuración abiertas "por si luego sirven".

### Límites

- Los nombres de los ajustes cambian según fabricante y versión de Android: di "Opciones de desarrollador" y pregunta al usuario si no encuentra la etiqueta.
- No pidas PIN, contraseña, contraseña de desbloqueo ni código de emparejamiento para pegarlos en el chat.
- No pegues volcados con IMEI, serial, MAC, cuentas o tokens: redáctalos antes de mostrarlos.

## EN

Source of truth: `android_get_status` when the `android_automation_mcp` MCP is available. This file is the cookbook for interpreting that state and acting with least privilege.

### Local probes (read-only)

| Probe | What it checks |
| --- | --- |
| `id` | Current process identity (`u0_aNNN` app, `uid=2000(shell)` ADB/Shizuku, `uid=0(root)` root). |
| `getprop ro.product.model` | Device model, no personal data. |
| `adb devices` | Bridge state: `device`, `unauthorized`, `offline` or empty. |
| `adb shell id` | Real identity of the ADB session. |
| `rish -c id` | Identity through Shizuku. |
| `su -c id` | Root identity, if root is installed **and** granted. |
| `command -v android-su` | Whether AntiGem exposes its root wrapper. |

A failing probe does **not** prove the mode is impossible: it proves it doesn't work right now. Report exactly what came out.

### Exact invocation form

| Mode | Pattern | Example |
| --- | --- | --- |
| None | `<command>` | `id` |
| ADB | `adb shell '<command>'` | `adb shell 'pm list packages \| grep antigem'` |
| ADB with several devices | `adb -s <serial> shell '<command>'` | `adb -s 127.0.0.1:5555 shell id` |
| Shizuku | `rish -c '<command>'` | `rish -c 'pm list packages \| grep antigem'` |
| Root (Magisk/KernelSU) | `su -c '<command>'` | `su -c 'dumpsys battery'` |
| Root (AntiGem wrapper) | `android-su -c '<command>'` | `android-su -c 'dumpsys battery'` |

Quote the remote command in single quotes so the local shell doesn't expand `$`, `*` or `;`. If the remote command contains a single quote, write it as `'\''`. Example: `adb shell 'pm clear com.example.app'` (this **deletes that app's data**: only with confirmation).

Do not interpolate user input directly inside those quotes: validate it first as a package name, known path or allowed value.

### Activation step by step

**None.** Nothing to enable. If the task needs `pm`, `am`, `dumpsys` or `/data/data`, explain that elevation is needed and ask before continuing.

**ADB (wireless debugging).**

1. On the phone: **Settings → Developer options → Wireless debugging** (and, if needed, **Pair device with PIN/QR code**).
2. The user enters the PIN on the phone or uses it for pairing; don't paste or store it in chat.
3. From the terminal: `adb pair <ip>:<pairing_port>`, then `adb connect <ip>:<port>`. With USB, connect the cable and accept the RSA fingerprint on the phone.
4. Verify `adb devices` → the serial must say `device`.
5. Check identity: `adb shell id` → `uid=2000(shell) ...`.

**Shizuku.**

1. Install Shizuku from its official source and open the app.
2. Enable **Developer options → Wireless debugging** and tap **Start** inside Shizuku; follow pairing if requested.
3. In Shizuku, grant permission to the app that will run the command (AntiGem or Terminal).
4. If `rish` is missing, install Shizuku's shell component from the app itself; don't guess paths or download scripts from the internet.
5. Verify `rish -c id` → `uid=2000(shell) ...`. If the service stopped after a reboot, reopen Shizuku.

**Root.**

1. Check a root solution is installed and the manager allows this app/shell to request root.
2. Verify with a probe: `su -c id` → `uid=0(root) ...`. If AntiGem offers `android-su`, check `command -v android-su` and try `android-su -c id`.
3. Run read-only commands first (`dumpsys`, `pm list packages`, `getprop`). Any write (`pm clear`, `mount`, `rm`, flashing) needs explicit confirmation.
4. Don't modify system partitions or install modules unless the user asks for it explicitly.

### Common errors

| Error | Meaning | Next step |
| --- | --- | --- |
| `error: no devices/emulators found` | ADB can't see the phone. | Check IP/port or cable and debugging; repeat `adb devices`. |
| `device unauthorized` | RSA authorisation wasn't accepted. | Accept the prompt on the phone; if it persists, revoke debugging authorisations and reconnect. |
| `Permission denied` | Current mode lacks that permission. | Explain what's missing; don't escalate to root automatically. |
| `rish: not found` | Shizuku component missing or service inactive. | Install the component from Shizuku and verify `rish -c id`. |
| `su: not found` / `su: Permission denied` | No root or not granted to this app. | Ask the user; don't try other commands. |
| `read-only file system` | Root plus a remount is needed. | Stop and ask before any write. |
| `... is protected` / `open failed: EACCES` | Even `shell` can't read that path from another app. | You need root or a debuggable app; explain it. |
| `command not found` inside `adb shell` | Android uses toybox, not Ubuntu utilities. | Try `toybox --list` and use an available applet. |

### Cleanup

- If you opened ADB: `adb disconnect <ip>:<port>` and disable **Wireless/USB debugging** on the phone.
- If you used Shizuku: **Stop** in the Shizuku app; the granted permission can be revoked there.
- If you used root: revoke the shell's grant in the manager if it was temporary.
- Don't leave debugging sessions open "in case they're useful later".

### Limits

- Setting names vary by manufacturer and Android version: say "Developer options" and ask the user if the label differs.
- Never ask for a PIN, unlock password or pairing code to paste into chat.
- Never paste dumps containing IMEI, serial, MAC, accounts or tokens: redact them first.
