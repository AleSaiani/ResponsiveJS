/// <reference types="chrome" />
/**
 * Background service worker — the chrome.debugger proxy. The devtools panel
 * cannot use chrome.debugger directly, so CDP commands hop through here:
 * panel → runtime message → debugger.sendCommand → response.
 */

interface CdpMessage {
    type: 'cdp.attach' | 'cdp.send' | 'cdp.detach';
    tabId: number;
    method?: string;
    params?: Record<string, unknown>;
}

chrome.runtime.onMessage.addListener((msg: CdpMessage, _sender, sendResponse) => {
    const target = { tabId: msg.tabId };
    const done = (result?: unknown): void => sendResponse({ ok: true, result });
    const fail = (e: unknown): void => sendResponse({ error: e instanceof Error ? e.message : String(e) });

    if (msg.type === 'cdp.attach') {
        chrome.debugger.attach(target, '1.3').then(done, fail);
    } else if (msg.type === 'cdp.send') {
        chrome.debugger.sendCommand(target, msg.method!, msg.params).then(done, fail);
    } else if (msg.type === 'cdp.detach') {
        // Detaching an already-detached target is fine — never an error.
        chrome.debugger.detach(target).then(done, () => done());
    } else {
        return false;
    }
    return true; // keep sendResponse alive for the async reply
});
