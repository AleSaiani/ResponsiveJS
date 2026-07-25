<script setup lang="ts">
/**
 * The two-second visual: the same property, drawn as a function of width.
 *
 * Grey steps = a breakpoint ladder (what you write today). Blue curve = a
 * fluid value. Drag the scrubber and BOTH the chart and the real card move
 * together — because they are the same function. The numbers are not drawn
 * by hand: they come from r$'s own `fluid()`.
 */
import { ref, computed, onMounted, shallowRef } from 'vue';

const MIN = 320;
const MAX = 1440;
const width = ref(560);

// Deliberately synchronous. The browser already coalesces `input` on a range
// control to about one event per frame, and Vue batches the render into a
// microtask — so this repaints in the same frame the event arrived in.
// Deferring to requestAnimationFrame instead adds a frame of latency and, on
// any frame the browser delays, the card visibly falls behind the thumb.
function onInput(event: Event): void {
    width.value = Number((event.target as HTMLInputElement).value);
}

type Fn = (w: number) => number;
const fluidFont = shallowRef<Fn>((w) => 18 + ((w - MIN) / (MAX - MIN)) * 30);
const fluidPad = shallowRef<Fn>((w) => 12 + ((w - MIN) / (MAX - MIN)) * 28);

onMounted(async () => {
    // the curve IS r$'s function — sampled, not approximated
    const { fluid, configure } = await import('@responsivejs/runtime');
    configure({ breakpoints: [MIN, MAX] });
    const font = fluid(18, 48);
    const pad = fluid(12, 40);
    fluidFont.value = (w) => Number(font.resolve(w));
    fluidPad.value = (w) => Number(pad.resolve(w));
});

/** The ladder everyone writes: three @media steps. */
const STEPS = [
    { upTo: 768, font: 18, pad: 12 },
    { upTo: 1024, font: 28, pad: 24 },
    { upTo: Infinity, font: 40, pad: 36 },
];
const stepAt = (w: number): number => STEPS.find((s) => w < s.upTo)!.font;

// ─── chart geometry (viewBox units; the SVG scales to its container) ───
const W = 560;
const H = 230;
const PAD = { l: 46, r: 18, t: 18, b: 34 };
const x = (w: number): number => PAD.l + ((w - MIN) / (MAX - MIN)) * (W - PAD.l - PAD.r);
const y = (v: number): number => H - PAD.b - ((v - 12) / (48 - 12)) * (H - PAD.t - PAD.b);

const curvePath = computed(() => {
    const pts: string[] = [];
    for (let w = MIN; w <= MAX; w += 20) pts.push(`${pts.length ? 'L' : 'M'} ${x(w).toFixed(1)} ${y(fluidFont.value(w)).toFixed(1)}`);
    return pts.join(' ');
});
const stepPath = computed(() => {
    const d: string[] = [`M ${x(MIN)} ${y(STEPS[0].font)}`];
    for (const s of STEPS) {
        const edge = Math.min(s.upTo, MAX);
        d.push(`L ${x(edge).toFixed(1)} ${y(s.font).toFixed(1)}`);
        if (s.upTo < MAX) {
            const next = STEPS[STEPS.indexOf(s) + 1];
            d.push(`L ${x(edge).toFixed(1)} ${y(next.font).toFixed(1)}`);
        }
    }
    return d.join(' ');
});

const font = computed(() => fluidFont.value(width.value));
const pad = computed(() => fluidPad.value(width.value));
const step = computed(() => stepAt(width.value));
const gap = computed(() => Math.abs(font.value - step.value));

const cardWidth = computed(() => Math.round(((width.value - MIN) / (MAX - MIN)) * 260 + 240));
</script>

<template>
    <div class="plane">
        <div class="chart">
            <svg :viewBox="`0 0 ${W} ${H}`" role="img"
                 aria-label="Font size as a function of viewport width: a breakpoint ladder in steps versus a fluid curve">
                <!-- axes -->
                <line :x1="PAD.l" :y1="H - PAD.b" :x2="W - PAD.r" :y2="H - PAD.b" class="axis" />
                <line :x1="PAD.l" :y1="PAD.t" :x2="PAD.l" :y2="H - PAD.b" class="axis" />
                <text :x="PAD.l - 8" :y="y(48) + 4" class="tick" text-anchor="end">48</text>
                <text :x="PAD.l - 8" :y="y(18) + 4" class="tick" text-anchor="end">18</text>
                <text :x="PAD.l" :y="H - 12" class="tick" text-anchor="start">{{ MIN }}px</text>
                <text :x="W - PAD.r" :y="H - 12" class="tick" text-anchor="end">{{ MAX }}px</text>

                <!-- what you write today -->
                <path :d="stepPath" class="steps" />
                <!-- what you declare with r$ -->
                <path :d="curvePath" class="curve" />

                <!-- the gap between them, at the current width -->
                <line :x1="x(width)" :y1="y(step)" :x2="x(width)" :y2="y(font)" class="gap" />
                <line :x1="x(width)" :y1="PAD.t" :x2="x(width)" :y2="H - PAD.b" class="scrub" />
                <circle :cx="x(width)" :cy="y(step)" r="5.5" class="dot-step" />
                <circle :cx="x(width)" :cy="y(font)" r="6.5" class="dot-curve" />

                <text :x="x(1180)" :y="y(40) + 22" class="label steps-label" text-anchor="middle">@media ladder</text>
                <text :x="x(430)" :y="y(34)" class="label curve-label">fluid(18, 48)</text>
            </svg>

            <label class="scrubber">
                <span class="sr">Viewport width</span>
                <input type="range" :min="MIN" :max="MAX" step="5" :value="width" @input="onInput" />
            </label>

            <p class="numbers">
                at <strong>{{ width }}px</strong> — r$ gives
                <strong class="c">{{ font.toFixed(1) }}px</strong>, the ladder gives
                <strong class="s">{{ step }}px</strong>
                <span v-if="gap > 0.5"> · a <strong>{{ gap.toFixed(1) }}px</strong> difference nobody designed</span>
            </p>
        </div>

        <div class="preview">
            <div class="preview-inner" :style="{ width: `${cardWidth}px` }">
                <article class="specimen" :style="{ fontSize: `${font}px`, padding: `${pad}px` }">
                    <strong>Between your breakpoints</strong>
                    <span>this is what a user actually sees.</span>
                </article>
            </div>
            <p class="caption">the same function, rendered — drag the slider</p>
        </div>
    </div>
</template>

<style scoped>
.plane { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; }

.chart svg { width: 100%; height: auto; display: block; }
.axis { stroke: var(--vp-c-divider); stroke-width: 1; }
.tick { fill: var(--vp-c-text-2); font-size: 13px; font-family: ui-monospace, monospace; }
.label { font-size: 14px; font-family: ui-monospace, monospace; font-weight: 600; }
.steps { fill: none; stroke: var(--vp-c-text-2); stroke-width: 2.5; stroke-dasharray: 6 5; }
.curve { fill: none; stroke: var(--vp-c-brand-1); stroke-width: 4; stroke-linecap: round; }
.gap { stroke: #d97706; stroke-width: 3; }
.scrub { stroke: var(--vp-c-divider); stroke-width: 1; }
.dot-step { fill: var(--vp-c-text-2); }
.dot-curve { fill: var(--vp-c-brand-1); }
.steps-label { fill: var(--vp-c-text-2); }
.curve-label { fill: var(--vp-c-brand-1); }

.scrubber { display: block; margin-top: .5rem; }
.scrubber input { width: 100%; min-height: 24px; accent-color: var(--vp-c-brand-1); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }

.numbers { font-size: .95rem; color: var(--vp-c-text-2); margin: .35rem 0 0; }
.numbers .c { color: var(--vp-c-brand-1); }
.numbers .s { color: var(--vp-c-text-1); }

.preview { border-top: 1px dashed var(--vp-c-divider); padding-top: 1rem; }
/* A fixed box plus containment makes the card a layout leaf: dragging changes
   type, padding and width inside it without reflowing anything on the page. */
.preview-inner { max-width: 100%; height: 16.5rem; overflow: hidden; contain: layout paint; }
.specimen {
    border: 1px solid var(--vp-c-divider);
    border-radius: 10px;
    background: var(--vp-c-bg-alt);
    line-height: 1.25;
    display: grid;
    gap: .3em;
}
.specimen strong { color: var(--vp-c-brand-1); }
.specimen span { font-size: .62em; color: var(--vp-c-text-2); }
.caption { font-size: .8rem; color: var(--vp-c-text-2); margin: .5rem 0 0; }
</style>
