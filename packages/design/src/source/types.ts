/**
 * MeasurementSource — the driver contract of r$.
 *
 * A source knows how to set a viewport, measure a page, and (optionally)
 * evaluate JS in it. Everything above this seam (sweeping, constraints,
 * scoring, a11y, analyze) is driver-neutral.
 */

import type { ViewportSnapshot } from '@responsivejs/core/types';

export interface MeasurementSource {
    /** 'playwright' | 'cdp' | custom. */
    readonly kind: string;

    /** Navigate and wait for load. Absent on in-page/attached sources. */
    open?(url: string): Promise<void>;

    /** Emulate the viewport and wait for layout to settle. */
    setViewport(width: number, height: number): Promise<void>;

    /** Measure all elements matching the selectors at the current viewport. */
    measure(selectors: string[]): Promise<ViewportSnapshot>;

    /**
     * The eval seam: run a JS expression STRING in the page (the lowest common
     * denominator — CDP accepts only strings). Implementations MUST await a
     * returned promise and return a JSON-serializable value. Absent ⇒ scroll
     * sweeping and axe are unavailable (analyze degrades gracefully).
     */
    evaluate?<T = unknown>(expression: string): Promise<T>;

    close?(): Promise<void>;
}
