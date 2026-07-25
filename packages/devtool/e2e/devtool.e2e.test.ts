/**
 * E2E: the devtool ENGINE against real chromium — the same path the panel
 * runs, with the chrome.debugger hop replaced by a Playwright CDPSession
 * behind the same Messenger seam. Proves the full devtool loop: sweep via
 * CDP emulation → curve inspection → record a contract → the oracle
 * verifies it.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page, type CDPSession } from '@playwright/test';
import { verifyContract } from '@responsivejs/design';
import { makeCdpClient, fullSweep, curveOf, cdpSweep, type Messenger } from '../src/engine.js';
import { buildIframeSweepExpression, type IframeSweepResult } from '../src/iframe-sweep.js';
import { toTrack } from '../src/props.js';
import { curveToSvg } from '../src/curve-svg.js';
import { buildRecordedContract } from '../src/recorder.js';
import { buildLandingFixture, type LandingFixture } from '../../runtime/e2e/fixture.js';

let fixture: LandingFixture;
let browser: Browser;
let page: Page;
let cdp: CDPSession;

beforeAll(async () => {
    fixture = await buildLandingFixture();
    browser = await chromium.launch();
    page = await browser.newPage();
    await page.goto(fixture.url, { waitUntil: 'networkidle' });
    cdp = await page.context().newCDPSession(page);
}, 120_000);

afterAll(async () => {
    await browser?.close();
    await fixture?.close();
});

/** The panel's background hop, played by a real CDPSession. */
function cdpMessenger(): Messenger {
    return {
        send: async (msg) => {
            if (msg.type === 'cdp.send') {
                try {
                    // Playwright types cdp.send by protocol name — the devtool speaks strings.
                    const result = await (cdp as unknown as { send(m: string, p?: unknown): Promise<unknown> }).send(
                        msg.method as string,
                        msg.params,
                    );
                    return { ok: true, result };
                } catch (e) {
                    return { error: e instanceof Error ? e.message : String(e) };
                }
            }
            return { ok: true }; // attach/detach are no-ops over an existing session
        },
    };
}

describe('the devtool engine over real CDP', () => {
    it('sweep → curves → recorded contract → verify: the loop closes', async () => {
        const client = makeCdpClient(cdpMessenger(), 1);
        await client.attach();

        const { store, report } = await fullSweep(client, {
            widths: [400, 900, 1400],
            selectors: ['main', '.hero h1', '.card', '.cta'],
        });

        // the sweep really emulated: three widths measured
        expect(store.widths).toEqual([400, 900, 1400]);
        expect(report.total).toBeGreaterThan(0);

        // curve inspector: the hero headline is fluid — measured f(width) grows
        const curve = curveOf(store, '.hero h1', 'fontSize');
        expect(curve.size).toBe(3);
        const values = [...curve.values()];
        expect(values[2]).toBeGreaterThan(values[0]);

        // it plots
        const svg = curveToSvg(curve);
        expect(svg.points).toHaveLength(3);
        expect(svg.path).toContain('M ');

        // recorder: pin the curve, build the contract, verify against the sweep
        const contract = buildRecordedContract({
            name: 'devtool-recorded',
            widths: store.widths,
            touchMin: 24,
            baselines: [{ selector: '.hero h1', prop: 'fontSize', curve: [...curve.entries()] }],
        });
        const verdict = verifyContract(contract, store);
        expect(verdict.pass).toBe(true);
        expect(verdict.baselines?.[0].pass).toBe(true);

        await client.detach();
    }, 120_000);

    it('the element inspector measures arbitrary extra properties per width', async () => {
        const client = makeCdpClient(cdpMessenger(), 1);
        const { store, extra } = await cdpSweep(client, {
            widths: [400, 1400],
            selectors: ['.cards'],
            extraSelector: '.cards',
            extraProps: ['grid-template-columns', 'padding-left'],
        });
        expect(store.widths).toEqual([400, 1400]);

        // adaptive: 1 column below tablet, 3 above → a DISCRETE track
        const grid = toTrack(extra.get('grid-template-columns')!);
        expect(grid.kind).toBe('discrete');
        if (grid.kind === 'discrete') {
            expect(new Set(grid.values.values()).size).toBe(2); // the regime switch, measured
        }

        // numeric extra property → a plottable curve
        expect(toTrack(extra.get('padding-left')!).kind).toBe('curve');
    }, 120_000);

    it('iframe emulation measures widths with NO debugger at all', async () => {
        // The fallback when a foreign extension blocks chrome.debugger:
        // evaluate the sweep expression exactly like inspectedWindow.eval would.
        const result = (await page.evaluate(
            buildIframeSweepExpression({
                widths: [400, 1400],
                selectors: ['.hero h1', '.cards'],
                extraSelector: '.cards',
                extraProps: ['grid-template-columns'],
            }),
        )) as IframeSweepResult;

        expect(result.error).toBeUndefined();
        expect(result.wires).toHaveLength(2);
        const [narrow, wide] = result.wires as { width: number; elements: [string, { styles: { fontSize: number } }[]][] }[];
        expect(narrow.width).toBe(400);
        expect(wide.width).toBe(1400);

        // the hero's fluid type responds to the IFRAME's width, not the window's
        const fontAt = (w: typeof narrow): number => w.elements.find(([sel]) => sel === '.hero h1')![1][0].styles.fontSize;
        expect(fontAt(wide)).toBeGreaterThan(fontAt(narrow));

        // the adaptive grid switches regime between the two iframe widths
        expect(result.extra!['grid-template-columns']['400']).not.toBe(result.extra!['grid-template-columns']['1400']);

        // the iframe is gone
        expect(await page.evaluate(`document.querySelectorAll('iframe').length`)).toBe(0);
    }, 120_000);
});
