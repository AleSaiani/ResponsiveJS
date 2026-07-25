# API — framework adapters (React · Vue · Angular)

The constructs are framework-agnostic and identical everywhere: `r$.fluid(16, 32)` is the same
value in all three. What an adapter adds is the **lifecycle** — apply when the element exists,
`update()` when the declaration changes, dispose when the component goes away. Nothing else is
wrapped, and nothing is hidden: you can always reach for the runtime directly.

Prefer prose? The lifecycle section of [the runtime guide](../guides/runtime.md#lifecycle-testing-ssr)
explains *why* handles exist; this page is the signatures.

| | React | Vue | Angular |
| --- | --- | --- | --- |
| package | `@responsivejs/react` | `@responsivejs/vue` | `@responsivejs/angular` |
| peer | react ≥ 18 | vue ≥ 3.4 | @angular/core ≥ 16 |
| style map | `useResponsive(ref, map, deps?)` | `useResponsive(elRef, map \| ref(map))` | `injectResponsive(el, map)` |
| geometry | `useGeometry(ref, states, deps?)` | `useGeometry(elRef, states)` | `injectGeometry(el, states)` |
| tokens | `useTokens(map, deps?)` | `useTokens(map)` | `injectTokens(map)` |
| group | `useScope()` | `useScope()` | `injectScope()` |
| width | `useViewportWidth(): number` | `useViewportWidth(): ShallowRef<number>` | `injectViewportWidth(): Signal<number>` |
| breakpoint | `useBreakpoint(ref): boolean` | `useBreakpoint(ref): ShallowRef<boolean>` | `injectBreakpoint(ref): Signal<boolean>` |
| template form | — | `v-responsive="map"` | *(a 6-line directive in your app — below)* |

## React

```tsx
const ref = useRef<HTMLDivElement>(null);
useResponsive(ref, { padding: r$.fluid(12, 24) });     // → clamp(), zero JS
useGeometry(ref, { wrapped: r$.whenWraps });            // → data-wrapped
const isDesktop = useBreakpoint('desktop');
```

- `deps` follows the `useEffect` convention. Changing them calls `update()` on the **live
  handle** (properties the new map drops are restored) instead of tearing it down.
- `useViewportWidth`/`useBreakpoint` read through `useSyncExternalStore`, so they are
  concurrent-safe and SSR-safe: the server snapshot is `config().ssrWidth`.
- StrictMode's double-invocation does not duplicate constructs.

## Vue

```vue
<script setup lang="ts">
const card = ref<HTMLElement | null>(null);
useResponsive(card, { padding: r$.fluid(12, 24) });
const isDesktop = useBreakpoint('desktop');
</script>

<template>
    <div ref="card" v-responsive="{ gap: r$.fluid(8, 16) }" />
</template>
```

- Pass a `ref(map)` and the handle updates through `watch` when you replace it.
- Template form: `app.use(responsivePlugin)` registers `v-responsive` globally, or import
  `vResponsive` into a component's `directives`. The directive owns the handle across mount,
  update and unmount.

## Angular

The package ships **no decorators on purpose**: it needs no Angular compilation step
(no ng-packagr, no partial-ivy artifacts), so it works from any Angular ≥ 16 app as plain
functions and signals.

```ts
@Component({ selector: 'app-card', standalone: true, template: `<div #card>…</div>` })
export class CardComponent {
    private readonly card = viewChild.required<ElementRef<HTMLElement>>('card');
    readonly width = injectViewportWidth();          // Signal<number>
    readonly isDesktop = injectBreakpoint('desktop'); // Signal<boolean>

    constructor() {
        afterNextRender(() => {
            injectResponsive(this.card().nativeElement, { padding: r$.fluid(12, 24) });
        });
    }
}
```

Every `inject*` helper must run in an injection context and releases on `DestroyRef`. Each has
a DI-free twin — `createResponsive`, `createGeometry`, `createViewportWidth`,
`createBreakpoint` — returning `{ update?, destroy }` for code that owns its own teardown
(and for use outside a constructor, e.g. inside `afterNextRender`).

Want the template form? Six lines in your app, compiled by your own build:

```ts
@Directive({ selector: '[rjsResponsive]', standalone: true })
export class RjsResponsiveDirective implements OnChanges, OnDestroy {
    @Input('rjsResponsive') map: StyleMap = {};
    private binding?: Binding<StyleMap>;
    constructor(private readonly el: ElementRef<HTMLElement>) {}
    ngOnChanges() { this.binding ? this.binding.update(this.map) : (this.binding = createResponsive(this.el, this.map)); }
    ngOnDestroy() { this.binding?.destroy(); }
}
```

## What every adapter guarantees

- **One construct per binding.** An update never stacks a second construct: check
  `r$.manifest()` — it stays at one entry.
- **Full restoration.** Disposal restores inline values that existed before the construct,
  removes injected CSS and geometry attributes, and releases observers.
- **No wrapping of values.** `r$.fluid`, `r$.whenWraps`, `r$.breakpoints` are imported from
  `@responsivejs/runtime` in all three — the adapter never re-exports a parallel API.
- **SSR-safe reads.** Width readers fall back to `config().ssrWidth` when there is no window.

For elements the adapter does not own (a portal, a third-party widget, a list rendered by
another library), reach for `r$.observe(selector, map)` from the runtime: it keeps a selector
bound as elements mount and unmount.
