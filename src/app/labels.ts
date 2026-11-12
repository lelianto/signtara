import { regionalLanguages, type RegionalLanguageCode } from '../language';

export const SCRIPT_LANG_ATTR: Record<string, string> = {
    JAVANESE: 'jv-Java',
    SUNDANESE: 'su-Sund',
    BALINESE: 'ban-Bali',
};

export function languageMeta(code: RegionalLanguageCode) {
    return regionalLanguages.find((l) => l.code === code) ?? regionalLanguages[0];
}

export function languageLabel(code: RegionalLanguageCode) {
    return code === 'id' ? 'Indonesia' : languageMeta(code).name;
}

function firstWord(label: string | undefined, fallback: string) {
    if (!label) return fallback;
    return label.replace(/\s*\(.*\)\s*$/, '').trim() || fallback;
}

/** Nama ragam tutur sesuai istilah lokal (Ngoko/Krama, Loma/Lemes, Andap/Alus, ...). */
export function registerNames(code: RegionalLanguageCode) {
    const meta = languageMeta(code);
    return {
        casual: firstWord(meta.registerTerms?.casualLabel, 'Akrab'),
        polite: firstWord(meta.registerTerms?.politeLabel, 'Halus'),
        honorific: firstWord(meta.registerTerms?.honorificLabel, 'Hormat'),
    };
}

export const STATUS_LABEL: Record<string, string> = {
    recognized: 'Huruf masuk',
    uncertain: 'Tahan sebentar',
    unknown: 'Mencari pola',
    no_hand: 'Tangan belum terlihat',
    loading: 'Menyiapkan',
    error: 'Perlu perhatian',
};

export function humanizeCameraMessage(raw: string): string {
    const m = raw || '';
    if (/requested device not found|notfound|device not found|no camera/i.test(m))
        return 'Kamera tidak ditemukan. Sambungkan kamera atau pilih perangkat lain di Pengaturan.';
    if (/notallowed|permission|denied|Izin kamera ditolak/i.test(m))
        return 'Izin kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser, lalu coba lagi.';
    if (/notreadable|could not start|in use|trackstart/i.test(m))
        return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu, lalu coba lagi.';
    if (/overconstrained/i.test(m)) return 'Kamera tidak mendukung pengaturan ini. Coba kamera lain.';
    if (/timeout/i.test(m)) return 'Model terlalu lama dimuat. Muat ulang halaman, lalu coba lagi.';
    return m;
}
