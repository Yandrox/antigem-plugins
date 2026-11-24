# JavaScript / TypeScript

## ES

Aplica a `.js`, `.jsx`, `.mjs`, `.ts`, `.tsx`. Marca cada ítem con `OK`, `Hallazgo` o `N/A` y añade `archivo:línea` a los hallazgos.

### Async y concurrencia

- [ ] `await` dentro de un `forEach`/`map` que no espera las promesas → usa `for...of` o `Promise.all`.
- [ ] `async` sin `await` innecesario, o función que mezcla callbacks y promesas.
- [ ] `Promise.all` con una promesa que puede rechazar y cancelar las demás sin control → considera `allSettled` o rollback.
- [ ] `setTimeout`/`setInterval`/listener sin limpieza en unmount → guarda el id y cancela en cleanup.
- [ ] Race condition: dos requests pueden llegar en orden inverso y sobrescribir estado → usa token/seq o aborta la anterior.
- [ ] `catch` vacío o `catch (e) { console.log(e) }` que deja el estado inconsistente.

### Efectos y ciclo de vida (React / hooks)

- [ ] `useEffect` sin array de dependencias o con dependencias incompletas → stale closure.
- [ ] Efecto que hace fetch sin `AbortController` → actualiza estado tras desmontar.
- [ ] Dependencia que se recrea cada render (objeto/array/función literal) → bucle de efectos.
- [ ] Estado derivado guardado con `useState` en lugar de calcularse en render → se desincroniza.
- [ ] `setState` después de unmount o en un callback no cancelado.
- [ ] Ref usada como estado y leída en render → no dispara repintado.

### Tipos (TypeScript)

- [ ] `any` en firmas públicas o en datos que vienen de red → usa `unknown` + validación.
- [ ] `as` para forzar un tipo sin comprobación → prefiere type guard / narrowed type.
- [ ] `!` (non-null assertion) sin garantía real → comprueba el valor.
- [ ] `@ts-ignore`/`@ts-expect-error` sin explicación ni ticket.
- [ ] `enum` de TS con `const enum` en librería publicada → problemas de inlining.
- [ ] Tipos opcionales que el código trata como obligatorios.

### Seguridad y datos

- [ ] `innerHTML`, `dangerouslySetInnerHTML`, `eval`, `new Function` con datos de entrada → inyección.
- [ ] Secretos o tokens en constantes del bundle → mover a configuración segura del dispositivo.
- [ ] Logs con request/response completos o PII → reducir a campos no sensibles.
- [ ] `JSON.parse` de fuente no confiable sin validación de forma.
- [ ] Prototype pollution: spreads o merges con claves controladas por el usuario.
- [ ] `Math.random()` para tokens/ids de seguridad → usar crypto.

### Rendimiento y estilo

- [ ] Mapa/filter anidado con complejidad cuadrática sobre listas grandes.
- [ ] Objetos o arrays literales creados en el render y pasados a componentes memorizados.
- [ ] Importaciones completas de librerías pesadas cuando existe importnamed → bundle grande.
- [ ] `==` en lugar de `===` (salvo comparación intencionada con null).
- [ ] Mutación directa de props/estado (`state.x = ...`, `array.push` sin copia).
- [ ] Comentarios desactualizados o código muerto que aún se importa.

### Antes / después (ejemplos)

```js
// Antes — await dentro de forEach no espera
items.forEach(async (item) => { await save(item); });
return done;

// Después
await Promise.all(items.map((item) => save(item)));
return done;
```

```ts
// Antes — any y non-null sin garantía
function parse(input: any) { return input.user!.name; }

// Después — unknown + type guard
function isUser(v: unknown): v is {user:{name:string}} {
  return typeof v === 'object' && v !== null && 'user' in v;
}
function parse(input: unknown) {
  return isUser(input) ? input.user.name : '';
}
```

```jsx
// Antes — fetch sin abortar, actualiza tras unmount
useEffect(() => { fetch(url).then(r => r.json()).then(setData); }, [url]);

// Después
useEffect(() => {
  const ac = new AbortController();
  fetch(url, {signal: ac.signal}).then(r => r.json()).then(setData)
    .catch(e => { if (e.name !== 'AbortError') throw e; });
  return () => ac.abort();
}, [url]);
```

## EN

Applies to `.js`, `.jsx`, `.mjs`, `.ts`, `.tsx`. Mark each item `OK`, `Finding` or `N/A` and add `file:line` to findings.

### Async and concurrency

- [ ] `await` inside `forEach`/`map` that does not wait for promises → use `for...of` or `Promise.all`.
- [ ] `async` with no `await`, or a function mixing callbacks and promises.
- [ ] `Promise.all` where one rejection leaves others running uncontrolled → consider `allSettled` or rollback.
- [ ] `setTimeout`/`setInterval`/listener without cleanup on unmount → store the id and cancel in cleanup.
- [ ] Race condition: two requests can arrive out of order and overwrite state → use a token/seq or abort the previous one.
- [ ] Empty `catch` or `catch (e) { console.log(e) }` leaving inconsistent state.

### Effects and lifecycle (React / hooks)

- [ ] `useEffect` with no dependency array or incomplete dependencies → stale closure.
- [ ] Effect fetching without `AbortController` → updates state after unmount.
- [ ] Dependency recreated every render (object/array/inline function) → effect loop.
- [ ] Derived state stored with `useState` instead of computed during render → drifts out of sync.
- [ ] `setState` after unmount or from an uncancelled callback.
- [ ] Ref used as state and read during render → no repaint.

### Types (TypeScript)

- [ ] `any` in public signatures or network data → use `unknown` + validation.
- [ ] `as` casting with no check → prefer a type guard / narrowed type.
- [ ] `!` non-null assertion without a real guarantee → check the value.
- [ ] `@ts-ignore`/`@ts-expect-error` without explanation or ticket.
- [ ] `const enum` in a published library → inlining problems.
- [ ] Optional types treated as required by the code.

### Security and data

- [ ] `innerHTML`, `dangerouslySetInnerHTML`, `eval`, `new Function` with input data → injection.
- [ ] Secrets or tokens in bundle constants → move to secure on-device configuration.
- [ ] Logs with full request/response or PII → reduce to non-sensitive fields.
- [ ] `JSON.parse` of untrusted source without shape validation.
- [ ] Prototype pollution: spreads/merges with user-controlled keys.
- [ ] `Math.random()` for security tokens/ids → use crypto.

### Performance and style

- [ ] Nested map/filter with quadratic complexity over large lists.
- [ ] Object/array literals created in render and passed to memoized components.
- [ ] Whole-library imports when a named import exists → larger bundle.
- [ ] `==` instead of `===` (unless intentionally comparing null).
- [ ] Direct mutation of props/state (`state.x = ...`, `array.push` without a copy).
- [ ] Stale comments or dead code still imported.
