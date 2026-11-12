/**
 * Combines the three word recognizers into one decision:
 *   1. personal recordings in the model's embedding space (few-shot, the user's own signing)
 *   2. the trained words-v1 classifier
 *   3. legacy hand-only personal recordings (DTW), for templates saved before holistic tracking
 * When nothing is confident enough, the closest candidates are returned as suggestions for the
 * user to confirm instead of guessing.
 */
import type { WordMatch } from './sequence';
import { PERSONAL_EMBEDDING, type EmbeddingMatch } from './personalEmbedding';
import type { ModelGuess } from './wordModel';
import { wordConceptId } from './vocabulary';

export interface WordResult extends WordMatch {
  source?: 'personal' | 'model';
  probability?: number;
  /** Nothing was confident: top candidates the user can confirm with confirmWord(). */
  suggestions?: string[];
}

export interface DecisionInput {
  embedding?: EmbeddingMatch | null;
  model?: { guess: ModelGuess; minProb: number; minMargin: number } | null;
  dtw?: WordMatch | null;
}

const NONE: WordResult = { accepted: false, distance: null, threshold: null, separation: null, reason: 'no_templates', ranking: [] };

function fromEmbedding(e: EmbeddingMatch): WordResult {
  return {
    accepted: e.accepted, word: e.word, conceptId: e.conceptId, source: 'personal', distance: e.distance,
    threshold: PERSONAL_EMBEDDING.maxDistance, separation: e.separation, reason: e.reason, ranking: e.ranking.map(({ word, distance }) => ({ word, distance })),
  };
}

function fromModel({ guess, minProb, minMargin }: NonNullable<DecisionInput['model']>): WordResult {
  return {
    accepted: guess.accepted, word: guess.word, conceptId: wordConceptId(guess.word), source: 'model',
    probability: guess.probability, distance: null, threshold: minProb, separation: guess.margin,
    reason: guess.accepted ? 'accepted' : guess.margin < minMargin ? 'ambiguous' : 'too_far',
    ranking: guess.ranking.map((r) => ({ word: r.word, distance: 1 - r.probability })),
  };
}

export function decideWord({ embedding, model, dtw }: DecisionInput): WordResult {
  if (embedding?.accepted) return fromEmbedding(embedding);
  if (model?.guess.accepted) return fromModel(model);
  if (dtw?.accepted) return { ...dtw, source: 'personal' };

  const suggestions = [...new Set([...(embedding?.suggestions ?? []), ...(model?.guess.suggest ? model.guess.ranking.map((r) => r.word) : [])])].slice(0, 3);
  // Report the most informative rejection: personal embedding, then model, then DTW.
  const base = embedding && embedding.reason !== 'no_templates' ? fromEmbedding(embedding)
    : model ? fromModel(model)
      : dtw ? { ...dtw, source: 'personal' as const }
        : NONE;
  return suggestions.length ? { ...base, accepted: false, suggestions } : { ...base, accepted: false };
}
