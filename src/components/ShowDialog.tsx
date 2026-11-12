import React, { useEffect, useRef, useState } from 'react';
import { RotateCw, Volume2, X } from 'lucide-react';
import type { MyMessage } from '../app/conversation';
import { SCRIPT_LANG_ATTR, languageLabel } from '../app/labels';

/**
 * Layar penuh berhuruf besar untuk ditunjukkan ke lawan bicara.
 * "Putar" membalik tampilan 180° untuk orang yang duduk berhadapan.
 */
export function ShowDialog({
    message,
    onClose,
    onSpeak,
}: {
    message: MyMessage | null;
    onClose: () => void;
    onSpeak: (m: MyMessage) => void;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const [flipped, setFlipped] = useState(false);

    useEffect(() => {
        const d = ref.current;
        if (!d) return;
        if (message && !d.open) {
            setFlipped(false);
            d.showModal();
        }
        if (!message && d.open) d.close();
    }, [message]);

    return (
        <dialog
            ref={ref}
            className="show"
            aria-label="Tunjukkan ke lawan bicara"
            onCancel={(e) => {
                e.preventDefault();
                onClose();
            }}
        >
            {message && (
                <div className={`show-inner${flipped ? ' is-flipped' : ''}`}>
                    <p className="show-lang">{languageLabel(message.lang)}</p>
                    <p className="show-text" lang={message.lang === 'id' ? 'id' : undefined}>
                        {message.spoken}
                    </p>
                    {message.aksara && (
                        <p className={`show-aksara aksara aksara--${message.script}`} lang={SCRIPT_LANG_ATTR[message.script ?? '']}>
                            {message.aksara}
                        </p>
                    )}
                    {message.lang !== 'id' && <p className="show-id">Artinya: {message.indonesian}</p>}
                </div>
            )}
            <div className="show-bar">
                <button type="button" className="btn btn--ghost-dark" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}>
                    <RotateCw size={18} strokeWidth={2} aria-hidden="true" />
                    Putar
                </button>
                {message && (
                    <button type="button" className="btn btn--ghost-dark" onClick={() => onSpeak(message)}>
                        <Volume2 size={18} strokeWidth={2} aria-hidden="true" />
                        Ucapkan lagi
                    </button>
                )}
                <button type="button" className="btn btn--light" onClick={onClose}>
                    <X size={18} strokeWidth={2} aria-hidden="true" />
                    Tutup
                </button>
            </div>
        </dialog>
    );
}
