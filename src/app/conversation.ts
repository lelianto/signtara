import type { AksaraScript, RegionalLanguageCode } from '../language';
import type { Correction } from '../engine/compose';

interface Base {
    id: string;
    at: number;
}

/** Pesan dari pengguna isyarat: apa yang diucapkan ke lawan bicara. */
export interface MyMessage extends Base {
    who: 'me';
    via: 'sign' | 'type' | 'phrase';
    spoken: string;
    indonesian: string;
    lang: RegionalLanguageCode;
    aksara: string | null;
    script?: AksaraScript;
    untranslated: string[];
    corrections: Correction[];
}

/** Balasan lawan bicara (dari mikrofon atau diketik). */
export interface TheirMessage extends Base {
    who: 'them';
    via: 'voice' | 'type';
    heard: string;
    meaning: string;
    sourceName: string;
    sameAsMeaning: boolean;
}

export type Message = MyMessage | TheirMessage;

export function newId() {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}
