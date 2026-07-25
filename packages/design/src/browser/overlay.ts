/**
 * <rjs-overlay> — the oracle as an in-page badge. Shadow DOM, zero deps,
 * zero styles leaked. Measures the LIVE DOM at the current viewport
 * (analyzeDOM), shows E/W counts, expands to the grouped findings, and
 * outlines the offending element on hover. Re-measures on resize.
 *
 * The class is defined lazily (defineOverlay) so this module stays safe to
 * import in Node/SSR — nothing touches HTMLElement until you call it.
 */

import type { UnifiedReport } from '../analyze/core.js';
import { analyzeDOM } from './analyze-dom.js';

export interface OverlayOptions {
    /** Default: the landmark set. */
    selectors?: string[];
    /** Touch-target minimum (default 24 = WCAG floor). */
    touchMin?: number;
}

const STYLES = `
:host { all: initial; }
.badge { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
  font: 600 13px/1 system-ui, sans-serif; color: #fff; background: #2a9d4a;
  padding: 8px 12px; border-radius: 999px; cursor: pointer; box-shadow: 0 2px 10px rgb(0 0 0 / .25);
  user-select: none; }
.badge.fail { background: #d33; }
.panel { position: fixed; right: 16px; bottom: 56px; z-index: 2147483647; width: 22rem;
  max-height: 60vh; overflow: auto; background: #fff; color: #1a1a1a; border: 1px solid #ddd;
  border-radius: 8px; box-shadow: 0 6px 24px rgb(0 0 0 / .2); font: 13px/1.45 system-ui, sans-serif;
  padding: 10px 12px; }
.panel[hidden] { display: none; }
.rule { font-weight: 700; margin: .5em 0 .2em; }
.item { padding: 2px 4px; border-radius: 4px; cursor: default; }
.item:hover { background: #f3f3f3; }
.item code { font-family: ui-monospace, monospace; font-size: 12px; background: #f3f3f3; padding: 0 3px; }
.sev { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; }
.meta { color: #666; font-size: 11px; margin-top: .6em; }
.hl { position: fixed; z-index: 2147483646; border: 2px solid #d33; pointer-events: none;
  background: rgb(221 51 51 / .08); }
.hl .lbl { position: absolute; left: -2px; background: #d33; color: #fff;
  font: 11px/1.6 system-ui, sans-serif; padding: 0 6px; border-radius: 3px; white-space: nowrap; }
.clean { color: #2a9d4a; font-weight: 600; }
`;

const SEV_COLOR: Record<string, string> = { error: '#d33', warning: '#d90', info: '#28c' };

let defined = false;

/** Register <rjs-overlay> (idempotent; no-op outside a browser). */
export function defineOverlay(): void {
    if (defined || typeof customElements === 'undefined') return;
    defined = true;

    class RjsOverlay extends HTMLElement {
        report: UnifiedReport | null = null;

        private root!: ShadowRoot;
        private badge!: HTMLElement;
        private panel!: HTMLElement;
        private highlight!: HTMLElement;
        private timer: ReturnType<typeof setTimeout> | undefined;
        private readonly onResize = (): void => {
            clearTimeout(this.timer);
            this.timer = setTimeout(() => this.analyze(), 300);
        };

        connectedCallback(): void {
            this.root = this.attachShadow({ mode: 'open' });
            const style = document.createElement('style');
            style.textContent = STYLES;
            this.badge = document.createElement('div');
            this.badge.className = 'badge';
            this.badge.textContent = 'r$ …';
            this.panel = document.createElement('div');
            this.panel.className = 'panel';
            this.panel.hidden = true;
            this.highlight = document.createElement('div');
            this.highlight.className = 'hl';
            this.highlight.hidden = true;
            this.badge.addEventListener('click', () => (this.panel.hidden = !this.panel.hidden));
            this.root.append(style, this.badge, this.panel, this.highlight);
            window.addEventListener('resize', this.onResize);
            this.analyze();
        }

        disconnectedCallback(): void {
            clearTimeout(this.timer);
            window.removeEventListener('resize', this.onResize);
        }

        /** Re-measure the live DOM at the current viewport and re-render. */
        analyze(): UnifiedReport {
            const selectors = (this.getAttribute('selectors') ?? '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            const touchMin = Number(this.getAttribute('touch-min')) || undefined;
            const report = analyzeDOM(selectors.length > 0 ? selectors : undefined, {
                score: false,
                ...(touchMin !== undefined ? { constraints: { touchTarget: { min: touchMin } } } : {}),
            });
            this.report = report;
            this.render(report);
            return report;
        }

        private render(report: UnifiedReport): void {
            const { errors, warnings } = report.summary;
            this.badge.textContent = `r$ ${errors}E ${warnings}W`;
            this.badge.classList.toggle('fail', !report.pass);

            this.panel.replaceChildren();
            if (report.violations.length === 0) {
                const p = document.createElement('div');
                p.className = 'clean';
                p.textContent = 'No violations at this viewport.';
                this.panel.append(p);
            }
            const byRule = new Map<string, typeof report.violations>();
            for (const v of report.violations) {
                (byRule.get(v.rule) ?? byRule.set(v.rule, []).get(v.rule)!).push(v);
            }
            for (const [rule, violations] of byRule) {
                const h = document.createElement('div');
                h.className = 'rule';
                h.textContent = `${rule} (${violations.length})`;
                this.panel.append(h);
                for (const v of violations) {
                    const item = document.createElement('div');
                    item.className = 'item';
                    const dot = document.createElement('span');
                    dot.className = 'sev';
                    dot.style.background = SEV_COLOR[v.severity ?? 'error'];
                    const el = document.createElement('code');
                    el.textContent = v.element ?? v.elements?.join(' + ') ?? '?';
                    item.append(dot, el, document.createTextNode(` — ${v.detail}`));
                    item.addEventListener('mouseenter', () => this.outline(v.element));
                    item.addEventListener('mouseleave', () => (this.highlight.hidden = true));
                    this.panel.append(item);
                }
            }
            const meta = document.createElement('div');
            meta.className = 'meta';
            meta.textContent = `measured live at ${report.widths[0]}px — run \`rjs analyze\` for the full width sweep`;
            this.panel.append(meta);
        }

        /** Outline the live element behind a violation ('.card[2]' → 3rd match).
         *  Scrolls it into view first — a highlight below the fold helps no one —
         *  and labels the box so you know WHAT you are looking at. */
        private outline(element: string | undefined): void {
            if (!element) return;
            const selector = element.replace(/\[\d+\]$/, '');
            const index = Number(/\[(\d+)\]$/.exec(element)?.[1] ?? 0);
            const target = document.querySelectorAll(selector)[index];
            if (!target) return;
            try {
                target.scrollIntoView({ block: 'center', inline: 'nearest' });
            } catch {
                // older engines: highlight in place
            }
            const r = target.getBoundingClientRect();
            Object.assign(this.highlight.style, {
                left: `${r.x}px`,
                top: `${r.y}px`,
                width: `${r.width}px`,
                height: `${r.height}px`,
            });
            this.highlight.replaceChildren();
            const label = document.createElement('div');
            label.className = 'lbl';
            label.textContent = element;
            label.style.top = r.y > 28 ? '-24px' : '100%';
            this.highlight.appendChild(label);
            this.highlight.hidden = false;
        }
    }

    customElements.define('rjs-overlay', RjsOverlay);
}

/** Define (if needed), create and append an <rjs-overlay> to the body. */
export function mountOverlay(opts: OverlayOptions = {}): HTMLElement {
    defineOverlay();
    const el = document.createElement('rjs-overlay');
    if (opts.selectors) el.setAttribute('selectors', opts.selectors.join(','));
    if (opts.touchMin !== undefined) el.setAttribute('touch-min', String(opts.touchMin));
    document.body.appendChild(el);
    return el;
}
