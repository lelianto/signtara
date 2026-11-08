import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
    Hand,
    Languages,
    BookOpen,
    Search,
    Settings,
    ArrowUpRight,
    ArrowRightLeft,
    Camera,
    CameraOff,
    Keyboard,
    ShieldCheck,
    Flame,
    Check,
    Volume2,
    Copy,
    Mic,
    Sparkles,
    Eraser,
    Info,
    Trash2,
} from 'lucide-react';
import { useCamera } from './recognition/useCamera';
import { CameraHelp } from './components/CameraHelp';
import { BhasantaraAksaraGuide } from './components/BhasantaraAksaraGuide';
import {
    concepts,
    javanese,
    indonesian,
    regionalLanguages,
    bhasantaraGlossary,
    bhasantaraParallel,
    NUSAX_ATTRIBUTION,
    translateText,
    suggestWords,
    speakText,
    transliterateToAksara,
    type Register,
    type RegionalLanguageCode,
    type AksaraScript,
    type TranslationInputMode,
} from './language';
import { readProgress, award, emptyProgress } from './storage/progress';
import './style.css';
import './premium.css';

/* ------------------------------------------------------------------ */
/* Konstanta                                                           */
/* ------------------------------------------------------------------ */

type Page = 'Translate' | 'Learn' | 'Dictionary' | 'Settings';
type DictTab = 'alphabet' | 'words' | 'sentences' | 'aksara';
type Tone = 'ok' | 'warn' | 'err' | 'neutral';

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Isi contoh kalimat dipertahankan dari versi asli. Validasi bahasa ditangani terpisah (lihat Prompt B).
const QUICK_TEXT_EXAMPLES: Record<RegionalLanguageCode | 'auto', string[]> = {
    auto: ['Saya makan nasi', 'Bapak makan nasi', 'Aku mangan sega', 'Abdi hoyong nginum cai', 'Ambo pai ka pasa'],
    id: ['Saya ingin pergi ke pasar', 'Bapak makan nasi', 'Ibu sedang tidur', 'Terima kasih banyak', 'Rumahku dekat pasar'],
    jv: ['Aku mangan sega', 'Kula badhe kesah', 'Matur nuwun', 'Sugeng enjang', 'Piye kabare?'],
    sun: ['Abdi hoyong nginum cai', 'Kuring dahar sangu', 'Hatur nuhun', 'Sampurasun', 'Kumaha damang?'],
    ban: ['Tiang madaar nasi', 'Titiang meled nginem toya', 'Matur suksma', 'Punapi gatra?'],
    mad: ["Engko' terro ngakan nase'", 'Mator sakalangkong', 'Beremma kabharra?', 'Salamet lagghu'],
    bbc: ['Au mangan indahan', 'Au lao tu onan', 'Mauliate godang', 'Horas'],
    min: ['Ambo pai ka pasa', 'Awak makan nasi', 'Tarimo kasih', 'Baa kaba?'],
    bug: ["Iya' manre inanre", 'Kurru sumange', 'Aga kareba?', 'Salama ele'],
    ace: ['Lôn pajoh bu', 'Terimong geunaseh', 'Peue haba?', 'Saleum teuka'],
    bjn: ['Ulun handak guring', 'Unda makan nasi', 'Tarima kasih', 'Kayapa habar?'],
    nij: ['Aku handak mihup danum', 'Tarima kasih hai', 'Narai kabar pahari', 'Salamat hanjewu'],
};

const PAGE_META: Record<Page, { title: string; subtitle: string }> = {
    Translate: { title: 'Dari tangan, jadi makna.', subtitle: 'Ejaan jari BISINDO → Bahasa Indonesia → bahasa daerah & aksara' },
    Learn: { title: 'Sedikit setiap hari.', subtitle: 'Latih alfabet BISINDO dengan kamera. Progres tersimpan di perangkat ini.' },
    Dictionary: { title: 'Temukan sebuah makna.', subtitle: 'Alfabet BISINDO, padanan kosakata, kalimat contoh, dan aksara Nusantara.' },
    Settings: { title: 'Nyaman dengan caramu.', subtitle: 'Kamera, data pribadi, dan transparansi sumber.' },
};

const NAV: Array<[Page, typeof Hand, string]> = [
    ['Translate', Languages, 'Terjemahkan'],
    ['Learn', BookOpen, 'Belajar'],
    ['Dictionary', Search, 'Kamus'],
    ['Settings', Settings, 'Pengaturan'],
];

const STATUS_LABEL: Record<string, string> = {
    recognized: 'Huruf dikenali',
    uncertain: 'Tahan lebih stabil',
    unknown: 'Mencari pola',
    no_hand: 'Tangan belum terdeteksi',
    loading: 'Memuat model',
    error: 'Perlu perhatian',
};

const STATUS_TONE: Record<string, Tone> = {
    recognized: 'ok',
    uncertain: 'warn',
    unknown: 'neutral',
    no_hand: 'neutral',
    loading: 'neutral',
    error: 'err',
};

const SOURCE_METHOD_LABEL: Record<string, string> = {
    parallel: 'Cocok dengan kalimat contoh',
    glossary: 'Padanan kamus',
    pivot: 'Kata per kata lewat Bahasa Indonesia',
    letter: 'Ejaan huruf',
    passthrough: 'Belum diterjemahkan',
};

const SCRIPT_LANG_ATTR: Record<string, string> = {
    JAVANESE: 'jv-Java',
    SUNDANESE: 'su-Sund',
    BALINESE: 'ban-Bali',
};

/* ------------------------------------------------------------------ */
/* Helper                                                              */
/* ------------------------------------------------------------------ */

function humanizeCameraMessage(raw: string): string {
    const m = raw || '';
    if (/la caméra est éteinte/i.test(m)) return 'Kamera belum dinyalakan.';
    if (/requested device not found|notfound|device not found|no camera/i.test(m))
        return 'Kamera tidak ditemukan. Sambungkan webcam atau pilih perangkat lain, lalu coba lagi.';
    if (/notallowed|permission|denied/i.test(m))
        return 'Izin kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser, lalu coba lagi.';
    if (/notreadable|could not start|in use|trackstart/i.test(m))
        return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut, lalu coba lagi.';
    if (/overconstrained/i.test(m)) return 'Kamera tidak mendukung pengaturan yang diminta. Coba pilih kamera lain.';
    if (/timeout/i.test(m)) return 'Model terlalu lama dimuat. Muat ulang halaman, lalu coba lagi.';
    if (/worker/i.test(m)) return 'Mesin pengenal berhenti. Nyalakan kamera kembali.';
    return m;
}

function splitRegisterLabel(label: string | undefined, fallbackName: string, fallbackHint: string) {
    if (!label) return { name: fallbackName, hint: fallbackHint };
    const match = label.match(/^(.*?)\s*\((.*)\)\s*$/);
    return match ? { name: match[1], hint: match[2] } : { name: label, hint: '' };
}

function ConfidenceRing({ value }: { value: number }) {
    const r = 30;
    const c = 2 * Math.PI * r;
    const v = Math.max(0, Math.min(1, value));
    return (
        <svg className="ix-ring" viewBox="0 0 72 72" aria-hidden="true">
            <circle cx="36" cy="36" r={r} className="ix-ring-track" />
            <circle cx="36" cy="36" r={r} className="ix-ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
        </svg>
    );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

function App() {
    const [page, setPage] = useState<Page>('Translate');
    const [inputMode, setInputMode] = useState<TranslationInputMode>('sign');
    const [sourceLang, setSourceLang] = useState<RegionalLanguageCode | 'auto'>('auto');
    const [mode, setMode] = useState<'alphabet' | 'vocabulary'>('alphabet');
    const [register, setRegister] = useState<Register>('ngoko');
    const [language, setLanguage] = useState<RegionalLanguageCode>('jv');
    const [aksaraScript, setAksaraScript] = useState<AksaraScript>('JAVANESE');
    const [dictLangFilter, setDictLangFilter] = useState<RegionalLanguageCode | 'all'>('all');
    const [dictTab, setDictTab] = useState<DictTab>('alphabet');
    const [dictLimit, setDictLimit] = useState(24);
    const [device, setDevice] = useState('');
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [text, setText] = useState('');
    const [query, setQuery] = useState('');
    const [progress, setProgress] = useState(emptyProgress);
    const [target, setTarget] = useState('A');
    const [feedback, setFeedback] = useState('');
    const [storageError, setStorageError] = useState('');
    const [copied, setCopied] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [referenceHands, setReferenceHands] = useState<Record<string, number>>({});
    const [weakLetters, setWeakLetters] = useState<string[]>([]);

    const recognitionRef = useRef<any>(null);
    const inputModeRef = useRef<TranslationInputMode>(inputMode);
    inputModeRef.current = inputMode;

    /* ---------- data referensi ---------- */
    useEffect(() => {
        fetch('/ref/provenance.json')
            .then((r) => r.json())
            .then((p) =>
                setReferenceHands(
                    Object.fromEntries(
                        Object.entries(p.entries as Record<string, { expectedHands: number }>).map(([l, e]) => [l, e.expectedHands])
                    )
                )
            )
            .catch(() => { });
        fetch('/models/twohand-v1/evaluation.json')
            .then((r) => r.json())
            .then((p) =>
                setWeakLetters(
                    p.perClass
                        .filter((c: { correct: number; total: number }) => c.correct < c.total)
                        .map((c: { label: string }) => c.label)
                )
            )
            .catch(() => { });
    }, []);

    /* ---------- input suara ---------- */
    useEffect(() => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) return;
        const rec = new SR();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = 'id-ID';
        rec.onresult = (ev: any) => {
            const tr = Array.from(ev.results).map((r: any) => r[0]?.transcript || '').join('');
            setText(inputModeRef.current === 'sign' ? tr.toUpperCase().slice(0, 200) : tr.slice(0, 200));
        };
        rec.onerror = () => setIsListening(false);
        rec.onend = () => setIsListening(false);
        recognitionRef.current = rec;
    }, []);

    const toggleVoiceInput = () => {
        if (!recognitionRef.current) return;
        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch {
                setIsListening(false);
            }
        }
    };

    /* ---------- kamera ---------- */
    const camera = useCamera((letter, source) => {
        setText((t) => (t + letter).slice(-200));
        if (page === 'Learn') {
            if (letter === target) {
                setFeedback(
                    source === 'personal'
                        ? `Sesuai contoh pribadi ${letter}. Kebenaran isyarat belum diverifikasi pengajar.`
                        : `Model mengenali huruf ${letter}.`
                );
                award(letter)
                    .then(setProgress)
                    .catch(() => setStorageError('Penyimpanan lokal tidak tersedia.'));
            } else {
                setFeedback(`Model membaca ${letter}. Coba lagi untuk ${target}.`);
            }
        }
    });

    // Kamera TIDAK lagi menyala otomatis: pengguna menekan "Nyalakan kamera".
    useEffect(() => {
        if (inputMode === 'text') camera.stop();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputMode]);

    useEffect(() => {
        readProgress()
            .then(setProgress)
            .catch(() => setStorageError('Progres tidak dapat dibaca. Periksa penyimpanan browser.'));
        navigator.mediaDevices
            ?.enumerateDevices()
            .then((d) => setDevices(d.filter((x) => x.kind === 'videoinput')))
            .catch(() => { });
    }, [camera.running]);

    // Pintasan keyboard di mode isyarat: Spasi = spasi, Backspace = hapus huruf.
    useEffect(() => {
        if (page !== 'Translate' || inputMode !== 'sign') return;
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement | null;
            if (el && (/^(INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY|A)$/.test(el.tagName) || el.isContentEditable)) return;
            if (e.key === ' ') {
                e.preventDefault();
                setText((t) => (t && !t.endsWith(' ') ? `${t} ` : t));
            } else if (e.key === 'Backspace') {
                e.preventDefault();
                setText((t) => t.slice(0, -1));
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [page, inputMode]);

    const navigate = (p: Page) => {
        camera.stop();
        setPage(p);
        setFeedback('');
        window.scrollTo({ top: 0 });
    };

    const changeDevice = (id: string) => {
        setDevice(id);
        if (camera.running) camera.start(id);
    };

    const changeMode = (m: 'alphabet' | 'vocabulary') => {
        camera.stop();
        setMode(m);
    };

    const copy = (key: string, value: string | null | undefined) => {
        if (!value || value === '—') return;
        navigator.clipboard?.writeText(value).catch(() => { });
        setCopied(key);
        window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    };

    /* ---------- terjemahan ---------- */
    const activeLangMeta = regionalLanguages.find((l) => l.code === language) || regionalLanguages[0];
    const regionalOptions = regionalLanguages.filter((l) => l.code !== 'id');

    const spelledResult = translateText({
        text,
        sourceLang: inputMode === 'sign' ? 'id' : sourceLang,
        targetLang: language,
        register,
        inputMode,
        fallbackConceptId: inputMode === 'sign' ? camera.result.conceptId : null,
        selectedScript: aksaraScript,
    });

    const exampleResult = useMemo(
        () =>
            translateText({
                text: 'terima kasih',
                sourceLang: 'id',
                targetLang: language,
                register,
                inputMode: 'text',
                selectedScript: aksaraScript,
            }),
        [language, register, aksaraScript]
    );

    const hasText = text.trim().length > 0;
    const hasConcept = inputMode === 'sign' && !!camera.result.conceptId;
    const hasOutput = hasText || hasConcept;

    const idOutput = hasText
        ? spelledResult.indonesianText
        : hasConcept
            ? indonesian.resolve(camera.result.conceptId!, register)
            : '—';

    const regOutput = hasText
        ? spelledResult.translatedText
        : hasConcept
            ? language === 'jv'
                ? javanese.resolve(camera.result.conceptId!, register)
                : indonesian.resolve(camera.result.conceptId!, register)
            : '—';

    const casualTerm = splitRegisterLabel(activeLangMeta.registerTerms?.casualLabel, 'Akrab', 'Sehari-hari');
    const politeTerm = splitRegisterLabel(activeLangMeta.registerTerms?.politeLabel, 'Halus', 'Sopan');
    const honorificTerm = splitRegisterLabel(activeLangMeta.registerTerms?.honorificLabel, 'Hormat', '');
    const activeRegisterName = register === 'ngoko' ? casualTerm.name : politeTerm.name;
    const showRegister = language !== 'id' && activeLangMeta.hasSpeechLevels;

    const showPivot = language !== 'id' || spelledResult.sourceLang !== 'id';
    const showMain = language !== 'id' || inputMode === 'text';
    const pivotLabel =
        inputMode === 'text' && spelledResult.sourceLang !== 'id'
            ? `Poros Bahasa Indonesia · ${spelledResult.detectedSourceLang.name} → Indonesia`
            : 'Bahasa Indonesia';
    const outLabel =
        language === 'id'
            ? 'TERJEMAHAN BAHASA INDONESIA'
            : `BAHASA ${activeLangMeta.name.toUpperCase()}${showRegister ? ` · ${register.toUpperCase()}` : ''}`;

    const applySuggestedWord = (word: string) => {
        const trimmed = text.trimEnd();
        const parts = trimmed ? trimmed.split(/\s+/) : [];
        if (!parts.length) {
            setText(word);
            return;
        }
        const last = parts[parts.length - 1].toUpperCase();
        if (word.startsWith(last) && word !== last) {
            parts[parts.length - 1] = word;
            setText(parts.join(' '));
        } else {
            setText(`${trimmed} ${word}`.trim());
        }
    };

    const selectLanguage = (c: RegionalLanguageCode) => {
        setLanguage(c);
        const m = regionalLanguages.find((x) => x.code === c);
        if (m?.defaultScript) setAksaraScript(m.defaultScript);
    };

    const swapLanguages = () => {
        const resolvedSrc = sourceLang === 'auto' ? spelledResult.sourceLang : sourceLang;
        if (resolvedSrc === language) return;
        if (hasText && spelledResult.translatedText && spelledResult.translatedText !== '—') {
            setText(spelledResult.translatedText);
        }
        setSourceLang(language);
        selectLanguage(resolvedSrc);
    };

    /* ---------- status kamera ---------- */
    const cameraError = camera.result.status === 'error';
    const friendlyMessage = humanizeCameraMessage(camera.message);
    const statusLabel =
        !camera.running && !camera.busy
            ? cameraError
                ? 'Perlu perhatian'
                : 'Menunggu kamera'
            : STATUS_LABEL[camera.result.status] ?? '';
    const statusTone: Tone = !camera.running && !camera.busy && !cameraError ? 'neutral' : STATUS_TONE[camera.result.status] ?? 'neutral';
    const handCount = camera.running ? camera.trackedHands : 0;
    const liveLetter = camera.running ? camera.result.signId?.slice(-1) ?? '' : '';
    const votes = camera.result.stabilityVotes ?? 0;
    const required = camera.result.stabilityRequired ?? 6;
    const stability = camera.result.status === 'recognized' ? 1 : required ? votes / required : 0;

    const deviceSelect = devices.length > 1 && (
        <select
            className="ix-select ix-select--dark"
            aria-label="Pilih kamera"
            value={device}
            onChange={(e) => changeDevice(e.target.value)}
        >
            <option value="">Kamera bawaan</option>
            {devices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Kamera ${i + 1}`}
                </option>
            ))}
        </select>
    );

    const preview = (
        <div className={`ix-camera camera${camera.running ? ' is-live' : ''}`}>
            <video ref={camera.video} muted playsInline aria-label="Pratinjau kamera" />
            <canvas ref={camera.canvas} aria-hidden="true" />

            {camera.running && (
                <>
                    <span className="ix-cam-chip ix-cam-chip--tl" role="status" aria-label="Jumlah tangan terlacak">
                        <span className="ix-hand-dots" aria-hidden="true">
                            <i className={handCount >= 1 ? 'on' : ''} />
                            <i className={handCount >= 2 ? 'on' : ''} />
                        </span>
                        {handCount}/2 tangan
                    </span>
                    <span className="ix-cam-chip ix-cam-chip--tr">
                        <span className="ix-live-dot" aria-hidden="true" />
                        Langsung
                    </span>
                    {liveLetter && (
                        <div className={`ix-letter ix-letter--${camera.result.status}`} aria-hidden="true">
                            <ConfidenceRing value={stability} />
                            <span>{liveLetter}</span>
                        </div>
                    )}
                </>
            )}

            {!camera.running && (
                <div className="ix-cam-empty">
                    <span className="ix-sr-only" role="status" aria-label="Jumlah tangan terlacak">
                        0/2 tangan
                    </span>
                    <div className="ix-cam-emblem">
                        <Hand size={30} strokeWidth={1.4} />
                    </div>
                    <h3 className="ix-cam-title">Mulai dari sebuah isyarat.</h3>
                    <p className="ix-cam-text">Satu atau dua tangan · diproses lokal di perangkatmu.</p>
                    <button
                        type="button"
                        className="ix-btn ix-btn--primary ix-btn--lg"
                        disabled={camera.busy || mode === 'vocabulary'}
                        onClick={() => camera.start(device)}
                    >
                        <Camera size={18} strokeWidth={1.8} />
                        {camera.busy ? 'Menyiapkan…' : 'Nyalakan kamera'}
                    </button>
                    {deviceSelect}
                </div>
            )}
        </div>
    );

    const modeTabs = (
        <div className="ix-segment" aria-label="Jenis isyarat">
            <button
                type="button"
                className={mode === 'alphabet' ? 'is-selected' : ''}
                onClick={() => changeMode('alphabet')}
            >
                Alfabet <span className="ix-segment-tag">A–Z</span>
            </button>
            <button
                type="button"
                className={mode === 'vocabulary' ? 'is-selected' : ''}
                onClick={() => changeMode('vocabulary')}
            >
                Kosakata <span className="ix-segment-tag">Belum tersedia</span>
            </button>
        </div>
    );

    const vocabNotice = mode === 'vocabulary' && (
        <div className="ix-notice">
            <Info size={18} strokeWidth={1.8} />
            <span>
                Pengenalan kosakata belum tersedia karena izin penggunaan model masih perlu dikonfirmasi. Tidak ada prediksi kata
                yang dihasilkan.
            </span>
        </div>
    );

    const stageColumn = (
        <section className="ix-stage studio-left-card" aria-label="Kamera isyarat">
            <div className="ix-stage-bar">
                {modeTabs}
                {camera.running && (
                    <button type="button" className="ix-btn ix-btn--ghost" onClick={camera.stop} aria-label="Hentikan kamera">
                        <CameraOff size={16} strokeWidth={1.8} />
                        Hentikan kamera
                    </button>
                )}
            </div>
            {vocabNotice}
            {preview}
            <p className={`ix-status ix-status--${cameraError ? 'err' : camera.running ? 'live' : 'idle'}`} role="status">
                <span className="ix-status-dot" aria-hidden="true" />
                {friendlyMessage}
            </p>
            <CameraHelp
                camera={camera}
                target={target}
                onTargetChange={setTarget}
                expectedHands={referenceHands[target] || 0}
                onCapture={() => {
                    setText('');
                    setFeedback('');
                    camera.beginCalibration(target, referenceHands[target] || 0);
                }}
            />
        </section>
    );

    /* ---------- kamus ---------- */
    const q = query.toLowerCase();
    const filteredGlossary =
        page === 'Dictionary'
            ? bhasantaraGlossary.filter(
                (g) =>
                    (dictLangFilter === 'all' || g.targetLang === dictLangFilter) &&
                    [g.idTerm, g.casual, g.formal, g.meaning].join(' ').toLowerCase().includes(q)
            )
            : [];
    const filteredParallel =
        page === 'Dictionary'
            ? bhasantaraParallel.filter(
                (p) =>
                    (dictLangFilter === 'all' || p.targetLang === dictLangFilter || p.sourceLang === dictLangFilter) &&
                    [p.idText, p.targetText, p.context].join(' ').toLowerCase().includes(q)
            )
            : [];

    const langPills = (
        <div className="ix-pills" role="tablist" aria-label="Filter bahasa daerah">
            <button
                type="button"
                className={dictLangFilter === 'all' ? 'is-selected' : ''}
                onClick={() => {
                    setDictLangFilter('all');
                    setDictLimit(24);
                }}
            >
                Semua bahasa
            </button>
            {regionalOptions.map((l) => (
                <button
                    key={l.code}
                    type="button"
                    className={dictLangFilter === l.code ? 'is-selected' : ''}
                    onClick={() => {
                        setDictLangFilter(l.code);
                        setDictLimit(24);
                    }}
                >
                    {l.name}
                </button>
            ))}
        </div>
    );

    /* ------------------------------------------------------------------ */
    /* Render                                                              */
    /* ------------------------------------------------------------------ */

    return (
        <div className="ix-app">
            <aside className="ix-sidebar" aria-label="Navigasi utama">
                <button type="button" className="ix-brand" onClick={() => navigate('Translate')}>
                    <span className="ix-brand-mark">
                        <Hand size={20} strokeWidth={1.7} />
                    </span>
                    <span className="ix-brand-word">
                        isyara<span>.</span>
                    </span>
                </button>
                <p className="ix-brand-kicker">Pusaka bahasa &amp; isyarat</p>

                <nav className="ix-nav">
                    {NAV.map(([id, Icon, label]) => (
                        <button
                            key={id}
                            type="button"
                            className={`ix-nav-item${page === id ? ' is-active' : ''}`}
                            aria-current={page === id ? 'page' : undefined}
                            aria-label={label}
                            onClick={() => navigate(id)}
                        >
                            <Icon size={19} strokeWidth={1.7} />
                            <span>{label}</span>
                        </button>
                    ))}
                </nav>

                <div className="ix-sidebar-foot">
                    <div className="ix-privacy">
                        <ShieldCheck size={18} strokeWidth={1.7} />
                        <span>
                            <b>Di perangkat ini</b>
                            <small>Video tidak pernah diunggah.</small>
                        </span>
                    </div>
                    <span className="ix-version">v0.5 · prototipe riset</span>
                </div>
            </aside>

            <main className="ix-main">
                <div className="ix-topbar">
                    <div className="ix-topbar-text">
                        <h1 className="ix-title">{PAGE_META[page].title}</h1>
                        <p className="ix-subtitle">
                            {page === 'Translate' && inputMode === 'text'
                                ? 'Teks langsung · lintas bahasa daerah dan Bahasa Indonesia'
                                : PAGE_META[page].subtitle}
                        </p>
                    </div>

                    {page === 'Translate' && (
                        <div className="ix-segment ix-segment--hero" role="tablist" aria-label="Pilih mode input terjemahan" data-testid="input-mode-switcher">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={inputMode === 'sign'}
                                data-testid="mode-sign-btn"
                                className={inputMode === 'sign' ? 'is-selected' : ''}
                                onClick={() => setInputMode('sign')}
                            >
                                <Camera size={16} strokeWidth={1.8} />
                                Isyarat
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={inputMode === 'text'}
                                data-testid="mode-text-btn"
                                className={inputMode === 'text' ? 'is-selected' : ''}
                                onClick={() => setInputMode('text')}
                            >
                                <Keyboard size={16} strokeWidth={1.8} />
                                Teks
                            </button>
                        </div>
                    )}
                </div>

                {storageError && (
                    <div className="ix-notice ix-notice--warn ix-content-notice" role="alert">
                        <Info size={18} strokeWidth={1.8} />
                        <span>{storageError}</span>
                    </div>
                )}

                <div className="ix-content">
                    {/* ============================ TERJEMAHKAN ============================ */}
                    {page === 'Translate' && (
                        <div className="ix-workspace">
                            {inputMode === 'sign' ? (
                                stageColumn
                            ) : (
                                <section className="ix-card ix-card--source" aria-label="Teks sumber">
                                    <div className="ix-controls">
                                        <label className="ix-field ix-field--grow">
                                            <span className="ix-field-label">Bahasa sumber</span>
                                            <select
                                                id="source-lang-select"
                                                className="ix-select"
                                                aria-label="Pilih bahasa sumber"
                                                value={sourceLang}
                                                onChange={(e) => setSourceLang(e.target.value as RegionalLanguageCode | 'auto')}
                                            >
                                                <option value="auto">Deteksi otomatis ({spelledResult.detectedSourceLang.name})</option>
                                                <option value="id">Indonesia</option>
                                                {regionalOptions.map((l) => (
                                                    <option key={l.code} value={l.code}>
                                                        {l.name} — {l.nativeName}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <button
                                            type="button"
                                            className="ix-btn ix-btn--ghost ix-swap"
                                            onClick={swapLanguages}
                                            title="Tukar bahasa sumber dan tujuan"
                                            aria-label="Tukar bahasa sumber dan tujuan"
                                        >
                                            <ArrowRightLeft size={16} strokeWidth={1.8} />
                                            Tukar
                                        </button>
                                    </div>

                                    <div className="ix-source-box">
                                        {hasText && (
                                            <span className="ix-pill ix-pill--gold" data-testid="detected-language-badge">
                                                <Sparkles size={13} strokeWidth={2} />
                                                {sourceLang === 'auto'
                                                    ? `Terdeteksi: Bahasa ${spelledResult.detectedSourceLang.name}`
                                                    : `Sumber: Bahasa ${regionalLanguages.find((l) => l.code === sourceLang)?.name || 'Indonesia'}`}
                                            </span>
                                        )}
                                        <textarea
                                            id="transcript"
                                            className="ix-source"
                                            value={text}
                                            onChange={(e) => setText(e.target.value.slice(0, 200))}
                                            placeholder="Ketik kalimat bahasa daerah atau Indonesia…"
                                            aria-label="Teks sumber"
                                        />
                                        <div className="ix-toolbar">
                                            <button type="button" className="ix-tool" onClick={toggleVoiceInput} aria-label="Rekam suara">
                                                <Mic size={15} strokeWidth={1.8} />
                                                <span>{isListening ? 'Merekam…' : 'Suara'}</span>
                                            </button>
                                            <button type="button" className="ix-tool ix-tool--icon" onClick={() => speakText(text)} aria-label="Bacakan teks sumber">
                                                <Volume2 size={15} strokeWidth={1.8} />
                                            </button>
                                            <button type="button" className="ix-tool" onClick={() => { setText(''); setFeedback(''); }}>
                                                <Eraser size={15} strokeWidth={1.8} />
                                                <span>Bersihkan</span>
                                            </button>
                                            <span className="ix-count">{text.length}/200</span>
                                        </div>
                                    </div>

                                    <div>
                                        <span className="ix-eyebrow">Coba kalimat</span>
                                        <div className="ix-chips" aria-label="Contoh kalimat cepat">
                                            {(QUICK_TEXT_EXAMPLES[sourceLang] || QUICK_TEXT_EXAMPLES.auto).map((sample) => (
                                                <button key={sample} type="button" className="ix-chip" onClick={() => setText(sample)}>
                                                    {sample}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            )}

                            <div className="ix-panel cockpit-results">
                                {inputMode === 'sign' && (
                                    <section className="ix-card" aria-label="Hasil ejaan">
                                        <div className="ix-card-head">
                                            <h2 className="ix-card-title">Ejaan</h2>
                                            <span className={`ix-pill ix-pill--${statusTone}`} aria-live="polite">
                                                {statusLabel}
                                            </span>
                                        </div>
                                        <textarea
                                            id="transcript"
                                            className="ix-spell"
                                            rows={2}
                                            value={text}
                                            onChange={(e) => setText(e.target.value.slice(0, 200))}
                                            placeholder="Huruf yang stabil muncul di sini…"
                                            aria-label="HASIL EJAAN"
                                        />
                                        <div className="ix-toolbar">
                                            <button type="button" className="ix-tool" onClick={() => setText((t) => (t ? `${t} ` : ''))} title="Spasi (tombol Spasi)">
                                                <span aria-hidden="true">␣</span>
                                                <span>Spasi</span>
                                            </button>
                                            <button type="button" className="ix-tool" onClick={() => setText((t) => t.slice(0, -1))} title="Hapus huruf terakhir (Backspace)">
                                                <span aria-hidden="true">⌫</span>
                                                <span>Hapus</span>
                                            </button>
                                            <button type="button" className="ix-tool" onClick={toggleVoiceInput} aria-label="Rekam suara">
                                                <Mic size={15} strokeWidth={1.8} />
                                                <span>{isListening ? 'Merekam…' : 'Suara'}</span>
                                            </button>
                                            <button type="button" className="ix-tool ix-tool--icon" onClick={() => speakText(text)} aria-label="Bacakan ejaan">
                                                <Volume2 size={15} strokeWidth={1.8} />
                                            </button>
                                            <button type="button" className="ix-tool ix-tool--end" onClick={() => { setText(''); setFeedback(''); }}>
                                                <Eraser size={15} strokeWidth={1.8} />
                                                <span>Bersihkan</span>
                                            </button>
                                        </div>
                                        {suggestWords(text).length > 0 && (
                                            <div className="ix-chips" aria-label="Saran kata">
                                                {suggestWords(text).map((w) => (
                                                    <button
                                                        key={w}
                                                        type="button"
                                                        className="ix-chip ix-chip--add"
                                                        onClick={() => applySuggestedWord(w)}
                                                    >
                                                        + {w}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                )}

                                <section className="ix-card ix-card--result" aria-label="Terjemahan">
                                    <div className="ix-controls">
                                        <label className="ix-field ix-field--grow">
                                            <span className="ix-field-label">Bahasa tujuan</span>
                                            <select
                                                id="regional-lang-select"
                                                className="ix-select"
                                                aria-label="Pilih bahasa daerah"
                                                value={language}
                                                onChange={(e) => selectLanguage(e.target.value as RegionalLanguageCode)}
                                            >
                                                {regionalOptions.map((l) => (
                                                    <option key={l.code} value={l.code}>
                                                        {l.name} — {l.nativeName}
                                                    </option>
                                                ))}
                                                <option value="id">Indonesia saja</option>
                                            </select>
                                        </label>

                                        {showRegister && (
                                            <div className="ix-field">
                                                <span className="ix-field-label">Ragam tutur</span>
                                                <div className="ix-segment ix-segment--sm" aria-label="Ragam bahasa">
                                                    {(['ngoko', 'krama'] as const).map((r) => {
                                                        const term = r === 'ngoko' ? casualTerm : politeTerm;
                                                        return (
                                                            <button
                                                                key={r}
                                                                type="button"
                                                                className={register === r ? 'is-selected' : ''}
                                                                title={term.hint}
                                                                onClick={() => setRegister(r)}
                                                            >
                                                                {r === 'ngoko' ? 'Ngoko' : 'Krama'}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {showRegister && (
                                        <p className="ix-register-hint">
                                            {register === 'ngoko' ? casualTerm.hint : politeTerm.hint}
                                        </p>
                                    )}

                                    <div className="ix-plaque">
                                        {showPivot && (
                                            <div className="ix-pivot">
                                                <span className="ix-eyebrow ix-eyebrow--light">{pivotLabel}</span>
                                                <p className="ix-pivot-text" data-testid="pivot-indonesian-output">
                                                    {idOutput}
                                                </p>
                                            </div>
                                        )}

                                        {showMain && (
                                            <div className="ix-out">
                                                <div className="ix-out-head">
                                                    <span className="ix-eyebrow ix-eyebrow--gold">{outLabel}</span>
                                                    <div className="ix-out-actions">
                                                        <button
                                                            type="button"
                                                            className="ix-icon-btn"
                                                            onClick={() => speakText(String(regOutput || ''))}
                                                            aria-label="Dengarkan terjemahan"
                                                            disabled={!hasOutput}
                                                        >
                                                            <Volume2 size={16} strokeWidth={1.8} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="ix-icon-btn"
                                                            onClick={() => copy('translation', String(regOutput || ''))}
                                                            aria-label="Salin terjemahan"
                                                            disabled={!hasOutput}
                                                        >
                                                            {copied === 'translation' ? <Check size={16} strokeWidth={2} /> : <Copy size={16} strokeWidth={1.8} />}
                                                        </button>
                                                    </div>
                                                </div>

                                                <p className={`ix-out-text${hasOutput ? '' : ' is-empty'}`} data-testid="regional-translation-output">
                                                    {regOutput}
                                                </p>

                                                {!hasOutput && language !== 'id' && exampleResult.translatedText && exampleResult.translatedText !== '—' && (
                                                    <p className="ix-out-example">
                                                        Contoh: “terima kasih” → <b>{exampleResult.translatedText}</b>
                                                    </p>
                                                )}

                                                {hasOutput && (
                                                    <div className="ix-notes">
                                                        {spelledResult.matchedMeaning && !/NusaX/i.test(spelledResult.matchedMeaning) && (
                                                            <p className="ix-note">{spelledResult.matchedMeaning}</p>
                                                        )}
                                                        {spelledResult.registerFallback && (
                                                            <p className="ix-note ix-note--warn" data-testid="register-fallback-note">
                                                                Bentuk halus belum tersedia — menampilkan bentuk sehari-hari.
                                                            </p>
                                                        )}
                                                        {spelledResult.honorificVariant && (
                                                            <p className="ix-note ix-note--honor">
                                                                {honorificTerm.name}
                                                                {honorificTerm.hint ? ` (${honorificTerm.hint})` : ''}: <strong>{spelledResult.honorificVariant}</strong>
                                                            </p>
                                                        )}
                                                        {hasText && spelledResult.untranslatedTokens.length > 0 && (
                                                            <p className="ix-note ix-note--warn" data-testid="untranslated-tokens-note">
                                                                Belum ada di kamus: {spelledResult.untranslatedTokens.join(', ')}
                                                            </p>
                                                        )}
                                                        <div className="ix-badges">
                                                            {hasText && SOURCE_METHOD_LABEL[spelledResult.sourceMethod] && (
                                                                <span className="ix-tag">{SOURCE_METHOD_LABEL[spelledResult.sourceMethod]}</span>
                                                            )}
                                                            {language !== 'id' && <span className="ix-tag ix-tag--draft">Draf · belum divalidasi penutur</span>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {spelledResult.hasNativeAksara ? (
                                            <div className="ix-aksara" data-testid="native-aksara-card">
                                                <div className="ix-out-head">
                                                    <span className="ix-eyebrow">Aksara · {spelledResult.aksaraLabel}</span>
                                                    <button
                                                        type="button"
                                                        className="ix-mini-btn"
                                                        onClick={() => copy('aksara', spelledResult.nativeAksaraText)}
                                                        aria-label="Salin aksara"
                                                    >
                                                        {copied === 'aksara' ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={1.8} />}
                                                        <span>{copied === 'aksara' ? 'Tersalin' : 'Salin'}</span>
                                                    </button>
                                                </div>
                                                <p
                                                    className={`ix-aksara-glyph ix-aksara-glyph--${spelledResult.nativeScript ?? 'JAVANESE'}`}
                                                    lang={SCRIPT_LANG_ATTR[spelledResult.nativeScript ?? ''] ?? undefined}
                                                    data-testid="live-aksara-output"
                                                >
                                                    {spelledResult.nativeAksaraText || '—'}
                                                </p>
                                                <small className="ix-fine">
                                                    {spelledResult.aksaraAuto === false
                                                        ? 'Ejaan aksara kamus — belum divalidasi ahli aksara.'
                                                        : 'Transliterasi otomatis — belum divalidasi ahli aksara.'}
                                                </small>
                                            </div>
                                        ) : (
                                            language !== 'id' && (
                                                <div className="ix-latin-note" data-testid="no-aksara-note">
                                                    <Info size={15} strokeWidth={1.8} />
                                                    <span>
                                                        Ditulis dengan huruf Latin. Modul aksara untuk Bahasa {activeLangMeta.name} belum tersedia.
                                                    </span>
                                                </div>
                                            )
                                        )}
                                    </div>

                                    {camera.result.source === 'personal' && inputMode === 'sign' && (
                                        <p className="ix-fine ix-fine--gold">Hasil memakai contoh pribadi yang Anda beri label sendiri.</p>
                                    )}
                                </section>
                            </div>
                        </div>
                    )}

                    {/* ============================ BELAJAR ============================ */}
                    {page === 'Learn' && (
                        <div className="ix-workspace">
                            {stageColumn}

                            <div className="ix-panel">
                                <section className="ix-card">
                                    <div className="ix-card-head">
                                        <h2 className="ix-card-title">Latihan hari ini</h2>
                                        <span className={`ix-pill ix-pill--${statusTone}`} aria-live="polite">
                                            {statusLabel}
                                        </span>
                                    </div>

                                    <div className="ix-practice">
                                        <figure className="ix-ref">
                                            <img src={`/ref/${target}/${target.toLowerCase()}_da7115.jpg`} alt={`Contoh referensi huruf ${target}`} />
                                        </figure>
                                        <div className="ix-practice-body">
                                            <label className="ix-field">
                                                <span className="ix-field-label">Huruf target</span>
                                                <select
                                                    id="target"
                                                    className="ix-select"
                                                    disabled={!!camera.capture || camera.saving}
                                                    value={target}
                                                    onChange={(e) => {
                                                        setTarget(e.target.value);
                                                        setFeedback('');
                                                    }}
                                                >
                                                    {letters.map((l) => (
                                                        <option key={l}>{l}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            <p className="ix-big-letter" aria-hidden="true">
                                                {target}
                                            </p>
                                            <p className="ix-fine">
                                                Referensi: {referenceHands[target] || '—'} tangan.{' '}
                                                {weakLetters.includes(target)
                                                    ? 'Huruf ini masih sering tertukar pada uji foto.'
                                                    : 'Akurasi untuk pengguna baru belum terukur.'}
                                            </p>
                                        </div>
                                    </div>

                                    <p className="ix-feedback" role="status">
                                        {feedback || 'Ikuti jumlah dan posisi tangan pada foto, lalu tahan hingga cincin penuh.'}
                                    </p>
                                </section>

                                <section className="ix-card">
                                    <div className="ix-card-head">
                                        <h2 className="ix-card-title">Perjalananmu</h2>
                                        <span className="ix-fine">{`${progress.xp} XP · ${progress.letters.length}/26 huruf`}</span>
                                        <Flame size={18} strokeWidth={1.8} className="ix-gold-icon" />
                                    </div>
                                    <div className="ix-stats">
                                        <div>
                                            <b>{progress.days.length}</b>
                                            <small>hari latihan</small>
                                        </div>
                                        <div>
                                            <b>{progress.xp}</b>
                                            <small>XP</small>
                                        </div>
                                        <div>
                                            <b>{progress.letters.length}/26</b>
                                            <small>huruf dikenali</small>
                                        </div>
                                    </div>
                                    <div className="ix-letter-track" aria-label="Huruf yang sudah dikenali">
                                        {letters.map((l) => (
                                            <button
                                                key={l}
                                                type="button"
                                                className={`${progress.letters.includes(l) ? 'is-done' : ''}${l === target ? ' is-target' : ''}`}
                                                onClick={() => {
                                                    setTarget(l);
                                                    setFeedback('');
                                                }}
                                                aria-label={`Latih huruf ${l}${progress.letters.includes(l) ? ' (sudah dikenali)' : ''}`}
                                            >
                                                {l}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="ix-fine">
                                        {progress.letters.length >= 5 ? 'Pencapaian: Lima Huruf!' : 'Kenali 5 huruf untuk pencapaian pertama.'}
                                    </p>
                                    <button
                                        type="button"
                                        className="ix-btn ix-btn--primary"
                                        onClick={() => setTarget(letters.find((l) => !progress.letters.includes(l)) || 'A')}
                                    >
                                        Latihan berikutnya
                                    </button>
                                </section>
                            </div>
                        </div>
                    )}

                    {/* ============================ KAMUS ============================ */}
                    {page === 'Dictionary' && (
                        <div className="ix-dict">
                            <div className="ix-search">
                                <Search size={18} strokeWidth={1.8} />
                                <input
                                    aria-label="Cari kamus"
                                    placeholder="Cari huruf, kata Indonesia, bahasa daerah, atau kalimat…"
                                    value={query}
                                    onChange={(e) => {
                                        setQuery(e.target.value);
                                        setDictLimit(24);
                                    }}
                                />
                            </div>

                            <div className="ix-tabs" role="tablist" aria-label="Bagian kamus">
                                {(
                                    [
                                        ['alphabet', 'Alfabet BISINDO'],
                                        ['words', 'Kosakata'],
                                        ['sentences', 'Kalimat'],
                                        ['aksara', 'Aksara & budaya'],
                                    ] as const
                                ).map(([id, label]) => (
                                    <button
                                        key={id}
                                        type="button"
                                        role="tab"
                                        aria-selected={dictTab === id}
                                        className={dictTab === id ? 'is-selected' : ''}
                                        onClick={() => {
                                            setDictTab(id);
                                            setDictLimit(24);
                                        }}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {dictTab === 'alphabet' && (
                                <>
                                    <div className="ix-letter-grid">
                                        {letters
                                            .filter((l) => l.toLowerCase().includes(q))
                                            .map((l) => (
                                                <button
                                                    key={l}
                                                    type="button"
                                                    className="ix-letter-card"
                                                    onClick={() => {
                                                        setTarget(l);
                                                        setMode('alphabet');
                                                        navigate('Learn');
                                                    }}
                                                >
                                                    <span className="ix-letter-card-img">
                                                        <img src={`/ref/${l}/${l.toLowerCase()}_da7115.jpg`} alt={`Referensi huruf ${l}`} loading="lazy" />
                                                    </span>
                                                    <span className="ix-letter-card-body">
                                                        <b>{l}</b>
                                                        <small>
                                                            {referenceHands[l] || '—'} tangan · {weakLetters.includes(l) ? 'perlu perbaikan' : 'eksperimental'}
                                                        </small>
                                                    </span>
                                                    <ArrowUpRight size={16} strokeWidth={1.8} className="ix-letter-card-arrow" />
                                                </button>
                                            ))}
                                    </div>
                                    {q && (
                                        <div className="ix-entry-grid" style={{ marginTop: '20px' }}>
                                            {concepts
                                                .filter((c) => [c.idText, c.ngoko, c.krama].join(' ').toLowerCase().includes(q))
                                                .map((c) => (
                                                    <article key={c.id} className="ix-entry">
                                                        <div className="ix-entry-head">
                                                            <span className="ix-tag">Jawa</span>
                                                            <span className="ix-tag ix-tag--draft">Draf</span>
                                                        </div>
                                                        <h3 className="ix-entry-id">{c.idText}</h3>
                                                        <dl className="ix-entry-forms">
                                                            <div><dt>Ngoko</dt><dd>{c.ngoko}</dd></div>
                                                            <div><dt>Krama</dt><dd>{c.krama}</dd></div>
                                                        </dl>
                                                        <p className="ix-entry-meta">{c.note}</p>
                                                        <a href={c.source} target="_blank" rel="noreferrer" className="ix-link">
                                                            Rujukan untuk peninjauan ↗
                                                        </a>
                                                    </article>
                                                ))}
                                        </div>
                                    )}
                                    <p className="ix-source-note">
                                        Foto penelitian, bukan pedoman yang sudah diverifikasi komunitas Tuli.{' '}
                                        <a href="https://github.com/rhiosutoyo/Indonesian-Sign-Language-BISINDO-Hand-Sign-Detection-Dataset" target="_blank" rel="noreferrer">
                                            Sumber: Rhio Sutoyo dan tim (MIT)
                                        </a>{' '}
                                        ·{' '}
                                        <a href="/ref/provenance.json" target="_blank" rel="noreferrer">
                                            Asal setiap foto
                                        </a>
                                    </p>
                                </>
                            )}

                            {dictTab === 'words' && (
                                <>
                                    <div className="ix-section-head">
                                        <h2 className="ix-h2">Konsep inti Jawa</h2>
                                        <span className="ix-fine">Materi bahasa saja · semua entri masih draf</span>
                                    </div>
                                    <div className="ix-entry-grid">
                                        {concepts
                                            .filter((c) => [c.idText, c.ngoko, c.krama].join(' ').toLowerCase().includes(q))
                                            .map((c) => (
                                                <article key={c.id} className="ix-entry">
                                                    <div className="ix-entry-head">
                                                        <span className="ix-tag">Jawa</span>
                                                        <span className="ix-tag ix-tag--draft">Draf</span>
                                                    </div>
                                                    <h3 className="ix-entry-id">{c.idText}</h3>
                                                    <dl className="ix-entry-forms">
                                                        <div><dt>Ngoko</dt><dd>{c.ngoko}</dd></div>
                                                        <div><dt>Krama</dt><dd>{c.krama}</dd></div>
                                                    </dl>
                                                    <p className="ix-entry-meta">{c.note}</p>
                                                    <a href={c.source} target="_blank" rel="noreferrer" className="ix-link">
                                                        Rujukan untuk peninjauan ↗
                                                    </a>
                                                </article>
                                            ))}
                                    </div>

                                    <div className="ix-section-head">
                                        <h2 className="ix-h2">Padanan Nusantara</h2>
                                        <span className="ix-fine">
                                            Menampilkan {Math.min(dictLimit, filteredGlossary.length)} dari {filteredGlossary.length.toLocaleString('id-ID')} entri draf
                                        </span>
                                    </div>
                                    {langPills}
                                    <div className="ix-entry-grid">
                                        {filteredGlossary.slice(0, dictLimit).map((g, i) => {
                                            const lMeta = regionalLanguages.find((l) => l.code === g.targetLang);
                                            const fromCorpus = g.source === 'nusax-auto';
                                            const spoken = g.formal || g.casual;
                                            return (
                                                <article key={`${g.targetLang}-${g.idTerm}-${i}`} className="ix-entry">
                                                    <div className="ix-entry-head">
                                                        <span className="ix-tag">{lMeta?.name}</span>
                                                        <span className={`ix-tag ${fromCorpus ? 'ix-tag--corpus' : 'ix-tag--draft'}`}>
                                                            {fromCorpus ? 'Korpus otomatis' : 'Draf'}
                                                        </span>
                                                        <button type="button" className="ix-icon-btn ix-icon-btn--sm" onClick={() => speakText(spoken)} aria-label={`Dengarkan ${spoken}`}>
                                                            <Volume2 size={15} strokeWidth={1.8} />
                                                        </button>
                                                    </div>
                                                    <p className="ix-entry-id">{g.idTerm}</p>
                                                    <dl className="ix-entry-forms">
                                                        <div><dt>Sehari-hari</dt><dd>{g.casual}</dd></div>
                                                        {g.formal && g.formal !== g.casual && <div><dt>Halus</dt><dd>{g.formal}</dd></div>}
                                                        {g.honorific && g.honorific !== g.formal && <div><dt>Hormat</dt><dd>{g.honorific}</dd></div>}
                                                    </dl>
                                                    {g.meaning && <p className="ix-entry-meta">{g.meaning}</p>}
                                                    {lMeta?.defaultScript && (
                                                        <p className={`ix-entry-aksara ix-aksara-glyph--${lMeta.defaultScript}`} lang={SCRIPT_LANG_ATTR[lMeta.defaultScript]}>
                                                            {g.aksara || transliterateToAksara(spoken, lMeta.defaultScript)}
                                                        </p>
                                                    )}
                                                </article>
                                            );
                                        })}
                                    </div>
                                    {filteredGlossary.length > dictLimit && (
                                        <button type="button" className="ix-btn ix-btn--ghost ix-more" onClick={() => setDictLimit((n) => n + 24)}>
                                            Tampilkan lebih banyak
                                        </button>
                                    )}
                                    <p className="ix-source-note">
                                        Sebagian entri berasal dari{' '}
                                        <a href={NUSAX_ATTRIBUTION.licensePath} target="_blank" rel="noreferrer">
                                            {NUSAX_ATTRIBUTION.name} ({NUSAX_ATTRIBUTION.license})
                                        </a>{' '}
                                        dan diekstrak otomatis; belum ditinjau penutur.
                                    </p>
                                </>
                            )}

                            {dictTab === 'sentences' && (
                                <>
                                    <div className="ix-section-head">
                                        <h2 className="ix-h2">Kalimat sejajar</h2>
                                        <span className="ix-fine">
                                            Menampilkan {Math.min(dictLimit, filteredParallel.length)} dari {filteredParallel.length} kalimat
                                        </span>
                                    </div>
                                    {langPills}
                                    <div className="ix-entry-grid ix-entry-grid--wide">
                                        {filteredParallel.slice(0, dictLimit).map((p, i) => {
                                            const code = p.targetLang === 'id' ? p.sourceLang : p.targetLang;
                                            const lMeta = regionalLanguages.find((l) => l.code === code);
                                            return (
                                                <article key={`${code}-${i}`} className="ix-entry">
                                                    <div className="ix-entry-head">
                                                        <span className="ix-tag">{lMeta?.name}</span>
                                                        <span className="ix-tag ix-tag--draft">Draf</span>
                                                        <button type="button" className="ix-icon-btn ix-icon-btn--sm" onClick={() => speakText(p.targetText)} aria-label="Dengarkan kalimat">
                                                            <Volume2 size={15} strokeWidth={1.8} />
                                                        </button>
                                                    </div>
                                                    <p className="ix-entry-target">{p.targetText}</p>
                                                    <p className="ix-entry-id ix-entry-id--sm">{p.idText}</p>
                                                    {p.formalText && <p className="ix-entry-meta">Ragam halus: {p.formalText}</p>}
                                                    <p className="ix-entry-meta">{p.context}</p>
                                                </article>
                                            );
                                        })}
                                    </div>
                                    {filteredParallel.length > dictLimit && (
                                        <button type="button" className="ix-btn ix-btn--ghost ix-more" onClick={() => setDictLimit((n) => n + 24)}>
                                            Tampilkan lebih banyak
                                        </button>
                                    )}
                                </>
                            )}

                            <div className="ix-aksara-module">
                                <BhasantaraAksaraGuide initialScript={aksaraScript} />
                            </div>
                        </div>
                    )}

                    {/* ============================ PENGATURAN ============================ */}
                    {page === 'Settings' && (
                        <div className="ix-settings">
                            <section className="ix-card">
                                <h2 className="ix-card-title">Kamera</h2>
                                <p className="ix-fine">Kamera hanya menyala saat Anda menekan “Nyalakan kamera”. Gambar tidak disimpan atau diunggah.</p>
                                <label className="ix-field">
                                    <span className="ix-field-label">Perangkat kamera</span>
                                    <select className="ix-select" value={device} onChange={(e) => changeDevice(e.target.value)} aria-label="Pilih kamera">
                                        <option value="">Kamera bawaan</option>
                                        {devices.map((d, i) => (
                                            <option key={d.deviceId || i} value={d.deviceId}>
                                                {d.label || `Kamera ${i + 1}`}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                {devices.length === 0 && (
                                    <p className="ix-fine">Nama perangkat muncul setelah izin kamera diberikan.</p>
                                )}
                            </section>

                            <section className="ix-card">
                                <h2 className="ix-card-title">Preferensi</h2>
                                <label className="ix-field">
                                    <span className="ix-field-label">Mode pengenalan</span>
                                    <select
                                        className="ix-select"
                                        value={mode}
                                        onChange={(e) => changeMode(e.target.value as 'alphabet' | 'vocabulary')}
                                    >
                                        <option value="alphabet">Alfabet A–Z</option>
                                        <option value="vocabulary">Kosakata · tidak tersedia</option>
                                    </select>
                                </label>
                                <label className="ix-field">
                                    <span className="ix-field-label">Bahasa keluaran</span>
                                    <select
                                        className="ix-select"
                                        value={language}
                                        onChange={(e) => selectLanguage(e.target.value as RegionalLanguageCode)}
                                    >
                                        {regionalOptions.map((l) => (
                                            <option key={l.code} value={l.code}>
                                                Indonesia + {l.name} ({l.nativeName})
                                            </option>
                                        ))}
                                        <option value="id">Indonesia</option>
                                    </select>
                                </label>
                                <label className="ix-field">
                                    <span className="ix-field-label">Ragam bahasa</span>
                                    <select
                                        className="ix-select"
                                        value={register}
                                        onChange={(e) => setRegister(e.target.value as Register)}
                                    >
                                        <option value="ngoko">
                                            {casualTerm.name}
                                            {casualTerm.hint ? ` (${casualTerm.hint})` : ''}
                                        </option>
                                        <option value="krama">
                                            {politeTerm.name}
                                            {politeTerm.hint ? ` (${politeTerm.hint})` : ''}
                                        </option>
                                    </select>
                                </label>
                                <label className="ix-field">
                                    <span className="ix-field-label">Aksara rujukan kamus</span>
                                    <select
                                        className="ix-select"
                                        value={aksaraScript}
                                        onChange={(e) => setAksaraScript(e.target.value as AksaraScript)}
                                    >
                                        <option value="JAVANESE">Aksara Jawa (Hanacaraka)</option>
                                        <option value="SUNDANESE">Aksara Sunda Baku</option>
                                        <option value="BALINESE">Aksara Bali (Carakan)</option>
                                    </select>
                                </label>
                            </section>

                            <section className="ix-card">
                                <h2 className="ix-card-title">Contoh pribadi</h2>
                                <p className="ix-fine">
                                    {camera.personalCount} contoh tersimpan di browser ini. Yang disimpan hanya titik koordinat tangan, bukan gambar.
                                    Label yang Anda berikan sendiri bukan verifikasi ahli.
                                </p>
                                <button type="button" className="ix-btn ix-btn--danger" onClick={() => camera.removePersonalExamples()} disabled={!camera.personalCount}>
                                    <Trash2 size={16} strokeWidth={1.8} />
                                    Hapus semua contoh pribadi
                                </button>
                                {camera.calibrationNotice && (
                                    <p className="ix-fine" role="status">
                                        {camera.calibrationNotice}
                                    </p>
                                )}
                            </section>

                            <section className="ix-card ix-card--span">
                                <h2 className="ix-card-title">Bahasa yang tersedia</h2>
                                <p className="ix-fine">Semua isi leksikal masih draf dan menunggu validasi penutur asli.</p>
                                <div className="ix-lang-grid">
                                    {regionalOptions.map((l) => (
                                        <article key={l.code} className="ix-lang">
                                            <div className="ix-lang-head">
                                                <b>{l.name}</b>
                                                <span>{l.nativeName}</span>
                                            </div>
                                            <p className="ix-fine">{l.region}</p>
                                            <p className="ix-fine">{l.entriesCount}</p>
                                            {l.defaultScript && <span className="ix-tag">Aksara tersedia</span>}
                                        </article>
                                    ))}
                                </div>
                            </section>

                            <section className="ix-card ix-card--span">
                                <h2 className="ix-card-title">Transparansi model &amp; korpus</h2>
                                <p className="ix-fine">
                                    TwoHand v1 · koreksi rasio kamera aktif · nearest-prototype · 254 fitur gabungan bentuk dan posisi hingga dua
                                    tangan · 26 label alfabet. MediaPipe 0.10.14, model landmark float16 v1. Ambang skor pemisahan 35% (kalibrasi
                                    data latih), konsensus 6 dari 8 frame.
                                </p>
                                <p className="ix-fine">
                                    Integrasi bahasa daerah &amp; aksara memadukan leksikon tingkat tutur{' '}
                                    <a href="https://github.com/tyobramas/bhasantara" target="_blank" rel="noreferrer">
                                        BHASANTARA
                                    </a>{' '}
                                    dengan korpus terbuka{' '}
                                    <a href={NUSAX_ATTRIBUTION.url} target="_blank" rel="noreferrer">
                                        {NUSAX_ATTRIBUTION.name} ({NUSAX_ATTRIBUTION.license})
                                    </a>
                                    : {regionalOptions.length} bahasa daerah, {bhasantaraGlossary.length.toLocaleString('id-ID')} padanan, dan{' '}
                                    {bhasantaraParallel.length} kalimat paralel, sebagian diekstrak otomatis dan belum ditinjau penutur. Aksara Jawa,
                                    Sunda, dan Bali dihasilkan lewat transliterasi otomatis.
                                </p>
                                <p className="ix-fine">
                                    Diagnostik sesi terakhir: {camera.metrics.fps.toFixed(1)} FPS · {camera.metrics.latency.toFixed(1)} ms deteksi
                                    dan klasifikasi.
                                </p>
                                <p className="ix-fine">
                                    <a href="/models/twohand-v1/evaluation.json" target="_blank" rel="noreferrer">
                                        Hasil evaluasi model dan batas pengujian
                                    </a>
                                </p>
                            </section>

                            <section className="ix-card ix-card--span">
                                <h2 className="ix-card-title">Privasi &amp; lisensi terbuka</h2>
                                <p className="ix-fine">
                                    Frame diproses di browser. Progres tersimpan di IndexedDB perangkat ini. Tidak ada akun, pelacakan, atau layanan
                                    inferensi eksternal.
                                </p>
                                <ul className="ix-list">
                                    <li>
                                        <a href="/licenses/Alphabet-Dataset-MIT.txt" target="_blank" rel="noreferrer">
                                            Lisensi dataset alfabet (MIT)
                                        </a>
                                    </li>
                                    <li>
                                        <a href={NUSAX_ATTRIBUTION.licensePath} target="_blank" rel="noreferrer">
                                            Lisensi korpus NusaX ({NUSAX_ATTRIBUTION.license})
                                        </a>
                                    </li>
                                    <li>
                                        <a href="/licenses/MediaPipe-Apache-2.0.txt" target="_blank" rel="noreferrer">
                                            Lisensi MediaPipe (Apache-2.0)
                                        </a>
                                    </li>
                                    <li>
                                        <a href="/licenses/Jemari-MIT.txt" target="_blank" rel="noreferrer">
                                            Atribusi fondasi Jemari
                                        </a>
                                    </li>
                                    <li>
                                        <a href="/licenses/Fonts-OFL-1.1.txt" target="_blank" rel="noreferrer">
                                            Lisensi font (SIL OFL 1.1)
                                        </a>
                                    </li>
                                </ul>
                            </section>

                            <section className="ix-card ix-card--span">
                                <h2 className="ix-card-title">Sumber &amp; lisensi</h2>
                                <ul className="ix-list">
                                    <li>
                                        Dataset alfabet BISINDO:{' '}
                                        <a href="https://github.com/rhiosutoyo/Indonesian-Sign-Language-BISINDO-Hand-Sign-Detection-Dataset" target="_blank" rel="noreferrer">
                                            Rhio Sutoyo dkk.
                                        </a>{' '}
                                        (MIT). Belum diverifikasi pengajar BISINDO.
                                    </li>
                                    <li>
                                        Korpus bahasa daerah:{' '}
                                        <a href={NUSAX_ATTRIBUTION.url} target="_blank" rel="noreferrer">
                                            {NUSAX_ATTRIBUTION.name}
                                        </a>{' '}
                                        — {NUSAX_ATTRIBUTION.authors} ({NUSAX_ATTRIBUTION.license}).
                                    </li>
                                    <li>Pelacak tangan: MediaPipe (Apache-2.0), berjalan lokal.</li>
                                    <li>Sistem ini mengenali ejaan jari, bukan menerjemahkan BISINDO sebagai bahasa utuh.</li>
                                </ul>
                            </section>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
