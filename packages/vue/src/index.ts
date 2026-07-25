/**
 * @responsivejs/vue — the lifecycle, handled.
 *
 * Composables for setup(), plus a `v-responsive` directive for templates.
 * Both do the same three things r$ asks of a host: apply when the element
 * exists, `update()` when the declaration changes, dispose on unmount.
 */

import {
    onMounted,
    onUnmounted,
    shallowRef,
    watch,
    type Directive,
    type ObjectDirective,
    type Ref,
    type ShallowRef,
} from 'vue';
import {
    r$,
    geometry,
    tokens,
    scope,
    subscribe,
    viewportWidth,
    breakpointSignal,
    config,
    type StyleMap,
    type ResponsiveHandle,
    type GeometryHandle,
    type PredicateInput,
} from '@responsivejs/runtime';

type ElementSource = Ref<Element | null | undefined> | (() => Element | null | undefined);

const resolve = (source: ElementSource): Element | null =>
    (typeof source === 'function' ? source() : source.value) ?? null;

/** Apply a style map to an element ref for the lifetime of the component. */
export function useResponsive(source: ElementSource, map: StyleMap | Ref<StyleMap>): void {
    let handle: ResponsiveHandle | null = null;
    const read = (): StyleMap => ('value' in (map as Ref<StyleMap>) ? (map as Ref<StyleMap>).value : (map as StyleMap));

    onMounted(() => {
        const el = resolve(source);
        if (el) handle = r$(el as HTMLElement, read());
    });
    if ('value' in (map as Ref<StyleMap>)) {
        watch(map as Ref<StyleMap>, (next) => handle?.update(next));
    }
    onUnmounted(() => {
        handle?.dispose();
        handle = null;
    });
}

/** Keep geometry data-attributes in sync on an element ref. */
export function useGeometry(source: ElementSource, states: Record<string, PredicateInput>): void {
    let handle: GeometryHandle | null = null;
    onMounted(() => {
        const el = resolve(source);
        if (el) handle = geometry(el as HTMLElement, states);
    });
    onUnmounted(() => {
        handle?.dispose();
        handle = null;
    });
}

/** Install a token scale for the lifetime of the component. */
export function useTokens(map: Parameters<typeof tokens>[0]): void {
    let handle: ReturnType<typeof tokens> | null = null;
    onMounted(() => {
        handle = tokens(map);
    });
    onUnmounted(() => {
        handle?.dispose();
        handle = null;
    });
}

/** A scope tied to the component: add handles, they all dispose on unmount. */
export function useScope(): ReturnType<typeof scope> {
    const s = scope();
    onUnmounted(() => s.dispose());
    return s;
}

/** The reactive viewport width, SSR-safe (falls back to `config().ssrWidth`). */
export function useViewportWidth(): ShallowRef<number> {
    const width = shallowRef(typeof window === 'undefined' ? config().ssrWidth : viewportWidth().get());
    let stop: (() => void) | undefined;
    onMounted(() => {
        const signal = viewportWidth();
        width.value = signal.get();
        stop = subscribe(signal, () => (width.value = signal.get()));
    });
    onUnmounted(() => stop?.());
    return width;
}

/** Reactive `min-width` match for a named or numeric breakpoint. */
export function useBreakpoint(ref: string | number): ShallowRef<boolean> {
    const matches = shallowRef(false);
    let release: (() => void) | undefined;
    onMounted(() => {
        const { signal, dispose } = breakpointSignal(ref);
        matches.value = signal.get();
        const stop = subscribe(signal, () => (matches.value = signal.get()));
        release = () => {
            stop();
            dispose();
        };
    });
    onUnmounted(() => release?.());
    return matches;
}

/**
 * `v-responsive="{ fontSize: fluid(14, 24) }"` — the template form. The
 * directive owns the handle: updated bindings call `update()`, unmount
 * disposes.
 */
export const vResponsive: ObjectDirective<HTMLElement, StyleMap> = {
    mounted(el, binding) {
        handles.set(el, r$(el, binding.value));
    },
    updated(el, binding) {
        handles.get(el)?.update(binding.value);
    },
    unmounted(el) {
        handles.get(el)?.dispose();
        handles.delete(el);
    },
};

const handles = new WeakMap<HTMLElement, ResponsiveHandle>();

/** `app.use(responsivePlugin)` registers `v-responsive` globally. */
export const responsivePlugin = {
    install(app: { directive(name: string, directive: Directive<HTMLElement, StyleMap>): unknown }): void {
        app.directive('responsive', vResponsive);
    },
};

export type { StyleMap };
