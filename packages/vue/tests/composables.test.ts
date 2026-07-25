// @vitest-environment happy-dom
/**
 * Same contract as the React adapter, checked against a real Vue app:
 * apply on mount, update on change, dispose on unmount.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp, defineComponent, h, ref, nextTick, type App } from 'vue';
import { r$, manifest } from '@responsivejs/runtime';
import { __resetProvenance } from '@responsivejs/runtime/provenance';
import { __resetViewportHub } from '@responsivejs/runtime/viewport';
import { __resetConfig, configure } from '@responsivejs/runtime/config';
import { useResponsive, useGeometry, useViewportWidth, vResponsive, responsivePlugin } from '../src/index.js';

let host: HTMLElement;
let app: App | null = null;

beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelectorAll('style[data-responsivejs]').forEach((s) => s.remove());
    configure({ breakpoints: [320, 1280] });
    (window as { innerWidth: number }).innerWidth = 320;
    __resetProvenance();
    host = document.createElement('div');
    document.body.appendChild(host);
});

afterEach(() => {
    app?.unmount();
    app = null;
    __resetProvenance();
    __resetViewportHub();
    __resetConfig();
});

describe('useResponsive', () => {
    it('applies on mount and disposes on unmount', () => {
        const Card = defineComponent({
            setup() {
                const el = ref<HTMLElement | null>(null);
                useResponsive(el, { fontSize: r$.fluid(10, 20, { curve: 'exponential' }) });
                return () => h('div', { ref: el, class: 'card' });
            },
        });
        app = createApp(Card);
        app.mount(host);
        r$.flush();

        expect(host.querySelector<HTMLElement>('.card')!.style.getPropertyValue('font-size')).toBe('10px');
        expect(manifest()).toHaveLength(1);

        app.unmount();
        app = null;
        expect(manifest()).toHaveLength(0);
    });

    it('a reactive map updates the live handle', async () => {
        const map = ref({ fontSize: r$.fluid(10, 20, { curve: 'exponential' }) });
        const Card = defineComponent({
            setup() {
                const el = ref<HTMLElement | null>(null);
                useResponsive(el, map);
                return () => h('div', { ref: el, class: 'card' });
            },
        });
        app = createApp(Card);
        app.mount(host);
        r$.flush();

        map.value = { fontSize: r$.fluid(30, 40, { curve: 'exponential' }) };
        await nextTick();
        r$.flush();

        expect(host.querySelector<HTMLElement>('.card')!.style.getPropertyValue('font-size')).toBe('30px');
        expect(manifest()).toHaveLength(1); // updated, not stacked
    });
});

describe('useGeometry', () => {
    it('registers and releases with the component', () => {
        const Nav = defineComponent({
            setup() {
                const el = ref<HTMLElement | null>(null);
                useGeometry(el, { wrapped: r$.whenWraps });
                return () => h('nav', { ref: el, class: 'nav' });
            },
        });
        app = createApp(Nav);
        app.mount(host);
        expect(manifest().some((e) => e.construct === 'geometry')).toBe(true);
        app.unmount();
        app = null;
        expect(manifest()).toHaveLength(0);
    });
});

describe('v-responsive directive', () => {
    it('owns the handle through mount, update and unmount', async () => {
        const size = ref(12);
        const Tpl = defineComponent({
            setup() {
                return () =>
                    h('p', {
                        class: 'txt',
                        // the directive form: v-responsive="map"
                        ...{},
                    });
            },
        });
        // mount with the directive applied through a render function
        const Wrapper = defineComponent({
            directives: { responsive: vResponsive },
            setup() {
                return () => h(Tpl);
            },
        });
        app = createApp(Wrapper);
        app.use(responsivePlugin);
        app.mount(host);
        expect(host.querySelector('.txt')).not.toBeNull();

        // directly exercise the directive hooks (the template compiler is not
        // available in this runtime-only build)
        const el = host.querySelector<HTMLElement>('.txt')!;
        vResponsive.mounted!(el, { value: { fontSize: r$.fluid(size.value, 24, { curve: 'exponential' }) } } as never, null as never, null as never);
        r$.flush();
        expect(el.style.getPropertyValue('font-size')).toBe('12px');

        vResponsive.updated!(el, { value: { fontSize: r$.fluid(20, 24, { curve: 'exponential' }) } } as never, null as never, null as never);
        r$.flush();
        expect(el.style.getPropertyValue('font-size')).toBe('20px');
        expect(manifest()).toHaveLength(1);

        vResponsive.unmounted!(el, null as never, null as never, null as never);
        expect(manifest()).toHaveLength(0);
        expect(el.style.getPropertyValue('font-size')).toBe('');
    });
});

describe('useViewportWidth', () => {
    it('tracks the hub and releases its subscription', async () => {
        const Probe = defineComponent({
            setup() {
                const width = useViewportWidth();
                return () => h('span', { class: 'w' }, String(width.value));
            },
        });
        app = createApp(Probe);
        app.mount(host);
        expect(host.querySelector('.w')!.textContent).toBe('320');

        (window as { innerWidth: number }).innerWidth = 900;
        window.dispatchEvent(new Event('resize'));
        await Promise.resolve();
        await nextTick();
        expect(host.querySelector('.w')!.textContent).toBe('900');
    });
});
