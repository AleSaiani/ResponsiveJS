<script setup lang="ts">
/**
 * A table that becomes cards at the width where the columns stop fitting —
 * and the honest way to build it.
 *
 * The trap: if you measure the table and then restyle the table, the overflow
 * you measured disappears, the predicate flips back, and the layout oscillates
 * forever. So we measure a PROBE that keeps the table's natural width and is
 * never restyled. The switch is a fact on the DOM; CSS decides what it means.
 */
import { ref, onMounted, onUnmounted, shallowRef } from 'vue';
import DemoFrame from './DemoFrame.vue';

const FRAME = { min: 260, max: 900 };

const probe = ref<HTMLElement | null>(null);
const wrap = ref<HTMLElement | null>(null);
const crowded = ref(false);
const scope = shallowRef<{ dispose(): void } | null>(null);
let observer: MutationObserver | undefined;

const ROWS = [
    { id: 'INV-2051', client: 'Northwind Traders', date: '12 Mar', status: 'Paid', total: '€ 1.240,00' },
    { id: 'INV-2052', client: 'Contoso Ltd', date: '14 Mar', status: 'Overdue', total: '€ 380,50' },
    { id: 'INV-2053', client: 'Fabrikam Industries', date: '19 Mar', status: 'Draft', total: '€ 9.120,00' },
];

onMounted(async () => {
    const { r$ } = await import('@responsivejs/runtime');
    const s = r$.scope();

    // measured on the probe, applied to the wrapper: no feedback loop
    s.add(r$.geometry(probe.value!, { crowded: r$.whenOverflows('x') }));
    // the amount stays readable at every width — a container fluid needs to be
    // told the container's range, or it walks the viewport's instead
    s.add(
        r$(wrap.value!.querySelectorAll<HTMLElement>('.amount'), {
            fontSize: r$.fluid(15, 21, { container: true, from: FRAME.min, to: FRAME.max }),
        }),
    );
    scope.value = s;

    const sync = (): void => {
        const on = probe.value!.hasAttribute('data-crowded');
        crowded.value = on;
        wrap.value!.toggleAttribute('data-crowded', on);
    };
    observer = new MutationObserver(sync);
    observer.observe(probe.value!, { attributes: true, attributeFilter: ['data-crowded'] });
    sync();
});

onUnmounted(() => {
    observer?.disconnect();
    scope.value?.dispose();
});
</script>

<template>
    <div class="t2c">
        <DemoFrame :start="640" :min="FRAME.min" :max="FRAME.max" label="table">
            <!-- the probe: the table's natural width, never restyled, never seen -->
            <div ref="probe" class="probe" aria-hidden="true">
                <span>INV-2053</span><span>Fabrikam Industries</span><span>12 Mar</span><span>Overdue</span><span>€ 9.120,00</span>
            </div>

            <div ref="wrap" class="wrap">
                <table>
                    <thead>
                        <tr><th>Invoice</th><th>Client</th><th>Date</th><th>Status</th><th class="num">Total</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in ROWS" :key="row.id">
                            <td data-label="Invoice"><code>{{ row.id }}</code></td>
                            <td data-label="Client">{{ row.client }}</td>
                            <td data-label="Date">{{ row.date }}</td>
                            <td data-label="Status"><span class="pill" :data-state="row.status.toLowerCase()">{{ row.status }}</span></td>
                            <td data-label="Total" class="num"><span class="amount">{{ row.total }}</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DemoFrame>

        <p class="readout">
            <code>whenOverflows('x')</code> measures
            <strong :class="crowded ? 'on' : 'off'">{{ crowded }}</strong>
            — {{ crowded ? 'five columns no longer fit, so each row is a card' : 'the columns fit, so it stays a table' }}
        </p>
    </div>
</template>

<style scoped>
.t2c { margin-top: .5rem; }

/* laid out for real (so it has a width) but never painted */
/* flex items shrink by default, which would let the row fit by squeezing its
   cells — exactly the measurement we do not want. Pin them to natural width. */
.probe { height: 0; overflow: hidden; display: flex; gap: 1.5rem; white-space: nowrap; font-size: .95rem; }
.probe > span { flex: 0 0 auto; }

table { width: 100%; border-collapse: collapse; font-size: .95rem; }
th, td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid var(--vp-c-divider); white-space: nowrap; }
th { font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; color: var(--vp-c-text-2); }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.pill { border-radius: 999px; padding: .15rem .55rem; font-size: .78rem; background: var(--vp-c-default-soft); }
.pill[data-state='paid'] { color: #0a6c3d; background: #d8f3e3; }
.pill[data-state='overdue'] { color: #8a3a06; background: #ffe6d2; }

/* CSS owns the switch; JS only stated the fact */
.wrap[data-crowded] thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.wrap[data-crowded] tr { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: .1rem .75rem; padding: .55rem 0; border-bottom: 1px solid var(--vp-c-divider); }
.wrap[data-crowded] td { border: 0; padding: .12rem 0; white-space: normal; display: contents; }
.wrap[data-crowded] td::before { content: attr(data-label); color: var(--vp-c-text-2); font-size: .8rem; }
.wrap[data-crowded] .num { text-align: left; }

.readout { font-size: .9rem; color: var(--vp-c-text-2); }
.readout .on { color: #d97706; }
.readout .off { color: #30a46c; }

html.dark .pill[data-state='paid'] { color: #7ee2b0; background: #10331f; }
html.dark .pill[data-state='overdue'] { color: #ffb782; background: #3a1e0a; }
</style>
