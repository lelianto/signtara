import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, ChevronDown, GraduationCap, Hand, Settings, TextQuote } from 'lucide-react';
import { useCamera } from '../recognition/useCamera';
import { useWordRecognizer } from '../recognition/useWordRecognizer';
import { readProgress, award, emptyProgress } from '../storage/progress';
import { understandReply, type ComposedMessage } from '../engine/compose';
import { usePrefs } from './prefs';
import { configureSpeech, speak } from './speech';
import { newId, type Message, type MyMessage } from './conversation';
import { languageLabel, languageMeta, registerNames } from './labels';
import { TalkPage, type TalkMode } from '../pages/TalkPage';
import { PhrasesPage } from '../pages/PhrasesPage';
import { LearnPage, type LearnTab } from '../pages/LearnPage';
import { DictionaryPage } from '../pages/DictionaryPage';
import { SettingsPage } from '../pages/SettingsPage';
import { LanguageSheet } from '../components/LanguageSheet';
import { ShowDialog } from '../components/ShowDialog';

type Page = 'talk' | 'phrases' | 'learn' | 'dict' | 'settings';

const NAV: Array<[Page, typeof Hand, string]> = [
    ['talk', Hand, 'Bicara'],
    ['phrases', TextQuote, 'Frasa'],
    ['learn', GraduationCap, 'Belajar'],
    ['dict', BookOpen, 'Kamus'],
];

export function App() {
    const { prefs, update } = usePrefs();
    const [page, setPage] = useState<Page>('talk');
    const [talkMode, setTalkMode] = useState<TalkMode>('sign');
    const [learnTab, setLearnTab] = useState<LearnTab>('letters');
    const [wordMode, setWordMode] = useState(false);
    const [draft, setDraft] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [showing, setShowing] = useState<MyMessage | null>(null);
    const [langOpen, setLangOpen] = useState(false);
    const [progress, setProgress] = useState(emptyProgress);
    const [target, setTarget] = useState('A');
    const [feedback, setFeedback] = useState('');
    const [storageError, setStorageError] = useState('');
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [referenceHands, setReferenceHands] = useState<Record<string, number>>({});
    const [weakLetters, setWeakLetters] = useState<string[]>([]);

    const wordsActive = (page === 'talk' && talkMode === 'sign' && wordMode) || (page === 'learn' && learnTab === 'words');

    const buzz = () => {
        if (prefs.haptics) navigator.vibrate?.(12);
    };

    const camera = useCamera(
        (letter, source) => {
            if (wordsActive) return; // Mode kata: huruf dari worker paralel diabaikan.
            if (page === 'talk') {
                setDraft((t) => (t + letter).slice(-200));
                buzz();
            } else if (page === 'learn') {
                if (letter === target) {
                    setFeedback(
                        source === 'personal' ? `Cocok dengan contoh pribadi ${letter}. Belum diverifikasi pengajar.` : `Bagus! Model mengenali huruf ${letter}.`
                    );
                    buzz();
                    award(letter)
                        .then(setProgress)
                        .catch(() => setStorageError('Penyimpanan lokal tidak tersedia. Progres tidak tersimpan.'));
                } else {
                    setFeedback(`Terbaca ${letter}. Coba lagi untuk ${target}.`);
                }
            }
        },
        () => {
            if (page === 'talk' && prefs.autoSpace && !wordsActive) setDraft((t) => (t && !t.endsWith(' ') ? `${t} ` : t));
        }
    );

    const words = useWordRecognizer(camera, wordsActive, (word) => {
        if (page !== 'talk') return;
        setDraft((t) => `${t && !t.endsWith(' ') ? `${t} ` : t}${word.toUpperCase()} `.slice(-200));
        buzz();
    });

    /* ---------- data referensi & perangkat ---------- */
    useEffect(() => {
        fetch('/ref/provenance.json')
            .then((r) => r.json())
            .then((p) =>
                setReferenceHands(
                    Object.fromEntries(Object.entries(p.entries as Record<string, { expectedHands: number }>).map(([l, e]) => [l, e.expectedHands]))
                )
            )
            .catch(() => {});
        fetch('/models/twohand-v1/evaluation.json')
            .then((r) => r.json())
            .then((p) => setWeakLetters(p.perClass.filter((c: { correct: number; total: number }) => c.correct < c.total).map((c: { label: string }) => c.label)))
            .catch(() => {});
        readProgress()
            .then(setProgress)
            .catch(() => setStorageError('Progres tidak dapat dibaca. Periksa penyimpanan browser.'));
    }, []);

    useEffect(() => {
        navigator.mediaDevices
            ?.enumerateDevices?.()
            .then((d) => setDevices(d.filter((x) => x.kind === 'videoinput')))
            .catch(() => {});
    }, [camera.running]);

    // Ganti mode ketik/dengar: kamera dimatikan supaya hemat baterai.
    useEffect(() => {
        if (talkMode !== 'sign') camera.stop();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [talkMode]);

    const startCamera = () => camera.start(prefs.device, prefs.facing);
    const flipCamera = () => {
        const facing = prefs.facing === 'user' ? 'environment' : 'user';
        update({ facing, device: '' });
        camera.start('', facing);
    };

    useEffect(() => {
        if (camera.running) camera.start(prefs.device, prefs.facing);
        // Ganti perangkat dari Pengaturan saat kamera menyala.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prefs.device]);

    const go = (p: Page) => {
        if (p !== page) camera.stop();
        setPage(p);
        setFeedback('');
        window.scrollTo({ top: 0 });
    };

    /* ---------- percakapan ---------- */
    // Diatur saat render (bukan efek) supaya ucapan yang dipicu di render yang sama sudah memakai pilihan terbaru.
    configureSpeech({ rate: prefs.speechRate, voices: prefs.voices });
    const speakMessage = useCallback((m: MyMessage) => speak(m.spoken, m.lang), []);

    const send = (c: ComposedMessage, via: MyMessage['via'], show: boolean) => {
        const m: MyMessage = {
            id: newId(),
            at: Date.now(),
            who: 'me',
            via,
            spoken: c.spoken,
            indonesian: c.indonesian,
            lang: prefs.lang,
            aksara: c.result.hasNativeAksara ? c.result.nativeAksaraText : null,
            script: c.result.nativeScript,
            untranslated: prefs.lang === 'id' ? [] : c.result.untranslatedTokens,
            corrections: c.corrections,
        };
        setMessages((list) => [...list, m]);
        speakMessage(m);
        if (show) setShowing(m);
    };

    const reply = (heard: string, via: 'voice' | 'type') => {
        const r = understandReply(heard);
        setMessages((list) => [
            ...list,
            {
                id: newId(),
                at: Date.now(),
                who: 'them',
                via,
                heard,
                meaning: r.indonesian,
                sourceName: r.sourceName,
                sameAsMeaning: r.sourceLang === 'id' || r.indonesian.toLowerCase() === heard.toLowerCase(),
            },
        ]);
    };

    const meta = languageMeta(prefs.lang);
    const names = registerNames(prefs.lang);
    const langChip = (
        <button type="button" className="lang-chip" onClick={() => setLangOpen(true)} aria-label={`Bahasa tujuan: ${languageLabel(prefs.lang)}. Ganti bahasa`}>
            <span className="lang-chip-name">{languageLabel(prefs.lang)}</span>
            {meta.hasSpeechLevels && prefs.lang !== 'id' && <span className="lang-chip-reg">{prefs.register === 'ngoko' ? names.casual : names.polite}</span>}
            <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>
    );

    return (
        <div className={`app app--${page}`}>
            <a className="skip" href="#main">
                Lewati ke isi
            </a>

            <header className="topbar">
                <button type="button" className="wordmark" onClick={() => go('talk')} aria-label="ISYARA, ke halaman Bicara">
                    isyara<span aria-hidden="true">.</span>
                </button>
                <div className="topbar-end">
                    {langChip}
                    <button
                        type="button"
                        className={`icon-btn${page === 'settings' ? ' is-on' : ''}`}
                        onClick={() => go('settings')}
                        aria-label="Pengaturan"
                        aria-current={page === 'settings' ? 'page' : undefined}
                    >
                        <Settings size={21} strokeWidth={2} aria-hidden="true" />
                    </button>
                </div>
            </header>

            <nav className="rail" aria-label="Navigasi utama">
                <button type="button" className="wordmark" onClick={() => go('talk')} aria-label="ISYARA, ke halaman Bicara">
                    isyara<span aria-hidden="true">.</span>
                </button>
                <p className="rail-tagline">Isyarat jadi suara dalam bahasa daerahmu.</p>
                <div className="rail-lang">
                    <span className="field-label">Bahasa tujuan</span>
                    {langChip}
                </div>
                <ul className="rail-list">
                    {[...NAV, ['settings', Settings, 'Pengaturan'] as [Page, typeof Hand, string]].map(([id, Icon, label]) => (
                        <li key={id}>
                            <button type="button" className={`rail-item${page === id ? ' is-on' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => go(id)}>
                                <Icon size={20} strokeWidth={2} aria-hidden="true" />
                                <span>{label}</span>
                            </button>
                        </li>
                    ))}
                </ul>
                <p className="rail-foot">Video diproses di perangkat ini dan tidak pernah diunggah.</p>
            </nav>

            <main id="main" className="main">
                {storageError && (
                    <p className="notice notice--warn banner" role="alert">
                        {storageError}
                    </p>
                )}

                {page === 'talk' && (
                    <TalkPage
                        camera={camera}
                        words={words}
                        wordMode={wordMode}
                        setWordMode={setWordMode}
                        prefs={prefs}
                        draft={draft}
                        setDraft={setDraft}
                        mode={talkMode}
                        setMode={setTalkMode}
                        messages={messages}
                        onSend={send}
                        onReply={reply}
                        onShow={setShowing}
                        onSpeak={speakMessage}
                        onStartCamera={startCamera}
                        onFlip={flipCamera}
                        canFlip={devices.length > 1}
                        onOpenLanguage={() => setLangOpen(true)}
                        onOpenLearnWords={() => {
                            setLearnTab('words');
                            go('learn');
                        }}
                    />
                )}
                {page === 'phrases' && (
                    <PhrasesPage prefs={prefs} update={update} onSend={(c, show) => send(c, 'phrase', show)} onOpenLanguage={() => setLangOpen(true)} />
                )}
                {page === 'learn' && (
                    <LearnPage
                        tab={learnTab}
                        setTab={(t) => {
                            setLearnTab(t);
                            setFeedback('');
                        }}
                        camera={camera}
                        words={words}
                        onStartCamera={startCamera}
                        onFlip={flipCamera}
                        canFlip={devices.length > 1}
                        progress={progress}
                        target={target}
                        setTarget={(l) => {
                            setTarget(l);
                            setFeedback('');
                        }}
                        feedback={feedback}
                        referenceHands={referenceHands}
                        weakLetters={weakLetters}
                        onCapture={() => {
                            setFeedback('');
                            camera.beginCalibration(target, referenceHands[target] || 0);
                        }}
                    />
                )}
                {page === 'dict' && (
                    <DictionaryPage
                        defaultLang={prefs.lang}
                        script={prefs.script}
                        referenceHands={referenceHands}
                        onPractice={(l) => {
                            setTarget(l);
                            setLearnTab('letters');
                            go('learn');
                        }}
                    />
                )}
                {page === 'settings' && (
                    <SettingsPage
                        prefs={prefs}
                        update={update}
                        camera={camera}
                        devices={devices}
                        onOpenLanguage={() => setLangOpen(true)}
                        messageCount={messages.length}
                        onClearConversation={() => setMessages([])}
                    />
                )}
            </main>

            <nav className="tabbar" aria-label="Navigasi utama">
                {NAV.map(([id, Icon, label]) => (
                    <button key={id} type="button" className={`tab${page === id ? ' is-on' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => go(id)}>
                        <Icon size={22} strokeWidth={page === id ? 2.3 : 1.9} aria-hidden="true" />
                        <span>{label}</span>
                    </button>
                ))}
            </nav>

            <LanguageSheet open={langOpen} onClose={() => setLangOpen(false)} prefs={prefs} update={update} />
            <ShowDialog message={showing} onClose={() => setShowing(null)} onSpeak={speakMessage} />
        </div>
    );
}
