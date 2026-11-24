# Kotlin / Android

## ES

Aplica a `.kt`, `.kts`, incluido Jetpack Compose y coroutines. Marca cada ítem con `OK`, `Hallazgo` o `N/A` y añade `archivo:línea`.

### Ciclo de vida y coroutines

- [ ] `viewModelScope`/`lifecycleScope` lanzado sin cancelar en el momento adecuado, o `GlobalScope` directo → fuga.
- [ ] Coroutine que captura `Activity`/`Fragment`/`Context` en una lambda de larga duración → fuga de contexto.
- [ ] `Job` guardado en un campo sin `cancel()` en `onDestroy`/`onCleared`.
- [ ] `Flow` colectado en `onCreate` sin `repeatOnLifecycle` → sigue activo en background.
- [ ] `launch` sin `try/catch` o `CoroutineExceptionHandler` → crash o silencio.
- [ ] `withContext(Dispatchers.IO)` faltante para I/O/DB/red en el hilo principal.
- [ ] `runBlocking` en código de producción o en el hilo de UI → bloqueo.
- [ ] `delay`/`Timer` o `callbackFlow` sin `awaitClose`/cancel.

### Compose

- [ ] Cálculo pesado, I/O o `LazyColumn` sin `key` estable dentro del composable → recomposición costosa.
- [ ] `remember` usado para estado que debe sobrevivir a rotación → usa `rememberSaveable`/ViewModel.
- [ ] Lambda que captura una lista grande o un contexto en `remember {}` con clave incorrecta.
- [ ] Efectos (`LaunchedEffect`, `DisposableEffect`) sin clave o sin `onDispose`.
- [ ] `collectAsState` de un Flow que no está limitado al ciclo de vida.
- [ ] `Modifier.clickable` sin `role`/`contentDescription` en elementos interactivos → accesibilidad.

### Permisos y manifiesto

- [ ] Permiso declarado en `AndroidManifest.xml` que el código nunca usa → quítalo.
- [ ] Permiso peligroso usado sin `requestPermissions`/`rememberLauncherForActivityResult` previo.
- [ ] `android:exported="true"` sin permiso o intent-filter justificado.
- [ ] `debuggable`, `usesCleartextTraffic` o `allowBackup` sin justificación en la versión de release.
- [ ] `Intent` implícito sin resolver actividad o sin manejar `ActivityNotFoundException`.

### Nulidad, errores y estilo

- [ ] `!!` sin garantía → `?.let`, `requireNotNull` con mensaje o valor por defecto.
- [ ] `lateinit` leído antes de inicializar → comprueba `::field.isInitialized`.
- [ ] `catch (e: Exception)` que traga el error y continúa con estado inválido.
- [ ] `MutableState` expuesto públicamente desde el ViewModel → expón `State` de solo lectura.
- [ ] Data class con muchos campos mutables compartida entre hilos sin sincronización.
- [ ] Strings/keys duplicados en código en lugar de `stringResource`/`strings.xml`.
- [ ] Comentarios en inglés/español mezclados sin criterio o documentación desactualizada.

### Seguridad y datos

- [ ] API key/token en `BuildConfig` sin ofuscación o en literal → mover a configuración segura.
- [ ] Log con token, bearer, body completo o PII (`Log.d(TAG, request.toString())`).
- [ ] `File` en almacenamiento externo sin permisos ni cifrado para datos sensibles.
- [ ] `WebView` con `setJavaScriptEnabled(true)` y `addJavascriptInterface` sin restricción.
- [ ] `OkHttp`/`Retrofit` sin timeout configurado.

### Antes / después (ejemplos)

```kotlin
// Antes — GlobalScope captura el contexto y no se cancela
GlobalScope.launch {
    val data = repository.load(context)
    withContext(Dispatchers.Main) { updateUi(data) }
}

// Después — ciclo de vida limitado e IO explícito
viewModelScope.launch {
    val data = withContext(Dispatchers.IO) { repository.load() }
    updateUi(data)
}
```

```kotlin
// Antes — Flow colectado en onCreate sigue en background
override fun onCreate(...) {
    lifecycleScope.launch { viewModel.state.collect { render(it) } }
}

// Después — solo mientras el estado está STARTED
override fun onCreate(...) {
    lifecycleScope.launch {
        repeatOnLifecycle(Lifecycle.State.STARTED) {
            viewModel.state.collect { render(it) }
        }
    }
}
```

```kotlin
// Antes — !! y estado mutable expuesto
val userName: String get() = user!!.name
val _uiState = MutableStateFlow(UiState())

// Después
val userName: String get() = user?.name.orEmpty()
private val _uiState = MutableStateFlow(UiState())
val uiState: StateFlow<UiState> = _uiState.asStateFlow()
```

## EN

Applies to `.kt`, `.kts`, including Jetpack Compose and coroutines. Mark each item `OK`, `Finding` or `N/A` and add `file:line`.

### Lifecycle and coroutines

- [ ] `viewModelScope`/`lifecycleScope` launched without proper cancellation, or direct `GlobalScope` → leak.
- [ ] Coroutine capturing `Activity`/`Fragment`/`Context` in a long-lived lambda → context leak.
- [ ] `Job` stored in a field without `cancel()` in `onDestroy`/`onCleared`.
- [ ] `Flow` collected in `onCreate` without `repeatOnLifecycle` → keeps running in background.
- [ ] `launch` without `try/catch` or `CoroutineExceptionHandler` → crash or silence.
- [ ] Missing `withContext(Dispatchers.IO)` for I/O/DB/network on the main thread.
- [ ] `runBlocking` in production or on the UI thread → blocking.
- [ ] `delay`/`Timer` or `callbackFlow` without `awaitClose`/cancel.

### Compose

- [ ] Heavy computation, I/O or `LazyColumn` without stable `key` inside a composable → expensive recomposition.
- [ ] `remember` for state that must survive rotation → use `rememberSaveable`/ViewModel.
- [ ] Lambda capturing a large list or context in `remember {}` with the wrong key.
- [ ] Effects (`LaunchedEffect`, `DisposableEffect`) without a key or `onDispose`.
- [ ] `collectAsState` of a Flow not scoped to the lifecycle.
- [ ] `Modifier.clickable` without `role`/`contentDescription` on interactive elements → accessibility.

### Permissions and manifest

- [ ] Manifest permission the code never uses → remove it.
- [ ] Dangerous permission used without a prior `requestPermissions`/`rememberLauncherForActivityResult`.
- [ ] `android:exported="true"` without a permission or justified intent-filter.
- [ ] `debuggable`, `usesCleartextTraffic` or `allowBackup` without justification in release.
- [ ] Implicit `Intent` without resolving the activity or handling `ActivityNotFoundException`.

### Nullability, errors and style

- [ ] `!!` without a guarantee → `?.let`, `requireNotNull` with a message, or a default.
- [ ] `lateinit` read before initialisation → check `::field.isInitialized`.
- [ ] `catch (e: Exception)` swallowing the error and continuing with invalid state.
- [ ] `MutableState` exposed publicly from the ViewModel → expose read-only `State`.
- [ ] Mutable data class shared across threads without synchronisation.
- [ ] Duplicated strings/keys in code instead of `stringResource`/`strings.xml`.
- [ ] Mixed-language or stale comments with no convention.

### Security and data

- [ ] API key/token in unobfuscated `BuildConfig` or a literal → secure configuration.
- [ ] Log with token, bearer, full body or PII (`Log.d(TAG, request.toString())`).
- [ ] `File` on external storage without permissions/encryption for sensitive data.
- [ ] `WebView` with `setJavaScriptEnabled(true)` and unrestricted `addJavascriptInterface`.
- [ ] `OkHttp`/`Retrofit` without configured timeouts.
