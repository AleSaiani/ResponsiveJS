<script setup lang="ts">
/**
 * The same card, four ways. The panel on the left is not a mock-up: it is the
 * Vue adapter (`@responsivejs/vue`) running in this page — this site is a Vue
 * app, so the Vue tab is the one you can actually watch work. The other three
 * are the same construct through their own adapter; the declaration is
 * identical in all of them, which is the point.
 */
import { ref, computed } from 'vue';
import { useResponsive, useGeometry } from '@responsivejs/vue';
import { fluid, whenWraps } from '@responsivejs/runtime';
import DemoFrame from './DemoFrame.vue';

const FRAME = { min: 240, max: 720 };
const card = ref<HTMLElement | null>(null);
const tags = ref<HTMLElement | null>(null);

const panel = { container: true, from: FRAME.min, to: FRAME.max } as const;
useResponsive(card, {
    padding: fluid(12, 28, panel),
    borderRadius: fluid(8, 18, panel),
    gap: fluid(6, 14, panel),
});
useGeometry(tags, { stacked: whenWraps });

type Framework = 'react' | 'vue' | 'angular' | 'vanilla';
const active = ref<Framework>('react');
const TABS: { id: Framework; label: string }[] = [
    { id: 'react', label: 'React' },
    { id: 'vue', label: 'Vue' },
    { id: 'angular', label: 'Angular' },
    { id: 'vanilla', label: 'Vanilla' },
];

const CODE: Record<Framework, string> = {
    react: `import { useResponsive, useGeometry } from '@responsivejs/react';
import { fluid, whenWraps } from '@responsivejs/runtime';

function PriceCard() {
    const card = useRef(null);
    const tags = useRef(null);

    useResponsive(card, {
        padding:      fluid(12, 28, { container: true }),
        borderRadius: fluid(8, 18,  { container: true }),
    });
    useGeometry(tags, { stacked: whenWraps });

    return <article ref={card}>…</article>;
}`,
    vue: `<script setup>
import { useResponsive, useGeometry } from '@responsivejs/vue';
import { fluid, whenWraps } from '@responsivejs/runtime';

const card = ref(null);
const tags = ref(null);

useResponsive(card, {
    padding:      fluid(12, 28, { container: true }),
    borderRadius: fluid(8, 18,  { container: true }),
});
useGeometry(tags, { stacked: whenWraps });
<\/script>

<template>
    <article ref="card">…</article>
</template>`,
    angular: `import { injectResponsive, injectGeometry } from '@responsivejs/angular';

@Component({ selector: 'price-card', templateUrl: './price-card.html' })
export class PriceCard {
    card = viewChild<ElementRef>('card');
    tags = viewChild<ElementRef>('tags');

    constructor() {
        injectResponsive(this.card, {
            padding:      fluid(12, 28, { container: true }),
            borderRadius: fluid(8, 18,  { container: true }),
        });
        injectGeometry(this.tags, { stacked: whenWraps });
    }
}`,
    vanilla: `import { r$ } from '@responsivejs/runtime';

const handle = r$('.price-card', {
    padding:      r$.fluid(12, 28, { container: true }),
    borderRadius: r$.fluid(8, 18,  { container: true }),
});
const tags = r$.geometry('.price-card .tags', { stacked: r$.whenWraps });

// one call releases the stylesheet, the observers and the inline values
const dispose = () => { handle.dispose(); tags.dispose(); };`,
};

const code = computed(() => CODE[active.value]);
const note = computed(() =>
    active.value === 'vue'
        ? 'This is the tab that is running: the panel uses these exact composables.'
        : 'Same declaration, this framework’s lifecycle. The panel runs the Vue one.',
);
</script>

<template>
    <div class="fw">
        <div class="live">
            <DemoFrame :start="440" :min="FRAME.min" :max="FRAME.max" label="framework">
                <article ref="card" class="price">
                    <header>
                        <strong>Team</strong>
                        <span class="amt">€ 29<small>/mo</small></span>
                    </header>
                    <p>Everything in Solo, plus shared contracts and CI verdicts.</p>
                    <div ref="tags" class="tags">
                        <span>Contracts</span><span>CI gate</span><span>SARIF</span><span>Provenance</span>
                    </div>
                </article>
            </DemoFrame>
        </div>

        <div class="src">
            <div class="tabs" role="tablist">
                <button
                    v-for="tab in TABS"
                    :key="tab.id"
                    role="tab"
                    type="button"
                    :aria-selected="active === tab.id"
                    :class="{ on: active === tab.id }"
                    @click="active = tab.id"
                >
                    {{ tab.label }}
                </button>
            </div>
            <pre class="code"><code>{{ code }}</code></pre>
            <p class="note">{{ note }}</p>
        </div>
    </div>
</template>

<style scoped>
.fw { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 2rem; align-items: start; }
@media (max-width: 900px) { .fw { grid-template-columns: minmax(0, 1fr); } }

.price { display: grid; background: var(--vp-c-bg); border: 1px solid var(--vp-c-divider); }
.price header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
.price p { margin: 0; font-size: .9rem; color: var(--vp-c-text-2); }
.amt { font-weight: 700; font-size: 1.35rem; }
.amt small { font-weight: 400; font-size: .8rem; color: var(--vp-c-text-2); }
.tags { display: flex; flex-wrap: wrap; gap: .4rem; }
.tags span { font-size: .78rem; border: 1px solid var(--vp-c-divider); border-radius: 999px; padding: .12rem .6rem; }
/* The fact JS measured, styled entirely by CSS — and styled on ELEMENTS THE
   MEASUREMENT DOES NOT DEPEND ON. Making the pills full-width here would be
   the classic latch: they would then wrap forever and never come back.
   row-gap does not affect horizontal wrapping, so it is safe to change. */
.tags[data-stacked] { row-gap: .5rem; }
.price:has(.tags[data-stacked]) header { flex-direction: column; align-items: flex-start; gap: .15rem; }
.price:has(.tags[data-stacked]) { border-color: var(--vp-c-brand-1); }

.tabs { display: flex; flex-wrap: wrap; gap: .35rem; margin-bottom: .6rem; }
.tabs button {
    border: 1px solid var(--vp-c-divider);
    background: transparent;
    color: var(--vp-c-text-2);
    border-radius: 999px;
    padding: .3rem .85rem;
    min-height: 24px;
    font-size: .85rem;
    cursor: pointer;
}
.tabs button.on { border-color: transparent; background: var(--vp-c-brand-1); color: #fff; font-weight: 600; }
.code { max-height: 22rem; overflow: auto; font-size: .82rem; line-height: 1.5; }
.note { font-size: .85rem; color: var(--vp-c-text-2); }
</style>
