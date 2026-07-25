// @vitest-environment happy-dom
/** SELECTOR_FN is evaluated IN THE PAGE — test it the same way: eval the source. */
import { describe, it, expect } from 'vitest';
import { SELECTOR_FN } from '../src/select-element.js';

const buildSelector = (0, eval)(SELECTOR_FN) as (el: Element | null) => string | null;

describe('SELECTOR_FN', () => {
    it('prefers a unique id', () => {
        document.body.innerHTML = '<div><p id="intro">x</p></div>';
        const selector = buildSelector(document.getElementById('intro'));
        expect(selector).toBe('#intro');
        expect(document.querySelectorAll(selector!)).toHaveLength(1);
    });

    it('disambiguates siblings with nth-of-type and stays unique', () => {
        document.body.innerHTML = '<section><article class="card">a</article><article class="card">b</article></section>';
        const second = document.querySelectorAll('article')[1];
        const selector = buildSelector(second);
        expect(selector).toContain(':nth-of-type(2)');
        expect(document.querySelectorAll(selector!)).toHaveLength(1);
        expect(document.querySelector(selector!)).toBe(second);
    });

    it('walks up until the path is unique', () => {
        document.body.innerHTML = '<div class="a"><span>x</span></div><div class="b"><span>y</span></div>';
        const target = document.querySelector('.b span')!;
        const selector = buildSelector(target);
        expect(document.querySelectorAll(selector!)).toHaveLength(1);
        expect(document.querySelector(selector!)).toBe(target);
    });

    it('null / non-element input → null', () => {
        expect(buildSelector(null)).toBeNull();
    });
});
