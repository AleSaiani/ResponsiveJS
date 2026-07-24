/**
 * responsive(target, map) — the application layer. One effect per element
 * group resolves values against the viewport (or container) width signal and
 * enqueues style patches; writes are coalesced into one rAF flush per frame.
 * Reads are pull-based (signals), so deferring writes cannot go stale.
 */

import { effect, type Disposer } from './signals.js';
import { viewportWidth, containerWidth } from './viewport.js';
import { configState } from './config.js';
import { isResponsiveValue, type StyleMap, type StyleValue } from './value.js';
import { emitCSS, injectStyle, removeStyle, toKebab, declarationValue } from './static.js';

export interface ResponsiveHandle {
    readonly elements: readonly HTMLElement[];
    /** Replace the style map (disposes and re-creates the effects). */
    update(map: StyleMap): void;
    pause(): void;
    resume(): void;
    /** Remove effects, observers, injected CSS and applied inline styles. */
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

export function applyResponsive(target: Target, map: StyleMap, options: ApplyOptions = {}): ResponsiveHandle {
    const cfg = configState.get();
    const elements = resolveElements(target);
    const styleKey = typeof target === 'string' ? `r$:${target}` : `r$:#${++handleCounter}`;
    let injectedCSS = false;

    let dynamicMap: StyleMap = map;
    const cssFirst = options.cssFirst ?? cfg.useMediaQueries;
    if (cssFirst && typeof target === 'string') {
        const { css, dynamicRest } = emitCSS(target, map);
        if (css.length > 0) {
            injectStyle(css, styleKey);
            injectedCSS = true;
        }
        dynamicMap = dynamicRest;
    }

    let disposers: Disposer[] = [];
    const appliedProps = new Set<string>();
    let paused = false;
    let currentMap = dynamicMap;

    const applyEntry = (el: HTMLElement, prop: string, value: StyleValue, width: number): void => {
        const kebab = toKebab(prop);
        const resolved = isResponsiveValue(value)
            ? value.resolve(width)
            : typeof value === 'function'
              ? value(width)
              : value;
        const unit = configState.get().defaultUnit;
        appliedProps.add(kebab);
        enqueueWrite(el, kebab, declarationValue(resolved, kebab, unit));
        if (configState.get().debug) {
            console.log(`[r$] ${describeElement(el)} ${kebab} @ ${width}px →`, resolved);
        }
    };

    const setup = (): void => {
        for (const el of elements) {
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
                if (!sourceEl) {
                    throw new Error(`r$: fromElement('${String(target)}') matched no element`);
                }
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
                if (container instanceof HTMLElement) container.style.containerType ||= 'inline-size';
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

    return {
        elements,
        update(next: StyleMap) {
            teardown();
            currentMap = next;
            if (injectedCSS) {
                const { css, dynamicRest } = emitCSS(typeof target === 'string' ? target : '', next);
                injectStyle(css, styleKey);
                currentMap = dynamicRest;
            }
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
            if (injectedCSS) removeStyle(styleKey);
            for (const el of elements) {
                for (const prop of appliedProps) el.style.removeProperty(prop);
                writeQueue.delete(el);
            }
        },
    };
}

function describeElement(el: HTMLElement): string {
    return el.id ? `#${el.id}` : el.className ? `.${String(el.className).split(' ')[0]}` : el.tagName.toLowerCase();
}

/** responsive.static(): compile the map to CSS only. Injects in browser, returns the CSS. */
export function staticCSS(selector: string, map: StyleMap): string {
    const { css, dynamicRest } = emitCSS(selector, map);
    const dynamicProps = Object.keys(dynamicRest);
    if (dynamicProps.length > 0) {
        throw new Error(
            `responsive.static(): [${dynamicProps.join(', ')}] cannot be expressed as static CSS. ` +
                'Use responsive() (CSS-first split) or responsive.dynamic() for these.',
        );
    }
    injectStyle(css, `r$:${selector}`);
    return css;
}
