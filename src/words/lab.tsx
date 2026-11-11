/**
 * Standalone dev page for the word-recognition prototype (open /words-lab.html on the dev
 * server). Kept separate from the main app so it can be tested while the app UI changes.
 */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Camera, CameraOff, Eraser } from 'lucide-react';
import { useCamera } from '../recognition/useCamera';
import { useWordRecognizer } from '../recognition/useWordRecognizer';
import { regionalLanguages, translateText, type RegionalLanguageCode, type Register } from '../language';
import { WordTrainer } from './WordTrainer';
import './words.css';

function Lab() {
  const camera = useCamera(() => { /* letters are ignored in word mode */ });
  const [sentence, setSentence] = useState<string[]>([]);
  const [lang, setLang] = useState<RegionalLanguageCode>('jv');
  const [register, setRegister] = useState<Register>('ngoko');
  const words = useWordRecognizer(camera, true, (word) => setSentence((s) => [...s, word].slice(-20)));
  const text = sentence.join(' ');
  const out = text ? translateText({ text, sourceLang: 'id', targetLang: lang, register, inputMode: 'sign' }) : null;
  const meta = regionalLanguages.find((l) => l.code === lang);

  return (
    <div className="wl-lab">
      <div className="wl-lab-inner">
        <header>
          <h1>Lab isyarat kata</h1>
          <p className="wl-fine">Prototipe pengenalan kata terisolasi: rekam isyarat Anda sendiri, lalu isyaratkan kata satu per satu.</p>
        </header>
        <div className="wl-lab-grid">
          <section aria-label="Kamera">
            <div className="wl-cam">
              <video ref={camera.video} muted playsInline aria-label="Pratinjau kamera" />
              <canvas ref={camera.canvas} aria-hidden="true" />
              {camera.running && <span className="wl-cam-chip" role="status">{camera.trackedHands}/2 tangan</span>}
            </div>
            <div className="wl-cam-actions">
              {camera.running ? (
                <button type="button" className="wl-btn wl-mini-btn" onClick={camera.stop}><CameraOff size={15} /> Hentikan kamera</button>
              ) : (
                <button type="button" className="wl-btn wl-btn--primary" disabled={camera.busy} onClick={() => camera.start('')}>
                  <Camera size={16} /> {camera.busy ? 'Menyiapkan…' : 'Nyalakan kamera'}
                </button>
              )}
              <span className="wl-fine">{camera.message}</span>
            </div>
            <div className="wl-output" style={{ marginTop: 16 }} aria-label="Hasil">
              <div className="wl-output-row">
                <span>Bahasa Indonesia</span>
                <strong data-testid="word-sentence">{text || '—'}</strong>
              </div>
              <div className="wl-output-row">
                <span>{meta?.name ?? lang}</span>
                <strong data-testid="word-translation">{out?.translatedText ?? '—'}</strong>
              </div>
              <div className="wl-cam-actions" style={{ marginTop: 0 }}>
                <select className="wl-select" aria-label="Bahasa tujuan" value={lang} onChange={(e) => setLang(e.target.value as RegionalLanguageCode)}>
                  {regionalLanguages.filter((l) => l.code !== 'id').map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
                {meta?.hasSpeechLevels && (
                  <select className="wl-select" aria-label="Ragam" value={register} onChange={(e) => setRegister(e.target.value as Register)}>
                    <option value="ngoko">{meta.registerTerms?.casualLabel ?? 'Akrab'}</option>
                    <option value="krama">{meta.registerTerms?.politeLabel ?? 'Halus'}</option>
                  </select>
                )}
                <button type="button" className="wl-mini-btn" onClick={() => setSentence((s) => s.slice(0, -1))}>⌫ Hapus kata</button>
                <button type="button" className="wl-mini-btn" onClick={() => setSentence([])}><Eraser size={13} /> Bersihkan</button>
              </div>
            </div>
          </section>
          <WordTrainer words={words} cameraOn={camera.running} />
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><Lab /></React.StrictMode>);
