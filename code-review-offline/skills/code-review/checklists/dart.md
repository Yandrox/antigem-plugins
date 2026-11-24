# Dart / Flutter

## ES

Aplica a `.dart`, incluido Flutter, widgets, BLoC/Riverpod/Provider y isolates. Marca cada ítem con `OK`, `Hallazgo` o `N/A` y añade `archivo:línea`.

### Ciclo de vida y recursos

- [ ] `StreamSubscription`, `Timer`, `AnimationController`, `TextEditingController`, `FocusNode`, `ScrollController` sin `dispose()` → fuga.
- [ ] `dispose()` que no llama a `super.dispose()` o que cancela en el orden equivocado.
- [ ] `async` callback que hace `setState`/emite después de `dispose` → comprueba `mounted`.
- [ ] `BuildContext` guardado en un campo, usado tras un `await`, o pasado a un objeto de larga duración (snackbar, navegación, dialog).
- [ ] `context.read`/`watch` dentro de callbacks que sobreviven al widget.
- [ ] `Future` sin `await` en `initState`/`didChangeDependencies` que escribe estado sin control.
- [ ] `compute`/`Isolate.spawn` sin `kill`/`close`, o con mensajes que copian estructuras grandes.

### Widgets y rendimiento

- [ ] Trabajo pesado (parseo, filtros, formateo, I/O) dentro de `build` → mover a `initState`, memoizar o usar isolate.
- [ ] `setState` que reconstruye un subtree grande → dividir en widgets pequeños o usar `const`.
- [ ] `ListView` con `children` en lugar de `ListView.builder` para listas largas → memory.
- [ ] Keys ausentes o inestables en listas dinámicas → estado de widget mal reutilizado.
- [ ] `Opacity`/`Visibility` con hijos costosos que siguen construyéndose.
- [ ] `const` posible no usado en widgets y constructores → recomposiciones innecesarias.
- [ ] Imágenes sin `cacheWidth`/`cacheHeight` o sin `fit`/`errorBuilder`.
- [ ] `MediaQuery`/`Theme.of` leídos en `build` sin necesidad → acopla el widget al tema.

### Estado y arquitectura

- [ ] Estado mutable compartido fuera del manejo declarado (variable de módulo, singleton) sin notificación.
- [ ] BLoC/Riverpod/Provider con `StreamController` sin `close()` o sin `cancel` de subscriptions.
- [ ] `StatefulWidget` con lógica de negocio en `build` → extraer a controller/bloc.
- [ ] `EqualUnordered`/comparación de listas por identidad → rebuilds o falta de rebuilds.
- [ ] `available` vs `ValueListenableBuilder` mal usados: escuchan un objeto que se muta en sitio sin notificar.
- [ ] Navegación `Navigator.push` sin manejar el `Future` resultante o sin comprobar `mounted` al volver.

### Async y errores

- [ ] `try/catch` vacío o `on Exception catch (_) {}` que deja la UI en estado de carga.
- [ ] `Future.delayed`/`Timer.periodic` sin cancelar.
- [ ] `then` encadenado sin `catchError` ni `onError`.
- [ ] `await` en un bucle sobre I/O independiente → usar `Future.wait` con cota.
- [ ] Excepciones de platform channel sin mapear a un estado de error visible.

### Seguridad y plataforma

- [ ] API keys/tokens en constantes del código → configuración segura del dispositivo.
- [ ] Logs con tokens, bodies completos o PII (`debugPrint(response.body)`).
- [ ] Permisos de Android/iOS declarados de más o usados sin pedirlos (`permission_handler`).
- [ ] `WebView` con JavaScript y canales sin restringir.
- [ ] `http` en lugar de `https` o sin validación de certificado.
- [ ] `shared_preferences` con datos sensibles sin cifrar.

### Antes / después (ejemplos)

```dart
// Antes — subscription sin cancelar y contexto tras await
class _PageState extends State<Page> {
  StreamSubscription? _sub;
  @override void initState() {
    super.initState();
    _sub = repo.stream.listen((v) => setState(() => data = v));
  }
  Future<void> load() async {
    final v = await repo.fetch();
    setState(() => data = v); // puede estar desmontado
  }
}

// Después
class _PageState extends State<Page> {
  StreamSubscription? _sub;
  @override void initState() {
    super.initState();
    _sub = repo.stream.listen((v) {
      if (mounted) setState(() => data = v);
    });
  }
  @override void dispose() {
    _sub?.cancel();
    super.dispose();
  }
  Future<void> load() async {
    final v = await repo.fetch();
    if (!mounted) return;
    setState(() => data = v);
  }
}
```

```dart
// Antes — trabajo pesado en build
@override
Widget build(BuildContext context) {
  final sorted = items.toList()..sort((a, b) => a.name.compareTo(b.name));
  return ListView(children: sorted.map((e) => Text(e.name)).toList());
}

// Después — memoizado y builder
late final List<Item> _sorted;
@override void initState() {
  super.initState();
  _sorted = List<Item>.from(widget.items)..sort((a, b) => a.name.compareTo(b.name));
}
@override
Widget build(BuildContext context) => ListView.builder(
  itemCount: _sorted.length,
  itemBuilder: (context, i) => Text(_sorted[i].name),
);
```

## EN

Applies to `.dart`, including Flutter, widgets, BLoC/Riverpod/Provider and isolates. Mark each item `OK`, `Finding` or `N/A` and add `file:line`.

### Lifecycle and resources

- [ ] `StreamSubscription`, `Timer`, `AnimationController`, `TextEditingController`, `FocusNode`, `ScrollController` without `dispose()` → leak.
- [ ] `dispose()` not calling `super.dispose()` or cancelling in the wrong order.
- [ ] `async` callback calling `setState`/emitting after `dispose` → check `mounted`.
- [ ] `BuildContext` stored in a field, used after `await`, or passed to a long-lived object (snackbar, navigation, dialog).
- [ ] `context.read`/`watch` inside callbacks that outlive the widget.
- [ ] `Future` without `await` in `initState`/`didChangeDependencies` writing state uncontrolled.
- [ ] `compute`/`Isolate.spawn` without `kill`/`close`, or messages copying large structures.

### Widgets and performance

- [ ] Heavy work (parsing, filters, formatting, I/O) inside `build` → move to `initState`, memoize or use an isolate.
- [ ] `setState` rebuilding a large subtree → split into small widgets or use `const`.
- [ ] `ListView` with `children` instead of `ListView.builder` for long lists → memory.
- [ ] Missing or unstable keys on dynamic lists → widget state reused incorrectly.
- [ ] `Opacity`/`Visibility` with expensive children still being built.
- [ ] Possible `const` not used on widgets/constructors → unnecessary rebuilds.
- [ ] Images without `cacheWidth`/`cacheHeight` or `fit`/`errorBuilder`.
- [ ] `MediaQuery`/`Theme.of` read in `build` unnecessarily → couples widget to theme.

### State and architecture

- [ ] Mutable state shared outside declared management (module variable, singleton) without notification.
- [ ] BLoC/Riverpod/Provider with `StreamController` not closed or subscriptions not cancelled.
- [ ] Business logic in `build` of a `StatefulWidget` → extract to controller/bloc.
- [ ] Lists compared by identity → missing or excessive rebuilds.
- [ ] `ValueListenableBuilder` listening to an object mutated in place without notification.
- [ ] `Navigator.push` without handling the result `Future` or checking `mounted` on return.

### Async and errors

- [ ] Empty `try/catch` or `on Exception catch (_) {}` leaving the UI in a loading state.
- [ ] `Future.delayed`/`Timer.periodic` without cancellation.
- [ ] `then` chains without `catchError`/`onError`.
- [ ] `await` in a loop over independent I/O → use bounded `Future.wait`.
- [ ] Platform channel exceptions not mapped to a visible error state.

### Security and platform

- [ ] API keys/tokens in code constants → secure on-device configuration.
- [ ] Logs with tokens, full bodies or PII (`debugPrint(response.body)`).
- [ ] Over-declared Android/iOS permissions or ones used without requesting (`permission_handler`).
- [ ] `WebView` with unrestricted JavaScript and channels.
- [ ] `http` instead of `https` or disabled certificate validation.
- [ ] Sensitive data in unencrypted `shared_preferences`.
