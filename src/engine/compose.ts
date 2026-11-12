/**
 * Isyara compose engine.
 *
 * Pipeline: ejaan jari (huruf mentah dari kamera) -> kalimat Bahasa Indonesia -> bahasa daerah.
 *
 * Ejaan jari lambat dan rawan salah baca satu huruf, jadi sebelum diterjemahkan
 * teks mentah dinormalisasi secara transparan:
 *  1. singkatan umum (YG -> yang, TDK -> tidak, MKSH -> terima kasih)
 *  2. pemisahan kata yang lupa diberi spasi (SAYAMAKAN -> saya makan)
 *  3. koreksi satu huruf yang tertukar bila ada satu kandidat kosakata yang jelas (MAKAM -> makan)
 * Setiap perubahan dicatat di `corrections` supaya UI bisa menunjukkannya ke pengguna.
 */
import {
    bhasantaraGlossary,
    bhasantaraParallel,
    translateText,
    type AksaraScript,
    type Register,
    type RegionalLanguageCode,
    type SpelledTranslationResult,
} from '../language';

export interface Correction {
    from: string;
    to: string;
    kind: 'shorthand' | 'split' | 'typo';
}

export interface NormalizedSpelling {
    text: string;
    corrections: Correction[];
}

export interface ComposedMessage {
    raw: string;
    indonesian: string;
    corrections: Correction[];
    result: SpelledTranslationResult;
    /** Teks yang dibacakan / ditampilkan ke lawan bicara. */
    spoken: string;
}

/* ------------------------------------------------------------------ */
/* Kosakata & frekuensi                                                */
/* ------------------------------------------------------------------ */

const FUNCTION_WORDS = `saya aku kamu anda dia beliau kami kita mereka ini itu sini sana situ di ke dari dan dengan atau
yang untuk pada adalah ada tidak bukan jangan sudah belum sedang akan sangat lebih paling juga saja lagi mau ingin bisa
tahu harus boleh apa siapa mana kapan bagaimana berapa kenapa mengapa tolong minta maaf terima kasih sama selamat pagi
siang sore malam halo hai iya ya tidak oke baik sehat sakit lapar haus makan minum tidur pergi pulang datang jalan beli
jual bayar harga mahal murah uang rumah sekolah kantor pasar toko toilet kamar mandi dokter obat rumah sakit polisi
bantu tunggu sebentar nanti sekarang besok kemarin hari ini jam waktu nama alamat nomor telepon air nasi teh kopi susu
roti buah sayur ikan ayam daging telur garam gula panas dingin besar kecil banyak sedikit semua satu dua tiga empat lima
enam tujuh delapan sembilan sepuluh bapak ibu kakak adik anak teman orang suka senang sedih marah takut capek lelah
mengerti paham dengar lihat tulis baca bicara isyarat tuli bisu tunawicara tunarungu kiri kanan depan belakang atas bawah
dekat jauh naik turun buka tutup masuk keluar kerja belajar main mandi cuci pakai baju sepatu tas hp kunci mobil motor
bus kereta ojek stasiun bandara terminal hotel restoran warung masjid gereja pura bank apotek klinik puskesmas tolong
buku pena kertas meja kursi pintu jendela lampu listrik ambulans alergi kepala perut gigi demam batuk pusing tersesat
pelan cepat tunggu ulang tanya jawab benar salah paham tulisan pesan kabar`;

const WORD_RE = /^[a-z]+$/;

function buildVocabulary() {
    const freq = new Map<string, number>();
    const bigram = new Map<string, Map<string, number>>();
    const add = (w: string, n = 1) => {
        if (WORD_RE.test(w) && w.length > 1) freq.set(w, (freq.get(w) ?? 0) + n);
    };

    // Kata fungsi & kebutuhan sehari-hari: bobot tinggi supaya menang saat seri.
    for (const w of FUNCTION_WORDS.split(/\s+/)) add(w, 40);

    for (const g of bhasantaraGlossary) {
        for (const w of g.idTerm.toLowerCase().split(/\s+/)) add(w, g.source === 'nusax-auto' ? 1 : 6);
    }

    const seenSentences = new Set<string>();
    for (const p of bhasantaraParallel) {
        const s = p.idText.toLowerCase();
        if (seenSentences.has(s)) continue;
        seenSentences.add(s);
        const words = s.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
        words.forEach((w, i) => {
            add(w, 2);
            const next = words[i + 1];
            if (next && WORD_RE.test(w) && WORD_RE.test(next)) {
                const m = bigram.get(w) ?? new Map<string, number>();
                m.set(next, (m.get(next) ?? 0) + 1);
                bigram.set(w, m);
            }
        });
    }
    return { freq, bigram };
}

const { freq: VOCAB, bigram: BIGRAM } = buildVocabulary();

/** Bigram buatan untuk percakapan sehari-hari; melengkapi korpus yang condong ke ulasan. */
const CONVERSATION_BIGRAMS: Record<string, string[]> = {
    saya: ['mau', 'ingin', 'tidak', 'sudah', 'sakit', 'lapar', 'haus', 'pergi', 'tunawicara'],
    aku: ['mau', 'ingin', 'tidak', 'sudah', 'lapar'],
    mau: ['makan', 'minum', 'pergi', 'pulang', 'beli', 'ke', 'tanya'],
    ingin: ['makan', 'minum', 'pergi', 'pulang', 'beli'],
    terima: ['kasih'],
    selamat: ['pagi', 'siang', 'sore', 'malam', 'datang', 'jalan'],
    apa: ['kabar'],
    tolong: ['bantu', 'saya', 'tunggu', 'tulis'],
    di: ['mana', 'sini', 'sana', 'rumah'],
    ke: ['mana', 'pasar', 'rumah', 'toilet', 'sekolah'],
    rumah: ['sakit', 'saya'],
    berapa: ['harganya', 'harga', 'lama'],
    tidak: ['bisa', 'mau', 'tahu', 'apa', 'mengerti'],
    sama: ['sama'],
};

const SHORTHAND: Record<string, string> = {
    yg: 'yang',
    tdk: 'tidak',
    gak: 'tidak',
    ga: 'tidak',
    nggak: 'tidak',
    engga: 'tidak',
    sy: 'saya',
    aq: 'aku',
    km: 'kamu',
    kmu: 'kamu',
    dmn: 'di mana',
    kmn: 'ke mana',
    mkn: 'makan',
    mnm: 'minum',
    mksh: 'terima kasih',
    makasih: 'terima kasih',
    trims: 'terima kasih',
    tks: 'terima kasih',
    tlg: 'tolong',
    bs: 'bisa',
    sdh: 'sudah',
    udh: 'sudah',
    udah: 'sudah',
    blm: 'belum',
    krn: 'karena',
    dgn: 'dengan',
    utk: 'untuk',
    jg: 'juga',
    lg: 'lagi',
    msh: 'masih',
    gmn: 'bagaimana',
    knp: 'kenapa',
    brp: 'berapa',
    skrg: 'sekarang',
    bsk: 'besok',
    kmrn: 'kemarin',
    pgn: 'ingin',
    pengen: 'ingin',
    tq: 'terima kasih',
    ok: 'oke',
    terimakasih: 'terima kasih',
    dimana: 'di mana',
    kemana: 'ke mana',
    darimana: 'dari mana',
};

const SHORT_OK = new Set(['di', 'ke', 'ya', 'hp', 'ok']);

export function isKnownWord(word: string): boolean {
    return VOCAB.has(word.toLowerCase());
}

function score(word: string): number {
    return VOCAB.get(word) ?? 0;
}

/** Pisahkan token tanpa spasi menjadi kata-kata kosakata (DP, minimal jumlah kata). */
function segment(token: string): string[] | null {
    const n = token.length;
    if (n < 5) return null;
    const best: Array<{ count: number; weight: number; prev: number } | null> = Array(n + 1).fill(null);
    best[0] = { count: 0, weight: 0, prev: -1 };
    for (let end = 1; end <= n; end++) {
        for (let start = Math.max(0, end - 14); start < end; start++) {
            const from = best[start];
            if (!from) continue;
            const piece = token.slice(start, end);
            if (piece.length < 2 || (piece.length === 2 && !SHORT_OK.has(piece))) continue;
            const w = score(piece);
            if (!w) continue;
            const cand = { count: from.count + 1, weight: from.weight + Math.log(1 + w), prev: start };
            const cur = best[end];
            if (!cur || cand.count < cur.count || (cand.count === cur.count && cand.weight > cur.weight)) best[end] = cand;
        }
    }
    const last = best[n];
    if (!last || last.count < 2 || last.count > 5) return null;
    const parts: string[] = [];
    let at = n;
    while (at > 0) {
        const node = best[at]!;
        parts.unshift(token.slice(node.prev, at));
        at = node.prev;
    }
    return parts;
}

/** Jarak edit Damerau (transposisi bertetangga dihitung 1). */
function editDistance(a: string, b: string, cap = 2): number {
    if (Math.abs(a.length - b.length) > cap) return cap + 1;
    const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
    }
    return d[a.length][b.length];
}

const VOCAB_BY_LENGTH = new Map<number, string[]>();
for (const w of VOCAB.keys()) {
    const list = VOCAB_BY_LENGTH.get(w.length) ?? [];
    list.push(w);
    VOCAB_BY_LENGTH.set(w.length, list);
}

/** Koreksi satu huruf hanya bila kandidat terbaik jelas lebih umum dari pesaingnya. */
function correctTypo(token: string): string | null {
    // Kata pendek terlalu mudah tertukar dengan kata sah lain (BUKU/BUKA), jadi tidak dikoreksi.
    if (token.length < 5) return null;
    const candidates: Array<{ word: string; weight: number }> = [];
    for (const len of [token.length - 1, token.length, token.length + 1]) {
        for (const w of VOCAB_BY_LENGTH.get(len) ?? []) {
            if (w[0] !== token[0] && w[1] !== token[1]) continue;
            if (editDistance(token, w, 1) === 1) candidates.push({ word: w, weight: score(w) });
        }
    }
    if (!candidates.length) return null;
    candidates.sort((x, y) => y.weight - x.weight);
    const [top, second] = candidates;
    if (top.weight < 6) return null;
    if (second && second.weight * 2 > top.weight) return null;
    return top.word;
}

export function normalizeSpelling(raw: string): NormalizedSpelling {
    const corrections: Correction[] = [];
    const tokens = raw
        .toLowerCase()
        .replace(/[^a-z\s'-]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
    const out: string[] = [];
    for (const token of tokens) {
        if (SHORTHAND[token]) {
            out.push(SHORTHAND[token]);
            corrections.push({ from: token, to: SHORTHAND[token], kind: 'shorthand' });
            continue;
        }
        if (isKnownWord(token) || token.length < 3) {
            out.push(token);
            continue;
        }
        const parts = segment(token);
        if (parts) {
            out.push(parts.join(' '));
            corrections.push({ from: token, to: parts.join(' '), kind: 'split' });
            continue;
        }
        const fixed = correctTypo(token);
        if (fixed) {
            out.push(fixed);
            corrections.push({ from: token, to: fixed, kind: 'typo' });
            continue;
        }
        out.push(token);
    }
    return { text: out.join(' '), corrections };
}

export function sentenceCase(text: string): string {
    const t = text.trim();
    return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/** Ejaan jari -> Indonesia -> bahasa tujuan. */
export function composeMessage(
    raw: string,
    targetLang: RegionalLanguageCode,
    register: Register,
    script?: AksaraScript,
    options: { normalize?: boolean } = {}
): ComposedMessage {
    const { text, corrections } =
        options.normalize === false ? { text: raw.toLowerCase().replace(/\s+/g, ' ').trim(), corrections: [] } : normalizeSpelling(raw);
    const result = translateText({
        text,
        sourceLang: 'id',
        targetLang,
        register,
        inputMode: 'sign',
        selectedScript: script,
    });
    const indonesian = sentenceCase(text);
    const translated = result.translatedText && result.translatedText !== '—' ? result.translatedText : indonesian;
    return {
        raw,
        indonesian,
        corrections,
        result,
        spoken: targetLang === 'id' ? indonesian : sentenceCase(translated),
    };
}

/** Teks ketik (bahasa apa pun, deteksi otomatis) -> bahasa tujuan. */
export function composeTyped(
    text: string,
    targetLang: RegionalLanguageCode,
    register: Register,
    script?: AksaraScript
): ComposedMessage {
    const result = translateText({ text, sourceLang: 'auto', targetLang, register, inputMode: 'text', selectedScript: script });
    const indonesian = sentenceCase(result.indonesianText && result.indonesianText !== '—' ? result.indonesianText : text);
    const translated = result.translatedText && result.translatedText !== '—' ? result.translatedText : text;
    return { raw: text, indonesian, corrections: [], result, spoken: sentenceCase(translated) };
}

/** Ucapan lawan bicara (bahasa daerah atau Indonesia) -> arti dalam Bahasa Indonesia. */
export function understandReply(text: string): { indonesian: string; sourceName: string; sourceLang: RegionalLanguageCode } {
    const result = translateText({ text, sourceLang: 'auto', targetLang: 'id', inputMode: 'text' });
    const indonesian = result.indonesianText && result.indonesianText !== '—' ? result.indonesianText : text;
    return { indonesian: sentenceCase(indonesian), sourceName: result.detectedSourceLang.name, sourceLang: result.sourceLang };
}

/**
 * Saran untuk mempercepat ejaan: lengkapi kata yang sedang dieja,
 * atau tebak kata berikutnya setelah spasi.
 */
export function suggestNext(raw: string, limit = 6): string[] {
    const lower = raw.toLowerCase();
    const endsWithSpace = /\s$/.test(lower);
    const words = lower.split(/\s+/).filter(Boolean);

    if (!words.length) return ['saya', 'tolong', 'terima kasih', 'maaf', 'halo', 'apa kabar'].slice(0, limit);

    if (endsWithSpace) {
        const prevRaw = words[words.length - 1];
        const prev = SHORTHAND[prevRaw]?.split(' ').pop() ?? prevRaw;
        const curated = CONVERSATION_BIGRAMS[prev] ?? [];
        const corpus = [...(BIGRAM.get(prev) ?? new Map()).entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([w]) => w)
            .filter((w) => w.length > 1);
        return unique([...curated, ...corpus]).slice(0, limit);
    }

    const partial = words[words.length - 1];
    const prev = words[words.length - 2];
    const followers = prev ? new Set([...(CONVERSATION_BIGRAMS[prev] ?? []), ...(BIGRAM.get(prev)?.keys() ?? [])]) : new Set<string>();
    const matches = [...VOCAB.entries()]
        .filter(([w]) => w.startsWith(partial) && w !== partial)
        .map(([w, f]) => ({ w, rank: f + (followers.has(w) ? 1000 : 0) - w.length * 0.1 }))
        .sort((a, b) => b.rank - a.rank)
        .map((x) => x.w);
    const phrases = partial.length >= 2 ? ['terima kasih', 'selamat pagi', 'apa kabar', 'rumah sakit', 'kamar mandi'].filter((p) => p.startsWith(partial)) : [];
    return unique([...phrases, ...matches]).slice(0, limit);
}

/** Terapkan saran ke teks mentah: ganti kata parsial, atau tambahkan setelah spasi. */
export function applySuggestion(raw: string, word: string): string {
    const upper = word.toUpperCase();
    if (!raw.trim()) return `${upper} `;
    if (/\s$/.test(raw)) return `${raw}${upper} `;
    const idx = raw.search(/\S+$/);
    return `${raw.slice(0, idx)}${upper} `;
}

function unique(list: string[]): string[] {
    return [...new Set(list)];
}
