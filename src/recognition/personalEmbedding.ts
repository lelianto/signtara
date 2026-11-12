/**
 * Personal words matched in the trained model's embedding space (few-shot): 3 recordings of
 * any word, including words the model never learned, are enough.
 *
 * Thresholds from ml/words/fewshot.ts (2 signers never seen by the model, 10 taught words × 3
 * recordings, 1,680 positive and 384 untaught queries): at cosine distance ≤ 0.10, 88.9% of
 * signs were accepted correctly, 0.1% wrongly and 2.6% of untaught words falsely; DTW on hand
 * landmarks gave 77.2% / 2.7% / 27.1%. Between 0.10 and 0.20 the words are offered as suggestions.
 */
import { embeddingDistance } from './wordModel';

export const PERSONAL_EMBEDDING = { maxDistance: 0.1, suggestDistance: 0.2, minSeparation: 0.1 };

export interface EmbeddedTemplate { id: string; word: string; conceptId: string; embedding: number[] }
export interface EmbeddingMatch {
  accepted: boolean;
  word?: string;
  conceptId?: string;
  distance: number | null;
  separation: number | null;
  ranking: { word: string; conceptId: string; distance: number }[];
  /** Personal words close enough to offer for confirmation. */
  suggestions: string[];
  reason: 'no_templates' | 'too_far' | 'ambiguous' | 'accepted';
}

export function matchEmbedding(query: number[], templates: EmbeddedTemplate[], exclude?: string, th = PERSONAL_EMBEDDING): EmbeddingMatch {
  const best = new Map<string, { word: string; conceptId: string; distance: number }>();
  for (const t of templates) {
    if (t.id === exclude) continue;
    const d = embeddingDistance(query, t.embedding);
    const cur = best.get(t.conceptId);
    if (!cur || d < cur.distance) best.set(t.conceptId, { word: t.word, conceptId: t.conceptId, distance: d });
  }
  const ranking = [...best.values()].sort((a, b) => a.distance - b.distance);
  if (!ranking.length) return { accepted: false, distance: null, separation: null, ranking, suggestions: [], reason: 'no_templates' };
  const [top, second] = ranking;
  const separation = second ? 1 - top.distance / Math.max(1e-9, second.distance) : null;
  const suggestions = ranking.filter((r) => r.distance <= th.suggestDistance).slice(0, 3).map((r) => r.word);
  const base = { word: top.word, conceptId: top.conceptId, distance: top.distance, separation, ranking: ranking.slice(0, 3) };
  if (top.distance > th.maxDistance) return { ...base, accepted: false, suggestions, reason: 'too_far' };
  if (separation !== null && separation < th.minSeparation) return { ...base, accepted: false, suggestions, reason: 'ambiguous' };
  return { ...base, accepted: true, suggestions: [], reason: 'accepted' };
}

/** Leave-one-out over the user's own recordings (same signer, not a general accuracy claim). */
export function crossValidateEmbeddings(templates: EmbeddedTemplate[]) {
  let correct = 0, wrong = 0, rejected = 0, tested = 0;
  const perWord = new Map<string, { word: string; correct: number; total: number }>();
  for (const t of templates) {
    if (!templates.some((x) => x.conceptId === t.conceptId && x.id !== t.id)) continue;
    tested++;
    const m = matchEmbedding(t.embedding, templates, t.id);
    const e = perWord.get(t.conceptId) ?? { word: t.word, correct: 0, total: 0 };
    e.total++;
    if (!m.accepted) rejected++;
    else if (m.conceptId === t.conceptId) { correct++; e.correct++; }
    else wrong++;
    perWord.set(t.conceptId, e);
  }
  return { tested, correct, wrong, rejected, perWord: [...perWord.values()] };
}
