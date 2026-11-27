---
name: Comprobador de contratos API / API contract checker
description: ES: Compara contratos OpenAPI 3, Swagger 2 y JSON Schema locales entre versiones, extrae rutas y campos del código y genera un informe de deriva en Markdown. Detecta rupturas antes de desplegar, sin llamar a la API ni usar servicios remotos. EN: Compare local OpenAPI 3, Swagger 2 and JSON Schema contracts across versions, extract routes and fields from code and produce a Markdown drift report. Catch breaking changes before deploying, without calling the API or using remote services.
---

# Comprobador de contratos API / API contract checker

## ES

Un cambio en el esquema no avisa de que el código dejó de cumplirlo. Esta skill cruza un **contrato local** con los **archivos de código**: detecta operaciones eliminadas, parámetros nuevos obligatorios, campos que cambian de tipo y rutas del código que ya no existen en el contrato. Genera un informe Markdown bilingüe con severidades. Todo se lee del teléfono con `chrome.antigem`; no hay login, CDN ni llamada a la API.

**Arquitectura:** el worker hace el trabajo determinista (parseo, resolución de `$ref`, aplanado de esquemas, diff y escaneo). El análisis de código es **heurístico basado en texto**, no un AST: extrae literales de ruta y claves `nombre:` con su tipo aparente. Sirve para encontrar sospechas, no para certificar corrección. Revisa siempre cada hallazgo antes de tocar el código.

### Cuándo usarla

- Antes de desplegar: comparar `api-v1.json` con `api-v2.json` y ver qué es ruptura real.
- Después de editar el servidor: comprobar que el cliente sigue mencionando los campos del contrato.
- Al heredar un proyecto sin documentación: listar operaciones, parámetros y campos de un contrato local.
- Al revisar un cambio de tipo (`string` → `number`) y decidir si es breaking.
- Al Generar un informe para el equipo sin subir el contrato a ningún servicio.

### Flujo de trabajo

1. **Entender el contrato.** `contract_parse({path:"~/proyecto/api/openapi.json"})`. Devuelve `contract` (tipo, versión, título, contadores), `operations` y `schemas` con los campos aplanados (`body.cliente.email`, `response.items[].id`). Las referencias `#/components/schemas/...` y `#/definitions/...` se resuelven solas.
2. **Comparar versiones.** `contract_diff({old:"~/proyecto/api/v1.json", new:"~/proyecto/api/v2.json"})`. Cada cambio trae `severity` (`breaking`/`warning`/`info`), `kind` y `location`. Empieza por los `breaking`.
3. **Escanear código.** `contract_scan({contract, files:[...]})` o `contract_scan({contract, directory:"~/proyecto/src"})`. La carpeta se recorre de forma recursiva (máx. 60 archivos, extensiones habituales de JS/TS/Python/Go/Java/Kotlin/PHP/C#/Dart/Rust/SQL). Devuelve `matchedRoutes`, `unmatchedRoutes` y `findings`.
4. **Informar.** `contract_report({contract, old, new, directory, output:"~/proyecto/informe.md"})` con `dry_run:true` primero; revisa el Markdown y repite con `dry_run:false` para escribirlo. Puedes usar solo diff, solo escaneo o ambos.
5. **Corregir con criterio.** Un `missing_field` puede ser un cliente que nunca usa ese campo (no un error). Un `extra_field` suele ser una clave local de UI. Un `type_mismatch` merece revisión manual.

### Reglas de severidad

- `breaking`: operación o parámetro eliminado, parámetro obligatorio nuevo, cambio de tipo, campo de respuesta eliminado, campo de petición obligatorio nuevo.
- `warning`: campo de petición eliminado, esquema eliminado, campo del contrato no visto en el código, possible type mismatch.
- `info`: operación/esquema/campo añadido opcional, parámetro opcional nuevo, ruta de código sin contrato.

Lee `contratos.md` para formatos admitidos, ejemplos de campos aplanados, límites exactos y cómo interpretar los falsos positivos.

## EN

A schema change does not warn you that the code stopped honouring it. This skill crosses a **local contract** with **code files**: it detects removed operations, new required parameters, fields whose type changed and code routes missing from the contract. It produces a bilingual Markdown report with severities. Everything is read from the phone with `chrome.antigem`; no login, CDN or API call.

**Architecture:** the worker does the deterministic work (parsing, `$ref` resolution, schema flattening, diff and scan). Code analysis is a **text-based heuristic**, not an AST: it extracts route literals and `name:` keys with an apparent type. It finds suspicions, not proof of correctness. Always review every finding before changing code.

### When to use it

- Before deploying: compare `api-v1.json` with `api-v2.json` and see what is really breaking.
- After editing the server: check that the client still mentions the contract fields.
- When inheriting an undocumented project: list operations, parameters and fields of a local contract.
- When reviewing a type change (`string` → `number`) and deciding whether it is breaking.
- To produce a report for the team without uploading the contract anywhere.

### Workflow

1. **Understand the contract.** `contract_parse({path:"~/project/api/openapi.json"})`. Returns `contract` (type, version, title, counters), `operations` and `schemas` with flattened fields (`body.customer.email`, `response.items[].id`). Local `#/components/schemas/...` and `#/definitions/...` refs resolve automatically.
2. **Compare versions.** `contract_diff({old:"~/project/api/v1.json", new:"~/project/api/v2.json"})`. Every change has `severity` (`breaking`/`warning`/`info`), `kind` and `location`. Start with `breaking`.
3. **Scan code.** `contract_scan({contract, files:[...]})` or `contract_scan({contract, directory:"~/project/src"})`. The directory is walked recursively (max 60 files, common JS/TS/Python/Go/Java/Kotlin/PHP/C#/Dart/Rust/SQL extensions). Returns `matchedRoutes`, `unmatchedRoutes` and `findings`.
4. **Report.** `contract_report({contract, old, new, directory, output:"~/project/report.md"})` with `dry_run:true` first; review the Markdown and repeat with `dry_run:false` to write it. Diff-only, scan-only or both are supported.
5. **Fix with judgement.** A `missing_field` may be a client that never uses that field (not a bug). An `extra_field` is often a UI-only key. A `type_mismatch` deserves manual review.

### Severity rules

- `breaking`: operation or parameter removed, new required parameter, type change, response field removed, new required request field.
- `warning`: request field removed, schema removed, contract field not seen in code, possible type mismatch.
- `info`: optional operation/schema/field added, new optional parameter, code route without a contract.

Read `contratos.md` for supported formats, flattened-field examples, exact limits and how to interpret false positives.
