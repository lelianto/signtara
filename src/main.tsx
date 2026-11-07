import React, { useState, useEffect, useRef } from 'react';
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
  Keyboard,
  ShieldCheck,
  Flame,
  Check,
  Volume2,
  Copy,
  Mic,
  Sparkles,
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

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const QUICK_TEXT_EXAMPLES: Record<RegionalLanguageCode | 'auto', string[]> = {
  auto: [
    'Saya makan nasi',
    'Bapak makan nasi',
    'Aku mangan sega',
    'Abdi hoyong nginum cai',
    'Ambo pai ka pasa',
  ],
  id: [
    'Saya ingin pergi ke pasar',
    'Bapak makan nasi',
    'Ibu sedang tidur',
    'Terima kasih banyak',
    'Rumahku dekat pasar',
  ],
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

function App() {
  const [page, setPage] = useState('Translate');
  const [inputMode, setInputMode] = useState<TranslationInputMode>('sign');
  const [sourceLang, setSourceLang] = useState<RegionalLanguageCode | 'auto'>('auto');
  const [mode, setMode] = useState('alphabet');
  const [register, setRegister] = useState<Register>('ngoko');
  const [language, setLanguage] = useState<RegionalLanguageCode>('jv');
  const [aksaraScript, setAksaraScript] = useState<AksaraScript>('JAVANESE');
  const [dictLangFilter, setDictLangFilter] = useState<RegionalLanguageCode | 'all'>('all');
  const [device, setDevice] = useState('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [progress, setProgress] = useState(emptyProgress);
  const [target, setTarget] = useState('A');
  const [feedback, setFeedback] = useState('');
  const [storageError, setStorageError] = useState('');
  const [copiedTranslation, setCopiedTranslation] = useState(false);
  const [copiedAksara, setCopiedAksara] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<any>(null);
  const inputModeRef = useRef<TranslationInputMode>(inputMode);
  inputModeRef.current = inputMode;

  const [referenceHands, setReferenceHands] = useState<Record<string, number>>({});
  const [weakLetters, setWeakLetters] = useState<string[]>([]);

  useEffect(() => {
    fetch('/ref/provenance.json')
      .then((r) => r.json())
      .then((p) =>
        setReferenceHands(
          Object.fromEntries(
            Object.entries(p.entries as Record<string, { expectedHands: number }>).map(([l, e]) => [
              l,
              e.expectedHands,
            ])
          )
        )
      )
      .catch(() => {});

    fetch('/models/twohand-v1/evaluation.json')
      .then((r) => r.json())
      .then((p) =>
        setWeakLetters(
          p.perClass
            .filter((c: { correct: number; total: number }) => c.correct < c.total)
            .map((c: { label: string }) => c.label)
        )
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'id-ID';
    rec.onresult = (ev: any) => {
      const tr = Array.from(ev.results)
        .map((r: any) => r[0]?.transcript || '')
        .join('');
      setText(
        inputModeRef.current === 'sign' ? tr.toUpperCase().slice(0, 200) : tr.slice(0, 200)
      );
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

  // Auto-start camera when entering Translate in Sign Mode ("langsung nyala kamera")
  useEffect(() => {
    if (page === 'Translate' && inputMode === 'sign' && mode === 'alphabet') {
      camera.start(device);
    } else if (page === 'Translate' && inputMode === 'text') {
      camera.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, inputMode, mode, device]);

  useEffect(() => {
    readProgress()
      .then(setProgress)
      .catch(() => setStorageError('Progres tidak dapat dibaca. Periksa penyimpanan browser.'));
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((d) => setDevices(d.filter((x) => x.kind === 'videoinput')))
      .catch(() => {});
  }, [camera.running]);

  const navigate = (p: string) => {
    camera.stop();
    setPage(p);
    setFeedback('');
  };

  const statuses = {
    recognized: 'Huruf dikenali',
    uncertain: 'Tahan gestur lebih stabil',
    unknown: 'Belum ada hasil yang yakin',
    no_hand: 'Tangan belum terdeteksi',
    loading: 'Memuat model',
    error: 'Perlu perhatian',
  };

  const activeLangMeta = regionalLanguages.find((l) => l.code === language) || regionalLanguages[0];
  const spelledResult = translateText({
    text,
    sourceLang: inputMode === 'sign' ? 'id' : sourceLang,
    targetLang: language,
    register,
    inputMode,
    fallbackConceptId: inputMode === 'sign' ? camera.result.conceptId : null,
    selectedScript: aksaraScript,
  });

  const idOutput = text.trim()
    ? spelledResult.indonesianText
    : inputMode === 'sign' && camera.result.conceptId
    ? indonesian.resolve(camera.result.conceptId, register)
    : '—';

  const regOutput = text.trim()
    ? spelledResult.translatedText
    : inputMode === 'sign' && camera.result.conceptId
    ? language === 'jv'
      ? javanese.resolve(camera.result.conceptId, register)
      : indonesian.resolve(camera.result.conceptId, register)
    : '—';

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

  const swapLanguages = () => {
    const resolvedSrc = sourceLang === 'auto' ? spelledResult.sourceLang : sourceLang;
    if (resolvedSrc === language) return;
    const nextTarget = resolvedSrc;
    const nextSource = language;
    if (text.trim() && spelledResult.translatedText && spelledResult.translatedText !== '—') {
      setText(spelledResult.translatedText);
    }
    setSourceLang(nextSource);
    setLanguage(nextTarget);
    const m = regionalLanguages.find((x) => x.code === nextTarget);
    if (m?.defaultScript) setAksaraScript(m.defaultScript);
  };

  const copyTranslatedOutput = () => {
    if (!regOutput || regOutput === '—') return;
    navigator.clipboard?.writeText(regOutput).catch(() => {});
    setCopiedTranslation(true);
    setTimeout(() => setCopiedTranslation(false), 1500);
  };

  const copyNativeAksara = () => {
    if (!spelledResult.nativeAksaraText || spelledResult.nativeAksaraText === '—') return;
    navigator.clipboard?.writeText(spelledResult.nativeAksaraText).catch(() => {});
    setCopiedAksara(true);
    setTimeout(() => setCopiedAksara(false), 1500);
  };

  const normalizedCameraMessage =
    camera.message === 'La caméra est éteinte.' ? 'Kamera belum dinyalakan.' : camera.message;

  const preview = (
    <div className="camera">
      <video ref={camera.video} muted playsInline aria-label="Pratinjau kamera" />
      <canvas ref={camera.canvas} aria-hidden="true" />
      {!camera.running && (
        <div className="camera-empty">
          <div className="camera-icon">
            <Hand size={36} strokeWidth={1.6} />
          </div>
          <h3>Mulai dari sebuah isyarat.</h3>
          <p>Satu atau dua tangan · diproses lokal di perangkatmu.</p>
          <button
            className="primary"
            disabled={camera.busy || mode === 'vocabulary'}
            onClick={() => camera.start(device)}
          >
            <Camera size={17} strokeWidth={2} />
            {camera.busy ? 'Menyiapkan…' : 'Nyalakan kamera'}
          </button>
        </div>
      )}
      <span className="camera-tag">
        <span className={camera.running ? 'dot live' : 'dot'} />
        {camera.running ? 'KAMERA AKTIF' : 'KAMERA NONAKTIF'}
      </span>
      <span className="camera-count" role="status" aria-label="Jumlah tangan terlacak">
        Pelacak: {camera.running ? camera.trackedHands : 0}/2 tangan
      </span>
      <span className="camera-bottom">
        {camera.running
          ? 'Dua tangan · pratinjau tanpa cermin'
          : 'Ruang aman untuk belajar, dengan caramu sendiri.'}
      </span>
    </div>
  );

  const isTranslateCockpit = page === 'Translate';
  const regionalCount = regionalLanguages.filter((l) => l.code !== 'id').length;

  const filteredGlossary =
    page === 'Dictionary'
      ? bhasantaraGlossary.filter(
          (g) =>
            (dictLangFilter === 'all' || g.targetLang === dictLangFilter) &&
            [g.idTerm, g.casual, g.formal, g.meaning]
              .join(' ')
              .toLowerCase()
              .includes(query.toLowerCase())
        )
      : [];

  const filteredParallel =
    page === 'Dictionary'
      ? bhasantaraParallel.filter(
          (p) =>
            (dictLangFilter === 'all' ||
              p.targetLang === dictLangFilter ||
              p.sourceLang === dictLangFilter) &&
            [p.idText, p.targetText, p.context]
              .join(' ')
              .toLowerCase()
              .includes(query.toLowerCase())
        )
      : [];

  return (
    <div className="app">
      <aside>
        <span className="heritage-kicker">❖ PUSAKA BAHASA &amp; ISYARAT</span>
        <a className="brand" href="#" onClick={() => navigate('Translate')}>
          <span className="brand-icon">
            <Hand size={22} strokeWidth={1.8} />
          </span>
          isyara<span className="brand-period">.</span>
        </a>
        <p className="aside-caption">{regionalCount} BAHASA DAERAH · AKSARA NUSANTARA</p>
        <nav>
          {[
            ['Translate', Languages, 'Terjemahkan'],
            ['Learn', BookOpen, 'Belajar'],
            ['Dictionary', Search, 'Kamus'],
            ['Settings', Settings, 'Pengaturan'],
          ].map(([id, Icon, label]) => {
            const I = Icon as typeof Hand;
            return (
              <button
                key={String(id)}
                className={page === id ? 'nav active' : 'nav'}
                onClick={() => navigate(String(id))}
              >
                <I size={19} strokeWidth={1.8} />
                {String(label)}
                {page === id && <span className="nav-dot" />}
              </button>
            );
          })}
        </nav>
        <div className="aside-bottom">
          <div className="local">
            <ShieldCheck size={20} strokeWidth={1.8} />
            <div>
              <b>Privasi, selalu.</b>
              <small>100% diproses di perangkat ini.</small>
            </div>
          </div>
          <div className="corpus-stat">
            <span>{bhasantaraGlossary.length.toLocaleString('id-ID')} padanan terkurasi</span>
          </div>
          <span className="version">ISYARA × BHASANTARA · v0.5.0</span>
        </div>
      </aside>

      <main className={isTranslateCockpit ? 'translate-viewport' : ''}>
        {isTranslateCockpit ? (
          <>
            <header className="cockpit-header">
              <div className="cockpit-title-group">
                <h1>Dari tangan, jadi makna.</h1>
                <span className="cockpit-flow-hint">
                  {inputMode === 'sign'
                    ? 'Isyarat BISINDO ➔ Indonesia ➔ Bahasa Daerah'
                    : 'Teks Langsung · Lintas Bahasa Daerah & Indonesia'}
                </span>
              </div>

              <div className="cockpit-header-controls">
                <div
                  className="input-mode-switch"
                  role="tablist"
                  aria-label="Pilih mode input terjemahan"
                  data-testid="input-mode-switcher"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inputMode === 'sign'}
                    data-testid="mode-sign-btn"
                    className={inputMode === 'sign' ? 'selected' : ''}
                    onClick={() => setInputMode('sign')}
                  >
                    <Camera size={15} strokeWidth={2} />
                    Isyarat Kamera
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inputMode === 'text'}
                    data-testid="mode-text-btn"
                    className={inputMode === 'text' ? 'selected' : ''}
                    onClick={() => setInputMode('text')}
                  >
                    <Keyboard size={15} strokeWidth={2} />
                    Teks Langsung
                  </button>
                </div>

                <span className="local-pill" title="Seluruh model berjalan lokal di perangkat Anda">
                  <span className="dot live" />
                  Lokal
                </span>
              </div>
            </header>

            <div className="content cockpit-content">
              {inputMode === 'sign' && mode === 'vocabulary' && (
                <div className="notice compact-notice">
                  Pengenalan kata belum tersedia: izin penggunaan model perlu dikonfirmasi. Tidak ada
                  prediksi kosakata yang dihasilkan.
                </div>
              )}

              <div className="translate-grid cockpit-grid">
                {/* KOLOM KIRI: STUDIO KAMERA ISYARAT ATAU TEKS SUMBER */}
                {inputMode === 'sign' ? (
                  <section className="studio-left-card">
                    <div className="studio-top-strip">
                      <div className="tabs compact-tabs">
                        <button
                          className={mode === 'alphabet' ? 'selected' : ''}
                          onClick={() => {
                            camera.stop();
                            setMode('alphabet');
                          }}
                        >
                          Alfabet <span>A–Z</span>
                        </button>
                        <button
                          className={mode === 'vocabulary' ? 'selected' : ''}
                          onClick={() => {
                            camera.stop();
                            setMode('vocabulary');
                          }}
                        >
                          Kosakata <span>Belum tersedia</span>
                        </button>
                      </div>

                      {camera.running ? (
                        <button type="button" className="stop-cam-btn" onClick={camera.stop}>
                          Hentikan kamera
                        </button>
                      ) : (
                        <span className="studio-idle-tag">Siap diaktifkan</span>
                      )}
                    </div>

                    {preview}

                    <CameraHelp
                      camera={camera}
                      target={target}
                      onTargetChange={setTarget}
                      expectedHands={referenceHands[target] || 0}
                      inlineStatusMessage={normalizedCameraMessage}
                      onCapture={() => {
                        setText('');
                        setFeedback('');
                        camera.beginCalibration(target, referenceHands[target] || 0);
                      }}
                    />
                  </section>
                ) : (
                  <section className="studio-left-card text-input-card">
                    <div className="lang-pair-bar">
                      <div className="lang-select-field">
                        <label htmlFor="source-lang-select">Bahasa sumber</label>
                        <select
                          id="source-lang-select"
                          aria-label="Pilih bahasa sumber"
                          value={sourceLang}
                          onChange={(e) =>
                            setSourceLang(e.target.value as RegionalLanguageCode | 'auto')
                          }
                        >
                          <option value="auto">
                            Deteksi Otomatis ({spelledResult.detectedSourceLang.name})
                          </option>
                          <option value="id">Indonesia (Bahasa Indonesia)</option>
                          {regionalLanguages
                            .filter((l) => l.code !== 'id')
                            .map((l) => (
                              <option key={l.code} value={l.code}>
                                {l.name} ({l.nativeName})
                              </option>
                            ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        className="swap-lang-btn"
                        onClick={swapLanguages}
                        title="Tukar bahasa sumber dan tujuan"
                        aria-label="Tukar bahasa sumber dan tujuan"
                      >
                        <ArrowRightLeft size={16} strokeWidth={2} />
                        <span>Tukar</span>
                      </button>
                    </div>

                    <div className="transcript direct-text-box">
                      <div className="transcript-head">
                        <label htmlFor="transcript">TEKS SUMBER</label>
                        <div className="transcript-actions">
                          <button
                            type="button"
                            onClick={toggleVoiceInput}
                            title="Input suara (Speech-to-Text)"
                            aria-label="Rekam suara"
                          >
                            <Mic size={14} strokeWidth={2} />
                            {isListening ? 'Merekam…' : 'Suara'}
                          </button>
                          <button
                            type="button"
                            onClick={() => speakText(text)}
                            title="Bacakan teks sumber"
                            aria-label="Bacakan teks sumber"
                          >
                            <Volume2 size={15} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setText('');
                              setFeedback('');
                            }}
                          >
                            Bersihkan
                          </button>
                        </div>
                      </div>

                      {text.trim() && (
                        <span className="detected-lang-badge" data-testid="detected-language-badge">
                          <Sparkles size={13} strokeWidth={2} />{' '}
                          {sourceLang === 'auto'
                            ? `Terdeteksi: Bahasa ${spelledResult.detectedSourceLang.name}`
                            : `Sumber: Bahasa ${
                                regionalLanguages.find((l) => l.code === sourceLang)?.name ||
                                'Indonesia'
                              }`}
                        </span>
                      )}

                      <textarea
                        id="transcript"
                        className="direct-textarea"
                        value={text}
                        onChange={(e) => setText(e.target.value.slice(0, 200))}
                        placeholder="Ketik kalimat bahasa daerah atau Indonesia (misal: Aku mangan sega, Abdi hoyong nginum cai, Ambo pai ka pasa)…"
                      />

                      <div className="example-section">
                        <span className="example-label">CONTOH KALIMAT CEPAT:</span>
                        <div className="word-chips" aria-label="Contoh kalimat cepat">
                          {(QUICK_TEXT_EXAMPLES[sourceLang] || QUICK_TEXT_EXAMPLES.auto).map(
                            (sample) => (
                              <button
                                key={sample}
                                type="button"
                                className="word-chip"
                                onClick={() => setText(sample)}
                              >
                                {sample}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* KOLOM KANAN: PANEL EJAAN, KONTROL BAHASA & PLAKAT PUSAKA TERJEMAHAN-AKSARA */}
                <section className="results cockpit-results">
                  <div className="result-heading">
                    <span>
                      {inputMode === 'sign'
                        ? 'PENGENALAN ISYARAT & MAKNA NUSANTARA'
                        : 'TERJEMAHAN LINTAS BAHASA NUSANTARA'}
                    </span>
                    <span className="model-indicator">● On-device</span>
                  </div>

                  {inputMode === 'sign' && (
                    <div className="spelling-panel">
                      <div className="detected detected-compact" aria-live="polite">
                        <strong className="detected-badge">
                          {camera.result.signId?.slice(-1) || '—'}
                        </strong>
                        <div className="detected-meta">
                          <div className="detected-status-row">
                            <span>{statuses[camera.result.status]}</span>
                            <small>{Math.round(camera.result.confidence * 100)}% skor</small>
                          </div>
                          <meter
                            min="0"
                            max="1"
                            value={camera.result.confidence}
                            aria-label="Skor model"
                          />
                        </div>
                      </div>

                      <div className="transcript transcript-compact">
                        <div className="transcript-head">
                          <label htmlFor="transcript">HASIL EJAAN</label>
                          <div className="transcript-actions">
                            <button
                              type="button"
                              onClick={toggleVoiceInput}
                              title="Input suara (Speech-to-Text)"
                              aria-label="Rekam suara"
                            >
                              <Mic size={13} strokeWidth={2} />
                              {isListening ? 'Merekam…' : 'Suara'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setText((t) => (t ? `${t} ` : ''))}
                              title="Tambah spasi antar kata"
                            >
                              ␣ Spasi
                            </button>
                            <button
                              type="button"
                              onClick={() => setText((t) => t.slice(0, -1))}
                              title="Hapus huruf terakhir"
                            >
                              ⌫ Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => speakText(text)}
                              title="Bacakan ejaan"
                              aria-label="Bacakan ejaan"
                            >
                              <Volume2 size={14} strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setText('');
                                setFeedback('');
                              }}
                            >
                              Bersihkan
                            </button>
                          </div>
                        </div>

                        <textarea
                          id="transcript"
                          rows={2}
                          value={text}
                          onChange={(e) => setText(e.target.value.slice(0, 200))}
                          placeholder="Huruf isyarat stabil muncul otomatis di sini, atau pilih kosakata cepat di bawah…"
                        />

                        <div className="word-chips" aria-label="Saran kata kamus Bhasantara">
                          {suggestWords(text).map((w) => (
                            <button
                              key={w}
                              type="button"
                              className="word-chip"
                              onClick={() => applySuggestedWord(w)}
                            >
                              + {w}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="target-controls-row">
                    <div className="target-select-wrap">
                      <label htmlFor="regional-lang-select">Bahasa daerah</label>
                      <select
                        id="regional-lang-select"
                        aria-label="Pilih bahasa daerah"
                        value={language}
                        onChange={(e) => {
                          const c = e.target.value as RegionalLanguageCode;
                          setLanguage(c);
                          const m = regionalLanguages.find((x) => x.code === c);
                          if (m?.defaultScript) setAksaraScript(m.defaultScript);
                        }}
                      >
                        {regionalLanguages
                          .filter((l) => l.code !== 'id')
                          .map((l) => (
                            <option key={l.code} value={l.code}>
                              {l.name} ({l.nativeName})
                            </option>
                          ))}
                        <option value="id">Indonesia saja</option>
                      </select>
                    </div>

                    {language !== 'id' && (
                      <div className="register register-compact">
                        <span title={spelledResult.registerLabel}>Ragam</span>
                        <div>
                          {(['ngoko', 'krama'] as const).map((r) => (
                            <button
                              type="button"
                              className={r === register ? 'selected' : ''}
                              key={r}
                              onClick={() => setRegister(r)}
                            >
                              {r === 'ngoko' ? 'Ngoko' : 'Krama'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PLAKAT PUSAKA TERPADU: POROS INDONESIA ➔ BAHASA DAERAH ➔ AKSARA ASLI */}
                  <div className="heritage-plaque">
                    {(language !== 'id' || spelledResult.sourceLang !== 'id') && (
                      <div className="plaque-pivot-band">
                        <span>
                          {inputMode === 'text' && spelledResult.sourceLang !== 'id'
                            ? `POROS BAHASA INDONESIA (${spelledResult.detectedSourceLang.name.toUpperCase()} ➔ ID)`
                            : 'BAHASA INDONESIA'}
                        </span>
                        <b data-testid="pivot-indonesian-output">{idOutput}</b>
                      </div>
                    )}

                    {(language !== 'id' || inputMode === 'text') && (
                      <div className="plaque-main-stage">
                        <div className="output-header-row">
                          <span>
                            {language === 'id'
                              ? 'TERJEMAHAN BAHASA INDONESIA'
                              : `BAHASA ${activeLangMeta.name.toUpperCase()} · ${register.toUpperCase()}`}
                          </span>
                          <div className="output-actions">
                            <button
                              type="button"
                              onClick={() => speakText(String(regOutput || ''))}
                              title="Dengarkan terjemahan"
                              aria-label="Dengarkan terjemahan"
                            >
                              <Volume2 size={15} strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              onClick={copyTranslatedOutput}
                              title="Salin terjemahan"
                              aria-label="Salin terjemahan"
                            >
                              {copiedTranslation ? (
                                <Check size={15} strokeWidth={2} />
                              ) : (
                                <Copy size={15} strokeWidth={2} />
                              )}
                            </button>
                          </div>
                        </div>

                        <b
                          className="plaque-translation-text"
                          data-testid="regional-translation-output"
                        >
                          {regOutput}
                        </b>

                        <div className="plaque-meta-notes">
                          {spelledResult.matchedMeaning && (
                            <small className="meaning-note">{spelledResult.matchedMeaning}</small>
                          )}
                          {spelledResult.honorificVariant && (
                            <small className="meaning-note">
                              Ragam hormat orang tua:{' '}
                              <strong>{spelledResult.honorificVariant}</strong>
                            </small>
                          )}
                          {text.trim() && spelledResult.untranslatedTokens.length > 0 && (
                            <small className="coverage-note" data-testid="untranslated-tokens-note">
                              Belum tersedia di kamus lokal:{' '}
                              {spelledResult.untranslatedTokens.join(', ')}
                            </small>
                          )}
                        </div>
                      </div>
                    )}

                    {spelledResult.hasNativeAksara ? (
                      <div className="plaque-aksara-band" data-testid="native-aksara-card">
                        <div className="aksara-box-head">
                          <span>AKSARA ASLI · {spelledResult.aksaraLabel.toUpperCase()}</span>
                          <button
                            type="button"
                            className="aksara-copy-mini"
                            onClick={copyNativeAksara}
                            title="Salin aksara"
                            aria-label="Salin aksara"
                          >
                            {copiedAksara ? (
                              <Check size={13} strokeWidth={2} />
                            ) : (
                              <Copy size={13} strokeWidth={2} />
                            )}
                            <span>{copiedAksara ? 'Tersalin' : 'Salin'}</span>
                          </button>
                        </div>
                        <div className="aksara-box-glyph" data-testid="live-aksara-output">
                          {spelledResult.nativeAksaraText || '—'}
                        </div>
                      </div>
                    ) : (
                      language !== 'id' && (
                        <div className="plaque-latin-band" data-testid="no-aksara-note">
                          Ditulis dalam alfabet Latin — modul aksara tradisional untuk Bahasa{' '}
                          {activeLangMeta.name} belum tersedia.
                        </div>
                      )
                    )}
                  </div>

                  {camera.result.source === 'personal' && inputMode === 'sign' && (
                    <p className="personal-source compact-personal">
                      Model menggunakan contoh pribadi yang Anda beri label.
                    </p>
                  )}
                </section>
              </div>
            </div>
          </>
        ) : (
          <>
            <header>
              <span>Ruang Pusaka Bahasa &amp; Isyarat Nusantara</span>
              <div>
                <span className="local-pill">
                  <span className="dot live" />
                  Berjalan lokal
                </span>
                <span className="avatar">K</span>
              </div>
            </header>

            <div className="content">
              <div className="eyebrow">ISYARAT KECIL, MAKNA BESAR</div>
              <div className="page-title">
                <div>
                  <h1>
                    {page === 'Learn'
                      ? 'Sedikit setiap hari.'
                      : page === 'Dictionary'
                      ? 'Temukan sebuah makna.'
                      : 'Nyaman dengan caramu.'}
                  </h1>
                  <p>
                    {page === 'Learn'
                      ? 'Latih alfabet dengan kamera dan simpan perjalanan belajarmu.'
                      : page === 'Dictionary'
                      ? `Referensi alfabet BISINDO, kamus ${regionalCount} bahasa daerah Nusantara (${bhasantaraGlossary.length.toLocaleString('id-ID')} padanan), dan literasi Aksara.`
                      : 'Atur kamera, bahasa daerah, aksara, dan transparansi korpus budaya.'}
                  </p>
                </div>
                <span className="edition">BISINDO × BHASANTARA</span>
              </div>

              {page === 'Learn' && (
                <>
                  <div className="workspace-bar">
                    <div className="tabs">
                      <button
                        className={mode === 'alphabet' ? 'selected' : ''}
                        onClick={() => {
                          camera.stop();
                          setMode('alphabet');
                        }}
                      >
                        Alfabet <span>A–Z</span>
                      </button>
                      <button
                        className={mode === 'vocabulary' ? 'selected' : ''}
                        onClick={() => {
                          camera.stop();
                          setMode('vocabulary');
                        }}
                      >
                        Kosakata <span>Belum tersedia</span>
                      </button>
                    </div>
                    <span className="small">
                      {`${progress.xp} XP · ${progress.letters.length}/26 huruf`}
                    </span>
                  </div>

                  {mode === 'vocabulary' && (
                    <div className="notice">
                      Pengenalan kata belum tersedia: izin penggunaan model perlu dikonfirmasi. Tidak
                      ada prediksi kosakata yang dihasilkan.
                    </div>
                  )}

                  <div className="translate-grid">
                    <section>
                      {preview}
                      <div className="camera-controls">
                        <span role="status">{normalizedCameraMessage}</span>
                        {camera.running && <button onClick={camera.stop}>Hentikan kamera</button>}
                      </div>
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

                    <section className="results">
                      <div className="result-heading">
                        <span>LATIHAN HARI INI</span>
                        <span className="model-indicator">● On-device</span>
                      </div>

                      <div className="practice">
                        <label htmlFor="target">Latih huruf</label>
                        <select
                          id="target"
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
                        <img
                          src={`/ref/${target}/${target.toLowerCase()}_da7115.jpg`}
                          alt={`Contoh referensi huruf ${target}`}
                        />
                        <p>
                          Referensi {target}: {referenceHands[target] || '—'} tangan.{' '}
                          {weakLetters.includes(target)
                            ? 'Huruf ini masih sering tertukar pada uji foto.'
                            : 'Hasil uji foto terbatas; akurasi pengguna baru belum terukur.'}
                        </p>
                        <p role="status">
                          {feedback ||
                            'Ikuti jumlah dan posisi tangan pada foto, lalu tahan hingga stabil.'}
                        </p>
                      </div>

                      <div className="detected detected-compact" aria-live="polite">
                        <strong className="detected-badge">
                          {camera.result.signId?.slice(-1) || '—'}
                        </strong>
                        <div className="detected-meta">
                          <div className="detected-status-row">
                            <span>{statuses[camera.result.status]}</span>
                            <small>{Math.round(camera.result.confidence * 100)}% skor</small>
                          </div>
                          <meter
                            min="0"
                            max="1"
                            value={camera.result.confidence}
                            aria-label="Skor model"
                          />
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="notice" style={{ marginTop: 20 }}>
                    <Flame size={20} strokeWidth={2} /> {progress.days.length} hari latihan ·{' '}
                    {progress.xp} XP ·{' '}
                    {progress.letters.length >= 5
                      ? 'Pencapaian: Lima Huruf!'
                      : 'Kenali 5 huruf untuk pencapaian pertama.'}
                    <button
                      onClick={() =>
                        setTarget(letters.find((l) => !progress.letters.includes(l)) || 'A')
                      }
                    >
                      Latihan berikutnya
                    </button>
                  </div>
                </>
              )}

              {page === 'Dictionary' && (
                <>
                  <input
                    className="search"
                    aria-label="Cari kamus"
                    placeholder="Cari huruf, kata Indonesia, bahasa daerah, atau kalimat…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />

                  <h2>
                    Alfabet BISINDO <span className="small">A–Z · referensi dataset penelitian</span>
                  </h2>
                  <div className="letter-grid">
                    {letters
                      .filter((l) => l.toLowerCase().includes(query.toLowerCase()))
                      .map((l) => (
                        <button
                          key={l}
                          onClick={() => {
                            setTarget(l);
                            setMode('alphabet');
                            navigate('Learn');
                          }}
                        >
                          <img
                            src={`/ref/${l}/${l.toLowerCase()}_da7115.jpg`}
                            alt={`Referensi huruf ${l}`}
                            loading="lazy"
                          />
                          <b>{l}</b>
                          <small className="reference-label">
                            {referenceHands[l] || '—'} tangan ·{' '}
                            {weakLetters.includes(l) ? 'perlu perbaikan' : 'eksperimental'}
                          </small>
                          <span>
                            Latih huruf <ArrowUpRight size={16} strokeWidth={2} />
                          </span>
                        </button>
                      ))}
                  </div>

                  <p>
                    Foto penelitian, bukan pedoman bahasa yang telah diverifikasi komunitas.{' '}
                    <a
                      href="https://github.com/rhiosutoyo/Indonesian-Sign-Language-BISINDO-Hand-Sign-Detection-Dataset"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Sumber: Rhio Sutoyo dan tim (MIT)
                    </a>{' '}
                    ·{' '}
                    <a href="/ref/provenance.json" target="_blank" rel="noreferrer">
                      Asal setiap foto
                    </a>{' '}
                    ·{' '}
                    <a href={NUSAX_ATTRIBUTION.licensePath} target="_blank" rel="noreferrer">
                      Korpus Bahasa Daerah: {NUSAX_ATTRIBUTION.name} ({NUSAX_ATTRIBUTION.license})
                    </a>
                  </p>

                  <h2>Padanan kosakata</h2>
                  <p>
                    Materi bahasa saja. Pengenalan dan referensi isyarat kata belum tersedia. Semua
                    entri masih draf dan belum diverifikasi ahli.
                  </p>
                  <div className="word-grid">
                    {concepts
                      .filter((c) =>
                        [c.idText, c.ngoko, c.krama].join(' ').includes(query.toLowerCase())
                      )
                      .map((c) => (
                        <article key={c.id}>
                          <span className="draft">Draf · belum diverifikasi</span>
                          <h3>{c.idText}</h3>
                          <p>
                            Ngoko <b>{c.ngoko}</b> · Krama <b>{c.krama}</b>
                          </p>
                          <p>{c.note}</p>
                          <a href={c.source} target="_blank" rel="noreferrer">
                            Rujukan untuk peninjauan ↗
                          </a>
                        </article>
                      ))}
                  </div>

                  <h2>
                    Kamus Nusantara BHASANTARA × NusaX{' '}
                    <span className="small">
                      {regionalCount} Bahasa Daerah · Menampilkan {Math.min(24, filteredGlossary.length)} dari{' '}
                      {filteredGlossary.length.toLocaleString('id-ID')} padanan
                    </span>
                  </h2>
                  <div className="dict-lang-pills" role="tablist" aria-label="Filter bahasa daerah">
                    <button
                      type="button"
                      className={dictLangFilter === 'all' ? 'selected' : ''}
                      onClick={() => setDictLangFilter('all')}
                    >
                      Semua Bahasa
                    </button>
                    {regionalLanguages
                      .filter((l) => l.code !== 'id')
                      .map((l) => (
                        <button
                          key={l.code}
                          type="button"
                          className={dictLangFilter === l.code ? 'selected' : ''}
                          onClick={() => setDictLangFilter(l.code)}
                        >
                          {l.name}
                        </button>
                      ))}
                  </div>

                  <div className="word-grid">
                    {filteredGlossary.slice(0, 24).map((g, i) => {
                      const lMeta = regionalLanguages.find((l) => l.code === g.targetLang);
                      return (
                        <article key={`${g.targetLang}-${g.idTerm}-${i}`}>
                          <div className="glossary-card-head">
                            <span className="draft">
                              {lMeta?.name} ({lMeta?.nativeName})
                            </span>
                            <button
                              type="button"
                              className="tts-btn"
                              onClick={() => speakText(g.formal)}
                              title={`Dengarkan ${g.formal}`}
                            >
                              <Volume2 size={16} strokeWidth={2} />
                            </button>
                          </div>
                          <strong className="glossary-term">{g.idTerm}</strong>
                          <p>
                            Sehari-hari: <b>{g.casual}</b> · Halus: <b>{g.formal}</b>
                            {g.honorific && g.honorific !== g.formal ? (
                              <>
                                {' '}
                                · Hormat: <b>{g.honorific}</b>
                              </>
                            ) : null}
                          </p>
                          <p>
                            {g.meaning}
                            {lMeta?.defaultScript
                              ? ` · Aksara: ${transliterateToAksara(g.formal, lMeta.defaultScript)}`
                              : ''}
                          </p>
                        </article>
                      );
                    })}
                  </div>

                  <h2>
                    Contoh Kalimat Sejajar Nusantara{' '}
                    <span className="small">
                      Menampilkan {Math.min(24, filteredParallel.length)} dari {filteredParallel.length} kalimat
                    </span>
                  </h2>
                  <div className="word-grid">
                    {filteredParallel.slice(0, 24).map((p, i) => {
                      const lMeta = regionalLanguages.find(
                        (l) => l.code === (p.targetLang === 'id' ? p.sourceLang : p.targetLang)
                      );
                      return (
                        <article key={`${p.sourceLang}-${p.targetLang}-${i}`}>
                          <div className="glossary-card-head">
                            <span className="draft">
                              {lMeta?.name} · {p.domain}
                            </span>
                            <button
                              type="button"
                              className="tts-btn"
                              onClick={() => speakText(p.targetText)}
                              title="Dengarkan kalimat"
                            >
                              <Volume2 size={16} strokeWidth={2} />
                            </button>
                          </div>
                          <strong className="glossary-term">{p.idText}</strong>
                          <p>
                            <b>{p.targetText}</b>
                          </p>
                          <p>{p.context}</p>
                        </article>
                      );
                    })}
                  </div>

                  <BhasantaraAksaraGuide initialScript={aksaraScript} />
                </>
              )}

              {page === 'Settings' && (
                <div className="settings">
                  <section>
                    <h2>Preferensi</h2>
                    <label>
                      Kamera
                      <select
                        value={device}
                        onChange={(e) => {
                          camera.stop();
                          setDevice(e.target.value);
                        }}
                      >
                        <option value="">Kamera default</option>
                        {devices.map((d, i) => (
                          <option value={d.deviceId} key={d.deviceId || i}>
                            {d.label || `Kamera ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Mode pengenalan
                      <select value={mode} onChange={(e) => setMode(e.target.value)}>
                        <option value="alphabet">Alfabet A–Z</option>
                        <option value="vocabulary">Kosakata · tidak tersedia</option>
                      </select>
                    </label>
                    <label>
                      Bahasa keluaran
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as RegionalLanguageCode)}
                      >
                        {regionalLanguages
                          .filter((l) => l.code !== 'id')
                          .map((l) => (
                            <option key={l.code} value={l.code}>
                              Indonesia + {l.name} ({l.nativeName})
                            </option>
                          ))}
                        <option value="id">Indonesia</option>
                      </select>
                    </label>
                    <label>
                      Ragam bahasa
                      <select
                        value={register}
                        onChange={(e) => setRegister(e.target.value as Register)}
                      >
                        <option value="ngoko">Sehari-hari (Ngoko / Loma)</option>
                        <option value="krama">Halus (Krama / Lemes)</option>
                      </select>
                    </label>
                    <label>
                      Aksara rujukan kamus
                      <select
                        value={aksaraScript}
                        onChange={(e) => setAksaraScript(e.target.value as AksaraScript)}
                      >
                        <option value="JAVANESE">Aksara Jawa (Hanacaraka)</option>
                        <option value="SUNDANESE">Aksara Sunda (Ngangalagena)</option>
                        <option value="BALINESE">Aksara Bali (Carakan)</option>
                      </select>
                    </label>
                  </section>

                  <section>
                    <h2>Contoh pribadi lokal</h2>
                    <p>
                      {camera.personalCount} contoh pribadi tersimpan. Contoh dipakai sebagai data
                      tambahan untuk inferensi, bukan sebagai bukti kebenaran isyarat.
                    </p>
                    <button
                      className="delete-personal"
                      onClick={() => camera.removePersonalExamples()}
                    >
                      Hapus semua contoh pribadi
                    </button>
                    <p role="status">{camera.calibrationNotice}</p>

                    <h2>Transparansi model &amp; korpus bahasa</h2>
                    <p>
                      TwoHand v1 · koreksi rasio kamera aktif · nearest-prototype · 254 fitur
                      gabungan bentuk dan posisi hingga dua tangan · 26 label alfabet. MediaPipe
                      0.10.14, model landmark float16 v1. Ambang skor pemisahan 35% (kalibrasi data
                      latih), konsensus 6 dari 8 frame.
                    </p>
                    <p>
                      Integrasi Bahasa Daerah &amp; Aksara memadukan leksikon tingkat tutur{' '}
                      <a
                        href="https://github.com/tyobramas/bhasantara"
                        target="_blank"
                        rel="noreferrer"
                      >
                        BHASANTARA
                      </a>{' '}
                      dengan korpus terbuka{' '}
                      <a href={NUSAX_ATTRIBUTION.url} target="_blank" rel="noreferrer">
                        {NUSAX_ATTRIBUTION.name} ({NUSAX_ATTRIBUTION.license})
                      </a>{' '}
                      mencakup {regionalCount} bahasa daerah Nusantara (
                      {bhasantaraGlossary.length.toLocaleString('id-ID')} padanan terkurasi &amp;{' '}
                      {bhasantaraParallel.length} kalimat paralel), serta transliterasi Aksara Jawa,
                      Sunda, dan Bali.
                    </p>
                    <p>
                      Diagnostik sesi terakhir: {camera.metrics.fps.toFixed(1)} FPS ·{' '}
                      {camera.metrics.latency.toFixed(1)} ms deteksi dan klasifikasi.
                    </p>

                    <h2>Privasi &amp; lisensi terbuka</h2>
                    <p>
                      Frame diproses di browser. Progres tersimpan di IndexedDB perangkat ini. Tidak
                      ada akun, pelacakan, atau layanan inferensi eksternal.
                    </p>
                    <a href="/licenses/Alphabet-Dataset-MIT.txt">Lisensi dataset alfabet (MIT)</a>
                    <p>
                      <a href={NUSAX_ATTRIBUTION.licensePath} target="_blank" rel="noreferrer">
                        Lisensi korpus NusaX ({NUSAX_ATTRIBUTION.license})
                      </a>
                    </p>
                    <p>
                      <a href="/models/twohand-v1/evaluation.json" target="_blank" rel="noreferrer">
                        Hasil evaluasi model dan batas pengujian
                      </a>
                    </p>
                    <p>
                      <a href="/licenses/Jemari-MIT.txt">Atribusi fondasi Jemari</a>
                    </p>
                  </section>
                </div>
              )}

              {storageError && (
                <p role="alert" className="notice">
                  {storageError}
                </p>
              )}

              <footer>
                <span>Setiap isyarat membuka percakapan lintas budaya Nusantara.</span>
                <span>
                  Merawat Bahasa &amp; Aksara <span className="footer-flower">✳</span>
                </span>
              </footer>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
