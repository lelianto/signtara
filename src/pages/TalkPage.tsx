import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Delete, Ear, Hand, Keyboard, Maximize2, Mic, Square, Volume2, X } from 'lucide-react';
import type { useCamera } from '../recognition/useCamera';
import type { useWordRecognizer } from '../recognition/useWordRecognizer';
import { composeMessage, composeTyped, suggestNext, applySuggestion, type ComposedMessage } from '../engine/compose';
import { PHRASE_GROUPS } from '../engine/phrases';
import type { Prefs } from '../app/prefs';
import type { Message, MyMessage } from '../app/conversation';
import { SCRIPT_LANG_ATTR, languageLabel, registerNames, languageMeta } from '../app/labels';
import { speechLangFor, useListener } from '../app/speech';
import { CameraStage } from '../components/CameraStage';
import { useWordModelAvailable } from '../app/useWordModelAvailable';

type Cam = ReturnType<typeof useCamera>;
type WordRec = ReturnType<typeof useWordRecognizer>;
export type TalkMode = 'sign' | 'type' | 'listen';

const STARTERS = [PHRASE_GROUPS[0].phrases[1], PHRASE_GROUPS[0].phrases[0], PHRASE_GROUPS[1].phrases[1]];

export function TalkPage({
    camera,
    words,
    wordMode,
    setWordMode,
    prefs,
    draft,
    setDraft,
    mode,
    setMode,
    messages,
    onSend,
    onReply,
    onShow,
    onSpeak,
    onStartCamera,
    onFlip,
    canFlip,
    onOpenLanguage,
    onOpenLearnWords,
}: {
    camera: Cam;
    words: WordRec;
    wordMode: boolean;
    setWordMode: (v: boolean) => void;
    prefs: Prefs;
    draft: string;
    setDraft: React.Dispatch<React.SetStateAction<string>>;
    mode: TalkMode;
    setMode: (m: TalkMode) => void;
    messages: Message[];
    onSend: (c: ComposedMessage, via: MyMessage['via'], show: boolean) => void;
    onReply: (heard: string, via: 'voice' | 'type') => void;
    onShow: (m: MyMessage) => void;
    onSpeak: (m: MyMessage) => void;
    onStartCamera: () => void;
    onFlip: () => void;
    canFlip: boolean;
    onOpenLanguage: () => void;
    onOpenLearnWords: () => void;
}) {
    const [typed, setTyped] = useState('');
    const [literal, setLiteral] = useState(false);
    const [replyTyped, setReplyTyped] = useState('');
    const listener = useListener();
    const modelAvailable = useWordModelAvailable();
    // Kata isyarat bisa dipakai jika ada model bawaan ATAU kata rekaman pribadi.
    const canUseWords = words.words.length > 0 || modelAvailable || words.modelStatus === 'ready';
    const listenLangs = speechLangFor(prefs.lang);
    const [listenLang, setListenLang] = useState(listenLangs[0]);
    const threadRef = useRef<HTMLDivElement>(null);

    useEffect(() => setListenLang(speechLangFor(prefs.lang)[0]), [prefs.lang]);
    useEffect(() => setLiteral(false), [draft === '']);

    useEffect(() => {
        const el = threadRef.current;
        if (el && messages.length) el.scrollTop = el.scrollHeight;
    }, [messages.length]);

    const source = mode === 'type' ? typed : draft;
    const composed = useMemo(() => {
        if (!source.trim()) return null;
        return mode === 'type'
            ? composeTyped(source, prefs.lang, prefs.register, prefs.script)
            : composeMessage(source, prefs.lang, prefs.register, prefs.script, { normalize: !literal });
    }, [source, mode, prefs.lang, prefs.register, prefs.script, literal]);

    const suggestions = useMemo(() => (mode === 'sign' && !wordMode ? suggestNext(draft) : []), [draft, mode, wordMode]);

    const send = (show: boolean) => {
        if (!composed) return;
        onSend(composed, mode === 'type' ? 'type' : 'sign', show);
        if (mode === 'type') setTyped('');
        else setDraft('');
    };

    // Pintasan keyboard saat mengeja: Spasi, Backspace, Enter = ucapkan.
    useEffect(() => {
        if (mode !== 'sign') return;
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement | null;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
            if (document.querySelector('dialog[open]')) return;
            // Di desktop, huruf dari keyboard fisik ikut masuk ke ejaan untuk koreksi cepat.
            if (/^[a-zA-Z]$/.test(e.key)) {
                e.preventDefault();
                setDraft((t) => (t + e.key.toUpperCase()).slice(-200));
                return;
            }
            // Spasi/Enter pada tombol yang sedang fokus tetap menekan tombol itu.
            if (el && /^(BUTTON|SUMMARY|A)$/.test(el.tagName) && (e.key === ' ' || e.key === 'Enter')) return;
            if (e.key === ' ') {
                e.preventDefault();
                setDraft((t) => (t && !t.endsWith(' ') ? `${t} ` : t));
            } else if (e.key === 'Backspace') {
                e.preventDefault();
                setDraft((t) => t.slice(0, -1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                send(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const finishListening = () => {
        listener.stop();
        const heard = listener.transcript.trim();
        if (heard) {
            onReply(heard, 'voice');
            listener.setTranscript('');
        }
    };

    const langName = languageLabel(prefs.lang);
    const names = registerNames(prefs.lang);
    const meta = languageMeta(prefs.lang);
    const targetLabel =
        prefs.lang === 'id' ? 'Bahasa Indonesia' : `Bahasa ${langName}${meta.hasSpeechLevels ? ` · ${prefs.register === 'ngoko' ? names.casual : names.polite}` : ''}`;
    const showAksara = prefs.showAksara && composed?.result.hasNativeAksara && composed.result.nativeAksaraText;

    return (
        <div className="talk">
            {/* ------------------------------ Percakapan ------------------------------ */}
            <section className="thread" aria-label="Percakapan" ref={threadRef}>
                {messages.length === 0 ? (
                    <div className="thread-empty">
                        <h1 className="display">
                            <span className="muted">Bicara dengan isyarat.</span>
                            <br />
                            Didengar dalam Bahasa {langName}.
                        </h1>
                        <p className="lead">
                            Eja kata dengan jari. BISARA membacanya sebagai Bahasa Indonesia, menerjemahkannya, lalu mengucapkannya untuk lawan
                            bicaramu. Balasan mereka muncul di sini sebagai tulisan.
                        </p>
                        <div className="starter">
                            <span className="field-label">Coba langsung</span>
                            <div className="chips">
                                {STARTERS.map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        className="chip-btn"
                                        onClick={() => onSend(composeTyped(p, prefs.lang, prefs.register, prefs.script), 'phrase', false)}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <p className="fine">Terjemahan bahasa daerah masih draf dan belum ditinjau penutur asli.</p>
                    </div>
                ) : (
                    <ol className="bubbles">
                        {messages.map((m) => (
                            <li key={m.id} className={`bubble-row bubble-row--${m.who}`}>
                                {m.who === 'me' ? (
                                    <article className="bubble bubble--me">
                                        <span className="bubble-meta">
                                            Kamu · {languageLabel(m.lang)}
                                            {m.via === 'sign' ? ' · isyarat' : m.via === 'phrase' ? ' · frasa' : ' · ketik'}
                                        </span>
                                        <p className="bubble-text">{m.spoken}</p>
                                        {prefs.showAksara && m.aksara && (
                                            <p className={`aksara aksara--${m.script} bubble-aksara`} lang={SCRIPT_LANG_ATTR[m.script ?? '']}>
                                                {m.aksara}
                                            </p>
                                        )}
                                        {m.lang !== 'id' && <p className="bubble-sub">{m.indonesian}</p>}
                                        {m.untranslated.length > 0 && (
                                            <p className="bubble-note">Belum ada di kamus, dibiarkan apa adanya: {m.untranslated.join(', ')}</p>
                                        )}
                                        <div className="bubble-actions">
                                            <button type="button" className="mini-btn" onClick={() => onSpeak(m)}>
                                                <Volume2 size={16} strokeWidth={2} aria-hidden="true" />
                                                Ucapkan
                                            </button>
                                            <button type="button" className="mini-btn" onClick={() => onShow(m)}>
                                                <Maximize2 size={16} strokeWidth={2} aria-hidden="true" />
                                                Tunjukkan
                                            </button>
                                        </div>
                                    </article>
                                ) : (
                                    <article className="bubble bubble--them">
                                        <span className="bubble-meta">
                                            Lawan bicara · {m.via === 'voice' ? 'suara' : 'ketik'}
                                            {m.sameAsMeaning ? '' : ` · terdengar Bahasa ${m.sourceName}`}
                                        </span>
                                        <p className="bubble-text">{m.heard}</p>
                                        {!m.sameAsMeaning && <p className="bubble-sub">Artinya: {m.meaning}</p>}
                                    </article>
                                )}
                            </li>
                        ))}
                    </ol>
                )}
            </section>

            {/* ------------------------------ Dok input ------------------------------ */}
            <section className="dock" aria-label="Tulis pesan">
                <div className="dock-head">
                    <div className="segment segment--icons" role="tablist" aria-label="Cara bicara">
                        {(
                            [
                                ['sign', Hand, 'Isyarat'],
                                ['type', Keyboard, 'Ketik'],
                                ['listen', Ear, 'Balasan'],
                            ] as const
                        ).map(([id, Icon, label]) => (
                            <button
                                key={id}
                                type="button"
                                role="tab"
                                aria-selected={mode === id}
                                className={mode === id ? 'is-on' : ''}
                                onClick={() => setMode(id)}
                            >
                                <Icon size={17} strokeWidth={2} aria-hidden="true" />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="dock-body">
                {mode === 'sign' && (
                    <>
                        <CameraStage
                            camera={camera}
                            onStart={onStartCamera}
                            onFlip={onFlip}
                            canFlip={canFlip}
                            compact={messages.length > 0}
                            overlay={
                                wordMode && words.phase !== 'off' ? (
                                    <span className={`word-phase word-phase--${words.phase}`}>
                                        {words.phase === 'signing'
                                            ? 'Merekam isyarat kata…'
                                            : 'Siap: angkat tangan, isyaratkan satu kata, turunkan. Bahu dan wajah sebaiknya terlihat.'}
                                    </span>
                                ) : undefined
                            }
                        />

                        {canUseWords && (
                        <div className="recog-mode">
                            <div className="segment segment--sm" role="radiogroup" aria-label="Yang dikenali kamera">
                                <button type="button" role="radio" aria-checked={!wordMode} className={!wordMode ? 'is-on' : ''} onClick={() => setWordMode(false)}>
                                    Ejaan huruf
                                </button>
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={wordMode}
                                    className={wordMode ? 'is-on' : ''}
                                    onClick={() => (canUseWords ? setWordMode(true) : onOpenLearnWords())}
                                >
                                    Kata isyarat
                                </button>
                            </div>
                            <span className="fine">
                                {wordMode
                                    ? words.modelStatus === 'loading'
                                        ? 'Memuat model kata…'
                                        : words.notice ||
                                          [
                                              words.modelStatus === 'ready' ? `${words.modelWords.length} kata bawaan` : '',
                                              words.words.length ? `${words.words.length} kata rekamanmu` : '',
                                          ]
                                              .filter(Boolean)
                                              .join(' · ') ||
                                          'Model kata belum tersedia. Rekam katamu sendiri di tab Belajar.'
                                    : words.words.length || modelAvailable
                                      ? prefs.autoSpace
                                          ? 'Turunkan tangan sebentar untuk spasi'
                                          : 'Spasi lewat tombol di bawah'
                                      : 'Kata isyarat: rekam dulu di tab Belajar'}
                            </span>
                        </div>
                        )}

                        <div className="draft-box">
                            <div className="draft" role="status" aria-label="Ejaan" data-testid="draft" data-value={draft} aria-live="polite">
                                {draft ? (
                                    <>
                                        {draft.split('').map((ch, i) =>
                                            ch === ' ' ? (
                                                <span key={i} className="key-gap" aria-hidden="true" />
                                            ) : (
                                                <span key={i} className="key" aria-hidden="true">
                                                    {ch}
                                                </span>
                                            )
                                        )}
                                        <span className="caret" aria-hidden="true" />
                                        <span className="sr-only">{draft}</span>
                                    </>
                                ) : (
                                    <span className="draft-empty">Ejaanmu muncul di sini</span>
                                )}
                            </div>
                            <div className="draft-tools">
                                <button type="button" className="tool" onClick={() => setDraft((t) => (t && !t.endsWith(' ') ? `${t} ` : t))} disabled={!draft} aria-label="Spasi">
                                    <span className="tool-glyph" aria-hidden="true">␣</span>
                                </button>
                                <button type="button" className="tool" onClick={() => setDraft((t) => t.slice(0, -1))} disabled={!draft} aria-label="Hapus huruf terakhir">
                                    <Delete size={19} strokeWidth={2} aria-hidden="true" />
                                </button>
                                <button type="button" className="tool" onClick={() => setDraft('')} disabled={!draft} aria-label="Bersihkan ejaan">
                                    <X size={19} strokeWidth={2} aria-hidden="true" />
                                </button>
                            </div>
                        </div>

                        {suggestions.length > 0 && (
                            <div className="chips chips--scroll" aria-label="Saran kata">
                                {suggestions.map((w) => (
                                    <button key={w} type="button" className="chip-btn" onClick={() => setDraft((t) => applySuggestion(t, w))}>
                                        {w}
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {mode === 'type' && (
                    <label className="field">
                        <span className="field-label">Tulis dalam Bahasa Indonesia atau bahasa daerah</span>
                        <textarea
                            className="input input--area"
                            value={typed}
                            maxLength={300}
                            onChange={(e) => setTyped(e.target.value)}
                            placeholder="Contoh: Saya mau minum air"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    send(false);
                                }
                            }}
                        />
                    </label>
                )}

                {mode === 'listen' && (
                    <div className="listen">
                        {listenLangs.length > 1 && (
                            <div className="segment segment--sm" role="radiogroup" aria-label="Bahasa yang didengar">
                                {listenLangs.map((l) => (
                                    <button key={l} type="button" role="radio" aria-checked={listenLang === l} className={listenLang === l ? 'is-on' : ''} onClick={() => setListenLang(l)}>
                                        {l === 'id-ID' ? 'Indonesia' : langName}
                                    </button>
                                ))}
                            </div>
                        )}
                        <button
                            type="button"
                            className={`mic${listener.listening ? ' is-on' : ''}`}
                            onClick={() => (listener.listening ? finishListening() : listener.start(listenLang))}
                            disabled={!listener.available}
                            aria-pressed={listener.listening}
                        >
                            {listener.listening ? <Square size={26} strokeWidth={2.2} aria-hidden="true" /> : <Mic size={28} strokeWidth={2} aria-hidden="true" />}
                            <span>{listener.listening ? 'Selesai mendengar' : 'Dengarkan lawan bicara'}</span>
                        </button>
                        <p className="listen-live" aria-live="polite">
                            {listener.transcript || (listener.listening ? 'Silakan bicara…' : 'Arahkan HP ke lawan bicara, lalu tekan tombol di atas.')}
                        </p>
                        {!listener.listening && listener.transcript && (
                            <button type="button" className="btn btn--primary btn--block" onClick={finishListening}>
                                Masukkan ke percakapan
                            </button>
                        )}
                        {listener.error && (
                            <p className="notice notice--warn" role="alert">
                                {listener.error}
                            </p>
                        )}
                        <form
                            className="reply-type"
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (replyTyped.trim()) {
                                    onReply(replyTyped.trim(), 'type');
                                    setReplyTyped('');
                                }
                            }}
                        >
                            <label className="field">
                                <span className="field-label">Atau lawan bicara mengetik balasan</span>
                                <span className="input-row">
                                    <input className="input" value={replyTyped} maxLength={300} onChange={(e) => setReplyTyped(e.target.value)} placeholder="Ketik balasan…" />
                                    <button type="submit" className="btn btn--secondary" disabled={!replyTyped.trim()}>
                                        Kirim
                                    </button>
                                </span>
                            </label>
                        </form>
                    </div>
                )}

                </div>

                {mode !== 'listen' && (
                    <div className={`preview${composed ? '' : ' is-empty'}`} aria-live="polite">
                        <button type="button" className="preview-lang" onClick={onOpenLanguage} aria-label={`Ganti bahasa tujuan, sekarang ${targetLabel}`}>
                            {targetLabel}
                            <span aria-hidden="true">▾</span>
                        </button>
                        {composed ? (
                            <>
                                <p className="preview-text" data-testid="translation-output">
                                    {composed.spoken}
                                </p>
                                {showAksara && (
                                    <p
                                        className={`aksara aksara--${composed.result.nativeScript} preview-aksara`}
                                        data-testid="live-aksara-output"
                                        lang={SCRIPT_LANG_ATTR[composed.result.nativeScript ?? '']}
                                    >
                                        {composed.result.nativeAksaraText}
                                    </p>
                                )}
                                {prefs.lang !== 'id' && <p className="preview-sub">Bahasa Indonesia: {composed.indonesian}</p>}
                                {composed.corrections.length > 0 && (
                                    <p className="preview-fix">
                                        Dibaca sebagai <b>{composed.indonesian.toLowerCase()}</b>.{' '}
                                        <button type="button" className="link-btn" onClick={() => setLiteral(true)}>
                                            Pakai ejaan asli
                                        </button>
                                    </p>
                                )}
                                {literal && mode === 'sign' && (
                                    <p className="preview-fix">
                                        Memakai ejaan asli.{' '}
                                        <button type="button" className="link-btn" onClick={() => setLiteral(false)}>
                                            Rapikan otomatis
                                        </button>
                                    </p>
                                )}
                            </>
                        ) : (
                            <p className="preview-text is-empty">Terjemahan muncul di sini</p>
                        )}
                        <div className="send-row">
                            <button type="button" className="btn btn--primary btn--lg send-main" onClick={() => send(false)} disabled={!composed}>
                                <Volume2 size={21} strokeWidth={2.2} aria-hidden="true" />
                                Ucapkan
                            </button>
                            <button type="button" className="btn btn--secondary btn--lg" onClick={() => send(true)} disabled={!composed}>
                                <Maximize2 size={19} strokeWidth={2} aria-hidden="true" />
                                Tunjukkan
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
