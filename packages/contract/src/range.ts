/**
 * Width-range helpers (inclusive px bounds).
 */

import type { WidthRange } from './types.js';

export function inRange(width: number, range?: WidthRange): boolean {
    if (!range) return true;
    if (range.min !== undefined && width < range.min) return false;
    if (range.max !== undefined && width > range.max) return false;
    return true;
}

export function describeRange(range?: WidthRange): string {
    if (!range || (range.min === undefined && range.max === undefined)) return 'all widths';
    if (range.min !== undefined && range.max !== undefined) return `${range.min}–${range.max}px`;
    if (range.min !== undefined) return `≥${range.min}px`;
    return `≤${range.max}px`;
}
