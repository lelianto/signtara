import React, { useMemo, useState } from 'react';
import { Maximize2, Plus, Trash2, Volume2 } from 'lucide-react';
import { PHRASE_GROUPS } from '../engine/phrases';
import { composeTyped, type ComposedMessage } from '../engine/compose';
import type { Prefs } from '../app/prefs';
import { languageLabel } from '../app/labels';

const MINE = 'mine';

export function PhrasesPage({
    prefs,
    update,
    onSend,
    onOpenLanguage,
}: {
    prefs: Prefs;
    update: (p: Partial<Prefs>) => void;
    onSend: (c: ComposedMessage, show: boolean) => void;
    onOpenLanguage: () => void;
}) {
    const [group, setGroup] = useState(prefs.customPhrases.length ? MINE : PHRASE_GROUPS[0].id);
    const [draft, setDraft] = useState('');
    const [sent, setSent] = useState('');

    const list = group === MINE ? prefs.customPhrases : PHRASE_GROUPS.find((g) => g.id === group)?.phrases ?? [];
    const rows = useMemo(
        () => list.map((p) => ({ id: p, composed: composeTyped(p, prefs.lang, prefs.register, prefs.script) })),
        [list, prefs.lang, prefs.register, prefs.script]
    );

    const fire = (c: ComposedMessage, show: boolean) => {
        onSend(c, show);
        setSent(c.spoken);
        window.setTimeout(() => setSent((s) => (s === c.spoken ? '' : s)), 2400);
    };

    const addPhrase = (e: React.FormEvent) => {
        e.preventDefault();
        const p = draft.trim().replace(/\s+/g, ' ');
        if (!p || prefs.customPhrases.includes(p)) return;
        update({ customPhrases: [p, ...prefs.customPhrases].slice(0, 30) });
        setDraft('');
        setGroup(MINE);
    };

    return (
        <div className="page">
            <header className="page-head">
                <h1 className="title">Frasa cepat</h1>
                <p className="lead">
                    Ketuk sekali untuk mengucapkan dalam{' '}
                    <button type="button" className="link-btn" onClick={onOpenLanguage}>
                        Bahasa {languageLabel(prefs.lang)}
                    </button>
                    . Cocok untuk kalimat yang sering dipakai tanpa perlu mengeja.
                </p>
            </header>

            <div className="chips chips--scroll" role="tablist" aria-label="Kelompok frasa">
                <button type="button" role="tab" aria-selected={group === MINE} className={`chip-btn${group === MINE ? ' is-on' : ''}`} onClick={() => setGroup(MINE)}>
                    Frasa saya
                </button>
                {PHRASE_GROUPS.map((g) => (
                    <button key={g.id} type="button" role="tab" aria-selected={group === g.id} className={`chip-btn${group === g.id ? ' is-on' : ''}`} onClick={() => setGroup(g.id)}>
                        {g.label}
                    </button>
                ))}
            </div>

            {group === MINE && (
                <form className="card add-phrase" onSubmit={addPhrase}>
                    <label className="field">
                        <span className="field-label">Tambah frasa milikmu (Bahasa Indonesia)</span>
                        <span className="input-row">
                            <input className="input" value={draft} maxLength={120} onChange={(e) => setDraft(e.target.value)} placeholder="Contoh: Nama saya Rina" />
                            <button type="submit" className="btn btn--primary" disabled={!draft.trim()}>
                                <Plus size={18} strokeWidth={2.2} aria-hidden="true" />
                                Simpan
                            </button>
                        </span>
                    </label>
                    <p className="fine">Tersimpan di browser ini saja.</p>
                </form>
            )}

            {rows.length === 0 ? (
                <p className="empty">Belum ada frasa milikmu. Tulis kalimat yang sering kamu pakai, misalnya nama atau alamat.</p>
            ) : (
                <ul className="phrase-list">
                    {rows.map(({ id, composed }) => (
                        <li key={id} className="phrase">
                            <button type="button" className="phrase-main" onClick={() => fire(composed, false)}>
                                <span className="phrase-text">{composed.spoken}</span>
                                {prefs.lang !== 'id' && <span className="phrase-id">{id}</span>}
                            </button>
                            <span className="phrase-actions">
                                <button type="button" className="icon-btn" onClick={() => fire(composed, false)} aria-label={`Ucapkan: ${composed.spoken}`}>
                                    <Volume2 size={19} strokeWidth={2} aria-hidden="true" />
                                </button>
                                <button type="button" className="icon-btn" onClick={() => fire(composed, true)} aria-label={`Tunjukkan: ${composed.spoken}`}>
                                    <Maximize2 size={18} strokeWidth={2} aria-hidden="true" />
                                </button>
                                {group === MINE && (
                                    <button
                                        type="button"
                                        className="icon-btn"
                                        onClick={() => update({ customPhrases: prefs.customPhrases.filter((p) => p !== id) })}
                                        aria-label={`Hapus frasa: ${id}`}
                                    >
                                        <Trash2 size={18} strokeWidth={2} aria-hidden="true" />
                                    </button>
                                )}
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            <p className="fine">Terjemahan bahasa daerah masih draf; kata yang belum ada di kamus dibiarkan dalam Bahasa Indonesia.</p>

            <div className={`toast${sent ? ' is-on' : ''}`} role="status" aria-live="polite">
                {sent && <>Diucapkan dan ditambahkan ke percakapan: “{sent}”</>}
            </div>
        </div>
    );
}
