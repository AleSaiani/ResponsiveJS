/// <reference types="chrome" />
/**
 * Persistence — chrome.storage.local. Settings are global (your widths are
 * your widths everywhere); pinned baselines are keyed BY ORIGIN so sites
 * never mix. Panel and sidebar stay in sync through storage.onChanged.
 */

import type { RecordedBaseline } from './recorder.js';

export interface Settings {
    widths: string;
    extraProps: string;
    touchMin: string;
    live: boolean;
    /** Sidebar: measure automatically when the Elements selection changes. */
    autoMeasure: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
    widths: '320,768,1280',
    extraProps: '',
    touchMin: '24',
    live: false,
    autoMeasure: false,
};

export async function loadSettings(): Promise<Settings> {
    const got = await chrome.storage.local.get('settings');
    return { ...DEFAULT_SETTINGS, ...(got.settings as Partial<Settings> | undefined) };
}

export async function saveSettings(partial: Partial<Settings>): Promise<void> {
    const current = await loadSettings();
    await chrome.storage.local.set({ settings: { ...current, ...partial } });
}

const pinsKey = (origin: string): string => `pins:${origin}`;

export async function loadPins(origin: string): Promise<RecordedBaseline[]> {
    const key = pinsKey(origin);
    const got = await chrome.storage.local.get(key);
    return (got[key] as RecordedBaseline[] | undefined) ?? [];
}

export async function savePins(origin: string, pins: RecordedBaseline[]): Promise<void> {
    await chrome.storage.local.set({ [pinsKey(origin)]: pins });
}

/** Re-render hook: fires when ANOTHER page (panel/sidebar) writes pins. */
export function onPinsChanged(origin: string, handler: (pins: RecordedBaseline[]) => void): void {
    chrome.storage.local.onChanged.addListener((changes) => {
        const change = changes[pinsKey(origin)];
        if (change) handler((change.newValue as RecordedBaseline[] | undefined) ?? []);
    });
}
