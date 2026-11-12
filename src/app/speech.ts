import { useCallback, useEffect, useRef, useState } from 'react';
import type { RegionalLanguageCode } from '../language';

/**
 * Kode bahasa BCP-47 untuk suara. Hanya Jawa dan Sunda yang punya suara/pengenal
 * ucapan di beberapa browser (Chrome/Android). Bahasa lain dibacakan dengan
 * suara Bahasa Indonesia, yang pelafalannya paling dekat.
 */
export function speechLangFor(code: RegionalLanguageCode): string[] {
    if (code === 'jv') return ['jv-ID', 'id-ID'];
    if (code === 'sun') return ['su-ID', 'id-ID'];
    return ['id-ID'];
}

/** Kode bahasa pertama suara (`id`, `jv`, `su`). Android lama memakai `in` untuk Indonesia. */
function baseLang(lang: string): string {
    const base = lang.replace('_', '-').toLowerCase().split('-')[0];
    return base === 'in' ? 'id' : base;
}

/**
 * Seberapa alami sebuah suara terdengar, dari namanya. Suara neural dan suara jaringan
 * jauh lebih luwes daripada suara "compact" bawaan OS yang terdengar kaku:
 * - Edge: "Microsoft Gadis Online (Natural)", suara neural yang sama dengan Edge TTS
 * - Safari/macOS/iOS: "Damayanti (Enhanced)" / "(Premium)" bila sudah diunduh
 * - Chrome desktop: "Google Bahasa Indonesia"
 */
export function voiceQuality(v: SpeechSynthesisVoice): number {
    const name = v.name;
    let score = 0;
    if (/natural|neural/i.test(name)) score += 60;
    else if (/premium/i.test(name)) score += 50;
    else if (/enhanced|siri/i.test(name)) score += 40;
    else if (/google/i.test(name)) score += 35;
    if (/online/i.test(name)) score += 5;
    if (/compact|espeak/i.test(name)) score -= 40;
    return score;
}

/** Ambang skor suara yang tidak terdengar kaku. */
export const NATURAL_VOICE_SCORE = 35;

/** Suara untuk satu bahasa (mis. `id-ID`), yang paling alami di depan. */
export function rankVoices(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice[] {
    const want = baseLang(lang);
    const region = lang.toLowerCase().split('-')[1];
    const score = (v: SpeechSynthesisVoice) => voiceQuality(v) + (v.lang.replace('_', '-').toLowerCase().split('-')[1] === region ? 5 : 0);
    return voices.filter((v) => baseLang(v.lang) === want).sort((a, b) => score(b) - score(a));
}

/** Semua suara yang cocok untuk bahasa tujuan: suara bahasa daerah dulu, lalu Bahasa Indonesia. */
export function voicesFor(voices: SpeechSynthesisVoice[], code: RegionalLanguageCode): SpeechSynthesisVoice[] {
    const seen = new Set<string>();
    return speechLangFor(code)
        .flatMap((lang) => rankVoices(voices, lang))
        .filter((v) => (seen.has(v.voiceURI) ? false : (seen.add(v.voiceURI), true)));
}

/** Nama suara yang ringkas untuk ditampilkan: "Microsoft Gadis Online (Natural) - Indonesian (Indonesia)" jadi "Gadis Online (Natural)". */
export function voiceName(v: SpeechSynthesisVoice): string {
    return v.name.replace(/^(Microsoft|Apple)\s+/i, '').replace(/\s+-\s+.*$/, '').trim() || v.name;
}

export const ttsAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;

// Chrome memuat daftar suara secara malas; minta sekarang supaya ucapan pertama sudah bisa memilih suara.
if (ttsAvailable) window.speechSynthesis.getVoices();

interface SpeechConfig {
    rate: number;
    /** Suara pilihan pengguna per bahasa suara utama (`id-ID`, `jv-ID`, `su-ID`) → voiceURI. Kosong = otomatis. */
    voices: Record<string, string>;
}

let config: SpeechConfig = { rate: 0.95, voices: {} };

/** Dipanggil App saat preferensi berubah, agar semua tombol "Dengarkan" memakai suara dan kecepatan yang sama. */
export function configureSpeech(patch: Partial<SpeechConfig>) {
    config = { ...config, ...patch };
}

/** Suara yang akan dipakai untuk bahasa tujuan ini: pilihan pengguna bila masih ada, kalau tidak yang paling alami. */
export function pickVoice(voices: SpeechSynthesisVoice[], code: RegionalLanguageCode): SpeechSynthesisVoice | undefined {
    const chosen = config.voices[speechLangFor(code)[0]];
    return (chosen && voices.find((v) => v.voiceURI === chosen)) || voicesFor(voices, code)[0];
}

/** Daftar suara yang ikut diperbarui saat browser selesai memuatnya. */
export function useVoices(): SpeechSynthesisVoice[] {
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => (ttsAvailable ? window.speechSynthesis.getVoices() : []));
    useEffect(() => {
        if (!ttsAvailable) return;
        const synth = window.speechSynthesis;
        const refresh = () => setVoices(synth.getVoices());
        refresh();
        synth.addEventListener?.('voiceschanged', refresh);
        return () => synth.removeEventListener?.('voiceschanged', refresh);
    }, []);
    return voices;
}

export interface SpeakOutcome {
    ok: boolean;
    /** Bahasa suara yang benar-benar dipakai, untuk ditampilkan dengan jujur. */
    voiceLang?: string;
    voiceName?: string;
}

export function speak(text: string, code: RegionalLanguageCode, rate = config.rate): SpeakOutcome {
    if (!ttsAvailable || !text.trim()) return { ok: false };
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    const voice = pickVoice(synth.getVoices(), code);
    if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang.replace('_', '-');
    } else {
        // Belum ada daftar suara (sering terjadi di muatan pertama): biarkan browser memilih.
        utterance.lang = 'id-ID';
    }
    synth.speak(utterance);
    return { ok: true, voiceLang: utterance.lang, voiceName: voice?.name };
}

type Recognizer = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: ((e: any) => void) | null;
    onerror: ((e: any) => void) | null;
    onend: (() => void) | null;
};

function recognizerCtor(): (new () => Recognizer) | undefined {
    if (typeof window === 'undefined') return undefined;
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
}

export const sttAvailable = !!recognizerCtor();

/** Mendengarkan lawan bicara. `transcript` diperbarui selama orang bicara. */
export function useListener() {
    const [listening, setListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState('');
    const rec = useRef<Recognizer | null>(null);

    const stop = useCallback(() => {
        rec.current?.stop();
    }, []);

    const start = useCallback((lang: string) => {
        const Ctor = recognizerCtor();
        if (!Ctor) {
            setError('Browser ini belum bisa mendengarkan suara. Minta lawan bicara mengetik balasannya.');
            return;
        }
        rec.current?.abort();
        const r = new Ctor();
        r.lang = lang;
        r.continuous = false;
        r.interimResults = true;
        r.onresult = (e: any) => {
            const text = Array.from(e.results as ArrayLike<any>)
                .map((x: any) => x[0]?.transcript ?? '')
                .join('');
            setTranscript(text.slice(0, 300));
        };
        r.onerror = (e: any) => {
            const code = e?.error ?? '';
            setError(
                code === 'not-allowed' || code === 'service-not-allowed'
                    ? 'Izin mikrofon ditolak. Izinkan mikrofon di pengaturan browser, atau minta lawan bicara mengetik.'
                    : code === 'no-speech'
                      ? 'Tidak terdengar suara. Coba dekatkan HP ke lawan bicara.'
                      : code === 'language-not-supported'
                        ? 'Bahasa ini belum didukung pengenal suara. Coba pilih Bahasa Indonesia.'
                        : 'Pengenal suara berhenti. Coba lagi.'
            );
            setListening(false);
        };
        r.onend = () => setListening(false);
        rec.current = r;
        setTranscript('');
        setError('');
        try {
            r.start();
            setListening(true);
        } catch {
            setListening(false);
        }
    }, []);

    useEffect(() => () => rec.current?.abort(), []);

    return { listening, transcript, setTranscript, error, start, stop, available: sttAvailable };
}
