/**
 * In-page flash highlight: scroll the element into view, draw a labeled
 * box over it, fade it out. What "clicking a finding" should do — show
 * you the element WHERE IT IS, without yanking you into another tab.
 */

export function buildHighlightExpression(selector: string, index: number, label: string): string {
    return `(() => {
    const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
    if (!el) return false;
    try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch { /* older engines */ }
    const prev = document.getElementById('__rjs_hl');
    if (prev) prev.remove();
    const r = el.getBoundingClientRect();
    const box = document.createElement('div');
    box.id = '__rjs_hl';
    box.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;transition:opacity .3s;' +
        'border:2px solid #e5484d;background:rgba(229,72,77,.12);border-radius:2px;' +
        'left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.width + 'px;height:' + r.height + 'px;';
    const tag = document.createElement('div');
    tag.textContent = ${JSON.stringify(label)};
    tag.style.cssText = 'position:absolute;left:-2px;' + (r.y > 28 ? 'top:-24px;' : 'top:100%;margin-top:2px;') +
        'background:#e5484d;color:#fff;font:11px/1.6 system-ui,sans-serif;padding:0 6px;border-radius:3px;white-space:nowrap;';
    box.appendChild(tag);
    document.documentElement.appendChild(box);
    setTimeout(() => { box.style.opacity = '0'; setTimeout(() => box.remove(), 350); }, 1800);
    return true;
})()`;
}
