import React, { useState } from 'react';
import { Circle, FlaskConical, Plus, Trash2, X } from 'lucide-react';
import type { useWordRecognizer } from '../recognition/useWordRecognizer';
import './words.css';
import { SUGGESTED_WORDS, MAX_WORD_LENGTH } from '../recognition/vocabulary';

type Words = ReturnType<typeof useWordRecognizer>;

const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(2));

export function WordTrainer({ words, cameraOn }: { words: Words; cameraOn: boolean }) {
  const [draft, setDraft] = useState('');
  const rec = words.recording;
  const m = words.lastMatch;
  const known = new Set(words.words.map((w) => w.word));
  const suggestions = SUGGESTED_WORDS.filter((w) => !known.has(w)).slice(0, 8);

  const phaseText = !cameraOn
    ? 'Nyalakan kamera untuk mulai.'
    : words.phase === 'signing'
      ? `${rec ? `Merekam “${rec.word}”` : 'Membaca isyarat'} · ${(words.duration / 1000).toFixed(1)} dtk — turunkan tangan bila selesai.`
      : rec
        ? `Siap merekam “${rec.word}” (${rec.done}/${rec.total}). Angkat tangan dan lakukan isyaratnya.`
        : 'Siap. Angkat tangan, lakukan satu isyarat kata, lalu turunkan tangan.';

  const record = (w: string) => { words.startRecording(w); setDraft(''); };

  return (
    <div className="wl-help wl-words" data-testid="word-trainer">
      <p className={`wl-help-notice${rec || words.phase === 'signing' ? ' is-recording' : ''}`} role="status">
        {phaseText}
      </p>

      {m && !rec && (
        <div className={`wl-word-result wl-word-result--${m.accepted ? 'ok' : 'warn'}`} data-testid="word-result">
          <span className="wl-word-result-label">{m.accepted ? 'Dikenali' : 'Tidak diterima'}</span>
          <strong>{m.accepted ? m.word : m.ranking[0]?.word ? `mungkin “${m.ranking[0].word}”?` : '—'}</strong>
          <small>
            {m.source === 'model'
              ? `model terlatih · keyakinan ${Math.round((m.probability ?? 0) * 100)}% · selisih ${Math.round((m.separation ?? 0) * 100)}%`
              : <>rekaman pribadi · jarak {fmt(m.distance)} / batas {fmt(m.threshold)}{m.separation != null && ` · selisih ${Math.round(m.separation * 100)}%`}</>}
          </small>
        </div>
      )}

      {m?.suggestions && !rec && (
        <div className="wl-chips" aria-label="Pilih kata yang dimaksud" data-testid="word-suggestions">
          {m.suggestions.map((w) => (
            <button key={w} type="button" className="wl-chip" onClick={() => words.confirmWord(w)}>{w}</button>
          ))}
        </div>
      )}

      {words.notice && <p className="wl-fine" role="status">{words.notice}</p>}

      <section className="wl-word-panel" aria-label="Ajari kata baru">
        <div className="wl-word-head">
          <h3 className="wl-word-title">Ajari kata</h3>
          <span className="wl-tag wl-tag--draft">Contoh pribadi</span>
        </div>
        {rec ? (
          <div className="wl-word-rec">
            <span className="wl-word-dots" aria-label={`${rec.done} dari ${rec.total} contoh`}>
              {Array.from({ length: rec.total }, (_, i) => (
                <Circle key={i} size={12} strokeWidth={2} className={i < rec.done ? 'is-done' : ''} />
              ))}
            </span>
            <span>“{rec.word}”</span>
            <button type="button" className="wl-mini-btn" onClick={words.cancelRecording}>
              <X size={13} strokeWidth={2} /> Batal
            </button>
          </div>
        ) : (
          <>
            <form
              className="wl-word-form"
              onSubmit={(e) => { e.preventDefault(); record(draft); }}
            >
              <input
                className="wl-word-input"
                value={draft}
                maxLength={MAX_WORD_LENGTH}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Kata Indonesia, mis. makan"
                aria-label="Kata yang akan direkam"
              />
              <button type="submit" className="wl-btn wl-btn--primary wl-btn--sm" disabled={!cameraOn || !draft.trim()}>
                Rekam 3×
              </button>
            </form>
            {suggestions.length > 0 && (
              <div className="wl-chips" aria-label="Saran kata">
                {suggestions.map((w) => (
                  <button key={w} type="button" className="wl-chip wl-chip--add" disabled={!cameraOn} onClick={() => record(w)}>
                    + {w}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {words.words.length > 0 && (
        <section className="wl-word-panel" aria-label="Kosakata tersimpan">
          <div className="wl-word-head">
            <h3 className="wl-word-title">Kosakata saya · {words.words.length}</h3>
            <button type="button" className="wl-mini-btn" onClick={words.evaluate} title="Uji tiap rekaman terhadap rekaman lainnya">
              <FlaskConical size={13} strokeWidth={2} /> Uji silang
            </button>
          </div>
          <ul className="wl-word-list">
            {words.words.map((w) => {
              const ev = words.evaluation?.perWord.find((p) => p.word === w.word);
              return (
                <li key={w.conceptId}>
                  <span className="wl-word-name">{w.word}</span>
                  <small>{w.count} contoh{ev ? ` · ${ev.correct}/${ev.total} benar` : ''}</small>
                  <button type="button" className="wl-mini-btn" disabled={!cameraOn || !!rec} onClick={() => record(w.word)} aria-label={`Tambah contoh ${w.word}`}>
                    <Plus size={13} strokeWidth={2} />
                  </button>
                  <button type="button" className="wl-mini-btn" onClick={() => words.removeWord(w.conceptId)} aria-label={`Hapus ${w.word}`}>
                    <Trash2 size={13} strokeWidth={2} />
                  </button>
                </li>
              );
            })}
          </ul>
          {words.evaluation && (
            <p className="wl-fine" data-testid="word-eval">
              {words.evaluation.tested
                ? `Uji silang: ${words.evaluation.correct} benar, ${words.evaluation.wrong} salah, ${words.evaluation.rejected} ditolak dari ${words.evaluation.tested} rekaman. Ini hanya mengukur konsistensi isyarat Anda sendiri.`
                : 'Perlu minimal 2 contoh per kata untuk uji silang.'}
            </p>
          )}
        </section>
      )}

      <section className="wl-word-panel" aria-label="Kosakata model" data-testid="model-words">
        <div className="wl-word-head">
          <h3 className="wl-word-title">Dikenali tanpa rekaman · {words.modelWords.length || '—'}</h3>
          <span className="wl-tag wl-tag--draft">
            {words.modelStatus === 'ready' ? words.modelInfo?.version : words.modelStatus === 'loading' ? 'memuat…' : words.modelStatus === 'error' ? 'model tidak tersedia' : 'mati'}
          </span>
        </div>
        {words.modelWords.length > 0 && <p className="wl-fine">{words.modelWords.join(' · ')}</p>}
        {words.modelInfo && (
          <p className="wl-fine">
            Dilatih dari {words.modelInfo.datasets.join(', ')} · lisensi bobot {words.modelInfo.license} (non-komersial). Pastikan bahu dan wajah
            terlihat: model membaca posisi tangan terhadap tubuh dan ekspresi wajah.
          </p>
        )}
      </section>

      <p className="wl-fine">
        Rekaman pribadi dicocokkan lebih dulu (DTW, hanya angka titik tangan yang disimpan di perangkat ini); bila tidak cocok, model
        terlatih yang memutuskan. Isyarat mengikuti varian para penanda di dataset dan belum diverifikasi pengajar BISINDO.
      </p>
    </div>
  );
}
