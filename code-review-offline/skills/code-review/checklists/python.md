# Python

## ES

Aplica a `.py`, `.pyi`, scripts y lenguaje de trabajo de los plugins. Marca cada ítem con `OK`, `Hallazgo` o `N/A` y añade `archivo:línea`.

### Recursos y cierre

- [ ] `open()` sin `with` → el fichero puede quedar abierto si hay excepción.
- [ ] `requests`/`httpx`/`socket`/`sqlite3` sin `with`, `close()` o context manager.
- [ ] `subprocess` sin `timeout` o sin `check` cuando el resultado importa.
- [ ] `threading.Thread`/`ThreadPoolExecutor` sin `join`/`shutdown` o sin manejar excepciones del worker.
- [ ] `asyncio` con tarea creada por `create_task` sin guardar referencia ni cancelarla → se pierde.
- [ ] `signal`/`atexit`/`weakref.finalize` sin limpieza equilibrada.

### Errores

- [ ] `except:` o `except Exception: pass` que oculta fallos reales.
- [ ] `raise` sin `from` al convertir excepciones → se pierde la causa.
- [ ] `try` demasiado amplio que captura errores de programación (`TypeError`, `AttributeError`) como si fueran de entrada.
- [ ] `assert` usado para validar datos de entrada: desaparece con `-O`.
- [ ] Logging con `logger.error(f"...")` frente a `logger.error("... %s", value)` → coste y formato.
- [ ] Excepción esperada en `finally` que sobrescribe la excepción original.

### Mutabilidad y estado

- [ ] Argumento por defecto mutable (`def f(x=[])`) → estado compartido entre llamadas.
- [ ] Dict/list global o de módulo mutable accedido desde varios hilos sin `Lock`.
- [ ] Copia superficial (`list(x)`, `dict(x)`, `copy.copy`) donde se necesita `deepcopy`.
- [ ] Iterar sobre una colección mientras se modifica → `RuntimeError` o saltos.
- [ ] `datetime.now()` usado como clave o para comparar sin timezone → resultados dependientes del equipo.
- [ ] Variables de entorno leídas en import y no validadas → fallo tarde.

### Seguridad y datos

- [ ] `eval`, `exec`, `pickle.loads`, `yaml.load` sin `SafeLoader` con datos no confiables → ejecución de código.
- [ ] `os.system`/`subprocess` con `shell=True` y entrada del usuario → inyección de comandos.
- [ ] Paths construidos por concatenación sin `os.path.join`/`pathlib` o sin validar traversal `..`.
- [ ] Secretos en literales o en variables de entorno sin gestionar → mover a configuración local segura.
- [ ] Logs con contraseñas, tokens, bodies completos o PII.
- [ ] `random` para tokens/secrets → usar `secrets`.
- [ ] `tempfile` sin contexto o con nombre predecible en `/tmp`.

### Rendimiento y estilo

- [ ] Concatenación de strings en un loop (`s += x`) en lugar de `join`.
- [ ] `import *`, imports no usados o imports dentro de un loop.
- [ ] Comprehension con trabajo redundante o doble recorrido de una lista grande.
- [ ] `== None` en lugar de `is None`.
- [ ] Funciones con demasiados parámetros posicionales o errores de tipo silenciosos.
- [ ] Docstrings desactualizados frente al comportamiento real.
- [ ] Código de scripts mezclado con lógica de librería sin `if __name__ == "__main__"`.

### Antes / después (ejemplos)

```python
# Antes — default mutable y error silenciado
def add(item, items=[]):
    try:
        items.append(item)
    except Exception:
        pass
    return items

# Después
def add(item, items=None):
    return (items or []) + [item]
```

```python
# Antes — fichero sin cerrar y eval
f = open(path)
data = eval(f.read())
f.close()

# Después
import json
with open(path, encoding="utf-8") as f:
    data = json.load(f)
```

```python
# Antes — hash aleatorio inseguro
import random
token = ''.join(random.choices(string.ascii_letters, k=32))

# Después
import secrets
token = secrets.token_urlsafe(32)
```

## EN

Applies to `.py`, `.pyi`, scripts and the plugin authoring language. Mark each item `OK`, `Finding` or `N/A` and add `file:line`.

### Resources and closing

- [ ] `open()` without `with` → the file may stay open on exception.
- [ ] `requests`/`httpx`/`socket`/`sqlite3` without `with`, `close()` or a context manager.
- [ ] `subprocess` without `timeout`, or without `check` when the result matters.
- [ ] `threading.Thread`/`ThreadPoolExecutor` without `join`/`shutdown` or worker exception handling.
- [ ] `asyncio` task from `create_task` without a stored reference or cancellation → lost task.
- [ ] `signal`/`atexit`/`weakref.finalize` without balanced cleanup.

### Errors

- [ ] `except:` or `except Exception: pass` hiding real failures.
- [ ] `raise` without `from` when converting exceptions → cause is lost.
- [ ] Overly broad `try` catching programming errors (`TypeError`, `AttributeError`) as input errors.
- [ ] `assert` used to validate input: it disappears with `-O`.
- [ ] `logger.error(f"...")` instead of `logger.error("... %s", value)` → cost and formatting.
- [ ] An exception in `finally` overwriting the original one.

### Mutability and state

- [ ] Mutable default argument (`def f(x=[])`) → state shared between calls.
- [ ] Mutable module/global dict or list accessed from multiple threads without a `Lock`.
- [ ] Shallow copy (`list(x)`, `dict(x)`, `copy.copy`) where `deepcopy` is needed.
- [ ] Mutating a collection while iterating → `RuntimeError` or skipped items.
- [ ] `datetime.now()` used as a key or for comparison without timezone → machine-dependent results.
- [ ] Environment variables read at import time without validation → late failure.

### Security and data

- [ ] `eval`, `exec`, `pickle.loads`, `yaml.load` without `SafeLoader` on untrusted data → code execution.
- [ ] `os.system`/`subprocess` with `shell=True` and user input → command injection.
- [ ] Paths built by concatenation without `os.path.join`/`pathlib` or `..` traversal validation.
- [ ] Secrets in literals or unmanaged environment variables → secure local configuration.
- [ ] Logs with passwords, tokens, full bodies or PII.
- [ ] `random` for tokens/secrets → use `secrets`.
- [ ] `tempfile` without a context or with a predictable name in `/tmp`.

### Performance and style

- [ ] String concatenation in a loop (`s += x`) instead of `join`.
- [ ] `import *`, unused imports or imports inside a loop.
- [ ] Comprehension with redundant work or a double pass over a large list.
- [ ] `== None` instead of `is None`.
- [ ] Functions with too many positional params or silently wrong types.
- [ ] Docstrings stale relative to actual behaviour.
- [ ] Script code mixed with library logic without `if __name__ == "__main__"`.
