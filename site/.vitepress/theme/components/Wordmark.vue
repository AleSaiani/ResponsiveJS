<script setup lang="ts">
/**
 * The header wordmark is itself an r$ construct: "ResponsiveJS" while there is
 * room for it, "r$" when there isn't.
 *
 * The measurement never looks at the wordmark that is currently rendered —
 * that would be a feedback loop (short fits → go long → doesn't fit → go short
 * → forever). It compares the LONG name's natural width, measured once on a
 * probe, against the space the rest of the bar leaves free. Both sides of that
 * comparison are independent of which version is on screen.
 */
import DefaultTheme from 'vitepress/theme';
import { onMounted, onUnmounted, shallowRef, ref } from 'vue';

const { Layout } = DefaultTheme;

const probe = ref<HTMLElement | null>(null);
const scope = shallowRef<{ dispose(): void } | null>(null);

onMounted(async () => {
    const { r$ } = await import('@responsivejs/runtime');
    const title = probe.value?.closest<HTMLElement>('.VPNavBarTitle');
    const row = title?.closest<HTMLElement>('.container');
    if (!title || !row) return;

    // What the rest of the bar NEEDS is not what it currently occupies: the
    // search box is flex-grow, so it always fills whatever the title leaves.
    // A copy laid out at `max-content`, out of flow, gives the natural width —
    // and keeps answering media queries, so it stays right on a phone too.
    const body = row.querySelector('.content-body') ?? row.querySelector('.content');
    let ghost: HTMLElement | null = null;
    if (body) {
        const hide = document.createElement('div');
        hide.className = 'rjs-ghost';
        hide.setAttribute('aria-hidden', 'true');
        ghost = body.cloneNode(true) as HTMLElement;
        ghost.removeAttribute('id');
        hide.appendChild(ghost);
        row.appendChild(hide);
    }

    const s = r$.scope();
    s.add(
        r$.geometry(row, {
            tight: {
                name: 'wordmark-space',
                measure(el) {
                    const wanted = probe.value?.getBoundingClientRect().width ?? 0;
                    if (wanted === 0) return false;
                    const needed = ghost?.scrollWidth ?? 0;
                    // 32px of breathing room, so the swap happens before it looks cramped
                    return el.clientWidth - needed - 32 < wanted;
                },
            },
        }),
    );
    onUnmounted(() => ghost?.parentElement?.remove());
    scope.value = s;
});

onUnmounted(() => scope.value?.dispose());
</script>

<template>
    <Layout>
        <template #nav-bar-title-before>
            <span class="rjs-mark">
                <span class="rjs-long">ResponsiveJS</span>
                <span class="rjs-short">r$</span>
                <!-- never painted, always measurable: the long name's natural width -->
                <span ref="probe" class="rjs-probe" aria-hidden="true">ResponsiveJS</span>
            </span>
        </template>
    </Layout>
</template>

<style>
/* not scoped: the swap is driven by an attribute r$ writes on the nav row */
.rjs-mark { position: relative; color: var(--rjs-green); font-weight: 700; letter-spacing: -0.01em; }
/* The short form has to read as a MARK, not as two small characters — at 17px
   wide, bare text looks like a missing logo. */
.rjs-short {
    display: none;
    font-family: ui-monospace, SFMono-Regular, monospace;
    background: var(--rjs-green);
    color: #fff;
    border-radius: 7px;
    padding: 0 .38em;
    line-height: 1.55;
}
.rjs-probe { position: absolute; left: 0; top: 0; height: 0; overflow: hidden; visibility: hidden; white-space: nowrap; pointer-events: none; }

/* measurable, never painted, and never part of anything else's layout —
   1×1 + clip-path is also what our own audit recognises as visually hidden,
   so the copy is not reported as content */
.rjs-ghost { position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0; clip-path: inset(50%); pointer-events: none; }
.rjs-ghost > * { width: max-content; }

[data-tight] .rjs-long { display: none; }
[data-tight] .rjs-short { display: inline; }
</style>
