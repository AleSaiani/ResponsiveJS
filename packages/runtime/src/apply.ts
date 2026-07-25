/**
 * responsive(target, map) — the application layer. One effect per element
 * group resolves values against the viewport (or container) width signal and
 * enqueues style patches; writes are coalesced into one rAF flush per frame.
 * Reads are pull-based (signals), so deferring writes cannot go stale.
 *
 * Ownership model (2026-07-24 review): every handle owns a UNIQUE stylesheet
 * key; the inline value that existed before the handle's first write to a
 * property is saved and restored on dispose (or when update() drops the
 * property); shared side effects (container-type) are refcounted.
 */

import { effect, type Disposer } from './signals.js';
import { viewportWidth, containerWidth } from './viewport.js';
import { configState } from './config.js';
import { isResponsiveValue, type StyleMap, type StyleValue } from './value.js';
import { emitCSS, injectStyle, removeStyle, toKebab, declarationValue } from './static.js';
import { registerProvenance, describeMap } from './provenance.js';

export interface ResponsiveHandle {
    readonly elements: readonly HTMLElement[];
    /** Replace the style map: dropped properties are restored, the rest re-applies. */
    update(map: StyleMap): void;
    pause(): void;
    resume(): void;
    /** Remove effects, observers, injected CSS — and restore pre-existing inline styles. */
    dispose(): void;
}

// ─── write scheduler (rAF-coalesced) ────────────────────────────────────

const writeQueue = new Map<HTMLElement, Map<string, string>>();
let writeScheduled = false;

const schedule: (cb: () => void) => void =
    typeof requestAnimationFrame === 'function'
        ? (cb) => requestAnimationFrame(() => cb())
        : (cb) => queueMicrotask(cb);

function enqueueWrite(el: HTMLElement, kebabProp: string, value: string): void {
    let props = writeQueue.get(el);
    if (!props) {
        props = new Map();
        writeQueue.set(el, props);
    }
    props.set(kebabProp, value);
    if (!writeScheduled) {
        writeScheduled = true;
        schedule(() => {
            if (writeScheduled) flush();
        });
    }
}

/** Synchronously drain the pending style writes (tests and imperative code). */
export function flush(): void {
    writeScheduled = false;
    for (const [el, props] of writeQueue) {
        for (const [prop, value] of props) {
            el.style.setProperty(prop, value);
        }
    }
    writeQueue.clear();
}

// ─── shared container-type ownership (refcounted) ───────────────────────

const containerTypeRefs = new WeakMap<HTMLElement, number>();

/** Set container-type: inline-size unless the user already declared one.
 *  Refcounted across handles; the last release removes OUR declaration. */
export function acquireContainerType(el: HTMLElement): Disposer {
    const refs = containerTypeRefs.get(el);
    if (refs !== undefined) {
        containerTypeRefs.set(el, refs + 1);
    } else if (el.style.containerType) {
        return () => {}; // user-owned — never touch it
    } else {
        el.style.containerType = 'inline-size';
        containerTypeRefs.set(el, 1);
    }
    let released = false;
    return () => {
        if (released) return;
        released = true;
        const current = containerTypeRefs.get(el);
        if (current === undefined) return;
        if (current <= 1) {
            containerTypeRefs.delete(el);
            el.style.removeProperty('container-type');
        } else {
            containerTypeRefs.set(el, current - 1);
        }
    };
}

// ─── target resolution ──────────────────────────────────────────────────

export type Target = string | Element | Element[] | NodeListOf<Element>;

export function resolveElements(target: Target): HTMLElement[] {
    if (typeof target === 'string') {
        if (typeof document === 'undefined') return [];
        return [...document.querySelectorAll<HTMLElement>(target)];
    }
    if (target instanceof Element) return [target as HTMLElement];
    return [...target] as HTMLElement[];
}

// ─── core application ───────────────────────────────────────────────────

interface ApplyOptions {
    /** false → skip the static-CSS split (responsive.dynamic). */
    cssFirst?: boolean;
}

let handleCounter = 0;

/**
 * fromElement() sources are validated BEFORE anything is written: provenance
 * registration and injected CSS are side effects, and a throw from setup()
 * used to leave both behind with no handle to clean them up.
 */
function assertSourcesResolvable(map: StyleMap): void {
    if (typeof document === 'undefined') return;
    for (const value of Object.values(map)) {
        if (!isResponsiveValue(value) || !value.source) continue;
        const { target } = value.source;
        if (typeof target === 'string' && !document.querySelector(target)) {
            throw new Error(`r$: fromElement('${target}') matched no element`);
        }
    }
}

export function applyResponsive(target: Target, map: StyleMap, options: ApplyOptions = {}): ResponsiveHandle {
    const cfg = configState.get();
    assertSourcesResolvable(map);
    const elements = resolveElements(target);
    // Unique per handle: two r$('.x', …) calls must never share (or clobber)
    // each other's stylesheet. Later injection wins the cascade — documented.
    const styleKey = `r$:#${++handleCounter}${typeof target === 'string' ? `:${target}` : ''}`;
    let injectedCSS = false;

    const splitStatic = (m: StyleMap): StyleMap => {
        if (!(options.cssFirst ?? cfg.useMediaQueries) || typeof target !== 'string') return m;
        const { css, dynamicRest } = emitCSS(target, m);
        if (css.length > 0) {
            injectStyle(css, styleKey);
            injectedCSS = true;
        } else if (injectedCSS) {
            removeStyle(styleKey);
            injectedCSS = false;
        }
        return dynamicRest;
    };

    let fullMap = map;
    let currentMap = splitStatic(map);

    const describeValue = (v: StyleValue): string =>
        isResponsiveValue(v) ? v.kind : typeof v === 'function' ? 'custom' : 'literal';
    let unregister = registerProvenance({
        construct: 'style',
        target: typeof target === 'string' ? target : elements.map(describeElement).join(', '),
        behavior: Object.entries(map).map(([p, v]) => `${p}: ${describeValue(v)}`),
        config: describeMap(map),
    });

    let disposers: Disposer[] = [];
    let paused = false;
    /** Inline value present BEFORE our first write, per element × property. */
    const savedInline = new Map<HTMLElement, Map<string, string>>();

    const applyEntry = (el: HTMLElement, prop: string, value: StyleValue, width: number): void => {
        const kebab = toKebab(prop);
        let saved = savedInline.get(el);
        if (!saved) {
            saved = new Map();
            savedInline.set(el, saved);
        }
        if (!saved.has(kebab)) saved.set(kebab, el.style.getPropertyValue(kebab));

        const resolved = isResponsiveValue(value)
            ? value.resolve(width)
            : typeof value === 'function'
              ? value(width)
              : value;
        // The value's own unit wins: fluid(1, 2, 'rem') must not write px.
        const unit = (isResponsiveValue(value) ? value.unit : undefined) ?? configState.get().defaultUnit;
        enqueueWrite(el, kebab, declarationValue(resolved, kebab, unit));
        if (configState.get().debug) {
            console.log(`[r$] ${describeElement(el)} ${kebab} @ ${width}px →`, resolved);
        }
    };

    const restoreProp = (el: HTMLElement, kebab: string): void => {
        writeQueue.get(el)?.delete(kebab); // cancel our pending write
        const saved = savedInline.get(el)?.get(kebab);
        if (saved) el.style.setProperty(kebab, saved);
        else el.style.removeProperty(kebab);
        savedInline.get(el)?.delete(kebab);
    };

    const setup = (): void => {
        // Static-only container values still need a real container configured:
        // the stylesheet says cqi, but CSS cannot reach the parent — this
        // one-time setup is the JS half of the CSS-first container path.
        const hasContainerValue = Object.values(fullMap).some((v) => isResponsiveValue(v) && v.container && !v.source);

        for (const el of elements) {
            if (hasContainerValue) {
                const container = el.parentElement ?? el;
                if (container instanceof HTMLElement) disposers.push(acquireContainerType(container));
            }

            const entries = Object.entries(currentMap);
            if (entries.length === 0) continue;

            const viewportEntries = entries.filter(([, v]) => !(isResponsiveValue(v) && (v.container || v.source)));
            const containerEntries = entries.filter(([, v]) => isResponsiveValue(v) && v.container && !v.source);
            const sourceEntries = entries.filter(([, v]) => isResponsiveValue(v) && v.source);

            if (viewportEntries.length > 0) {
                const vw = viewportWidth();
                disposers.push(
                    effect(() => {
                        const width = vw.get();
                        if (paused) return;
                        for (const [prop, value] of viewportEntries) applyEntry(el, prop, value, width);
                    }),
                );
            }

            // fromElement(): the driving width is another element's width.
            for (const [prop, value] of sourceEntries) {
                const target = (value as { source: { target: string | Element } }).source.target;
                const sourceEl = typeof target === 'string' ? document.querySelector(target) : target;
                // Vanished after construction (DOM churn, or a re-run after a
                // config change): skip. The loud failure belongs to the
                // construction-time preflight, where the caller can still act.
                if (!sourceEl) continue;
                const { signal, dispose } = containerWidth(sourceEl);
                disposers.push(dispose);
                disposers.push(
                    effect(() => {
                        const width = signal.get();
                        if (paused) return;
                        applyEntry(el, prop, value, width);
                    }),
                );
            }

            if (containerEntries.length > 0) {
                // cqi semantics: the container is the nearest ancestor; fall back
                // to the element itself when it has no parent.
                const container = el.parentElement ?? el;
                const { signal, dispose } = containerWidth(container);
                disposers.push(dispose);
                disposers.push(
                    effect(() => {
                        const width = signal.get();
                        if (paused) return;
                        for (const [prop, value] of containerEntries) applyEntry(el, prop, value, width);
                    }),
                );
            }
        }
    };

    const teardown = (): void => {
        for (const d of disposers) d();
        disposers = [];
    };

    setup();

    // The static half must react to config changes exactly like the JS half:
    // new breakpoints mean new clamps, otherwise the two halves of the same
    // map drift apart (stale CSS + fresh JS).
    let configSettled = false;
    const configWatcher = effect(() => {
        configState.get();
        if (!configSettled) {
            configSettled = true;
            return;
        }
        teardown();
        currentMap = splitStatic(fullMap);
        setup();
    });

    return {
        elements,
        update(next: StyleMap) {
            assertSourcesResolvable(next);
            teardown();
            unregister();
            unregister = registerProvenance({
                construct: 'style',
                target: typeof target === 'string' ? target : elements.map(describeElement).join(', '),
                behavior: Object.entries(next).map(([p, v]) => `${p}: ${describeValue(v)}`),
                config: describeMap(next),
            });
            fullMap = next;
            const nextDynamic = splitStatic(next);
            // Properties we owned that the new map no longer touches: restore.
            const nextKebabs = new Set(Object.keys(next).map(toKebab));
            for (const [el, saved] of savedInline) {
                for (const kebab of [...saved.keys()]) {
                    if (!nextKebabs.has(kebab)) restoreProp(el, kebab);
                }
            }
            currentMap = nextDynamic;
            setup();
        },
        pause() {
            paused = true;
        },
        resume() {
            paused = false;
            // Re-run by tearing down and re-creating (effects re-apply current widths).
            teardown();
            setup();
        },
        dispose() {
            teardown();
            configWatcher();
            unregister();
            if (injectedCSS) removeStyle(styleKey);
            for (const [el, saved] of savedInline) {
                for (const kebab of [...saved.keys()]) restoreProp(el, kebab);
                if (writeQueue.get(el)?.size === 0) writeQueue.delete(el);
            }
            savedInline.clear();
        },
    };
}

function describeElement(el: HTMLElement): string {
    return el.id ? `#${el.id}` : el.className ? `.${String(el.className).split(' ')[0]}` : el.tagName.toLowerCase();
}

export interface StaticHandle {
    /** The compiled stylesheet — what SSR should ship. */
    readonly css: string;
    /** Remove the injected stylesheet. */
    dispose(): void;
}

/** responsive.static(): compile the map to CSS only. Injects in the browser and
 *  returns the CSS plus its disposer — each call owns its OWN stylesheet, so two
 *  static maps for the same selector never clobber each other.
 *  NOTE: container values compile to cqi — with static-only emission YOU must
 *  declare `container-type` on the container (r$() full application does it for you). */
export function staticCSS(selector: string, map: StyleMap): StaticHandle {
    const { css, dynamicRest } = emitCSS(selector, map);
    const dynamicProps = Object.keys(dynamicRest);
    if (dynamicProps.length > 0) {
        throw new Error(
            `responsive.static(): [${dynamicProps.join(', ')}] cannot be expressed as static CSS. ` +
                'Use responsive() (CSS-first split) or responsive.dynamic() for these.',
        );
    }
    const styleKey = `r$:static:#${++handleCounter}:${selector}`;
    injectStyle(css, styleKey);
    let disposed = false;
    return {
        css,
        dispose() {
            if (disposed) return;
            disposed = true;
            removeStyle(styleKey);
        },
    };
}
