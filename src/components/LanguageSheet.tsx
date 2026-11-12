import React from 'react';
import { Check } from 'lucide-react';
import { regionalLanguages, type RegionalLanguageCode } from '../language';
import type { Prefs } from '../app/prefs';
import { Sheet } from './Sheet';
import { registerNames } from '../app/labels';

export function LanguageSheet({
    open,
    onClose,
    prefs,
    update,
}: {
    open: boolean;
    onClose: () => void;
    prefs: Prefs;
    update: (p: Partial<Prefs>) => void;
}) {
    const regional = regionalLanguages.filter((l) => l.code !== 'id');
    const active = regionalLanguages.find((l) => l.code === prefs.lang);
    const names = registerNames(prefs.lang);

    const choose = (code: RegionalLanguageCode) => {
        const meta = regionalLanguages.find((l) => l.code === code);
        update({ lang: code, ...(meta?.defaultScript ? { script: meta.defaultScript } : {}) });
    };

    return (
        <Sheet open={open} onClose={onClose} title="Bahasa tujuan">
            <p className="sheet-lead">Isyaratmu diterjemahkan lewat Bahasa Indonesia ke bahasa ini, lalu dibacakan.</p>

            {active?.hasSpeechLevels && (
                <div className="field">
                    <span className="field-label" id="register-label">
                        Ragam tutur
                    </span>
                    <div className="segment segment--fill segment--stack" role="radiogroup" aria-labelledby="register-label">
                        {(['ngoko', 'krama'] as const).map((r) => (
                            <button
                                key={r}
                                type="button"
                                role="radio"
                                aria-checked={prefs.register === r}
                                className={prefs.register === r ? 'is-on' : ''}
                                onClick={() => update({ register: r })}
                            >
                                {r === 'ngoko' ? names.casual : names.polite}
                                <small>{r === 'ngoko' ? 'ke teman sebaya' : 'ke orang tua / orang baru'}</small>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <ul className="lang-list" role="radiogroup" aria-label="Pilih bahasa">
                {regional.map((l) => (
                    <li key={l.code}>
                        <button
                            type="button"
                            role="radio"
                            aria-checked={prefs.lang === l.code}
                            className={`lang-row${prefs.lang === l.code ? ' is-on' : ''}`}
                            onClick={() => choose(l.code)}
                        >
                            <span className="lang-row-text">
                                <b>{l.name}</b>
                                <small>
                                    {l.nativeName} · {l.region}
                                </small>
                            </span>
                            {l.defaultScript && <span className="tag">Aksara</span>}
                            {prefs.lang === l.code && <Check size={20} strokeWidth={2.4} aria-hidden="true" className="lang-check" />}
                        </button>
                    </li>
                ))}
                <li>
                    <button
                        type="button"
                        role="radio"
                        aria-checked={prefs.lang === 'id'}
                        className={`lang-row${prefs.lang === 'id' ? ' is-on' : ''}`}
                        onClick={() => choose('id')}
                    >
                        <span className="lang-row-text">
                            <b>Bahasa Indonesia saja</b>
                            <small>Tanpa terjemahan bahasa daerah</small>
                        </span>
                        {prefs.lang === 'id' && <Check size={20} strokeWidth={2.4} aria-hidden="true" className="lang-check" />}
                    </button>
                </li>
            </ul>
            <div className="sheet-foot">
                <button type="button" className="btn btn--primary btn--block" onClick={onClose}>
                    Pakai {active?.code === 'id' ? 'Bahasa Indonesia' : `Bahasa ${active?.name ?? ''}`}
                </button>
            </div>
        </Sheet>
    );
}
