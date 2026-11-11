import React, { useMemo, useState } from 'react';
import { Search, Volume2 } from 'lucide-react';
import {
    bhasantaraGlossary,
    bhasantaraParallel,
    regionalLanguages,
    transliterateToAksara,
    NUSAX_ATTRIBUTION,
    type RegionalLanguageCode,
    type AksaraScript,
} from '../language';
import { BhasantaraAksaraGuide } from '../components/BhasantaraAksaraGuide';
import { SCRIPT_LANG_ATTR } from '../app/labels';
import { speak } from '../app/speech';

type Tab = 'alphabet' | 'words' | 'sentences' | 'aksara';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const PAGE = 30;

export function DictionaryPage({
    defaultLang,
    script,
    referenceHands,
    onPractice,
}: {
    defaultLang: RegionalLanguageCode;
    script: AksaraScript;
    referenceHands: Record<string, number>;
    onPractice: (letter: string) => void;
}) {
    const [tab, setTab] = useState<Tab>('words');
    const [query, setQuery] = useState('');
    const [lang, setLang] = useState<RegionalLanguageCode | 'all'>(defaultLang === 'id' ? 'all' : defaultLang);
    const [limit, setLimit] = useState(PAGE);
    const q = query.trim().toLowerCase();
    const regional = regionalLanguages.filter((l) => l.code !== 'id');

    const glossary = useMemo(
        () =>
            tab !== 'words'
                ? []
                : bhasantaraGlossary
                      .filter((g) => (lang === 'all' || g.targetLang === lang) && (!q || [g.idTerm, g.casual, g.formal, g.meaning].join(' ').toLowerCase().includes(q)))
                      .sort((a, b) => Number(a.source === 'nusax-auto') - Number(b.source === 'nusax-auto')),
        [tab, lang, q]
    );
    const sentences = useMemo(
        () =>
            tab !== 'sentences'
                ? []
                : bhasantaraParallel.filter(
                      (p) => (lang === 'all' || p.targetLang === lang || p.sourceLang === lang) && (!q || [p.idText, p.targetText, p.context].join(' ').toLowerCase().includes(q))
                  ),
        [tab, lang, q]
    );

    const reset = () => setLimit(PAGE);

    const langFilter = (
        <div className="chips chips--scroll" role="radiogroup" aria-label="Saring bahasa">
            {[{ code: 'all' as const, name: 'Semua' }, ...regional].map((l) => (
                <button
                    key={l.code}
                    type="button"
                    role="radio"
                    aria-checked={lang === l.code}
                    className={`chip-btn${lang === l.code ? ' is-on' : ''}`}
                    onClick={() => {
                        setLang(l.code);
                        reset();
                    }}
                >
                    {l.name}
                </button>
            ))}
        </div>
    );

    return (
        <div className="page">
            <header className="page-head">
                <h1 className="title">Kamus</h1>
                <p className="lead">Padanan kata dan kalimat dari Bahasa Indonesia ke 10 bahasa daerah, alfabet isyarat, dan aksara.</p>
            </header>

            <label className="search">
                <Search size={19} strokeWidth={2} aria-hidden="true" />
                <span className="sr-only">Cari kamus</span>
                <input
                    type="search"
                    aria-label="Cari kamus"
                    placeholder="Cari kata Indonesia atau bahasa daerah"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        reset();
                    }}
                />
            </label>

            <div className="segment segment--sm segment--fill" role="tablist" aria-label="Bagian kamus">
                {(
                    [
                        ['words', 'Kosakata'],
                        ['sentences', 'Kalimat'],
                        ['alphabet', 'Alfabet'],
                        ['aksara', 'Aksara'],
                    ] as const
                ).map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={tab === id}
                        className={tab === id ? 'is-on' : ''}
                        onClick={() => {
                            setTab(id);
                            reset();
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {tab === 'words' && (
                <>
                    {langFilter}
                    <p className="fine">
                        {glossary.length.toLocaleString('id-ID')} entri{q ? ` untuk “${query.trim()}”` : ''}. Semua masih draf.
                    </p>
                    {glossary.length === 0 ? (
                        <p className="empty">Tidak ada padanan untuk “{query.trim()}”. Coba kata dasarnya, misalnya “makan” untuk “memakan”.</p>
                    ) : (
                        <ul className="entries">
                            {glossary.slice(0, limit).map((g, i) => {
                                const meta = regionalLanguages.find((l) => l.code === g.targetLang);
                                const spoken = g.formal || g.casual;
                                const aksara = meta?.defaultScript ? g.aksara || transliterateToAksara(g.casual, meta.defaultScript) : '';
                                return (
                                    <li key={`${g.targetLang}-${g.idTerm}-${i}`} className="entry">
                                        <div className="entry-main">
                                            <h3 className="entry-title">{g.idTerm}</h3>
                                            <p className="entry-forms">
                                                <span>{g.casual}</span>
                                                {g.formal && g.formal !== g.casual && <span className="entry-alt">halus: {g.formal}</span>}
                                                {g.honorific && g.honorific !== g.formal && <span className="entry-alt">hormat: {g.honorific}</span>}
                                            </p>
                                            {aksara && meta?.defaultScript && (
                                                <p className={`aksara aksara--${meta.defaultScript} entry-aksara`} lang={SCRIPT_LANG_ATTR[meta.defaultScript]}>
                                                    {aksara}
                                                </p>
                                            )}
                                            <span className="entry-tags">
                                                <span className="tag">{meta?.name}</span>
                                                <span className="tag tag--muted">{g.source === 'nusax-auto' ? 'Korpus otomatis' : 'Draf'}</span>
                                            </span>
                                        </div>
                                        <button type="button" className="icon-btn" onClick={() => speak(spoken, g.targetLang)} aria-label={`Dengarkan ${spoken}`}>
                                            <Volume2 size={19} strokeWidth={2} aria-hidden="true" />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {glossary.length > limit && (
                        <button type="button" className="btn btn--secondary btn--block" onClick={() => setLimit((n) => n + PAGE)}>
                            Tampilkan {Math.min(PAGE, glossary.length - limit)} lagi
                        </button>
                    )}
                    <p className="fine">
                        Sebagian entri diekstrak otomatis dari{' '}
                        <a href={NUSAX_ATTRIBUTION.licensePath} target="_blank" rel="noreferrer">
                            {NUSAX_ATTRIBUTION.name} ({NUSAX_ATTRIBUTION.license})
                        </a>{' '}
                        dan belum ditinjau penutur.
                    </p>
                </>
            )}

            {tab === 'sentences' && (
                <>
                    {langFilter}
                    {sentences.length === 0 ? (
                        <p className="empty">Tidak ada kalimat yang cocok. Hapus kata pencarian atau pilih bahasa lain.</p>
                    ) : (
                        <ul className="entries">
                            {sentences.slice(0, limit).map((p, i) => {
                                const code = p.targetLang === 'id' ? p.sourceLang : p.targetLang;
                                const meta = regionalLanguages.find((l) => l.code === code);
                                return (
                                    <li key={`${code}-${i}`} className="entry">
                                        <div className="entry-main">
                                            <p className="entry-title entry-title--sentence">{p.targetText}</p>
                                            <p className="entry-sub">{p.idText}</p>
                                            {p.formalText && <p className="entry-alt">Ragam halus: {p.formalText}</p>}
                                            <span className="entry-tags">
                                                <span className="tag">{meta?.name}</span>
                                                {p.context && <span className="tag tag--muted">{p.context}</span>}
                                            </span>
                                        </div>
                                        <button type="button" className="icon-btn" onClick={() => speak(p.targetText, code)} aria-label="Dengarkan kalimat">
                                            <Volume2 size={19} strokeWidth={2} aria-hidden="true" />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {sentences.length > limit && (
                        <button type="button" className="btn btn--secondary btn--block" onClick={() => setLimit((n) => n + PAGE)}>
                            Tampilkan {Math.min(PAGE, sentences.length - limit)} lagi
                        </button>
                    )}
                </>
            )}

            {tab === 'alphabet' && (
                <>
                    <div className="letter-grid">
                        {LETTERS.filter((l) => !q || l.toLowerCase() === q).map((l) => (
                            <button key={l} type="button" className="letter-card" onClick={() => onPractice(l)} aria-label={`Latih huruf ${l}`}>
                                <img src={`/ref/${l}/${l.toLowerCase()}_da7115.jpg`} alt="" loading="lazy" width={240} height={180} />
                                <span className="letter-card-foot">
                                    <span className="key">{l}</span>
                                    <small>{referenceHands[l] ? `${referenceHands[l]} tangan` : ''}</small>
                                </span>
                            </button>
                        ))}
                    </div>
                    <p className="fine">
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

            {tab === 'aksara' && <BhasantaraAksaraGuide initialScript={script} />}
        </div>
    );
}
