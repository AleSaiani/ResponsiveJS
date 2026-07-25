import { describe, it, expect } from 'vitest';
import { makeCdpClient, type Messenger } from '../src/engine.js';

function fakeMessenger(handler: (msg: Record<string, unknown>) => { ok?: boolean; result?: unknown; error?: string }) {
    const sent: Record<string, unknown>[] = [];
    const messenger: Messenger = {
        send: async (msg) => {
            sent.push(msg);
            return handler(msg);
        },
    };
    return { messenger, sent };
}

describe('makeCdpClient', () => {
    it('routes attach/send/detach through the background proxy with the tabId', async () => {
        const { messenger, sent } = fakeMessenger(() => ({ ok: true, result: { value: 1 } }));
        const client = makeCdpClient(messenger, 42);
        await client.attach();
        await client.send('Emulation.setDeviceMetricsOverride', { width: 320 });
        await client.detach();
        expect(sent.map((m) => m.type)).toEqual(['cdp.attach', 'cdp.send', 'cdp.detach']);
        expect(sent.every((m) => m.tabId === 42)).toBe(true);
        expect(sent[1].method).toBe('Emulation.setDeviceMetricsOverride');
    });

    it('background errors become thrown errors (never silent)', async () => {
        const { messenger } = fakeMessenger(() => ({ error: 'Cannot attach: another debugger' }));
        const client = makeCdpClient(messenger, 1);
        await expect(client.attach()).rejects.toThrow(/another debugger/);
    });
});
