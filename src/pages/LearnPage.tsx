import React from 'react';
import type { useCamera } from '../recognition/useCamera';
import type { useWordRecognizer } from '../recognition/useWordRecognizer';
import type { Progress } from '../storage/progress';
import { CameraStage } from '../components/CameraStage';
import { CameraHelp } from '../components/CameraHelp';
import { WordsPanel } from '../components/WordsPanel';

type Cam = ReturnType<typeof useCamera>;
type Words = ReturnType<typeof useWordRecognizer>;
export type LearnTab = 'letters' | 'words';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function LearnPage({
    tab,
    setTab,
    camera,
    words,
    onStartCamera,
    onFlip,
    canFlip,
    progress,
    target,
    setTarget,
    feedback,
    referenceHands,
    weakLetters,
    onCapture,
}: {
    tab: LearnTab;
    setTab: (t: LearnTab) => void;
    camera: Cam;
    words: Words;
    onStartCamera: () => void;
    onFlip: () => void;
    canFlip: boolean;
    progress: Progress;
    target: string;
    setTarget: (l: string) => void;
    feedback: string;
    referenceHands: Record<string, number>;
    weakLetters: string[];
    onCapture: () => void;
}) {
    const after = LETTERS.slice(LETTERS.indexOf(target) + 1);
    const next = after.find((l) => !progress.letters.includes(l)) ?? LETTERS.find((l) => !progress.letters.includes(l) && l !== target) ?? 'A';
    const hands = referenceHands[target];

    return (
        <div className="page page--wide">
            <header className="page-head">
                <h1 className="title">Belajar</h1>
                <p className="lead">Latih ejaan jari BISINDO dan ajari BISARA kata isyaratmu sendiri. Progres tersimpan di perangkat ini.</p>
                <div className="segment segment--sm" role="tablist" aria-label="Materi belajar">
                    <button type="button" role="tab" aria-selected={tab === 'letters'} className={tab === 'letters' ? 'is-on' : ''} onClick={() => setTab('letters')}>
                        Huruf A–Z
                    </button>
                    <button type="button" role="tab" aria-selected={tab === 'words'} className={tab === 'words' ? 'is-on' : ''} onClick={() => setTab('words')}>
                        Kata isyarat
                    </button>
                </div>
            </header>

            <div className="split">
                <div className="split-main">
                    <CameraStage
                        camera={camera}
                        onStart={onStartCamera}
                        onFlip={onFlip}
                        canFlip={canFlip}
                        idleTitle={tab === 'letters' ? `Tiru bentuk huruf ${target}` : 'Rekam isyarat kata'}
                    />
                    {tab === 'letters' && (
                        <CameraHelp
                            camera={camera}
                            target={target}
                            onTargetChange={setTarget}
                            expectedHands={hands || 0}
                            onCapture={onCapture}
                        />
                    )}
                </div>

                <div className="split-side">
                    {tab === 'letters' ? (
                        <>
                            <section className="card practice" aria-labelledby="practice-title">
                                <div className="card-head">
                                    <h2 id="practice-title" className="card-title">
                                        Huruf {target}
                                    </h2>
                                    <span className="fine">{hands ? `${hands} tangan` : ''}</span>
                                </div>
                                <div className="practice-body">
                                    <img
                                        className="practice-ref"
                                        src={`/ref/${target}/${target.toLowerCase()}_da7115.jpg`}
                                        alt={`Foto referensi isyarat huruf ${target}`}
                                        width={320}
                                        height={240}
                                    />
                                    <span className="key key--xl" aria-hidden="true">
                                        {target}
                                    </span>
                                </div>
                                <p className="feedback" role="status">
                                    {feedback || 'Ikuti jumlah dan posisi tangan pada foto, lalu tahan sampai cincin di kamera penuh.'}
                                </p>
                                <p className="fine">
                                    {weakLetters.includes(target)
                                        ? 'Huruf ini masih sering tertukar pada uji foto.'
                                        : 'Foto dari dataset riset, belum diverifikasi pengajar BISINDO.'}
                                </p>
                                <button type="button" className="btn btn--primary btn--block" onClick={() => setTarget(next)}>
                                    Latih huruf berikutnya ({next})
                                </button>
                            </section>

                            <section className="card" aria-labelledby="progress-title">
                                <div className="card-head">
                                    <h2 id="progress-title" className="card-title">
                                        Perjalananmu
                                    </h2>
                                    <span className="fine" data-testid="progress-summary">{`${progress.xp} XP · ${progress.letters.length}/26 huruf`}</span>
                                </div>
                                <div className="keys-grid" aria-label="Pilih huruf untuk dilatih">
                                    {LETTERS.map((l) => {
                                        const done = progress.letters.includes(l);
                                        return (
                                            <button
                                                key={l}
                                                type="button"
                                                className={`key key--btn${done ? ' is-done' : ''}${l === target ? ' is-target' : ''}`}
                                                aria-pressed={l === target}
                                                aria-label={`Latih huruf ${l}${done ? ', sudah dikenali' : ''}`}
                                                onClick={() => setTarget(l)}
                                            >
                                                {l}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="fine">
                                    {progress.days.length} hari latihan.{' '}
                                    {progress.letters.length >= 5 ? 'Pencapaian: lima huruf pertama!' : 'Kenali 5 huruf untuk pencapaian pertama.'}
                                </p>
                            </section>
                        </>
                    ) : (
                        <WordsPanel words={words} cameraOn={camera.running} />
                    )}
                </div>
            </div>
        </div>
    );
}
