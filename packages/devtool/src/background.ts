/// <reference types="chrome" />
/**
 * Background service worker — the chrome.debugger proxy. The devtools panel
 * cannot use chrome.debugger directly, so CDP commands hop through here:
 * panel → runtime message → debugger.sendCommand → response.
 *
 * Attach quirk: when ANY frame in the tab belongs to a different extension
 * (password managers inject chrome-extension:// iframes), attach({tabId})
 * fails with "Cannot access a chrome-extension:// URL of different
 * extension". Fallback: attach to the tab's PAGE TARGET directly — same
 * protocol, foreign frames skipped.
 */

interface CdpMessage {
    type: 'cdp.attach' | 'cdp.send' | 'cdp.detach';
    tabId: number;
    method?: string;
    params?: Record<string, unknown>;
}

/** tabId → the debuggee that worked ({tabId} or {targetId}). */
const debuggees = new Map<number, chrome.debugger.Debuggee>();

async function attach(tabId: number): Promise<void> {
    if (debuggees.has(tabId)) return; // already attached (re-entrant panels)
    const direct: chrome.debugger.Debuggee = { tabId };
    try {
        await chrome.debugger.attach(direct, '1.3');
        debuggees.set(tabId, direct);
        return;
    } catch (e) {
        const targets = await chrome.debugger.getTargets();
        const page = targets.find((t) => t.tabId === tabId && t.type === 'page' && !t.attached);
        if (!page) throw e;
        const byTarget: chrome.debugger.Debuggee = { targetId: page.id };
        await chrome.debugger.attach(byTarget, '1.3');
        debuggees.set(tabId, byTarget);
    }
}

async function detach(tabId: number): Promise<void> {
    const debuggee = debuggees.get(tabId);
    debuggees.delete(tabId);
    if (debuggee) await chrome.debugger.detach(debuggee);
}

chrome.runtime.onMessage.addListener((msg: CdpMessage, _sender, sendResponse) => {
    const done = (result?: unknown): void => sendResponse({ ok: true, result });
    const fail = (e: unknown): void => sendResponse({ error: e instanceof Error ? e.message : String(e) });

    if (msg.type === 'cdp.attach') {
        attach(msg.tabId).then(done, fail);
    } else if (msg.type === 'cdp.send') {
        const debuggee = debuggees.get(msg.tabId) ?? { tabId: msg.tabId };
        chrome.debugger.sendCommand(debuggee, msg.method!, msg.params).then(done, fail);
    } else if (msg.type === 'cdp.detach') {
        // Detaching an already-detached target is fine — never an error.
        detach(msg.tabId).then(done, () => done());
    } else {
        return false;
    }
    return true; // keep sendResponse alive for the async reply
});

// If the user clicks Chrome's "Cancel" on the debugger bar, drop our record
// so the next attach starts clean.
chrome.debugger.onDetach.addListener((source) => {
    for (const [tabId, d] of debuggees) {
        if (d.tabId === source.tabId || d.targetId === source.targetId) debuggees.delete(tabId);
    }
});
