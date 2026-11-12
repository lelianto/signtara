import React, { useState } from 'react';
import { FlaskConical, Plus, Trash2, X } from 'lucide-react';
import type { useWordRecognizer } from '../recognition/useWordRecognizer';
import { SUGGESTED_WORDS, MAX_WORD_LENGTH } from '../recognition/vocabulary';

type Words = ReturnType<typeof useWordRecognizer>;

const fmt = (n: number | null | undefined) => (n == null ? '–' : n.toFixed(2));
/** Nama dataset yang mudah dibaca untuk atribusi (slug tak dikenal ditampilkan apa adanya). */
const DATASET_NAMES: Record<string, string> = {
    'bisindo-40-kata-mp4': 'BISINDO 40 Kata',
    'bisindo-dinamis-5kata-b': 'BISINDO Dinamis',
    'wl-bisindo': 'WL-BISINDO',
};
const pct = (n: number | null | undefined) => (n == null ? '–' : `${Math.round(n * 100)}%`);

/** Mengajari kata isyarat milik pengguna (3 rekaman per kata, dicocokkan dengan DTW). */
export function WordsPanel({ words, cameraOn }: { words: Words; cameraOn: boolean }) {
    const [draft, setDraft] = useState('');
    const rec = words.recording;
    const m = words.lastMatch;
    const known = new Set(words.words.map((w) => w.word));
    const suggestions = SUGGESTED_WORDS.filter((w) => !known.has(w)).slice(0, 8);

    const phaseText = !cameraOn
        ? 'Nyalakan kamera untuk merekam atau menguji kata.'
        : words.phase === 'signing'
          ? `${rec ? `Merekam “${rec.word}”` : 'Membaca isyarat'} · ${(words.duration / 1000).toFixed(1)} dtk. Turunkan tangan bila selesai.`
          : rec
            ? `Siap merekam “${rec.word}” (${rec.done}/${rec.total}). Angkat tangan dan lakukan isyaratnya.`
            : 'Siap. Angkat tangan, lakukan satu isyarat kata, lalu turunkan tangan. Bahu dan wajah sebaiknya terlihat di kamera.';

    const record = (w: string) => {
        words.startRecording(w);
        setDraft('');
    };

    return (
        <div className="words" data-testid="word-trainer">
            <p className={`notice${rec || words.phase === 'signing' ? ' notice--live' : ''}`} role="status">
                {phaseText}
            </p>

            {m && !rec && (
                <div className={`word-result${m.accepted ? ' is-ok' : ''}`} data-testid="word-result">
                    <span className="field-label">
                        {m.accepted ? 'Dikenali' : 'Belum yakin'} · {m.source === 'model' ? 'model bawaan' : 'rekamanmu'}
                    </span>
                    <strong>{m.accepted ? m.word : m.ranking[0]?.word ? `mungkin “${m.ranking[0].word}”?` : 'tidak cocok'}</strong>
                    <small>
                        {m.source === 'model'
                            ? `keyakinan ${pct(m.probability)} / batas ${pct(m.threshold)}`
                            : `jarak ${fmt(m.distance)} / batas ${fmt(m.threshold)}`}
                        {m.separation != null && ` · selisih ${Math.round(m.separation * 100)}%`}
                    </small>
                    {m.suggestions && m.suggestions.length > 0 && (
                        <div className="chips" aria-label="Maksud Anda? Pilihanmu disimpan sebagai contoh">
                            {m.suggestions.map((w) => (
                                <button key={w} type="button" className="chip-btn" onClick={() => words.confirmWord(w)}>
                                    {w}?
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <section className="card" aria-labelledby="model-words">
                <div className="card-head">
                    <h3 id="model-words" className="card-title">
                        Kata bawaan
                    </h3>
                    <span className="fine">
                        {words.modelStatus === 'ready'
                            ? `${words.modelWords.length} kata, tanpa perlu merekam`
                            : words.modelStatus === 'loading'
                              ? 'Memuat model…'
                              : 'Belum tersedia'}
                    </span>
                </div>
                {words.modelStatus === 'ready' ? (
                    <>
                        <ul className="model-words" aria-label="Kata yang dikenali model bawaan">
                            {words.modelWords.map((w) => (
                                <li key={w}>{w}</li>
                            ))}
                        </ul>
                        {words.modelInfo && (
                            <p className="fine">
                                Model {words.modelInfo.version}, dilatih dari {words.modelInfo.datasets.map((d) => DATASET_NAMES[d] ?? d).join(', ')}. Lisensi{' '}
                                {words.modelInfo.license} (nonkomersial).{' '}
                                <a href="/licenses/Word-Datasets.txt" target="_blank" rel="noreferrer">
                                    Atribusi & lisensi dataset
                                </a>
                            </p>
                        )}
                    </>
                ) : (
                    <p className="fine">
                        {words.modelStatus === 'loading'
                            ? 'Model kata sedang dimuat di perangkat ini.'
                            : words.modelStatus === 'error'
                              ? 'Model kata bawaan belum terpasang. Kamu tetap bisa mengajari kata sendiri di bawah.'
                              : 'Nyalakan kamera untuk memuat model kata bawaan.'}
                    </p>
                )}
            </section>

            {words.notice && <p className="fine">{words.notice}</p>}

            <section className="card" aria-labelledby="teach-word">
                <h3 id="teach-word" className="card-title">
                    Ajari kata baru
                </h3>
                {rec ? (
                    <div className="rec-row">
                        <span className="rec-dots" aria-label={`${rec.done} dari ${rec.total} rekaman`}>
                            {Array.from({ length: rec.total }, (_, i) => (
                                <i key={i} className={i < rec.done ? 'is-done' : ''} />
                            ))}
                        </span>
                        <b>“{rec.word}”</b>
                        <button type="button" className="mini-btn" onClick={words.cancelRecording}>
                            <X size={15} strokeWidth={2} aria-hidden="true" /> Batal
                        </button>
                    </div>
                ) : (
                    <>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                record(draft);
                            }}
                        >
                            <label className="field">
                                <span className="field-label">Kata dalam Bahasa Indonesia</span>
                                <span className="input-row">
                                    <input
                                        className="input"
                                        value={draft}
                                        maxLength={MAX_WORD_LENGTH}
                                        onChange={(e) => setDraft(e.target.value)}
                                        placeholder="Contoh: makan"
                                    />
                                    <button type="submit" className="btn btn--primary" disabled={!cameraOn || !draft.trim()}>
                                        Rekam 3×
                                    </button>
                                </span>
                            </label>
                        </form>
                        {suggestions.length > 0 && (
                            <div className="chips" aria-label="Saran kata">
                                {suggestions.map((w) => (
                                    <button key={w} type="button" className="chip-btn" disabled={!cameraOn} onClick={() => record(w)}>
                                        + {w}
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </section>

            {words.words.length > 0 && (
                <section className="card" aria-labelledby="my-words">
                    <div className="card-head">
                        <h3 id="my-words" className="card-title">
                            Kata isyarat saya · {words.words.length}
                        </h3>
                        <button type="button" className="mini-btn" onClick={words.evaluate}>
                            <FlaskConical size={15} strokeWidth={2} aria-hidden="true" /> Uji silang
                        </button>
                    </div>
                    <ul className="word-list">
                        {words.words.map((w) => {
                            const ev = words.evaluation?.perWord.find((p) => p.word === w.word);
                            return (
                                <li key={w.conceptId}>
                                    <span className="word-name">{w.word}</span>
                                    <small>
                                        {w.count} rekaman{ev ? ` · ${ev.correct}/${ev.total} benar` : ''}
                                    </small>
                                    <button type="button" className="icon-btn" disabled={!cameraOn || !!rec} onClick={() => record(w.word)} aria-label={`Tambah rekaman ${w.word}`}>
                                        <Plus size={18} strokeWidth={2} aria-hidden="true" />
                                    </button>
                                    <button type="button" className="icon-btn" onClick={() => words.removeWord(w.conceptId)} aria-label={`Hapus ${w.word}`}>
                                        <Trash2 size={17} strokeWidth={2} aria-hidden="true" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    {words.evaluation && (
                        <p className="fine" data-testid="word-eval">
                            {words.evaluation.tested
                                ? `Uji silang: ${words.evaluation.correct} benar, ${words.evaluation.wrong} salah, ${words.evaluation.rejected} ditolak dari ${words.evaluation.tested} rekaman. Ini hanya mengukur konsistensi isyaratmu sendiri.`
                                : 'Perlu minimal 2 rekaman per kata untuk uji silang.'}
                        </p>
                    )}
                </section>
            )}

            <p className="fine">
                Prototipe: isyarat dicocokkan dengan rekamanmu sendiri, tanpa model terlatih. Hanya angka titik tangan yang disimpan di
                perangkat ini. Posisi terhadap wajah dan ekspresi belum dibaca; isyarat belum diverifikasi pengajar BISINDO.
            </p>
        </div>
    );
}
