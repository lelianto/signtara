import React, { useState } from 'react';
import { ArrowLeftRight, Check, Copy, Volume2 } from 'lucide-react';
import {
    aksaraGuideData,
    transliterateToAksara,
    analyzeCulturalLiteracy,
    regionalLanguages,
    type AksaraScript,
    type AksaraItem,
    type TransliterateDirection,
    type RegionalLanguageCode,
} from '../language/bhasantara';
import { SCRIPT_LANG_ATTR } from '../app/labels';
import { speak } from '../app/speech';
import { Picker } from './Picker';

const SCRIPTS: Array<[AksaraScript, string, string]> = [
    ['JAVANESE', 'Jawa', 'Nglegena'],
    ['SUNDANESE', 'Sunda', 'Ngangalagena'],
    ['BALINESE', 'Bali', 'Wianjana'],
];

const CULTURE_SAMPLES: Array<[string, RegionalLanguageCode, string]> = [
    ['matur nuwun', 'jv', 'Matur nuwun'],
    ['sampurasun', 'sun', 'Sampurasun'],
    ['om swastyastu', 'ban', 'Om swastyastu'],
    ['mator sakalangkong', 'mad', 'Sakalangkong'],
    ['horas', 'bbc', 'Horas'],
    ['siri na pacce', 'bug', 'Siri na pacce'],
    ['huma betang', 'nij', 'Huma betang'],
];

const SCRIPT_SPEECH: Record<AksaraScript, RegionalLanguageCode> = { JAVANESE: 'jv', SUNDANESE: 'sun', BALINESE: 'ban' };

/** Panduan aksara (konversi dua arah + tabel huruf) dan catatan budaya. */
export function BhasantaraAksaraGuide({ initialScript = 'JAVANESE' }: { initialScript?: AksaraScript }) {
    const [script, setScript] = useState<AksaraScript>(initialScript);
    const [direction, setDirection] = useState<TransliterateDirection>('LATIN_TO_AKSARA');
    const [category, setCategory] = useState('Nglegena');
    const [copied, setCopied] = useState<string | null>(null);
    const [sample, setSample] = useState('matur nuwun');
    const [cultureLang, setCultureLang] = useState<RegionalLanguageCode>('jv');
    const [cultureQuery, setCultureQuery] = useState('matur nuwun');

    const data = aksaraGuideData[script];
    const categories = Object.keys(data);
    const activeCategory = categories.includes(category) ? category : categories[0];
    const converted = transliterateToAksara(sample, script, direction);
    const culture = analyzeCulturalLiteracy(cultureQuery, cultureLang);
    const toAksara = direction === 'LATIN_TO_AKSARA';

    const flash = (key: string) => {
        setCopied(key);
        window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1400);
    };

    const copyGlyph = (item: AksaraItem) => {
        navigator.clipboard?.writeText(item.glyph).catch(() => {});
        flash(`${item.latin}-${item.glyph}`);
        if (!toAksara) setSample((s) => `${s}${item.glyph}`);
    };

    return (
        <div className="aksara-guide">
            <section className="card" aria-labelledby="aksara-title">
                <div className="card-head">
                    <h2 id="aksara-title" className="card-title">
                        Aksara Nusantara
                    </h2>
                    <div className="segment segment--sm" role="tablist" aria-label="Pilih aksara">
                        {SCRIPTS.map(([code, label, defaultCat]) => (
                            <button
                                key={code}
                                type="button"
                                role="tab"
                                aria-selected={script === code}
                                className={script === code ? 'is-on' : ''}
                                onClick={() => {
                                    setScript(code);
                                    setCategory(defaultCat);
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="converter">
                    <label className="field">
                        <span className="field-label">{toAksara ? 'Tulisan Latin' : 'Tulisan aksara'}</span>
                        <input id="aksara-latin-input" className="input" value={sample} onChange={(e) => setSample(e.target.value)} placeholder={toAksara ? 'Contoh: sugeng enjang' : 'Tempel aksara, atau ketuk huruf di bawah'} />
                    </label>
                    <button
                        type="button"
                        className="icon-btn converter-swap"
                        onClick={() => {
                            setSample(converted);
                            setDirection(toAksara ? 'AKSARA_TO_LATIN' : 'LATIN_TO_AKSARA');
                        }}
                        aria-label="Tukar arah konversi"
                    >
                        <ArrowLeftRight size={18} strokeWidth={2} aria-hidden="true" />
                    </button>
                    <div className="converter-out">
                        <span className="field-label">{toAksara ? `Aksara ${SCRIPTS.find((s) => s[0] === script)?.[1]}` : 'Bacaan Latin'}</span>
                        <p className={toAksara ? `aksara aksara--${script} converter-glyph` : 'converter-glyph'} lang={toAksara ? SCRIPT_LANG_ATTR[script] : undefined} data-testid="aksara-converter-result">
                            {converted || '–'}
                        </p>
                        <span className="converter-actions">
                            <button type="button" className="mini-btn" onClick={() => speak(toAksara ? sample : converted, SCRIPT_SPEECH[script])}>
                                <Volume2 size={15} strokeWidth={2} aria-hidden="true" /> Dengarkan
                            </button>
                            <button
                                type="button"
                                className="mini-btn"
                                onClick={() => {
                                    if (!converted) return;
                                    navigator.clipboard?.writeText(converted).catch(() => {});
                                    flash('sample');
                                }}
                            >
                                {copied === 'sample' ? <Check size={15} strokeWidth={2} aria-hidden="true" /> : <Copy size={15} strokeWidth={2} aria-hidden="true" />}
                                {copied === 'sample' ? 'Tersalin' : 'Salin'}
                            </button>
                        </span>
                    </div>
                </div>

                <div className="chips chips--scroll" role="tablist" aria-label="Kelompok huruf">
                    {categories.map((c) => (
                        <button key={c} type="button" role="tab" aria-selected={activeCategory === c} className={`chip-btn${activeCategory === c ? ' is-on' : ''}`} onClick={() => setCategory(c)}>
                            {c}
                        </button>
                    ))}
                </div>

                <div className="glyph-grid">
                    {data[activeCategory]?.map((item, i) => {
                        const key = `${item.latin}-${item.glyph}`;
                        return (
                            <button key={`${key}-${i}`} type="button" className="glyph" onClick={() => copyGlyph(item)} aria-label={`Salin ${item.latin}`}>
                                <span className={`aksara aksara--${script}`} lang={SCRIPT_LANG_ATTR[script]} aria-hidden="true">
                                    {item.glyph}
                                </span>
                                <small>{copied === key ? 'Tersalin' : item.latin}</small>
                            </button>
                        );
                    })}
                </div>
                <p className="fine">Ketuk huruf untuk menyalin. Transliterasi otomatis, belum divalidasi ahli aksara.</p>
            </section>

            <section className="card" aria-labelledby="culture-title">
                <h2 id="culture-title" className="card-title">
                    Makna & budaya
                </h2>
                <div className="chips chips--scroll" aria-label="Contoh istilah">
                    {CULTURE_SAMPLES.map(([q, code, label]) => (
                        <button
                            key={q}
                            type="button"
                            className={`chip-btn${cultureQuery.toLowerCase() === q ? ' is-on' : ''}`}
                            onClick={() => {
                                setCultureQuery(q);
                                setCultureLang(code);
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="input-row">
                    <input className="input" aria-label="Istilah daerah" value={cultureQuery} onChange={(e) => setCultureQuery(e.target.value)} placeholder="Contoh: matur nuwun" />
                    <Picker
                        label="Bahasa istilah"
                        value={cultureLang}
                        onChange={setCultureLang}
                        options={regionalLanguages.filter((l) => l.code !== 'id').map((l) => ({ value: l.code, label: l.name, hint: l.nativeName }))}
                    />
                </div>
                <div className="culture" data-testid="cultural-literacy-card">
                    <h3>{culture.term}</h3>
                    <p>{culture.analysis}</p>
                    <p>
                        <b>Asal kata:</b> {culture.etymology}
                    </p>
                    <p>
                        <b>{culture.registerLevel}.</b> {culture.culturalInsight}
                    </p>
                    {culture.usageExamples.length > 0 && (
                        <p>
                            <b>Contoh:</b> {culture.usageExamples.join(' · ')}
                        </p>
                    )}
                </div>
            </section>
        </div>
    );
}
