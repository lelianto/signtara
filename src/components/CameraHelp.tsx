import React from 'react';
import { Camera as CameraIcon } from 'lucide-react';
import type { useCamera } from '../recognition/useCamera';

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
  const d = camera.diagnostics;
  const fallbackExplanation = camera.capture
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
    : `Menstabilkan pola: ${camera.result.stabilityVotes || 0}/${
        camera.result.stabilityRequired || 6
      } frame.`;

  const statusLine = inlineStatusMessage ?? fallbackExplanation;

  return (
    <div className="camera-help compact-help">
      <div className="diagnostic-summary">
        <div className="diag-left">
          <span className={camera.running ? 'status-pip live' : 'status-pip'} aria-hidden="true" />
          {inlineStatusMessage !== undefined ? (
            <span className="diag-explain" role="status">
              {statusLine}
            </span>
          ) : (
            <span className="diag-explain">{statusLine}</span>
          )}
        </div>
        <div className="diag-right">
          <span className="diag-res">
            {d.width ? `${d.width} × ${d.height}` : 'Menunggu kamera'} · rasio dikoreksi
          </span>
          <details className="diag-popover">
            <summary>Rincian</summary>
            <div className="popover-card">
              <p>
                <b>Model:</b> TwoHand v1 · geometri terkoreksi
              </p>
              <p>
                <b>Status pola:</b> {fallbackExplanation}
              </p>
              <p>
                <b>Deteksi ulang tangan:</b>{' '}
                {!camera.running
                  ? 'menunggu kamera'
                  : camera.recoveryEnabled
                  ? 'aktif otomatis'
                  : 'tidak tersedia'}
                .
              </p>
              <p>
                <b>Kandidat:</b> {d.candidate || '—'} · skor {(d.score * 100).toFixed(0)}% (min{' '}
                {(d.minScore * 100).toFixed(0)}%).
              </p>
              <p>
                <b>Jarak bentuk:</b> {d.distance === null ? '—' : d.distance.toFixed(3)} ·{' '}
                {camera.metrics.latency.toFixed(0)} ms/frame.
              </p>
            </div>
          </details>
        </div>
      </div>

      <div className="calibration-bar">
        <div className="calib-select-group">
          <label htmlFor="calibration-letter">Kalibrasi</label>
          <select
            id="calibration-letter"
            aria-label="Contoh pribadi untuk huruf"
            value={target}
            disabled={!!camera.capture || camera.saving}
            onChange={(e) => onTargetChange(e.target.value)}
          >
            {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <details className="diag-popover">
            <summary>Foto {target}</summary>
            <div className="popover-card">
              <img
                className="calibration-reference"
                src={`/ref/${target}/${target.toLowerCase()}_da7115.jpg`}
                alt={`Referensi kalibrasi ${target}`}
              />
              <p>
                Referensi {target} ({expectedHands || '—'} tangan) · dataset riset, belum
                diverifikasi pengajar BISINDO.
              </p>
            </div>
          </details>
          <small className="calib-count">{camera.personalCount} contoh pribadi tersimpan.</small>
        </div>

        <button
          className="primary calib-btn"
          disabled={
            !camera.running ||
            !expectedHands ||
            d.handCount !== expectedHands ||
            !!camera.capture ||
            camera.saving
          }
          onClick={onCapture}
        >
          <CameraIcon size={15} strokeWidth={2} />
          {camera.capture
            ? `Merekam ${camera.capture.count}/${camera.capture.total}…`
            : camera.saving
            ? 'Menyimpan…'
            : `Simpan contoh pribadi ${target}`}
        </button>
      </div>

      {camera.calibrationNotice && (
        <p className="calib-notice" role="status">
          {camera.calibrationNotice}
        </p>
      )}
    </div>
  );
}
