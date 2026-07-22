/**
 * @responsivejs/core — the shared math of r$.
 *
 * Everything is a function of width: `value = f(width)`. This package is the
 * pure, zero-dependency layer: geometry, curves, statistics, color,
 * typography, aesthetics, and the snapshot data model.
 */

export * from './types.js';
export * from './snapshot.js';

export * as rect from './rect.js';
export * as curve from './curve.js';
export * as stats from './stats.js';
export * as color from './color.js';
export * as typography from './typography.js';
export * as aesthetics from './aesthetics.js';

export type { Rect } from './rect.js';
export type { Curve } from './curve.js';
export type { Viewport, AestheticScore, ScoreInput } from './aesthetics.js';
