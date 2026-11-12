import { useEffect, useMemo, useRef, useState } from 'react';
import type { useCamera, FrameListener } from './useCamera';
import { SignSegmenter, crossValidate, matchWord, rawFrame, toSequence, wordThresholds, type WordMatch } from './sequence';
import { normalizeWord, wordConceptId } from './vocabulary';
import { holisticSequence, type HolisticRaw } from './holistic';
import { HolisticTracker } from './holisticTracker';
import { classifyWord, validateWordModel, type WordModel } from './wordModel';
import {
  clearWordTemplates, deleteWord, readWordTemplates, saveWordTemplate, type StoredWordTemplate,
} from '../storage/wordTemplates';

type Camera = ReturnType<typeof useCamera>;
export type WordPhase = 'off' | 'ready' | 'signing';
export interface Recording { word: string; done: number; total: number }

export const RECORDINGS_PER_SESSION = 3;
export type ModelStatus = 'off' | 'loading' | 'ready' | 'error';
/** A decision from personal recordings (DTW) or the trained model. */
export interface WordResult extends WordMatch { source?: 'personal' | 'model'; probability?: number }

let modelCache: Promise<WordModel> | null = null;
function loadWordModel() {
  modelCache ??= fetch('/models/words-v1/model.json').then(async (r) => {
    if (!r.ok) throw Error(`Word model HTTP ${r.status}`);
    const value: unknown = await r.json();
    validateWordModel(value);
    return value;
  }).catch((e) => { modelCache = null; throw e; });
  return modelCache;
}
const MIN_MODEL_FRAMES = 6;

/**
 * Isolated-sign word mode: consumes raw tracked frames from the camera, segments one sign
 * at a time (raise hands → sign → lower hands) and either stores it as a personal template
 * (while recording) or recognizes it. Personal recordings (DTW, hands only) are tried
 * first; otherwise the trained holistic model (hands + body + face, words-v1) decides.
 */
export function useWordRecognizer(camera: Camera, enabled: boolean, onWord: (word: string, conceptId: string) => void) {
  const [templates, setTemplates] = useState<StoredWordTemplate[]>([]);
  const [phase, setPhase] = useState<WordPhase>('off');
  const [duration, setDuration] = useState(0);
  const [lastMatch, setLastMatch] = useState<WordResult | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus>('off');
  const [model, setModel] = useState<WordModel | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [notice, setNotice] = useState('');
  const [evaluation, setEvaluation] = useState<ReturnType<typeof crossValidate> | null>(null);

  const templatesRef = useRef(templates);
  const recordingRef = useRef<Recording | null>(null);
  const modelRef = useRef<WordModel | null>(null);
  modelRef.current = model;
  const thresholdsRef = useRef(new Map<string, number>());
  const callback = useRef(onWord);
  callback.current = onWord;

  const thresholds = useMemo(() => wordThresholds(templates), [templates]);
  templatesRef.current = templates;
  thresholdsRef.current = thresholds;

  const words = useMemo(() => {
    const map = new Map<string, { word: string; conceptId: string; count: number }>();
    for (const t of templates) {
      const cur = map.get(t.conceptId) ?? { word: t.word, conceptId: t.conceptId, count: 0 };
      cur.count++;
      map.set(t.conceptId, cur);
    }
    return [...map.values()].sort((a, b) => a.word.localeCompare(b.word));
  }, [templates]);

  useEffect(() => {
    readWordTemplates().then(setTemplates).catch(() => setNotice('Kosakata pribadi tidak dapat dibaca dari penyimpanan browser.'));
  }, []);

  const setRec = (r: Recording | null) => { recordingRef.current = r; setRecording(r); };

  // Trained model + body/face trackers load only while word mode is active.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setModelStatus((s) => (s === 'ready' ? s : 'loading'));
    loadWordModel().then((m) => { if (!cancelled) { setModel(m); setModelStatus('ready'); } })
      .catch(() => { if (!cancelled) setModelStatus('error'); });
    return () => { cancelled = true; };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !camera.running) {
      camera.frameListener.current = null;
      setPhase('off');
      return;
    }
    const segmenter = new SignSegmenter();
    let current: WordPhase = 'ready', lastDurationUpdate = 0;
    let holistic: HolisticTracker | null = null, disposed = false;
    let holisticFrames: HolisticRaw[] = [];
    HolisticTracker.create().then((t) => { if (disposed) t.close(); else holistic = t; }).catch(() => { /* hands-only fallback */ });
    setPhase('ready');
    const listener: FrameListener = (hands, frame, now) => {
      const event = segmenter.push(rawFrame(hands, frame, now));
      if (event.type === 'signing' && holistic && camera.video.current) {
        // Body and face are only needed while a sign is in progress.
        const body = holistic.detect(camera.video.current, now);
        holisticFrames.push({ t: now, width: frame.width, height: frame.height, hands: hands.map((h) => h.map((p) => ({ x: p.x, y: p.y, z: p.z }))), ...body });
        if (holisticFrames.length > 200) holisticFrames.shift();
      }
      if (event.type === 'signing') {
        if (current !== 'signing') { current = 'signing'; setPhase('signing'); setLastMatch(null); }
        if (now - lastDurationUpdate > 100) { lastDurationUpdate = now; setDuration(event.duration); }
        return;
      }
      if (event.type === 'idle') return;
      current = 'ready';
      setPhase('ready');
      setDuration(0);
      const signFrames = holisticFrames;
      holisticFrames = [];
      if (event.type === 'rejected') {
        setNotice(event.reason === 'too_short'
          ? 'Gerakan terlalu singkat. Lakukan isyarat penuh, lalu turunkan tangan.'
          : 'Isyarat lebih dari 4 detik. Turunkan tangan untuk mengulang satu kata.');
        return;
      }
      const sequence = toSequence(event.frames);
      const rec = recordingRef.current;
      if (rec) {
        saveWordTemplate(rec.word, sequence).then((saved) => {
          setTemplates(saved);
          setEvaluation(null);
          const done = rec.done + 1;
          if (done >= rec.total) {
            setRec(null);
            setNotice(`${rec.total} contoh “${rec.word}” tersimpan. Coba isyaratkan lagi untuk menguji.`);
          } else {
            setRec({ ...rec, done });
            setNotice(`Contoh ${done}/${rec.total} “${rec.word}” tersimpan. Turunkan tangan, lalu ulangi isyaratnya.`);
          }
        }).catch(() => { setRec(null); setNotice('Contoh gagal disimpan. Periksa penyimpanan browser.'); });
        return;
      }
      const personal: WordResult = { ...matchWord(sequence, templatesRef.current, thresholdsRef.current), source: 'personal' };
      let result: WordResult = personal;
      const m = modelRef.current;
      const start = event.frames[0].t, end = event.frames[event.frames.length - 1].t;
      const span = signFrames.filter((f) => f.t >= start && f.t <= end);
      if (!personal.accepted && m && span.length >= MIN_MODEL_FRAMES) {
        const guess = classifyWord(m, holisticSequence(span));
        const modelResult: WordResult = {
          accepted: guess.accepted, word: guess.word, conceptId: wordConceptId(guess.word), source: 'model',
          probability: guess.probability, distance: null, threshold: m.thresholds.minProb, separation: guess.margin,
          reason: guess.accepted ? 'accepted' : guess.margin < m.thresholds.minMargin ? 'ambiguous' : 'too_far',
          ranking: guess.ranking.map((r) => ({ word: r.word, distance: 1 - r.probability })),
        };
        // Prefer the model's view unless personal recordings had a (rejected) candidate and the model is unsure too.
        if (modelResult.accepted || personal.reason === 'no_templates') result = modelResult;
      }
      setLastMatch(result);
      if (result.accepted && result.word && result.conceptId) {
        setNotice('');
        callback.current(result.word, result.conceptId);
      } else {
        setNotice(result.reason === 'no_templates'
          ? (m ? 'Isyarat belum terbaca jelas. Pastikan bahu dan wajah terlihat, lalu ulangi.' : 'Belum ada kosakata. Rekam beberapa contoh kata terlebih dahulu.')
          : result.reason === 'ambiguous'
            ? `Mirip beberapa kata (${result.ranking.slice(0, 2).map((r) => r.word).join(' / ')}). Ulangi lebih jelas.`
            : 'Isyarat belum cocok dengan kosakata yang dikenal.');
      }
    };
    camera.frameListener.current = listener;
    return () => {
      disposed = true;
      holistic?.close();
      holistic = null;
      if (camera.frameListener.current === listener) camera.frameListener.current = null;
    };
  }, [enabled, camera.running, camera.frameListener]);

  function startRecording(input: string) {
    const word = normalizeWord(input);
    if (!word) { setNotice('Gunakan huruf a–z dan spasi saja, maksimal 30 karakter.'); return; }
    setLastMatch(null);
    setRec({ word, done: 0, total: RECORDINGS_PER_SESSION });
    setNotice(`Merekam “${word}”: angkat tangan, lakukan isyarat, lalu turunkan tangan. Ulangi ${RECORDINGS_PER_SESSION}×.`);
  }

  function cancelRecording() {
    setRec(null);
    setNotice('Perekaman dibatalkan.');
  }

  async function removeWord(conceptId: string) {
    try { setTemplates(await deleteWord(conceptId)); setEvaluation(null); } catch { setNotice('Kata gagal dihapus.'); }
  }

  async function removeAll() {
    try { await clearWordTemplates(); setTemplates([]); setEvaluation(null); setLastMatch(null); setNotice('Semua kosakata pribadi dihapus.'); }
    catch { setNotice('Kosakata gagal dihapus. Periksa penyimpanan browser.'); }
  }

  function evaluate() { setEvaluation(crossValidate(templatesRef.current)); }

  return {
    templates, words, phase, duration, lastMatch, recording, notice, evaluation,
    modelStatus,
    /** Words the trained model can recognize without personal recordings. */
    modelWords: model?.classes ?? [],
    modelInfo: model ? { version: model.version, license: model.license, datasets: model.datasets } : null,
    startRecording, cancelRecording, removeWord, removeAll, evaluate,
  };
}
