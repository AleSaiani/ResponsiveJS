/**
 * A unique CSS selector for the element picked in the Elements panel ($0).
 * SELECTOR_FN is a self-contained function SOURCE (evaluated in the page,
 * like the collector) so it is unit-testable outside the extension.
 */

export const SELECTOR_FN = `(el) => {
    if (!el || el.nodeType !== 1) return null;
    const esc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_-]/g, '\\\\$&'));
    const part = (node) => {
        if (node.id) return '#' + esc(node.id);
        let s = node.tagName.toLowerCase();
        for (const c of [...node.classList].slice(0, 2)) s += '.' + esc(c);
        const parent = node.parentElement;
        if (parent) {
            const same = [...parent.children].filter((x) => x.tagName === node.tagName);
            if (same.length > 1) s += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
        }
        return s;
    };
    const path = [];
    let node = el;
    while (node && node.tagName !== 'BODY' && node.tagName !== 'HTML') {
        path.unshift(part(node));
        const joined = path.join(' > ');
        if (document.querySelectorAll(joined).length === 1) return joined;
        node = node.parentElement;
    }
    return path.length > 0 ? path.join(' > ') : el.tagName.toLowerCase();
}`;

/** Expression for inspectedWindow.eval — $0 is the devtools selection. */
export const SELECTED_ELEMENT_EXPRESSION = `(${SELECTOR_FN})(typeof $0 !== 'undefined' ? $0 : null)`;
