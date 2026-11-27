![PLUGINS: 30](../assets/badges/plugins.svg) ![MODE: 100% OFFLINE](../assets/badges/offline.svg) ![PLATFORM: ANTIGEM](../assets/badges/antigem.svg) ![LANG: ES · EN](../assets/badges/lang.svg) ![INSTALL: Yandrox/antigem-plugins](../assets/badges/install.svg)

[Leer el README en inglés](../README.md)

# Plugins comunitarios para AntiGem

Repositorio público con plugins y skills para AntiGem. Todo funciona offline: JavaScript incluido en cada plugin, sin CDNs ni servicios remotos.

## Instalar

En AntiGem: **Ajustes → Custom AntiGem Plugins → Repositories** y añade `Yandrox/antigem-plugins`.

## Plugins

| Plugin | ID | Versión | Descripción |
| --- | --- | --- | --- |
| [A11y Audit](../a11y-audit/) | `a11y-audit` | 1.0.2 | Audita accesibilidad de mini apps y WebViews: contraste, zonas táctiles, ARIA, alt, foco y nombres; genera informe y correcciones. |
| [Android Access Guide](../android-access-guide/) | `android-access-guide` | 1.0.0 | Detecta el modo de acceso shell (ADB, Shizuku, root o ninguno), explica el riesgo y genera el comando exacto con pasos de activación. Solo skills, offline. |
| [APK Recon](../apk-recon/) | `apk-recon` | 1.0.0 | Checklist guiado de reconocimiento de un APK local con REA: manifiesto, permisos peligrosos, componentes exportados, firma, ABIs nativos y strings sospechosos, con informe Markdown ordenado por riesgo. |
| [Bot Forge](../bot-forge/) | `bot-forge` | 1.0.2 | Kit offline para diseñar, generar, auditar y documentar bots de Telegram y Discord. No envía mensajes ni usa tokens. |
| [Browser Flow Recorder](../browser-flow-recorder/) | `browser-flow-recorder` | 1.0.0 | Convierte acciones de browser_mcp en flujos reproducibles con aserciones, redacción de credenciales, comparación de capturas e informe bilingüe. Offline. |
| [Chart Craft](../chart-craft/) | `chart-craft` | 1.0.2 | Genera gráficos SVG offline para mini apps con ejes, tooltips accesibles y paletas de alto contraste; devuelve SVG en línea y data URI. |
| [Chrome API Compatibility](../chrome-api-compat/) | `chrome-api-compat` | 1.0.0 | Matriz bilingüe de las APIs chrome.* realmente implementadas en AntiGem (stubs y rechazos incluidos), plantillas de manifest.json mínimo y checklist para sustituir APIs de escritorio por equivalentes nativos. Solo skills, offline. |
| [Code Review Offline](../code-review-offline/) | `code-review-offline` | 1.0.0 | Revisión sistemática de código local antes del commit: checklists por lenguaje (JS/TS, Kotlin, Python, Dart), anti-patrones de móvil y refactors con antes/después e informe con severidad y archivo:línea. Sin red ni login. |
| [Config Backup & Diff](../config-backup-diff/) | `config-backup-diff` | 1.0.2 | Exporta y compara configuraciones locales (skills, MCP, temas y notas exportadas), muestra diferencias y restaura archivos de forma selectiva, sin red. |
| [Git Hygiene](../git-hygiene/) | `git-hygiene` | 1.0.0 | Conventional Commits con scopes del repo, decisión de patch/minor/major, checklist de merge (tests, versión en dos sitios, índice actualizado) y detección de commits que mezclan responsabilidades, con generación de CHANGELOG.md desde git log. Solo skills, sin red. |
| [License Audit](../license-audit/) | `license-audit` | 1.0.0 | Auditoría offline de licencias antes de publicar: recorre carpetas locales, lee package.json, LICENSE y cabeceras, detecta copyleft incompatible con MIT, licencias ausentes y snippets sin atribución, y genera THIRD_PARTY_NOTICES.md. |
| [Local Assets Lab](../local-assets-lab/) | `local-assets-lab` | 1.1.0 | Genera fondos, iconos, stickers y paletas SVG sin conexión. |
| [MCP Health Check](../mcp-health-check/) | `mcp-health-check` | 1.0.0 | Diagnóstico offline de la salud del ecosistema MCP de AntiGem: inventario de plugins instalados y borradores, conteo de tools y skills, duplicados, workers ausentes, deriva de versiones, tamaño de storage y observaciones de servidores declinados o lentos. Solo lectura. |
| [MCP Schema Designer](../mcp-schema-designer/) | `mcp-schema-designer` | 1.0.0 | Skill para diseñar y revisar esquemas de tools MCP: nombres coherentes, descripciones bilingües, tipos y rangos, exclusión mutua, defaults seguros, ejemplos y tabla de errores. Complementa a plugin-doctor, que valida el resultado. |
| [MiniApp Preflight](../miniapp-preflight/) | `miniapp-preflight` | 1.0.0 | Checklist bilingüe antes de firmar o instalar mini apps: manifest, permisos, AntiGem.*, bundle, consola, captura y clave; informe ✅/⚠️/❌. Solo skills, offline. |
| [MiniApp Test Runner](../miniapp-test-runner/) | `miniapp-test-runner` | 1.1.4 | Graba, repite, compara e informa pruebas de mini apps sin servicios externos. |
| [Notes Bridge](../notes-bridge/) | `notes-bridge` | 1.0.0 | Exporta e importa notas y listas de notes_mcp a Markdown local con frontmatter, búsqueda full-text y deduplicación; prepara un plan para aplicar con notes_update. Híbrido y offline. |
| [Offline Subs](../offline-subs/) | `offline-subs` | 1.0.1 | Genera SRT/VTT desde guiones, alinea subtítulos con la duración real del vídeo y crea estilos listos para Shorts, Reels y YouTube, sin red. |
| [Plugin Doctor](../plugin-doctor/) | `plugin-doctor` | 1.3.0 | Valida y repara repositorios de plugins de AntiGem; genera un README raíz en inglés y una copia en español en docs/, cada uno con una sola tabla y badges SVG locales. |
| [Plugin Upgrade Advisor](../plugin-upgrade-advisor/) | `plugin-upgrade-advisor` | 1.0.0 | Compara el inventario local con el índice del repo, lee changelogs del git log, clasifica el riesgo de cada salto de versión y propone un orden seguro de actualización. Solo skills, offline. |
| [Prompt Regression](../prompt-regression/) | `prompt-regression` | 1.0.2 | Detecta deriva en las skills guardando casos entrada→salida con aserciones de formato, idioma, herramienta y longitud. |
| [REA Playbook](../rea-playbook/) | `rea-playbook` | 1.0.1 | Árbol de decisión para usar REA bien: qué herramienta elegir según el artefacto, argumentos típicos y cómo leer el resultado, con resumen primero y detalle después. No duplica REA |
| [Regex Workbench](../regex-workbench/) | `regex-workbench` | 1.0.0 | Prueba y explica expresiones regulares con español y Unicode sin salir de la app: tokens, casos de prueba, falsos positivos, riesgo de backtracking y conversiones JS/PCRE/POSIX. |
| [Secret Scanner](../secret-scanner/) | `secret-scanner` | 1.0.0 | Escáner offline de secretos antes de publicar: detecta claves OpenAI, Google, GitHub, AWS, JWTs, tokens y contraseñas en claro, ignora lockfiles y ejemplos, y emite un informe con ruta:línea, confianza, entradas de .gitignore y pasos de rotación. Nunca modifica archivos. |
| [Session Handoff](../session-handoff/) | `session-handoff` | 1.0.0 | Genera un bloque Markdown portable y conciso para continuar una sesión en otro agente (OpenCode, Jarvis, Claude Code, Codex): objetivo, decisiones, trabajo completado, bloqueos, estado del repo, rutas relevantes, pendientes y siguiente paso. Offline, sin ejecutar acciones ni exponer secretos. |
| [Skill Linter](../skill-linter/) | `skill-linter` | 1.0.0 | Linter offline de contenido de skills de AntiGem: valida frontmatter, exige secciones ES/EN, comprueba referencias a archivos de detalle y enlaces, mide longitud y avisa de posibles instrucciones inyectadas. Complementa a plugin-doctor, que revisa la estructura. Solo lectura. |
| [Storage Cleaner](../storage-cleaner/) | `storage-cleaner` | 1.1.1 | Escanea duplicados, archivos grandes y restos de proyectos; genera un plan y un informe sin borrar nada. |
| [Theme Audit](../theme-audit/) | `theme-audit` | 1.0.0 | Auditoría offline de contraste WCAG de temas de AntiGem: calcula el ratio de cada par texto/fondo (interfaz, código, editor y terminal), marca fallos AA/AAA y propone un theme_update concreto para el tema claro y el oscuro. Solo lectura. |
| [Trace Translator](../trace-translator/) | `trace-translator` | 1.0.0 | Normaliza stack traces de Java, Kotlin, Dart y JS: agrupa frames repetidos, marca los del proyecto, separa causa raíz de síntoma, traduce mensajes comunes y propone siguientes pasos. Sin red ni servicios externos. |
| [Viral Script Lab](../viral-script-lab/) | `viral-script-lab` | 1.0.2 | Analiza guiones cortos (gancho, cortes, ritmo, 3 actos y CTA) y genera títulos y hashtags sin servicios externos. |

## Mantenimiento con Plugin Doctor

- `doctor_validate`: revisa manifiestos, skills, índice, enlaces y límites de tamaño.
- `doctor_fix_index`: regenera `antigem-plugins.json` desde los `manifest.json`.
- `doctor_generate_readme`: genera el README raíz en inglés y una copia en español en `docs/`, cada uno con una sola tabla y badges locales.

## Límites por plugin

- Máximo 5000 archivos.
- Máximo 32 MiB por archivo y 128 MiB por plugin.
- Sube la versión en el `manifest.json` y en el índice al publicar cambios.
