/**
 * Playwright adapter for MeasurementSource. Import is type-only: Playwright
 * stays an optional peer — the caller hands in the Page.
 */

import type { Page } from '@playwright/test';
import type { ViewportSnapshot } from '@responsivejs/core/types';
import type { MeasurementSource } from './types.js';
import { measure } from '../driver/measurer.js';

export interface PlaywrightSourceOptions {
    /** Settle delay after viewport changes (CSS transitions, container queries). */
    settleMs?: number;
}

export class PlaywrightSource implements MeasurementSource {
    readonly kind = 'playwright';
    private readonly settleMs: number;

    constructor(
        private readonly page: Page,
        opts: PlaywrightSourceOptions = {},
    ) {
        this.settleMs = opts.settleMs ?? 50;
    }

    async open(url: string): Promise<void> {
        await this.page.goto(url, { waitUntil: 'networkidle' });
    }

    async setViewport(width: number, height: number): Promise<void> {
        await this.page.setViewportSize({ width, height });
        await this.page.waitForTimeout(this.settleMs);
    }

    measure(selectors: string[]): Promise<ViewportSnapshot> {
        return measure(this.page, selectors);
    }

    evaluate<T = unknown>(expression: string): Promise<T> {
        return this.page.evaluate(expression) as Promise<T>;
    }

    async screenshot(): Promise<Uint8Array> {
        return new Uint8Array(await this.page.screenshot({ type: 'png' }));
    }
}
