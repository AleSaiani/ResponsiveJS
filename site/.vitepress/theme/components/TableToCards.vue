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

const FRAME = { min: 260, max: 1100 };

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
        <DemoFrame :start="720" :min="FRAME.min" :max="FRAME.max" label="table">
            <!-- the probe: the table's natural width, never restyled, never seen -->
            <div ref="probe" class="probe" aria-hidden="true">
                <span>INV-2053</span><span>Fabrikam Industries</span><span>12 Mar</span><span>Overdue</span><span>€ 9.120,00</span>
            </div>

            <div ref="wrap" class="wrap">
                <table>
                    <thead>
                        <tr><th>Invoice</th><th class="client">Client</th><th>Date</th><th>Status</th><th class="num">Total</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in ROWS" :key="row.id">
                            <td data-label="Invoice"><code>{{ row.id }}</code></td>
                            <td data-label="Client" class="client">{{ row.client }}</td>
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

/* The docs theme renders tables as `display: block; width: max-content` so they
   can scroll — which would keep this one at its content width forever. Here the
   whole point is that it fills the panel until it can't. */
.wrap table { display: table; width: 100%; table-layout: auto; border-collapse: collapse; font-size: .95rem; }
th, td { text-align: left; padding: .55rem .65rem; border-bottom: 1px solid var(--vp-c-divider); white-space: nowrap; }
th { font-size: .74rem; text-transform: uppercase; letter-spacing: .05em; color: var(--vp-c-text-2); font-weight: 600; }
tbody tr:last-child td { border-bottom: 0; }
.client { width: 99%; }
.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
.pill { display: inline-block; border-radius: 999px; padding: .15rem .6rem; font-size: .76rem; font-weight: 600; background: var(--vp-c-default-soft); }
.pill[data-state='paid'] { color: #0a6c3d; background: #d8f3e3; }
.pill[data-state='overdue'] { color: #8a3a06; background: #ffe6d2; }

/* ── CSS owns the switch; JS only stated the fact ─────────────────────────
   Restyling the table freely is safe precisely because the measurement lives
   on the probe: nothing here can feed back into it. */
.wrap[data-crowded] table,
.wrap[data-crowded] tbody { display: block; width: 100%; }
.wrap[data-crowded] thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }

.wrap[data-crowded] tr {
    display: grid;
    /* The right-hand track carries both the status pill and the amount, and
       intrinsic sizing settles on the pill — which clips the amount mid-figure.
       An explicit floor makes the money the thing that cannot lose. */
    grid-template-columns: minmax(0, 1fr) minmax(5.75em, max-content);
    grid-template-areas:
        'code   total'
        'client client'
        'date   status';
    gap: .2rem .75rem;
    align-items: center;
    padding: .7rem .85rem;
    margin-bottom: .5rem;
    border: 1px solid var(--vp-c-divider);
    border-radius: 12px;
    background: var(--vp-c-bg);
}
.wrap[data-crowded] tr:last-child { margin-bottom: 0; }
.wrap[data-crowded] td { border: 0; padding: 0; white-space: normal; }
/* the labels are scaffolding for the table; a card reads without them */
.wrap[data-crowded] td[data-label='Invoice'] { grid-area: code; }
/* the amount must never wrap: "€ 1.240,00" split over two lines is the kind of
   detail that makes a card layout look broken */
.wrap[data-crowded] td[data-label='Total'] {
    grid-area: total;
    text-align: right;
    font-size: 1.05em;
    white-space: nowrap;
    /* the track is shared with the status pill; without this the pill wins the
       sizing and the amount is clipped mid-figure */
    min-width: max-content;
}
.wrap[data-crowded] td[data-label='Client'] { grid-area: client; font-weight: 600; font-size: 1.05em; }
.wrap[data-crowded] td[data-label='Date'] { grid-area: date; color: var(--vp-c-text-2); font-size: .85em; }
.wrap[data-crowded] td[data-label='Status'] { grid-area: status; justify-self: end; }
.wrap[data-crowded] .client { width: auto; }

.readout { font-size: .9rem; color: var(--vp-c-text-2); }
.readout .on { color: #d97706; }
.readout .off { color: #30a46c; }

html.dark .pill[data-state='paid'] { color: #7ee2b0; background: #10331f; }
html.dark .pill[data-state='overdue'] { color: #ffb782; background: #3a1e0a; }
</style>
