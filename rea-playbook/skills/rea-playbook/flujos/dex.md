# Flujo DEX / clases Android / DEX flow

## ES

El código DEX casi siempre está dentro de un APK. No extraigas `classes.dex` "por si acaso": las tools de Android trabajan directamente sobre la ruta del APK.

### 1. Encontrar clases

```js
rea_call({name:'search_android_classes', arguments:{path:'/ruta/app.apk', query:'Http'}})
```

La búsqueda es por substring **sensible a mayúsculas** sobre nombres de clase de nivel superior. Con `query:''` inventaria todas las filas. Los nombres repetidos se reportan en `duplicate_names`: no son un error de la tool.

Para acotar el punto de entrada, pide a `inspect_android_package` la faceta `components` (ver `apk.md`).

### 2. Inspeccionar una clase

```js
rea_call({name:'inspect_android_class', arguments:{
  path:'/ruta/app.apk', class_name:'com.ejemplo.ClienteHttp', detail:'summary'
}})
```

Devuelve métodos, campos, clases internas, prototipos DEX y valores `static final` codificados, **sin generar código fuente**. El `overload_index` que aparece aquí es local al artefacto: cópialo tal cual para el siguiente paso; no asumas que es estable entre ejecuciones.

### 3. Decompilar un método

```js
rea_call({name:'inspect_android_method', arguments:{
  path:'/ruta/app.apk',
  class_name:'com.ejemplo.ClienteHttp',
  method_name:'enviar',
  overload_index:0,
  detail:'summary'
}})
```

Da el prototipo DEX, la representación, marcadores de fallback a smali y truncamiento del fuente. Las firmas mostradas pueden ser alias: compruébalas contra el prototipo. Si hay ofuscación con mapping, pasa `mapping_path` con la ruta exacta del archivo de mapas.

### 4. Grafo y trazas

```js
rea_call({name:'project_android_application_graph', arguments:{...}})
rea_call({name:'trace_android_references', arguments:{...}})
```

Úsalos cuando necesites conectar un entry point con una clase concreta. Pasa la evidencia devuelta, no nombres inventados. Consulta `rea_tool_info` para los argumentos exactos: estas tools tienen esquemas largos.

### 5. Ofuscación y mapas

- `search_android_classes` con términos del dominio (`login`, `crypto`, `token`, `webview`) suele sobrevivir a ofuscadores que respetan nombres de librerías.
- Los valores `static final` de `inspect_android_class` son una vía rápida para encontrar URLs y claves sin descompilar.
- Si los nombres están totalmente ofuscados, empieza por los componentes exportados y sigue las referencias hacia el interior.

### Cómo leer el resultado

1. **Prototipo DEX**: tipos reales de parámetros y retorno; la firma de pantalla puede ser un alias.
2. **Marcadores de fallback**: indican que el descompilador no pudo producir fuente y se usó smali; eso limita la interpretación.
3. **Truncamiento**: un método cortado no permite concluir que no hay más lógica.
4. **Cobertura de declaraciones**: `declaration_coverage` en componentes señala declaraciones parciales.

### Trampas frecuentes

- Buscar con minúsculas y concluir que no existe la clase: la búsqueda distingue mayúsculas.
- Usar un `overload_index` de otra ejecución o de otra clase.
- Interpretar `duplicate_names` como corrupción del APK.
- Decir "no hay código nativo" porque solo miraste clases Java.

## EN

DEX code is usually inside an APK. The Android tools work directly on the APK path; do not extract `classes.dex` "just in case".

### 1. Find classes

`search_android_classes {path, query}` does a **case-sensitive** substring search over top-level class names. `query:''` inventories all rows. Repeated names appear in `duplicate_names`; that is not a tool error. Use the `components` facet of `inspect_android_package` for entry points.

### 2. Inspect one class

`inspect_android_class {path, class_name, detail:'summary'}` returns methods, fields, inner classes, DEX prototypes and encoded `static final` values **without generating source**. The `overload_index` is artifact-local: copy it into the next call and do not assume it is stable across runs.

### 3. Decompile one method

`inspect_android_method {path, class_name, method_name, overload_index, detail}` returns the DEX prototype, representation, smali fallback markers and source truncation. Display signatures may be aliases; verify against the prototype. For obfuscation maps, pass `mapping_path` with the exact map file path.

### 4. Graph and traces

`project_android_application_graph` and `trace_android_references` connect an entry point to a concrete class. Pass returned evidence, never invented names; check `rea_tool_info` for their long schemas.

### 5. Obfuscation

Domain terms (`login`, `crypto`, `token`, `webview`) often survive obfuscators that keep library names. `static final` values from `inspect_android_class` are a quick route to URLs and keys. With fully obfuscated names, start at exported components and follow references inward.

### How to read it

1. DEX prototype: real parameter and return types; the display signature may be an alias.
2. Fallback markers: the decompiler could not produce source and used smali.
3. Truncation: a cut method does not prove there is no further logic.
4. `declaration_coverage` on components flags partial declarations.

### Common traps

- Searching lowercase and concluding the class is absent: the search is case-sensitive.
- Reusing an `overload_index` from another run or class.
- Reading `duplicate_names` as APK corruption.
- Claiming "no native code" after looking only at Java classes.
