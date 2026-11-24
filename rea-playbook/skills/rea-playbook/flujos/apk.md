# Flujo APK / APK flow

## ES

### 1. Inventario y manifiesto

```js
rea_call({name:'inspect_android_package', arguments:{path:'/ruta/app.apk', detail:'summary'}})
```

Devuelve package, SDK, permisos declarados, componentes estáticos y recuentos de clases y recursos **sin ejecutar el APK ni verificar firmas**. Requiere el JAR de JADX y un JDK aportados por quien llama.

Con `detail:'summary'`, la evidencia completa queda retenida. Para ver facetas sin repetir el análisis:

```js
rea_call({name:'inspect_android_package', arguments:{
  path:'/ruta/app.apk', detail:'summary',
  view:{kind:'android', facet:'components', exported:true, limit:100}
}})
rea_call({name:'inspect_android_package', arguments:{
  path:'/ruta/app.apk', detail:'summary',
  view:{kind:'android', facet:'manifest', offset:0, limit:200}
}})
```

También puedes usar `inspect_analysis_view` con el `parent_evidence_id` devuelto. `facet` acepta `manifest`, `components` y `component-summary`.

### 2. Firmas

```js
rea_call({name:'inspect_apk_signature', arguments:{path:'/ruta/app.apk', detail:'summary'}})
```

Muestra firmantes v1/v2/v3/v3.1, huellas del certificado, digests, rangos de SDK, linaje de rotación y source stamp. Incluye el SHA-256 exacto del archivo. No ejecuta código Android.

### 3. Recursos y cadenas

```js
rea_call({name:'decode_android_resources', arguments:{path:'/ruta/app.apk', include_strings:false}})
```

Da manifiesto legible, versión/SDK, recursos de cadena y locales. Para cadenas, pide `include_strings:true` con `string_limit` y `locale` concretos; usa offsets para paginar. La recuperación de smali/fuentes es de JADX, no de esta tool.

### 4. Contenido interno

```js
rea_call({name:'inspect_artifact', arguments:{path:'/ruta/app.apk', detail:'summary'}})
rea_call({name:'extract_artifact', arguments:{
  occurrence_ids:['occ_...'], output_root:'/ruta/salida'
}})
```

`extract_artifact` usa IDs de ocurrencia **exactos** del inventario, nunca sobreescribe y rechaza rutas que salgan del destino. Los archivos extraídos (por ejemplo `lib/arm64-v8a/libnative.so`) se analizan con el flujo `elf.md`.

### 5. Clases y métodos → `dex.md`

Para entry points, usa la faceta `components` del paso 1. Para una clase concreta, sigue `dex.md`.

### 6. Desde el teléfono

```js
rea_call({name:'list_adb_devices', arguments:{}})
rea_call({name:'resolve_adb_packages', arguments:{query:'com.ejemplo'}})
rea_call({name:'pull_adb_package', arguments:{serial:'...', package:'com.ejemplo', output_directory:'/ruta/salida'}})
rea_call({name:'inspect_adb_package', arguments:{serial:'...', package:'com.ejemplo'}})
rea_call({name:'read_adb_logcat', arguments:{serial:'...', count:200, buffer:'main'}})
```

`pull_adb_package` trae base y todos los splits; el directorio con nombre de paquete no debe existir.

### Qué mirar primero

- Componentes `exported:true` sin permiso, especialmente services y providers con `authorities`.
- `intent-filter` con acciones del sistema en activities exportadas.
- `minSdkVersion` / `targetSdkVersion` frente a los permisos solicitados.
- Firmas v1/v2/v3 y rotación de certificado: un cambio de huella indica otro firmante.
- Recuento de DEX y nativos por ABI: orienta si el peso está en Java o en `.so`.

## EN

### 1. Inventory and manifest

Call `inspect_android_package` with `{path, detail:'summary'}`. It returns package, SDK, declared permissions, static components and class/resource counts **without executing the APK or verifying signatures**. Requires a caller-supplied JADX MCP JAR and JDK.

With `detail:'summary'`, full evidence is retained. Read facets without rerunning by passing `view:{kind:'android', facet:'components'|'manifest'|'component-summary', ...}`, or use `inspect_analysis_view` with the returned `parent_evidence_id`.

### 2. Signatures

`inspect_apk_signature {path, detail:'summary'}` reports v1/v2/v3/v3.1 signers, certificate fingerprints, digests, SDK ranges, rotation lineage and source stamp, plus the exact SHA-256.

### 3. Resources and strings

`decode_android_resources {path, include_strings:false}` gives a readable manifest, version/SDK facts, string resources and locales. Request `include_strings:true` with bounded `string_limit` and a specific `locale`; page with offsets. Smali/source recovery belongs to JADX.

### 4. Inner content

`inspect_artifact {path, detail:'summary'}` returns an inventory; `extract_artifact {occurrence_ids, output_root}` materialises selected files using **exact** occurrence IDs. It never overwrites and rejects traversal. Extracted `.so` files go through `elf.md`.

### 5. Classes and methods → `dex.md`

Use the `components` facet for entry points and follow `dex.md` for a specific class.

### 6. From the phone

`list_adb_devices` → `resolve_adb_packages` → `pull_adb_package {serial, package, output_directory}` → `inspect_adb_package {serial, package}` → `read_adb_logcat {serial, count, buffer}`.

### What to check first

- `exported:true` components without a permission, especially services and providers with `authorities`.
- System-action intent filters on exported activities.
- `minSdkVersion`/`targetSdkVersion` versus requested permissions.
- Signature schemes and rotation: a changed fingerprint means a different signer.
- DEX count and native libraries per ABI.

### Common traps

- Treating declared signatures as verified authenticity: this tool does not verify them.
- Reading only the first page of components and concluding there are no exported ones.
- Assuming few classes means little code: obfuscated or multi-DEX apps inflate counts.
