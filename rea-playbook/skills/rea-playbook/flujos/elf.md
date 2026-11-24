# Flujo ELF / .so / ELF flow

## ES

### 1. Primera lectura: layout

```js
rea_call({name:'inspect_binary_layout', arguments:{path:'/ruta/libnative.so'}})
```

Da secciones y segmentos ELF, símbolos, relocaciones, enlazado y mitigaciones, con SHA-256 del artefacto. No lanza el binario ni abre un disassembler. Es el punto de partida antes de desensamblar.

### 2. Símbolos exportados y notas

```js
rea_call({name:'inspect_native_exports', arguments:{path:'/ruta/libnative.so', detail:'summary'}})
rea_call({name:'inspect_elf_notes', arguments:{path:'/ruta/libnative.so', max_entries:200}})
```

`inspect_native_exports` devuelve símbolos dinámicos ELF definidos con binding, tipo y versión, preservando alias y versiones ocultas. Para Mach-O usa `inspect_macho`. `inspect_elf_notes` muestra cabeceras PT_NOTE y secciones SHT_NOTE: build ID, ABI y metadatos del toolchain.

### 3. Desensamblado puntual

```js
rea_call({name:'inspect_with_objdump', arguments:{
  path:'/ruta/libnative.so', operation:'disassemble', symbol:'Java_com_ejemplo_Native_init'
}})
```

`operation` admite `disassemble` (opcionalmente acotado a `symbol`), entre otras. El ejecutable de objdump lo aporta quien llama y su versión no está verificada. Ajusta `max_output_bytes` para no saturar.

Para Rizin:

```js
rea_call_change({name:'execute_rizin_command', arguments:{
  path:'/ruta/libnative.so', command:'afl~main', max_output_bytes:20000
}})
```

Está marcado con ✎: los comandos pueden ejecutar código, tocar archivos o acceder a red. Úsalo solo con comandos que conozcas y con autorización.

### 4. Toolchains específicas

| Sospecha | Herramienta |
| --- | --- |
| Go | `inspect_go_binary {path}` — compilador, módulos, reemplazos y build settings |
| Rust | `inspect_rust_binary {path}` — dependencias cargo-auditable |
| Python empaquetado | `inspect_python_pyc {path}` — cabeceras y objetos de código, sin ejecutar |
| WASM | `inspect_wasm_artifact {path}` — requiere WABT aportado |
| CUDA/HIP | `inspect_gpu_code_objects {path}` |
| Erlang | `inspect_erlang_beam {path}` |
| JNI / .NET | `verify_managed_native_boundaries` cruzando exports con declaraciones P/Invoke |

### 5. Comparar versiones

```js
rea_call({name:'compare_artifacts', arguments:{left:{...}, right:{...}}})
```

Acepta evidencia completa en línea o referencias retenidas `{kind:'retained-evidence', evidence_id}`. Compara inventarios por ruta, identidad de contenido, metadatos y relaciones.

### Cómo leer el resultado

- **RELRO completo** frente a parcial; **NX** activo; **stack canary**; **PIE**: indican mitigaciones. Su ausencia es un hallazgo, no una prueba de explotabilidad.
- `RPATH`/`RUNPATH` con rutas absolutas o relativas al directorio actual: carga de librerías dependiente del entorno.
- Símbolos dinámicos con nombres `Java_` o `JNI_OnLoad`: puente JNI; busca las implementaciones en `dex.md`.
- Pocas exportaciones y muchos imports de `dlopen`/`dlsym`: carga dinámica de código.
- Un build ID y notas de compilador permiten enlazar un crash con esta biblioteca mediante `inspect_recorded_crash`.

### Trampas frecuentes

- Concluir que un binario está "limpio" porque `inspect_native_exports` no muestra símbolos: puede estar strippeado o usar carga dinámica.
- Pedir un disassembler completo de un `.so` grande sin acotar `symbol`.
- Rebasear la ruta del host de REA al workspace del cliente.

## EN

### 1. First read: layout

Call `inspect_binary_layout {path}`. It reports ELF sections and segments, symbols, relocations, linkage and mitigations with artifact SHA-256, without launching the image or opening a disassembler. Start here before disassembling.

### 2. Exports and notes

`inspect_native_exports {path, detail:'summary'}` returns defined ELF dynamic symbols with binding, type and version, preserving aliases and hidden versions. Use `inspect_macho` for Mach-O. `inspect_elf_notes {path, max_entries}` exposes PT_NOTE headers and SHT_NOTE sections: build ID, ABI and toolchain metadata.

### 3. Targeted disassembly

`inspect_with_objdump {path, operation:'disassemble', symbol:'...'}` optionally scopes to one symbol. The objdump executable is caller-supplied and unverified; bound `max_output_bytes`.

`execute_rizin_command {path, command}` is marked ✎: commands can run code, touch files or reach the network. Only use commands you understand and with authorisation.

### 4. Specific toolchains

See the table above: Go, Rust, packed Python, WASM, CUDA/HIP, Erlang and JNI/.NET boundaries.

### 5. Compare versions

`compare_artifacts {left, right}` accepts inline Evidence or retained references and compares inventories by path, content identity, metadata and graph relations.

### How to read it

- Full vs partial RELRO, NX, stack canary, PIE: mitigation signals. Absence is a finding, not proof of exploitability.
- `RPATH`/`RUNPATH` with absolute or cwd-relative paths: environment-dependent library loading.
- `Java_`/`JNI_OnLoad` exports: JNI bridge; find implementations via `dex.md`.
- Few exports but many `dlopen`/`dlsym` imports: dynamic code loading.
- A build ID lets you correlate `inspect_recorded_crash` with this library.

### Common traps

- Calling a binary "clean" because exports are empty: it may be stripped or use dynamic loading.
- Requesting a full disassembly of a large `.so` without a `symbol` scope.
- Rebasing REA host paths onto the client workspace.
