<script setup lang="ts">
/**
 * The hero demo: a real nav, real r$ constructs, real measurements. Drag the
 * frame and watch `data-wrapped` appear at the width where the links stop
 * fitting — a number nobody had to choose.
 */
import { ref, onMounted, onUnmounted } from 'vue';
import DemoFrame from './DemoFrame.vue';

const nav = ref<HTMLElement | null>(null);
const card = ref<HTMLElement | null>(null);
const wrapped = ref(false);
const scope = ref<{ dispose(): void } | null>(null);
let observer: MutationObserver | undefined;

onMounted(async () => {
    const { r$ } = await import('@responsivejs/runtime');
    const s = r$.scope();

    // state from geometry: measured, not a breakpoint someone guessed
    s.add(r$.geometry(nav.value!, { wrapped: r$.whenWraps }));
    // container-bound fluid: this reacts to the FRAME, not the window
    s.add(
        r$(card.value!, {
            padding: r$.fluid(10, 22, { container: true }),
            borderRadius: r$.fluid(6, 14, { container: true }),
            boxShadow: r$.fluid('0 1px 3px rgba(0,0,0,0.28)', '0 14px 40px rgba(0,0,0,0.16)', { container: true }),
        }),
    );
    scope.value = s;

    // mirror the measured fact into the caption
    const sync = (): void => {
        wrapped.value = nav.value?.hasAttribute('data-wrapped') ?? false;
    };
    observer = new MutationObserver(sync);
    observer.observe(nav.value!, { attributes: true, attributeFilter: ['data-wrapped'] });
    sync();
});

onUnmounted(() => {
    observer?.disconnect();
    scope.value?.dispose();
});
</script>

<template>
    <div class="resize-me">
        <DemoFrame :start="460" :min="220" :max="820" label="hero">
            <div class="bar">
                <span class="logo">r$</span>
                <nav ref="nav" class="nav">
                    <a href="#">Product</a><a href="#">Docs</a><a href="#">Pricing</a><a href="#">Changelog</a><a href="#">Blog</a>
                </nav>
                <button class="burger" type="button" aria-label="Open menu">☰</button>
            </div>
            <div ref="card" class="card">
                <strong>Nothing here is a breakpoint.</strong>
                The menu collapses at the width where the links stop fitting. The padding, the
                radius and the shadow are functions of this panel's width.
            </div>
        </DemoFrame>

        <p class="readout">
            <code>whenWraps</code> currently measures
            <strong :class="wrapped ? 'on' : 'off'">{{ wrapped ? 'true' : 'false' }}</strong>
            → the nav {{ wrapped ? 'is collapsed' : 'fits on one row' }}.
        </p>
    </div>
</template>

<style scoped>
.resize-me { max-width: 46rem; margin: 1.25rem 0 0; }
.bar { display: flex; align-items: center; gap: .75rem; }
.logo { font-weight: 700; }
.nav { display: flex; gap: .75rem; flex-wrap: wrap; flex: 1; }
.nav a { color: var(--vp-c-text-1); text-decoration: none; padding: .4rem .1rem; white-space: nowrap; }
.burger { display: none; min-width: 44px; min-height: 44px; border: 1px solid var(--vp-c-divider); border-radius: 8px; background: transparent; color: var(--vp-c-text-1); }

/* JS detects, CSS styles — this is the whole coupling */
.nav[data-wrapped] { visibility: hidden; height: 0; overflow: hidden; }
.nav[data-wrapped] ~ .burger { display: block; }

.card { margin-top: 1rem; background: var(--vp-c-bg); border: 1px solid var(--vp-c-divider); }
.card strong { display: block; margin-bottom: .35rem; }
.readout { font-size: .9rem; color: var(--vp-c-text-2); }
.readout .on { color: #d97706; }
.readout .off { color: #30a46c; }
</style>
