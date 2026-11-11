import React from 'react';
import { Camera, CameraOff, SwitchCamera } from 'lucide-react';
import type { useCamera } from '../recognition/useCamera';
import { STATUS_LABEL, humanizeCameraMessage } from '../app/labels';

type Cam = ReturnType<typeof useCamera>;

function Ring({ value }: { value: number }) {
    const r = 26;
    const c = 2 * Math.PI * r;
    const v = Math.max(0, Math.min(1, value));
    return (
        <svg className="ring" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r={r} className="ring-track" />
            <circle cx="32" cy="32" r={r} className="ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
        </svg>
    );
}

/**
 * Jendela kamera. Huruf sementara tampil di pojok dengan cincin kestabilan:
 * cincin penuh = huruf masuk ke ejaan.
 */
export function CameraStage({
    camera,
    onStart,
    onFlip,
    canFlip,
    compact = false,
    overlay,
    idleTitle = 'Eja dengan jari di depan kamera',
    idleText = 'Video diproses di HP ini saja, tidak pernah diunggah.',
}: {
    camera: Cam;
    onStart: () => void;
    onFlip?: () => void;
    canFlip?: boolean;
    compact?: boolean;
    overlay?: React.ReactNode;
    idleTitle?: string;
    idleText?: string;
}) {
    const running = camera.running;
    const status = camera.result.status;
    const isError = status === 'error' && !running;
    const live = running ? camera.result.signId?.slice(-1) ?? camera.diagnostics.candidate ?? '' : '';
    const votes = camera.result.stabilityVotes ?? 0;
    const required = camera.result.stabilityRequired ?? 6;
    const stability = status === 'recognized' ? 1 : required ? votes / required : 0;
    const hands = running ? camera.trackedHands : 0;

    return (
        <div className={`stage${running ? ' is-live' : ''}${compact ? ' is-compact' : ''}`}>
            <div className="stage-frame">
                <video ref={camera.video} muted playsInline aria-label="Pratinjau kamera" />
                <canvas ref={camera.canvas} aria-hidden="true" />

                {running && (
                    <>
                        <div className="stage-top">
                            <span className="chip chip--dark" role="status" aria-label="Jumlah tangan terlacak">
                                <span className="hand-dots" aria-hidden="true">
                                    <i className={hands >= 1 ? 'on' : ''} />
                                    <i className={hands >= 2 ? 'on' : ''} />
                                </span>
                                {hands}/2 tangan
                            </span>
                            <span className="stage-actions">
                                {canFlip && onFlip && (
                                    <button type="button" className="icon-btn icon-btn--dark" onClick={onFlip} aria-label="Ganti kamera depan atau belakang">
                                        <SwitchCamera size={18} strokeWidth={2} aria-hidden="true" />
                                    </button>
                                )}
                                <button type="button" className="icon-btn icon-btn--dark" onClick={camera.stop} aria-label="Hentikan kamera">
                                    <CameraOff size={18} strokeWidth={2} aria-hidden="true" />
                                </button>
                            </span>
                        </div>
                        {live && status !== 'no_hand' && (
                            <div className={`live-letter live-letter--${status}`} aria-hidden="true">
                                <Ring value={stability} />
                                <span>{live}</span>
                            </div>
                        )}
                        <span className={`stage-status stage-status--${status}`}>{STATUS_LABEL[status] ?? ''}</span>
                        {overlay}
                    </>
                )}

                {!running && (
                    <div className="stage-idle">
                        <span className="sr-only" role="status" aria-label="Jumlah tangan terlacak">
                            0/2 tangan
                        </span>
                        {!compact && <p className="stage-idle-title">{idleTitle}</p>}
                        <button type="button" className="btn btn--light btn--lg" disabled={camera.busy} onClick={onStart}>
                            <Camera size={20} strokeWidth={2} aria-hidden="true" />
                            {camera.busy ? 'Menyiapkan kamera…' : 'Nyalakan kamera'}
                        </button>
                        {!compact && <p className="stage-idle-text">{idleText}</p>}
                    </div>
                )}
            </div>
            {(isError || (camera.busy && !running)) && (
                <p className={`stage-msg${isError ? ' is-error' : ''}`} role="status">
                    {humanizeCameraMessage(camera.message)}
                </p>
            )}
            {running && (
                <p className="sr-only" role="status">
                    {camera.message}
                </p>
            )}
        </div>
    );
}
