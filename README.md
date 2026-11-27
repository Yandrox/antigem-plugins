![PLUGINS: 30](./assets/badges/plugins.svg) ![MODE: 100% OFFLINE](./assets/badges/offline.svg) ![PLATFORM: ANTIGEM](./assets/badges/antigem.svg) ![LANG: ES · EN](./assets/badges/lang.svg) ![INSTALL: Yandrox/antigem-plugins](./assets/badges/install.svg)

[Read the README in Spanish](./docs/README.es.md)

# AntiGem community plugins

Public repository with plugins and skills for AntiGem. Everything works offline: JavaScript is bundled in each plugin, with no CDNs or remote services.

## Install

In AntiGem: **Settings → Custom AntiGem Plugins → Repositories** and add `Yandrox/antigem-plugins`.

## Plugins

| Plugin | ID | Version | Description |
| --- | --- | --- | --- |
| [A11y Audit](./a11y-audit/) | `a11y-audit` | 1.0.2 | Audit mini apps and WebViews for accessibility: contrast, tap targets, ARIA, alt, focus and names; generate report and fixes. |
| [Android Access Guide](./android-access-guide/) | `android-access-guide` | 1.0.0 | Detect shell access mode (ADB, Shizuku, root or none), explains the risk and produces the exact command with activation steps. Skills only, offline. |
| [APK Recon](./apk-recon/) | `apk-recon` | 1.0.0 | Guided reconnaissance checklist for a local APK using REA: manifest, dangerous permissions, exported components, signature, native ABIs and suspicious strings, with a risk-ranked Markdown report. |
| [Bot Forge](./bot-forge/) | `bot-forge` | 1.0.2 | Offline toolkit to design, generate, audit and document Telegram and Discord bots. It sends no messages and uses no tokens. |
| [Browser Flow Recorder](./browser-flow-recorder/) | `browser-flow-recorder` | 1.0.0 | Turn browser_mcp actions into reproducible flows with assertions, credential redaction, screenshot comparison and a bilingual report. Offline. |
| [Chart Craft](./chart-craft/) | `chart-craft` | 1.0.2 | Generate offline SVG charts for mini apps with axes, accessible tooltips and high-contrast palettes; returns inline SVG and a data URI. |
| [Chrome API Compatibility](./chrome-api-compat/) | `chrome-api-compat` | 1.0.0 | Bilingual matrix of the chrome.* APIs actually implemented in AntiGem (including stubs and rejections), minimal manifest.json templates and a checklist to replace desktop APIs with native equivalents. Skills only, offline. |
| [Code Review Offline](./code-review-offline/) | `code-review-offline` | 1.0.0 | Systematic offline code review before commit: per-language checklists (JS/TS, Kotlin, Python, Dart), mobile anti-patterns and before/after refactors with a severity and file:line report. No network, no login. |
| [Config Backup & Diff](./config-backup-diff/) | `config-backup-diff` | 1.0.2 | Export and compare local config (skills, MCP, themes and exported notes), show diffs and restore files selectively, offline. |
| [Git Hygiene](./git-hygiene/) | `git-hygiene` | 1.0.0 | Conventional Commits with repo scopes, patch/minor/major decision, merge checklist (tests, version in two places, index updated) and detection of mixed-responsibility commits, with CHANGELOG.md generation from git log. Skills only, no network. |
| [License Audit](./license-audit/) | `license-audit` | 1.0.0 | Offline license audit before publishing: scans local folders, reads package.json, LICENSE files and headers, flags copyleft incompatible with MIT, missing licences and unattributed snippets, and generates THIRD_PARTY_NOTICES.md. |
| [Local Assets Lab](./local-assets-lab/) | `local-assets-lab` | 1.1.0 | Generate SVG backgrounds, icons, stickers and palettes offline. |
| [MCP Health Check](./mcp-health-check/) | `mcp-health-check` | 1.0.0 | Offline health check for the AntiGem MCP ecosystem: inventory of installed plugins and drafts, tool and skill counts, duplicate names, missing workers, version drift, storage size and observations about declined or slow servers. Read-only. |
| [MCP Schema Designer](./mcp-schema-designer/) | `mcp-schema-designer` | 1.0.0 | Skill to design and review MCP tool schemas: consistent names, bilingual descriptions, types and ranges, mutual exclusion, safe defaults, examples and error table. It complements plugin-doctor, which validates the result. |
| [MiniApp Preflight](./miniapp-preflight/) | `miniapp-preflight` | 1.0.0 | Bilingual preflight checklist before signing or installing mini apps: manifest, permissions, AntiGem.*, bundle, console, screenshot and key; ✅/⚠️/❌ report. Skills only, offline. |
| [MiniApp Test Runner](./miniapp-test-runner/) | `miniapp-test-runner` | 1.1.4 | Record, replay, compare and report mini app tests without external services. |
| [Notes Bridge](./notes-bridge/) | `notes-bridge` | 1.0.0 | Export and import notes_mcp notes and to-dos to local Markdown with frontmatter, full-text search and deduplication; prepares a plan to apply with notes_update. Hybrid and offline. |
| [Offline Subs](./offline-subs/) | `offline-subs` | 1.0.1 | Generate SRT/VTT from scripts, align subtitles to real video duration and create ready styles for Shorts, Reels and YouTube, offline. |
| [Plugin Doctor](./plugin-doctor/) | `plugin-doctor` | 1.2.0 | Validate and repair AntiGem plugin repositories; generates a README with a single table and local SVG badges. |
| [Plugin Upgrade Advisor](./plugin-upgrade-advisor/) | `plugin-upgrade-advisor` | 1.0.0 | Compare the local inventory with the repo index, read changelogs from git log, classifies version-bump risk and proposes a safe upgrade order. Skills only, offline. |
| [Prompt Regression](./prompt-regression/) | `prompt-regression` | 1.0.2 | Detect skill drift by storing input→output cases with assertions for format, language, tool choice and length. |
| [REA Playbook](./rea-playbook/) | `rea-playbook` | 1.0.1 | Decision tree for using REA well: which tool to pick per artifact, typical arguments and how to read results, summary first and detail afterwards. It does not duplicate REA. |
| [Regex Workbench](./regex-workbench/) | `regex-workbench` | 1.0.0 | Test and explain regular expressions with Spanish and Unicode offline: tokens, test cases, false positives, backtracking risk and JS/PCRE/POSIX conversions. |
| [Secret Scanner](./secret-scanner/) | `secret-scanner` | 1.0.0 | Offline secret scanner before publishing: detects OpenAI, Google, GitHub, AWS keys, JWTs, tokens and plaintext passwords, skips lockfiles and examples, and reports file:line, confidence, .gitignore entries and rotation steps. Never modifies files. |
| [Session Handoff](./session-handoff/) | `session-handoff` | 1.0.0 | Generates a compact, portable Markdown block to continue a session in another agent (OpenCode, Jarvis, Claude Code, Codex): objective, decisions, completed work, blockers, repo state, relevant paths, open items and next step. Offline, no actions, no secrets. |
| [Skill Linter](./skill-linter/) | `skill-linter` | 1.0.0 | Offline content linter for AntiGem skills: validates frontmatter, requires ES/EN sections, checks detail-file references and links, measures length and flags possible injected instructions. Complements plugin-doctor, which checks structure. Read-only. |
| [Storage Cleaner](./storage-cleaner/) | `storage-cleaner` | 1.1.1 | Scan duplicates, large files and project leftovers; generate a plan and report without deleting anything. |
| [Theme Audit](./theme-audit/) | `theme-audit` | 1.0.0 | Offline WCAG contrast audit for AntiGem themes: computes the ratio of every text/background pair (UI, code, editor and terminal), flags AA/AAA failures and proposes a concrete theme_update for the light and dark themes. Read-only. |
| [Trace Translator](./trace-translator/) | `trace-translator` | 1.0.0 | Normalise Java, Kotlin, Dart and JS stack traces: group repeated frames, flag project frames, separate root cause from symptom, translate common messages and suggest next steps. Offline, no external services. |
| [Viral Script Lab](./viral-script-lab/) | `viral-script-lab` | 1.0.2 | Analyse short-form scripts (hook, cuts, pace, 3 acts and CTA) and generate titles and hashtags offline. |

## Maintenance with Plugin Doctor

- `doctor_validate`: Checks manifests, skills, index, links and size limits.
- `doctor_fix_index`: Rebuilds `antigem-plugins.json` from every `manifest.json`.
- `doctor_generate_readme`: Generates this README with a single plugin table and local badges.

## Per-plugin limits

- 5000 files maximum.
- 32 MiB per file and 128 MiB per plugin maximum.
- Raise the version in both `manifest.json` and the index when publishing changes.
