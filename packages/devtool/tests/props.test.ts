// @vitest-environment happy-dom
/** Arbitrary-property measurement: expression evaluated like the page will. */
import { describe, it, expect } from 'vitest';
import { buildPropsExpression, toTrack, parsePropList } from '../src/props.js';

const run = <T>(expr: string): T => (0, eval)(expr) as T;

describe('buildPropsExpression', () => {
    it('reads computed values, custom properties included', () => {
        document.body.innerHTML = '<p id="t" style="letter-spacing: 2px; --tok: 7px">x</p>';
        const values = run<Record<string, string>>(buildPropsExpression('#t', ['letter-spacing', '--tok']));
        expect(values['letter-spacing']).toBe('2px');
        expect(values['--tok']).toBe('7px');
    });

    it('missing element → null (never a throw in-page)', () => {
        expect(run(buildPropsExpression('.nope', ['width']))).toBeNull();
    });
});

describe('toTrack', () => {
    it('all-numeric values become a plottable curve', () => {
        const track = toTrack(new Map([[320, '16px'], [1280, '32px']]));
        expect(track.kind).toBe('curve');
        if (track.kind === 'curve') expect([...track.curve]).toEqual([[320, 16], [1280, 32]]);
    });

    it('any non-numeric value keeps the track discrete (adaptive switches)', () => {
        const track = toTrack(new Map([[320, '1fr'], [1280, 'repeat(3, 1fr)']]));
        expect(track.kind).toBe('discrete');
    });

    it('percentages and negatives still count as numeric', () => {
        expect(toTrack(new Map([[320, '-0.5px'], [768, '50%']])).kind).toBe('curve');
    });
});

describe('parsePropList', () => {
    it('splits, trims and drops empties', () => {
        expect(parsePropList(' letter-spacing, --space-m ,, ')).toEqual(['letter-spacing', '--space-m']);
    });
});
