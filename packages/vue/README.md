# @responsivejs/vue

> Vue bindings for [`r$`](https://github.com/AleSaiani/ResponsiveJS). The constructs are the
> same; these composables (and the directive) own the **lifecycle** — apply on mount, update on
> change, dispose on unmount.

```bash
npm install @responsivejs/vue @responsivejs/runtime
```

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { r$ } from '@responsivejs/runtime';
import { useResponsive, useGeometry, useBreakpoint } from '@responsivejs/vue';

const card = ref<HTMLElement | null>(null);
useResponsive(card, { padding: r$.fluid(12, 24) });   // → clamp(), zero JS
useGeometry(card, { wrapped: r$.whenWraps });          // → data-wrapped
const isDesktop = useBreakpoint('desktop');            // reactive boolean
</script>

<template>
    <div ref="card" class="card">{{ isDesktop ? 'wide' : 'narrow' }}</div>
</template>
```

| Composable | What it owns |
| --- | --- |
| `useResponsive(elRef, map \| ref(map))` | A style map on the element. A reactive map calls `update()` on the live handle. |
| `useGeometry(elRef, states)` | Geometry data-attributes on the element. |
| `useTokens(map)` | A token scale for the component's lifetime. |
| `useScope()` | A scope you can `add()` any handle to; everything disposes on unmount. |
| `useViewportWidth()` | `ShallowRef<number>` tracking the width hub. |
| `useBreakpoint(name \| px)` | `ShallowRef<boolean>` for a `min-width` match. |

Template form: `app.use(responsivePlugin)` then `v-responsive="{ fontSize: fluid(14, 24) }"`
(or import `vResponsive` locally). The directive owns the handle across mount, update and unmount.

Docs: [runtime guide](https://github.com/AleSaiani/ResponsiveJS/blob/main/docs/guides/runtime.md) ·
License: MPL-2.0
