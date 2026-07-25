/**
 * Live re-check — a MutationObserver in the page raises a dirty flag the
 * panel polls; a debounced quick check follows. Our own artifacts (the
 * flash highlight, the r$ overlay) are filtered out or every highlight
 * would trigger a re-measure of itself.
 */

export const WATCH_START_EXPRESSION = `(() => {
    if (window.__rjs_watch) return 'on';
    const ours = (node) => {
        for (let n = node; n; n = n.parentNode) {
            if (n.id === '__rjs_hl' || (n.tagName && n.tagName.toLowerCase() === 'rjs-overlay')) return true;
        }
        return false;
    };
    const relevant = (m) => {
        if (ours(m.target)) return false;
        if (m.type === 'childList') {
            // inserting/removing OUR box mutates its parent: look at the nodes
            const nodes = [...m.addedNodes, ...m.removedNodes];
            return nodes.length === 0 || nodes.some((n) => !ours(n));
        }
        return true;
    };
    const mo = new MutationObserver((mutations) => {
        if (mutations.some(relevant)) window.__rjs_dirty = true;
    });
    mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
    window.__rjs_watch = mo;
    return 'on';
})()`;

/** Read AND clear the dirty flag. */
export const WATCH_POLL_EXPRESSION = `(() => {
    const dirty = !!window.__rjs_dirty;
    window.__rjs_dirty = false;
    return dirty;
})()`;

export const WATCH_STOP_EXPRESSION = `(() => {
    if (window.__rjs_watch) {
        window.__rjs_watch.disconnect();
        delete window.__rjs_watch;
    }
    window.__rjs_dirty = false;
    return 'off';
})()`;
