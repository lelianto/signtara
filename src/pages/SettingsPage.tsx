import React from 'react';
import { ChevronRight, Trash2, Volume2 } from 'lucide-react';
import { regionalLanguages, bhasantaraGlossary, bhasantaraParallel, NUSAX_ATTRIBUTION } from '../language';
import type { Prefs, Theme } from '../app/prefs';
import { languageLabel, registerNames, languageMeta } from '../app/labels';
import type { useCamera } from '../recognition/useCamera';
import { ttsAvailable, sttAvailable, useVoices, voicesFor, pickVoice, voiceName, voiceQuality, speechLangFor, speak, NATURAL_VOICE_SCORE } from '../app/speech';
import { Picker } from '../components/Picker';

type Cam = ReturnType<typeof useCamera>;

const VOICE_SAMPLE: Partial<Record<Prefs['lang'], string>> = {
    jv: 'Sugeng enjing, piye kabare?',
    sun: 'Wilujeng enjing, kumaha damang?',
};

const VOICE_LANG_NAME: Record<string, string> = { id: 'Indonesia', in: 'Indonesia', jv: 'Jawa', su: 'Sunda' };

function VoiceRow({ prefs, update }: { prefs: Prefs; update: (p: Partial<Prefs>) => void }) {
    const voices = useVoices();
    const key = speechLangFor(prefs.lang)[0];
    const candidates = voicesFor(voices, prefs.lang);
    const best = candidates[0];
    const current = pickVoice(voices, prefs.lang);
    const chosen = prefs.voices[key] && candidates.some((v) => v.voiceURI === prefs.voices[key]) ? prefs.voices[key] : '';
    const describe = (v: SpeechSynthesisVoice) =>
        `${VOICE_LANG_NAME[v.lang.slice(0, 2).toLowerCase()] ?? v.lang} · ${v.localService ? 'di perangkat' : 'online'}${voiceQuality(v) >= NATURAL_VOICE_SCORE ? ' · natural' : ''}`;
    const setVoice = (uri: string) => {
        const next = { ...prefs.voices };
        if (uri) next[key] = uri;
        else delete next[key];
        update({ voices: next });
    };

    return (
        <>
            <div className="row">
                <span className="row-text">
                    <b>Suara</b>
                    <small>{current ? `${voiceName(current)} · ${describe(current)}` : 'Daftar suara belum dimuat browser'}</small>
                </span>
                <span className="row-voice">
                    <Picker
                        label="Pilih suara"
                        title="Suara bacaan"
                        className="row-select"
                        value={chosen}
                        onChange={setVoice}
                        disabled={!candidates.length}
                        options={[
                            { value: '', label: 'Otomatis', hint: best ? `Paling alami di perangkat ini: ${voiceName(best)}` : undefined },
                            ...candidates.map((v) => ({ value: v.voiceURI, label: voiceName(v), hint: describe(v) })),
                        ]}
                    />
                    <button
                        type="button"
                        className="icon-btn"
                        onClick={() => speak(VOICE_SAMPLE[prefs.lang] ?? 'Halo, apa kabar? Senang bertemu denganmu.', prefs.lang)}
                        aria-label="Coba suara"
                    >
                        <Volume2 size={20} strokeWidth={2} aria-hidden="true" />
                    </button>
                </span>
            </div>
            {voices.length > 0 && (!best || voiceQuality(best) < NATURAL_VOICE_SCORE) && (
                <p className="row-note">
                    Suara di perangkat ini masih kaku. Buka BISARA di Microsoft Edge untuk suara natural Gadis atau Ardi, atau unduh suara Damayanti (Enhanced) di
                    Pengaturan Mac/iPhone, bagian Aksesibilitas, Konten Lisan.
                </p>
            )}
        </>
    );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="row row--toggle">
            <span className="row-text">
                <b>{label}</b>
                {hint && <small>{hint}</small>}
            </span>
            <input type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        </label>
    );
}

export function SettingsPage({
    prefs,
    update,
    camera,
    devices,
    onOpenLanguage,
    messageCount,
    onClearConversation,
}: {
    prefs: Prefs;
    update: (p: Partial<Prefs>) => void;
    camera: Cam;
    devices: MediaDeviceInfo[];
    onOpenLanguage: () => void;
    messageCount: number;
    onClearConversation: () => void;
}) {
    const names = registerNames(prefs.lang);
    const meta = languageMeta(prefs.lang);

    return (
        <div className="page">
            <header className="page-head">
                <h1 className="title">Pengaturan</h1>
                <p className="lead">Semua pilihan tersimpan di browser ini saja.</p>
            </header>

            <section className="group" aria-labelledby="set-lang">
                <h2 id="set-lang" className="group-title">
                    Bahasa
                </h2>
                <button type="button" className="row" onClick={onOpenLanguage}>
                    <span className="row-text">
                        <b>Bahasa tujuan</b>
                        <small>
                            {languageLabel(prefs.lang)}
                            {meta.hasSpeechLevels && prefs.lang !== 'id' ? ` · ${prefs.register === 'ngoko' ? names.casual : names.polite}` : ''}
                        </small>
                    </span>
                    <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
                </button>
                <Toggle label="Tampilkan aksara" hint="Untuk Jawa, Sunda, dan Bali" checked={prefs.showAksara} onChange={(v) => update({ showAksara: v })} />
                <div className="row">
                    <span className="row-text">
                        <b id="rate-label">Kecepatan suara</b>
                    </span>
                    <div className="segment segment--sm" role="radiogroup" aria-labelledby="rate-label">
                        {(
                            [
                                [0.75, 'Pelan'],
                                [0.95, 'Normal'],
                                [1.15, 'Cepat'],
                            ] as const
                        ).map(([rate, label]) => (
                            <button
                                key={label}
                                type="button"
                                role="radio"
                                aria-checked={Math.abs(prefs.speechRate - rate) < 0.06}
                                className={Math.abs(prefs.speechRate - rate) < 0.06 ? 'is-on' : ''}
                                onClick={() => update({ speechRate: rate })}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                {ttsAvailable && <VoiceRow prefs={prefs} update={update} />}
                {!ttsAvailable && <p className="row-note">Browser ini tidak bisa membacakan teks. Gunakan tombol Tunjukkan.</p>}
                {!sttAvailable && <p className="row-note">Browser ini belum bisa mendengarkan suara. Lawan bicara bisa mengetik balasan.</p>}
            </section>

            <section className="group" aria-labelledby="set-cam">
                <h2 id="set-cam" className="group-title">
                    Kamera & isyarat
                </h2>
                <Toggle
                    label="Spasi otomatis"
                    hint="Turunkan tangan sebentar setelah mengeja untuk memisahkan kata"
                    checked={prefs.autoSpace}
                    onChange={(v) => update({ autoSpace: v })}
                />
                <Toggle label="Getar saat huruf masuk" hint="Di HP yang mendukung" checked={prefs.haptics} onChange={(v) => update({ haptics: v })} />
                <div className="row">
                    <span className="row-text">
                        <b>Kamera</b>
                        <small>{devices.length ? `${devices.length} kamera ditemukan` : 'Nama kamera muncul setelah izin diberikan'}</small>
                    </span>
                    <Picker
                        label="Pilih kamera"
                        className="row-select"
                        value={prefs.device ? prefs.device : `facing:${prefs.facing}`}
                        onChange={(v) => (v.startsWith('facing:') ? update({ device: '', facing: v.slice(7) as Prefs['facing'] }) : update({ device: v }))}
                        options={[
                            { value: 'facing:user', label: 'Kamera depan', hint: 'Untuk mengeja sendiri sambil melihat layar' },
                            { value: 'facing:environment', label: 'Kamera belakang', hint: 'Untuk diarahkan ke orang yang berisyarat' },
                            ...devices.filter((d) => d.deviceId).map((d, i) => ({ value: d.deviceId, label: d.label || `Kamera ${i + 1}` })),
                        ]}
                    />
                </div>
            </section>

            <section className="group" aria-labelledby="set-look">
                <h2 id="set-look" className="group-title">
                    Tampilan
                </h2>
                <div className="row">
                    <span className="row-text">
                        <b id="theme-label">Tema</b>
                    </span>
                    <div className="segment segment--sm" role="radiogroup" aria-labelledby="theme-label">
                        {(
                            [
                                ['system', 'Otomatis'],
                                ['light', 'Terang'],
                                ['dark', 'Gelap'],
                            ] as Array<[Theme, string]>
                        ).map(([id, label]) => (
                            <button key={id} type="button" role="radio" aria-checked={prefs.theme === id} className={prefs.theme === id ? 'is-on' : ''} onClick={() => update({ theme: id })}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="group" aria-labelledby="set-data">
                <h2 id="set-data" className="group-title">
                    Data di perangkat ini
                </h2>
                <div className="row">
                    <span className="row-text">
                        <b>Percakapan</b>
                        <small>{messageCount} pesan. Hilang saat halaman ditutup.</small>
                    </span>
                    <button type="button" className="btn btn--danger btn--sm" onClick={onClearConversation} disabled={!messageCount} aria-label="Hapus percakapan">
                        <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                        Hapus
                    </button>
                </div>
                <div className="row">
                    <span className="row-text">
                        <b>Contoh tangan pribadi</b>
                        <small>{camera.personalCount} contoh. Hanya titik koordinat tangan, bukan gambar.</small>
                    </span>
                    <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={() => camera.removePersonalExamples()}
                        disabled={!camera.personalCount}
                        aria-label="Hapus semua contoh pribadi"
                    >
                        <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                        Hapus
                    </button>
                </div>
                {camera.calibrationNotice && (
                    <p className="row-note" role="status">
                        {camera.calibrationNotice}
                    </p>
                )}
            </section>

            <section className="group" aria-labelledby="set-about">
                <h2 id="set-about" className="group-title">
                    Tentang BISARA
                </h2>
                <div className="about">
                    <p>
                        BISARA mengenali <b>ejaan jari</b> BISINDO (A sampai Z) dan kata isyarat yang kamu rekam sendiri. Ini belum menerjemahkan
                        BISINDO sebagai bahasa utuh.
                    </p>
                    <p>
                        Kamera diproses di browser dengan MediaPipe dan model TwoHand v1 (nearest-prototype, konsensus 6 dari 8 frame). Tidak ada
                        video yang diunggah, tidak ada akun, tidak ada pelacakan.
                    </p>
                    <p>
                        Bahasa daerah: leksikon BHASANTARA dan korpus{' '}
                        <a href={NUSAX_ATTRIBUTION.url} target="_blank" rel="noreferrer">
                            {NUSAX_ATTRIBUTION.name}
                        </a>{' '}
                        ({regionalLanguages.length - 1} bahasa, {bhasantaraGlossary.length.toLocaleString('id-ID')} padanan, {bhasantaraParallel.length.toLocaleString('id-ID')}{' '}
                        kalimat). Semua masih draf dan menunggu tinjauan penutur asli.
                    </p>
                    <p className="fine">
                        Sesi kamera terakhir: {camera.metrics.fps.toFixed(1)} FPS · {camera.metrics.latency.toFixed(0)} ms per frame.{' '}
                        <a href="/models/twohand-v1/evaluation.json" target="_blank" rel="noreferrer">
                            Hasil evaluasi model
                        </a>
                    </p>
                    <ul className="links">
                        <li>
                            <a href="https://github.com/rhiosutoyo/Indonesian-Sign-Language-BISINDO-Hand-Sign-Detection-Dataset" target="_blank" rel="noreferrer">
                                Dataset alfabet BISINDO, Rhio Sutoyo dkk. (MIT)
                            </a>
                        </li>
                        <li>
                            <a href={NUSAX_ATTRIBUTION.licensePath} target="_blank" rel="noreferrer">
                                Lisensi korpus NusaX ({NUSAX_ATTRIBUTION.license})
                            </a>
                        </li>
                        <li>
                            <a href="/licenses/MediaPipe-Apache-2.0.txt" target="_blank" rel="noreferrer">
                                Lisensi MediaPipe (Apache-2.0)
                            </a>
                        </li>
                        <li>
                            <a href="/licenses/Jemari-MIT.txt" target="_blank" rel="noreferrer">
                                Atribusi fondasi Jemari
                            </a>
                        </li>
                        <li>
                            <a href="/licenses/Fonts-OFL-1.1.txt" target="_blank" rel="noreferrer">
                                Lisensi font (SIL OFL 1.1)
                            </a>
                        </li>
                    </ul>
                </div>
            </section>
        </div>
    );
}
