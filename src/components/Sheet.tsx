import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Lembar bawah (HP) / dialog tengah (desktop) berbasis <dialog> native:
 * fokus terkunci di dalam, Escape menutup, klik latar menutup.
 */
export function Sheet({
    open,
    onClose,
    title,
    children,
    className = '',
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    className?: string;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();

    useEffect(() => {
        const d = ref.current;
        if (!d) return;
        if (open && !d.open) d.showModal();
        if (!open && d.open) d.close();
    }, [open]);

    return (
        <dialog
            ref={ref}
            className={`sheet ${className}`}
            aria-labelledby={titleId}
            onCancel={(e) => {
                e.preventDefault();
                onClose();
            }}
            onClick={(e) => {
                if (e.target === ref.current) onClose();
            }}
        >
            <div className="sheet-body">
                <div className="sheet-grip" aria-hidden="true" />
                <header className="sheet-head">
                    <h2 id={titleId}>{title}</h2>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup">
                        <X size={20} strokeWidth={2} aria-hidden="true" />
                    </button>
                </header>
                {open && children}
            </div>
        </dialog>
    );
}
