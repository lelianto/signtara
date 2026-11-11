import { useEffect, useState } from 'react';
import type { AksaraScript, Register, RegionalLanguageCode } from '../language';
import type { Facing } from '../recognition/useCamera';

export type Theme = 'system' | 'light' | 'dark';

export interface Prefs {
    lang: RegionalLanguageCode;
    register: Register;
    script: AksaraScript;
    theme: Theme;
    /** Tangan turun sebentar setelah mengeja = spasi. */
    autoSpace: boolean;
    showAksara: boolean;
    haptics: boolean;
    speechRate: number;
    /** Suara pilihan per bahasa suara (`id-ID`, `jv-ID`, `su-ID`) → voiceURI. Tidak ada = otomatis pilih yang paling alami. */
    voices: Record<string, string>;
    device: string;
    facing: Facing;
    customPhrases: string[];
}

export const DEFAULT_PREFS: Prefs = {
    lang: 'jv',
    register: 'ngoko',
    script: 'JAVANESE',
    theme: 'system',
    autoSpace: true,
    showAksara: true,
    haptics: true,
    speechRate: 0.95,
    voices: {},
    device: '',
    facing: 'user',
    customPhrases: [],
};

const KEY = 'isyara.prefs.v1';

function read(): Prefs {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return DEFAULT_PREFS;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return DEFAULT_PREFS;
        const merged = { ...DEFAULT_PREFS, ...parsed } as Prefs;
        if (!Array.isArray(merged.customPhrases)) merged.customPhrases = [];
        if (!merged.voices || typeof merged.voices !== 'object' || Array.isArray(merged.voices)) merged.voices = {};
        return merged;
    } catch {
        return DEFAULT_PREFS;
    }
}

/** Preferensi disimpan di browser ini saja (localStorage), bukan di server. */
export function usePrefs() {
    const [prefs, setPrefs] = useState<Prefs>(read);

    useEffect(() => {
        try {
            localStorage.setItem(KEY, JSON.stringify(prefs));
        } catch {
            /* Mode privat / penyimpanan penuh: preferensi berlaku untuk sesi ini saja. */
        }
    }, [prefs]);

    useEffect(() => {
        const root = document.documentElement;
        if (prefs.theme === 'system') root.removeAttribute('data-theme');
        else root.setAttribute('data-theme', prefs.theme);
    }, [prefs.theme]);

    const update = (patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch }));
    return { prefs, update };
}
