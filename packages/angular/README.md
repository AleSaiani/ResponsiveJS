# @responsivejs/angular

> Angular bindings for [`r$`](https://github.com/AleSaiani/ResponsiveJS). The constructs are the
> same; these helpers own the **lifecycle** — apply on create, update on change, dispose on
> `DestroyRef`.

```bash
npm install @responsivejs/angular @responsivejs/runtime
```

**Decorator-free on purpose**: no Angular compilation step (no ng-packagr, no partial-ivy
artifacts), so it works from any Angular ≥ 16 app as plain functions and signals.

```ts
import { Component, ElementRef, viewChild, afterNextRender } from '@angular/core';
import { r$ } from '@responsivejs/runtime';
import { injectResponsive, injectViewportWidth, injectBreakpoint } from '@responsivejs/angular';

@Component({ selector: 'app-card', standalone: true, template: `<div #card>…</div>` })
export class CardComponent {
    private readonly card = viewChild.required<ElementRef<HTMLElement>>('card');
    readonly width = injectViewportWidth();            // Signal<number>
    readonly isDesktop = injectBreakpoint('desktop');  // Signal<boolean>

    constructor() {
        afterNextRender(() => {
            injectResponsive(this.card().nativeElement, { padding: r$.fluid(12, 24) });
        });
    }
}
```

| Helper | What it owns |
| --- | --- |
| `injectResponsive(el, map)` | A style map on the element. `binding.update(next)` updates the live handle. |
| `injectGeometry(el, states)` | Geometry data-attributes on the element. |
| `injectTokens(map)` | A token scale for the component's lifetime. |
| `injectScope()` | A scope you can `add()` any handle to. |
| `injectViewportWidth()` | `Signal<number>`, SSR-safe (`config().ssrWidth`). |
| `injectBreakpoint(name \| px)` | `Signal<boolean>` for a `min-width` match. |

Each has a DI-free twin (`createResponsive`, `createGeometry`, `createViewportWidth`,
`createBreakpoint`) returning `{ update?, destroy }` — for code outside an injection context.

Want `[rjsResponsive]` in templates? It is six lines in your own app (compiled by your build) —
see [the adapters reference](https://github.com/AleSaiani/ResponsiveJS/blob/main/docs/api/adapters.md#angular).

Docs: [adapters reference](https://github.com/AleSaiani/ResponsiveJS/blob/main/docs/api/adapters.md) ·
[runtime guide](https://github.com/AleSaiani/ResponsiveJS/blob/main/docs/guides/runtime.md) ·
License: MPL-2.0
