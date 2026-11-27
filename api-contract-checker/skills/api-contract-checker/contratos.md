# Formatos y hallazgos / Formats and findings

## ES

### Formatos admitidos

| Formato | Detección | Qué se extrae |
| --- | --- | --- |
| OpenAPI 3 | `openapi: "3.x"` o `components` | `paths` + parámetros, `requestBody` JSON, primera respuesta `2xx`, `components.schemas`. |
| Swagger 2 | `swagger: "2.0"` | `paths` + parámetros (`in: body`), `responses.*.schema`, `definitions`. |
| JSON Schema | `$schema`, `properties`, `definitions` o `$defs` | Esquema raíz (`Root`) y definiciones; sin operaciones. |

Solo se resuelven referencias **locales** (`#/components/schemas/X`, `#/definitions/X`, `#/$defs/X`). Un `$ref` a otro archivo se ignora y avisa en `contract.warnings`: este plugin no descarga nada.

### Campos aplanados

`flattenSchema` convierte un esquema anidado en rutas con punto:

| Esquema | Campo resultante | Tipo |
| --- | --- | --- |
| `properties.cliente.properties.email` | `cliente.email` | `string` |
| `properties.items.items.properties.id` | `items[].id` | `string` |
| `requestBody` | `body.nombre` | `string` |
| respuesta `2xx` | `response.total` | `number` |
| `type: integer` | — | `number` (normalizado) |
| `oneOf: [string, number]` | — | `string\|number` |

Ejemplo mínimo:

```json
{
  "openapi": "3.0.3",
  "info": {"title": "API demo"},
  "paths": {
    "/clientes/{id}": {
      "get": {
        "parameters": [
          {"name": "id", "in": "path", "required": true, "schema": {"type": "string"}}
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {"$ref": "#/components/schemas/Cliente"}
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "Cliente": {
        "type": "object",
        "required": ["id", "email"],
        "properties": {
          "id": {"type": "string"},
          "email": {"type": "string"},
          "items": {"type": "array", "items": {"type": "object", "properties": {"sku": {"type": "string"}}}}
        }
      }
    }
  }
}
```

`contract_parse` devuelve la operación `GET /clientes/{id}`, el parámetro `id` y los campos `response.id`, `response.email`, `response.items[].sku`.

### Cómo se escanea el código

- Rutas: literales entre comillas simples, dobles o backticks que empiezan por `/`. Se normalizan los segmentos dinámicos: `/clientes/:id`, `/clientes/${id}` y `/clientes/{id}` pasan a `/clientes/{}`.
- Campos: claves `nombre:` o `"nombre":` con tipo aparente por el valor que sigue (comillas → `string`, número → `number`, `true`/`false` → `boolean`, `[` → `array`, `{` → `object`). Se descartan palabra reservadas y nombres muy genéricos (`http`, `data`, `props`, ...).
- Coincidencia: un archivo se asocia a una operación si menciona una ruta normalizada del contrato. Los campos de ese archivo se comparan solo con las operaciones coincidentes.
- `missing_field`: campo de petición/parámetro del contrato no visto en el código. `extra_field`: clave del código fuera del contrato. `type_mismatch`: tipo aparente distinto del contrato.
- Se omiten archivos binarios, mayores de 1 MiB y los `.json`/`.md` al usar `directory`; `contract_scan` avisa en `warnings`. Pásalos en `files` si de verdad quieres analizarlos.

### Interpretación

El informe es una **pista**, no una verdad. Un cliente puede no mencionar un campo de respuesta; un objeto de UI puede tener claves propias; un `any` del contrato no se puede comparar. Cruza el hallazgo con `contract_parse` antes de cambiar código. No se compara el comportamiento en runtime: el plugin **nunca llama a la API**.

### Límites

- Contrato: 4 MiB.
- Archivos de código: 60 como máximo, 1 MiB por archivo.
- Campos por esquema: 120; profundidad: 6; esquemas: 60; operaciones: 100.
- Hallazgos por informe/diff: 150 (el resumen indica `truncated`).
- Rutas sin contrato mostradas: 30.
- Salida: solo `.md`; las rutas empiezan por `~/`, `/sdcard/` o `/data/` y no contienen `..`.

### Problemas comunes

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| `no_route_match` | Rutas con prefijo distinto o construidas por concatenación. | Pasa más archivos o añade un literal de ruta completo. |
| Muchos `extra_field` | Claves de configuración o UI en el mismo archivo. | Filtra por `location` y contrasta con `contract_parse`. |
| `$ref` avisos | Referencia externa o puntero mal escrito. | Inlinea ese esquema en el contrato local. |
| `JSON inválido` | El archivo no es JSON puro (comentarios, comillas simples). | Conviértelo a JSON válido antes de analizarlo. |

## EN

### Supported formats

| Format | Detection | Extracted |
| --- | --- | --- |
| OpenAPI 3 | `openapi: "3.x"` or `components` | `paths` + parameters, JSON `requestBody`, first `2xx` response, `components.schemas`. |
| Swagger 2 | `swagger: "2.0"` | `paths` + parameters (`in: body`), `responses.*.schema`, `definitions`. |
| JSON Schema | `$schema`, `properties`, `definitions` or `$defs` | Root schema (`Root`) and definitions; no operations. |

Only **local** references resolve (`#/components/schemas/X`, `#/definitions/X`, `#/$defs/X`). A `$ref` to another file is skipped with a warning in `contract.warnings`: this plugin downloads nothing.

### Flattened fields

`flattenSchema` turns a nested schema into dotted paths:

| Schema | Resulting field | Type |
| --- | --- | --- |
| `properties.customer.properties.email` | `customer.email` | `string` |
| `properties.items.items.properties.id` | `items[].id` | `string` |
| `requestBody` | `body.name` | `string` |
| `2xx` response | `response.total` | `number` |
| `type: integer` | — | `number` (normalised) |
| `oneOf: [string, number]` | — | `string\|number` |

Minimal example:

```json
{
  "openapi": "3.0.3",
  "info": {"title": "API demo"},
  "paths": {
    "/customers/{id}": {
      "get": {
        "parameters": [
          {"name": "id", "in": "path", "required": true, "schema": {"type": "string"}}
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {"$ref": "#/components/schemas/Customer"}
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "Customer": {
        "type": "object",
        "required": ["id", "email"],
        "properties": {
          "id": {"type": "string"},
          "email": {"type": "string"},
          "items": {"type": "array", "items": {"type": "object", "properties": {"sku": {"type": "string"}}}}
        }
      }
    }
  }
}
```

`contract_parse` returns operation `GET /customers/{id}`, parameter `id` and fields `response.id`, `response.email`, `response.items[].sku`.

### How code is scanned

- Routes: quoted literals (single, double or backticks) starting with `/`. Dynamic segments are normalised: `/customers/:id`, `/customers/${id}` and `/customers/{id}` all become `/customers/{}`.
- Fields: `name:` or `"name":` keys with an apparent type from the following value (quotes → `string`, number → `number`, `true`/`false` → `boolean`, `[` → `array`, `{` → `object`). Reserved words and very generic names (`http`, `data`, `props`, ...) are skipped.
- Matching: a file is linked to an operation when it mentions a normalised contract route. Its fields are compared only against those matching operations.
- `missing_field`: contract request/parameter field not seen in code. `extra_field`: code key outside the contract. `type_mismatch`: apparent type differs from the contract.
- Binary files, files over 1 MiB and `.json`/`.md` files are skipped when using `directory`; `contract_scan` reports them in `warnings`. Pass them in `files` if you really want them scanned.

### Interpretation

The report is a **hint**, not truth. A client may never mention a response field; a UI object may have its own keys; a contract `any` cannot be compared. Cross-check each finding with `contract_parse` before changing code. Runtime behaviour is not checked: the plugin **never calls the API**.

### Limits

- Contract: 4 MiB.
- Code files: 60 maximum, 1 MiB per file.
- Fields per schema: 120; depth: 6; schemas: 60; operations: 100.
- Findings per report/diff: 150 (summary shows `truncated`).
- Unmatched routes shown: 30.
- Output: `.md` only; paths start with `~/`, `/sdcard/` or `/data/` and contain no `..`.

### Common issues

| Symptom | Likely cause | Action |
| --- | --- | --- |
| `no_route_match` | Different path prefix or routes built by concatenation. | Pass more files or add a full route literal. |
| Many `extra_field` | Config or UI keys in the same file. | Filter by `location` and compare with `contract_parse`. |
| `$ref` warnings | External reference or bad pointer. | Inline that schema in the local contract. |
| `Invalid JSON` | File is not pure JSON (comments, single quotes). | Convert it to valid JSON first. |
