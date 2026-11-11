import React, { useState } from 'react';
import { Camera as CameraIcon, SlidersHorizontal } from 'lucide-react';
import type { useCamera } from '../recognition/useCamera';
import { Picker } from './Picker';

type Camera = ReturnType<typeof useCamera>;

export function CameraHelp({
  camera,
  target,
  onTargetChange,
  expectedHands,
  onCapture,
  inlineStatusMessage,
}: {
  camera: Camera;
  target: string;
  onTargetChange: (letter: string) => void;
  expectedHands: number;
  onCapture: () => void;
  inlineStatusMessage?: string;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const d = camera.diagnostics;
  const explanation = camera.capture
    ? 'Merekam contoh pribadi; ejaan ditahan sementara.'
    : camera.saving
      ? 'Menyimpan contoh pribadi di perangkat ini.'
      : !camera.running
        ? 'Aktifkan kamera untuk mulai melacak tangan.'
        : d.handCount === 0
          ? 'Posisikan tangan di area kamera dengan cahaya cukup.'
          : expectedHands > 0 && d.handCount !== expectedHands
            ? `Referensi ${target} butuh ${expectedHands} tangan (terbaca ${d.handCount}).`
            : d.reason === 'too_far'
              ? 'Posisi tangan belum cocok dengan contoh model.'
              : d.reason === 'ambiguous'
                ? 'Pola mirip beberapa huruf; tahan lebih stabil.'
                : camera.result.status === 'recognized'
                  ? 'Pola stabil dan diterima.'
                  : `Menstabilkan pola: ${camera.result.stabilityVotes || 0}/${camera.result.stabilityRequired || 6} frame.`;

  const recording = !!camera.capture || camera.saving;

  return (
    <div className="help">
      {(recording || camera.calibrationNotice) && (
        <p className={`notice${recording ? ' notice--live' : ''}`} role="status">
          {camera.calibrationNotice || explanation}
        </p>
      )}

      <details
        className="drawer"
        onToggle={(e) => setDrawerOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary>
          <SlidersHorizontal size={17} strokeWidth={2} aria-hidden="true" />
          <span>Kalibrasi &amp; diagnostik</span>
          <small>
            {d.width ? `${d.width} × ${d.height} · rasio dikoreksi` : 'Kamera mati'} · {camera.personalCount} contoh pribadi tersimpan.
          </small>
          {!drawerOpen && (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={!camera.running || !expectedHands || d.handCount !== expectedHands || recording}
              onClick={(e) => {
                e.stopPropagation();
                onCapture();
              }}
            >
              <CameraIcon size={15} strokeWidth={2} aria-hidden="true" />
              {camera.capture
                ? `Merekam ${camera.capture.count}/${camera.capture.total}…`
                : camera.saving
                  ? 'Menyimpan…'
                  : `Simpan contoh pribadi ${target}`}
            </button>
          )}
        </summary>

        <div className="drawer-body">
          <dl className="diag">
            <div><dt>Model</dt><dd>TwoHand v1 · geometri terkoreksi</dd></div>
            <div><dt>Status pola</dt><dd>{explanation}</dd></div>
            <div>
              <dt>Deteksi ulang tangan</dt>
              <dd>{!camera.running ? 'Menunggu kamera' : camera.recoveryEnabled ? 'Aktif otomatis' : 'Tidak tersedia'}</dd>
            </div>
            <div>
              <dt>Kandidat</dt>
              <dd>
                {d.candidate || '–'} · skor {(d.score * 100).toFixed(0)}% (min {(d.minScore * 100).toFixed(0)}%)
              </dd>
            </div>
            <div>
              <dt>Jarak bentuk</dt>
              <dd>
                {d.distance === null ? '–' : d.distance.toFixed(3)} · {camera.metrics.latency.toFixed(0)} ms/frame
              </dd>
            </div>
            <div><dt>Resolusi</dt><dd>{d.width ? `${d.width} × ${d.height}` : 'Menunggu kamera'}</dd></div>
          </dl>
          <p className="fine">Skor adalah jarak geometris, bukan probabilitas.</p>

          <div className="calib">
            <div className="calib-ref">
              <img src={`/ref/${target}/${target.toLowerCase()}_da7115.jpg`} alt={`Referensi kalibrasi ${target}`} width={160} height={120} />
            </div>
            <div className="calib-body">
              <div className="field">
                <span className="field-label">Huruf yang dikalibrasi</span>
                <Picker
                  label="Contoh pribadi untuk huruf"
                  title="Pilih huruf"
                  grid
                  value={target}
                  disabled={recording}
                  onChange={onTargetChange}
                  options={'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => ({ value: l, label: l }))}
                />
              </div>
              <p className="fine">
                Referensi {target}: {expectedHands || '–'} tangan · dataset riset, belum diverifikasi pengajar BISINDO.
              </p>
              {drawerOpen && (
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!camera.running || !expectedHands || d.handCount !== expectedHands || recording}
                  onClick={onCapture}
                >
                  <CameraIcon size={16} strokeWidth={2} aria-hidden="true" />
                  {camera.capture
                    ? `Merekam ${camera.capture.count}/${camera.capture.total}…`
                    : camera.saving
                      ? 'Menyimpan…'
                      : `Simpan contoh pribadi ${target}`}
                </button>
              )}
            </div>
          </div>

          {inlineStatusMessage && <p className="fine">{inlineStatusMessage}</p>}
        </div>
      </details>
    </div>
  );
}
