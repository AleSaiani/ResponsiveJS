/**
 * Browser-injectable observer script for real-time DOM measurement.
 * Creates ResizeObserver + MutationObserver to re-measure on changes.
 */

/**
 * Build a self-contained script string that, when evaluated in a browser,
 * sets up observers and stores measurements in `window.__pdx_store`.
 */
export function buildObserverScript(selectors: string[]): string {
    const selectorsJSON = JSON.stringify(selectors);

    // The script runs entirely inside the browser — no imports, pure DOM API
    return `
(function() {
    const selectors = ${selectorsJSON};

    // Global store: Map<viewportWidth, measurement[]>
    if (!window.__pdx_store) {
        window.__pdx_store = new Map();
    }

    function measure() {
        const width = window.innerWidth;
        const results = [];

        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(function(el, index) {
                const r = el.getBoundingClientRect();
                const cs = getComputedStyle(el);

                results.push({
                    selector: selector,
                    index: index,
                    rect: { x: r.x, y: r.y, width: r.width, height: r.height },
                    styles: {
                        fontSize: parseFloat(cs.fontSize) || 0,
                        lineHeight: parseFloat(cs.lineHeight) || 0,
                        fontWeight: parseFloat(cs.fontWeight) || 400,
                        gap: parseFloat(cs.gap) || 0,
                        paddingTop: parseFloat(cs.paddingTop) || 0,
                        paddingRight: parseFloat(cs.paddingRight) || 0,
                        paddingBottom: parseFloat(cs.paddingBottom) || 0,
                        paddingLeft: parseFloat(cs.paddingLeft) || 0,
                        marginTop: parseFloat(cs.marginTop) || 0,
                        marginRight: parseFloat(cs.marginRight) || 0,
                        marginBottom: parseFloat(cs.marginBottom) || 0,
                        marginLeft: parseFloat(cs.marginLeft) || 0,
                        borderRadiusTL: parseFloat(cs.borderTopLeftRadius) || 0,
                        borderRadiusTR: parseFloat(cs.borderTopRightRadius) || 0,
                        borderRadiusBR: parseFloat(cs.borderBottomRightRadius) || 0,
                        borderRadiusBL: parseFloat(cs.borderBottomLeftRadius) || 0,
                        minWidth: parseFloat(cs.minWidth) || 0,
                        maxWidth: cs.maxWidth === 'none' ? Infinity : (parseFloat(cs.maxWidth) || 0),
                        minHeight: parseFloat(cs.minHeight) || 0,
                        maxHeight: cs.maxHeight === 'none' ? Infinity : (parseFloat(cs.maxHeight) || 0),
                        zIndex: cs.zIndex === 'auto' ? 0 : (parseInt(cs.zIndex) || 0),
                        opacity: parseFloat(cs.opacity) || 1,
                        outlineWidth: parseFloat(cs.outlineWidth) || 0,
                        outlineOffset: parseFloat(cs.outlineOffset) || 0
                    },
                    computed: {
                        display: cs.display,
                        overflow: cs.overflow,
                        position: cs.position,
                        visibility: cs.visibility,
                        pointerEvents: cs.pointerEvents,
                        backgroundColor: cs.backgroundColor,
                        color: cs.color,
                        boxSizing: cs.boxSizing,
                        textAlign: cs.textAlign,
                        whiteSpace: cs.whiteSpace,
                        cursor: cs.cursor
                    }
                });
            });
        }

        window.__pdx_store.set(width, {
            width: width,
            height: window.innerHeight,
            measurements: results,
            timestamp: Date.now()
        });
    }

    // Cleanup previous observers if re-injected
    if (window.__pdx_resizeObserver) {
        window.__pdx_resizeObserver.disconnect();
    }
    if (window.__pdx_mutationObserver) {
        window.__pdx_mutationObserver.disconnect();
    }

    // ResizeObserver on documentElement to detect viewport resize
    window.__pdx_resizeObserver = new ResizeObserver(function() {
        measure();
    });
    window.__pdx_resizeObserver.observe(document.documentElement);

    // MutationObserver on body to detect DOM changes
    window.__pdx_mutationObserver = new MutationObserver(function() {
        measure();
    });
    window.__pdx_mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
    });

    // Measure immediately on injection
    measure();
})();
`;
}
