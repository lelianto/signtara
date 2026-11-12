import { describe, expect, it } from 'vitest';
import { configureSpeech, pickVoice, rankVoices, voiceName, voicesFor } from '../src/app/speech';

const v = (name: string, lang: string, localService = true) => ({ name, lang, localService, voiceURI: name, default: false }) as SpeechSynthesisVoice;

const voices = [
    v('Damayanti', 'id-ID'),
    v('Google Bahasa Indonesia', 'id-ID', false),
    v('Microsoft Gadis Online (Natural) - Indonesian (Indonesia)', 'id-ID', false),
    v('Microsoft Siti Online (Natural) - Javanese (Indonesia)', 'jv-ID', false),
    v('eSpeak Indonesian', 'in_ID'),
    v('Samantha', 'en-US'),
];

describe('pemilihan suara', () => {
    it('mendahulukan suara neural, lalu jaringan, lalu suara bawaan yang kaku', () => {
        expect(rankVoices(voices, 'id-ID').map((x) => x.name)).toEqual([
            'Microsoft Gadis Online (Natural) - Indonesian (Indonesia)',
            'Google Bahasa Indonesia',
            'Damayanti',
            'eSpeak Indonesian',
        ]);
    });

    it('bahasa Jawa memakai suara Jawa dulu, lalu jatuh ke Bahasa Indonesia', () => {
        expect(voicesFor(voices, 'jv')[0].name).toContain('Siti');
        expect(voicesFor(voices, 'jv')).toHaveLength(5);
        expect(voicesFor(voices, 'mad')[0].name).toContain('Gadis');
    });

    it('menghormati suara pilihan pengguna dan mengabaikan pilihan yang sudah hilang', () => {
        configureSpeech({ voices: { 'id-ID': 'Damayanti' } });
        expect(pickVoice(voices, 'id')?.name).toBe('Damayanti');
        configureSpeech({ voices: { 'id-ID': 'tidak-ada' } });
        expect(pickVoice(voices, 'id')?.name).toContain('Gadis');
        configureSpeech({ voices: {} });
    });

    it('meringkas nama suara', () => {
        expect(voiceName(voices[2])).toBe('Gadis Online (Natural)');
        expect(voiceName(voices[0])).toBe('Damayanti');
    });
});
