import { describe, it, expect } from 'vitest';
import { normalizeSpelling, composeMessage, suggestNext, applySuggestion, understandReply } from '../src/engine/compose';
import { PHRASE_GROUPS } from '../src/engine/phrases';
import { speechLangFor } from '../src/app/speech';

describe('compose engine: fingerspelling -> Indonesian -> regional', () => {
    it('keeps already-correct words untouched', () => {
        const r = normalizeSpelling('SAYA MAKAN NASI');
        expect(r.text).toBe('saya makan nasi');
        expect(r.corrections).toEqual([]);
    });

    it('expands common chat shorthand and records it', () => {
        const r = normalizeSpelling('SY TDK BS');
        expect(r.text).toBe('saya tidak bisa');
        expect(r.corrections.map((c) => c.kind)).toEqual(['shorthand', 'shorthand', 'shorthand']);
    });

    it('splits words spelled without a space', () => {
        const r = normalizeSpelling('SAYAMAKAN');
        expect(r.text).toBe('saya makan');
        expect(r.corrections[0]).toMatchObject({ from: 'sayamakan', to: 'saya makan', kind: 'split' });
    });

    it('fixes a single misread letter only when one candidate is clearly best', () => {
        expect(normalizeSpelling('MINUN').text).toBe('minum');
        // Unknown names stay as spelled.
        expect(normalizeSpelling('BUDI').text).toBe('budi');
    });

    it('translates the normalized sentence into the target language', () => {
        const m = composeMessage('SAYA MAKAN NASI', 'jv', 'ngoko');
        expect(m.indonesian).toBe('Saya makan nasi');
        expect(m.spoken.toLowerCase()).toContain('mangan');
        const id = composeMessage('TERIMA KASIH', 'id', 'ngoko');
        expect(id.spoken).toBe('Terima kasih');
    });

    it('suggests completions and next words', () => {
        expect(suggestNext('SAY')).toContain('saya');
        expect(suggestNext('TERIMA ')).toContain('kasih');
        expect(applySuggestion('SAYA MA', 'makan')).toBe('SAYA MAKAN ');
        expect(applySuggestion('SAYA ', 'mau')).toBe('SAYA MAU ');
    });

    it('explains a regional reply in Indonesian', () => {
        const r = understandReply('Aku mangan sega');
        expect(r.indonesian.toLowerCase()).toContain('makan');
    });

    it('ships everyday phrases for every group and maps speech languages', () => {
        expect(PHRASE_GROUPS.length).toBeGreaterThan(3);
        expect(PHRASE_GROUPS.every((g) => g.phrases.length > 0)).toBe(true);
        expect(speechLangFor('jv')[0]).toBe('jv-ID');
        expect(speechLangFor('min')).toEqual(['id-ID']);
    });
});
