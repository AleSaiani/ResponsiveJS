import { describe, it, expect } from 'vitest';
import { CdpSource, type CdpClient } from '../src/source/cdp.js';

function makeClient(handler?: (method: string, params?: Record<string, unknown>) => unknown) {
    const calls: { method: string; params?: Record<string, unknown> }[] = [];
    const client: CdpClient = {
        async send(method, params) {
            calls.push({ method, params });
            return handler?.(method, params) ?? {};
        },
    };
    return { client, calls };
}

describe('CdpSource', () => {
    it('setViewport sends Emulation.setDeviceMetricsOverride with desktop metrics', async () => {
        const { client, calls } = makeClient();
        const source = new CdpSource(client, { settleMs: 0 });
        await source.setViewport(768, 900);
        const call = calls.find((c) => c.method === 'Emulation.setDeviceMetricsOverride');
        expect(call?.params).toEqual({ width: 768, height: 900, deviceScaleFactor: 1, mobile: false });
    });

    it('measure evaluates the injected collector with returnByValue and awaitPromise', async () => {
        const wire = { width: 768, height: 900, timestamp: 1, elements: [], childRelations: [] };
        const { client, calls } = makeClient((method) =>
            method === 'Runtime.evaluate' ? { result: { value: wire } } : {},
        );
        const source = new CdpSource(client, { settleMs: 0 });
        await source.setViewport(768, 900);
        const snap = await source.measure(['.a']);

        const evalCall = calls.find((c) => c.method === 'Runtime.evaluate');
        expect(evalCall?.params?.returnByValue).toBe(true);
        expect(evalCall?.params?.awaitPromise).toBe(true);
        expect(String(evalCall?.params?.expression)).toContain('querySelectorAll');
        expect(String(evalCall?.params?.expression)).toContain('"width":768'); // explicit, not innerWidth
        expect(snap.width).toBe(768);
        expect(snap.elements instanceof Map).toBe(true);
    });

    it('evaluate throws on exceptionDetails', async () => {
        const { client } = makeClient((method) =>
            method === 'Runtime.evaluate'
                ? { exceptionDetails: { exception: { description: 'ReferenceError: boom' } } }
                : {},
        );
        const source = new CdpSource(client);
        await expect(source.evaluate('boom()')).rejects.toThrow(/ReferenceError: boom/);
    });

    it('open polls readyState until complete', async () => {
        let polls = 0;
        const { client, calls } = makeClient((method, params) => {
            if (method === 'Runtime.evaluate' && String(params?.expression).includes('readyState')) {
                polls++;
                return { result: { value: polls >= 2 ? 'complete' : 'loading' } };
            }
            return {};
        });
        const source = new CdpSource(client);
        await source.open('http://x');
        expect(calls.some((c) => c.method === 'Page.navigate')).toBe(true);
        expect(polls).toBe(2);
    });

    it('open times out with a clear error', async () => {
        const { client } = makeClient((method) =>
            method === 'Runtime.evaluate' ? { result: { value: 'loading' } } : {},
        );
        const source = new CdpSource(client, { loadTimeoutMs: 150 });
        await expect(source.open('http://slow')).rejects.toThrow(/timed out/);
    });
});
