import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Sheet } from './Sheet';

export interface PickerOption<T extends string> {
    value: T;
    label: string;
    hint?: string;
}

/**
 * Pengganti <select> bawaan browser: tombol yang membuka lembar pilihan
 * (bottom sheet di HP, dialog di desktop). Pilihan berupa radio, bisa dengan keyboard.
 */
export function Picker<T extends string>({
    label,
    value,
    options,
    onChange,
    disabled,
    title,
    className = '',
    grid = false,
}: {
    label: string;
    value: T;
    options: PickerOption<T>[];
    onChange: (v: T) => void;
    disabled?: boolean;
    title?: string;
    className?: string;
    /** Tampilkan pilihan sebagai kisi (mis. huruf A–Z). */
    grid?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const current = options.find((o) => o.value === value) ?? options[0];

    return (
        <>
            <button
                type="button"
                className={`picker ${className}`}
                onClick={() => setOpen(true)}
                disabled={disabled}
                aria-haspopup="dialog"
                aria-label={`${label}: ${current?.label ?? ''}`}
            >
                <span className="picker-value">{current?.label}</span>
                <ChevronDown size={18} strokeWidth={2.2} aria-hidden="true" />
            </button>
            <Sheet open={open} onClose={() => setOpen(false)} title={title ?? label}>
                <ul className={grid ? 'pick-grid' : 'lang-list'} role="radiogroup" aria-label={label}>
                    {options.map((o) => (
                        <li key={o.value}>
                            <button
                                type="button"
                                role="radio"
                                aria-checked={o.value === value}
                                className={grid ? `key key--btn${o.value === value ? ' is-target' : ''}` : `lang-row${o.value === value ? ' is-on' : ''}`}
                                onClick={() => {
                                    onChange(o.value);
                                    setOpen(false);
                                }}
                            >
                                {grid ? (
                                    o.label
                                ) : (
                                    <>
                                        <span className="lang-row-text">
                                            <b>{o.label}</b>
                                            {o.hint && <small>{o.hint}</small>}
                                        </span>
                                        {o.value === value && <Check size={20} strokeWidth={2.4} aria-hidden="true" className="lang-check" />}
                                    </>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            </Sheet>
        </>
    );
}
