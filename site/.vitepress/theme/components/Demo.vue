<script setup lang="ts">
/**
 * One live demo per construct. Every one is the real thing: the r$ call in
 * the code block below the frame is literally the code that runs here.
 * Values are container-bound, so they answer to the frame you drag — not to
 * your browser window.
 */
import { ref, onMounted, onUnmounted, shallowRef } from 'vue';
import DemoFrame from './DemoFrame.vue';

const props = defineProps<{ kind: 'tokens' | 'truncate' | 'sync' | 'ratio' | 'stuck' }>();

const stage = ref<HTMLElement | null>(null);
const readout = ref('');
const scope = shallowRef<{ dispose(): void } | null>(null);
let observer: MutationObserver | undefined;

onMounted(async () => {
    const { r$ } = await import('@responsivejs/runtime');
    const root = stage.value!;
    const s = r$.scope();
    const q = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(sel)!;

    if (props.kind === 'tokens') {
        // A scale, not a ladder: one declaration, every consumer follows.
        s.add(
            r$(q('.tk'), {
                fontSize: r$.fluid(15, 22, { container: true }),
                padding: r$.fluid(10, 26, { container: true }),
                borderRadius: r$.fluid(4, 16, { container: true }),
                boxShadow: r$.fluid('0 1px 2px rgba(0,0,0,.3)', '0 16px 44px rgba(0,0,0,.16)', { container: true }),
                backgroundColor: r$.fluid('#eef2ff', '#dbe6ff', { container: true }),
            }),
        );
        const report = (): void => {
            const cs = getComputedStyle(q('.tk'));
            readout.value = `font-size ${cs.fontSize} · padding ${cs.padding} · radius ${cs.borderRadius}`;
        };
        observer = new MutationObserver(report);
        observer.observe(q('.tk'), { attributes: true, attributeFilter: ['style'] });
        report();
    } else if (props.kind === 'truncate') {
        s.add(r$.geometry(q('.excerpt'), { truncated: r$.whenTruncated() }));
        const report = (): void => {
            readout.value = q('.excerpt').hasAttribute('data-truncated')
                ? 'data-truncated → the "Read more" link exists because text was actually cut'
                : 'no attribute → nothing was cut, so no link is offered';
        };
        observer = new MutationObserver(report);
        observer.observe(q('.excerpt'), { attributes: true, attributeFilter: ['data-truncated'] });
        report();
    } else if (props.kind === 'sync') {
        s.add(r$.sync(root.querySelectorAll<HTMLElement>('.cardlet h4'), 'height'));
        readout.value = 'the three headings share the tallest natural height — across separate containers';
    } else if (props.kind === 'ratio') {
        s.add(r$.ratio(q('.side'), q('.main'), { min: 0.25, max: 0.4 }));
        const report = (): void => {
            const ratio = q('.side').getBoundingClientRect().width / q('.main').getBoundingClientRect().width;
            readout.value = `sidebar / main = ${ratio.toFixed(2)} — held inside [0.25, 0.40]`;
        };
        observer = new MutationObserver(report);
        observer.observe(q('.side'), { attributes: true, attributeFilter: ['style'] });
        setTimeout(report, 60);
    } else if (props.kind === 'stuck') {
        s.add(r$.geometry(q('.head'), { stuck: r$.whenStuck() }));
        readout.value = 'scroll inside the frame: the shadow exists only while the header is pinned';
    }

    scope.value = s;
});

onUnmounted(() => {
    observer?.disconnect();
    scope.value?.dispose();
});
</script>

<template>
    <DemoFrame :label="kind" :start="kind === 'ratio' ? 560 : 420" :min="240" :max="820">
        <div ref="stage">
            <template v-if="kind === 'tokens'">
                <div class="tk">Every value here is a function of this panel's width — including the colour.</div>
            </template>

            <template v-else-if="kind === 'truncate'">
                <p class="excerpt">
                    A predicate measures whether the text was really clipped, so the affordance appears only when
                    there is something to reveal — no character counting, no guessing per language.
                </p>
                <a class="more" href="#">Read more →</a>
            </template>

            <template v-else-if="kind === 'sync'">
                <div class="row">
                    <div class="cardlet"><h4>Short title</h4><p>Body</p></div>
                    <div class="cardlet"><h4>A considerably longer title that wraps</h4><p>Body</p></div>
                    <div class="cardlet"><h4>Middle length title</h4><p>Body</p></div>
                </div>
            </template>

            <template v-else-if="kind === 'ratio'">
                <div class="split">
                    <aside class="side">sidebar</aside>
                    <main class="main">main content</main>
                </div>
            </template>

            <template v-else-if="kind === 'stuck'">
                <div class="scroller">
                    <header class="head">Pinned header</header>
                    <p v-for="n in 8" :key="n">Line {{ n }} — scroll me.</p>
                </div>
            </template>
        </div>
    </DemoFrame>
    <p class="readout">{{ readout }}</p>
</template>

<style scoped>
.readout { font-size: .875rem; color: var(--vp-c-text-2); margin-top: -.75rem; }

.tk { background: #eef2ff; color: #1a2340; }

.excerpt {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin: 0;
}
.more { display: none; margin-top: .5rem; }
.excerpt[data-truncated] + .more { display: inline-block; }

.row { display: flex; gap: .75rem; flex-wrap: wrap; }
.cardlet { flex: 1 1 8rem; border: 1px solid var(--vp-c-divider); border-radius: 8px; padding: .6rem; }
.cardlet h4 { margin: 0 0 .35rem; font-size: .95rem; }
.cardlet p { margin: 0; font-size: .85rem; color: var(--vp-c-text-2); }

.split { display: flex; gap: .75rem; }
.side { background: var(--vp-c-brand-soft); border-radius: 8px; padding: .6rem; }
.main { flex: 1; border: 1px solid var(--vp-c-divider); border-radius: 8px; padding: .6rem; }

.scroller { max-height: 190px; overflow: auto; }
.head { position: sticky; top: 0; background: var(--vp-c-bg); padding: .5rem; font-weight: 600; }
.head[data-stuck] { box-shadow: 0 2px 12px rgb(0 0 0 / .18); }
.scroller p { margin: .5rem 0; }
</style>
