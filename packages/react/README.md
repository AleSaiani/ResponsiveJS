# @responsivejs/react

> React bindings for [`r$`](https://github.com/AleSaiani/ResponsiveJS). The constructs are the
> same; these hooks own the **lifecycle** — apply on mount, update on change, dispose on unmount.

```bash
npm install @responsivejs/react @responsivejs/runtime
```

```tsx
import { useRef } from 'react';
import { r$ } from '@responsivejs/runtime';
import { useResponsive, useGeometry, useBreakpoint } from '@responsivejs/react';

function Card() {
    const ref = useRef<HTMLDivElement>(null);

    useResponsive(ref, { padding: r$.fluid(12, 24) });          // → clamp(), zero JS
    useGeometry(ref, { wrapped: r$.whenWraps });                 // → data-wrapped
    const isDesktop = useBreakpoint('desktop');                  // reactive boolean

    return <div ref={ref} className="card">{isDesktop ? 'wide' : 'narrow'}</div>;
}
```

| Hook | What it owns |
| --- | --- |
| `useResponsive(ref, map, deps?)` | A style map on the ref'd element. Changing `deps` calls `update()` on the live handle (dropped properties are restored) instead of recreating it. |
| `useGeometry(ref, states, deps?)` | Geometry data-attributes on the ref'd element. |
| `useTokens(map, deps?)` | A token scale for the component's lifetime. |
| `useScope()` | A scope you can `add()` any handle to; everything disposes on unmount. |
| `useViewportWidth()` | The reactive width via `useSyncExternalStore` — SSR-safe (`config().ssrWidth`). |
| `useBreakpoint(name \| px)` | Reactive `min-width` match; releases the media-query listener. |

StrictMode's double-invocation is handled: constructs are not duplicated.

Docs: [runtime guide](https://github.com/AleSaiani/ResponsiveJS/blob/main/docs/guides/runtime.md) ·
License: MPL-2.0
