import type {
  AksaraScript,
  CulturalLiteracyItem,
  LexiconEntry,
  RegionalLanguageCode,
  Register,
  SpelledTranslationResult,
  TranslationOptions,
} from './types';
import {
  AKSARA_LABELS,
  aksaraToLatinLocal,
  getNativeScriptForLanguage,
  transliterateToAksara,
  transliterateWithMeta,
} from './aksara';
import {
  analyzeIndonesianToken,
  analyzeRegionalToken,
  normalizeIndonesianToken,
  type PossessiveType,
} from './stemmer';
import {
  bhasantaraGlossary,
  bhasantaraParallel,
  culturalLiteracyCorpus,
  LOCALE_MAP,
  LOCALE_PACKS,
  regionalLanguages,
} from './locales';

function cleanPhrase(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[?.!,;:]+$/g, '')
    .replace(/\s+/g, ' ');
}

function foldDiacritics(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^'+|'+$/g, '');
}

const AKSARA_UNICODE_REGEX = /[\uA980-\uA9DF\u1B80-\u1BBF\u1B00-\u1B7F]/;

function detectAksaraScriptInText(text: string): RegionalLanguageCode | null {
  if (/[\uA980-\uA9DF]/.test(text)) return 'jv';
  if (/[\u1B80-\u1BBF]/.test(text)) return 'sun';
  if (/[\u1B00-\u1B7F]/.test(text)) return 'ban';
  return null;
}

// ============================================================================
// Precomputed O(1) Forward & Reverse Lexicon Indices
// ============================================================================

const forwardIndexByLang = {} as Record<RegionalLanguageCode, Map<string, LexiconEntry>>;
const reverseIndexByLang = {} as Record<RegionalLanguageCode, Map<string, string>>;
const reverseSingleWordsByLang = {} as Record<RegionalLanguageCode, Set<string>>;
const multiWordRegionalByLang = {} as Record<
  RegionalLanguageCode,
  Array<{ form: string; idTerm: string; wordCount: number }>
>;
const markerSetByLang = {} as Record<RegionalLanguageCode, Set<string>>;
const aksaraOverridesByLang = {} as Record<RegionalLanguageCode, Map<string, string>>;

const KNOWN_ID_TERMS = new Set<string>();
const KNOWN_ID_SINGLE_WORDS = new Set<string>([
  'saya', 'aku', 'kamu', 'anda', 'dia', 'beliau', 'kami', 'kita', 'mereka',
  'ini', 'itu', 'sini', 'sana', 'di', 'ke', 'dari', 'dan', 'dengan', 'atau',
  'yang', 'untuk', 'pada', 'adalah', 'itu', 'ada', 'tidak', 'bukan', 'jangan',
  'sudah', 'belum', 'sedang', 'akan', 'sangat', 'lebih', 'paling', 'juga',
  'saja', 'lagi', 'mau', 'ingin', 'bisa', 'tahu', 'harus', 'boleh',
]);

for (const pack of LOCALE_PACKS) {
  const code = pack.meta.code;
  const fwd = new Map<string, LexiconEntry>();
  const rev = new Map<string, string>();
  const revSingle = new Set<string>();
  const multiReg: Array<{ form: string; idTerm: string; wordCount: number }> = [];
  const markers = new Set<string>(pack.markers.map((m) => foldDiacritics(cleanPhrase(m))));
  const aksaraMap = new Map<string, string>();
  for (const m of pack.markers) markers.add(cleanPhrase(m));

  for (const entry of pack.lexicon) {
    const idNorm = cleanPhrase(entry.idTerm);
    if (!fwd.has(idNorm)) {
      fwd.set(idNorm, entry);
    }
    KNOWN_ID_TERMS.add(idNorm);
    for (const part of idNorm.split(' ')) {
      if (part) KNOWN_ID_SINGLE_WORDS.add(part);
    }

    if (entry.aksara && entry.aksara.trim()) {
      for (const f of [entry.casual, entry.formal, entry.honorific]) {
        const nf = f ? cleanPhrase(f) : '';
        if (nf && !aksaraMap.has(nf)) {
          aksaraMap.set(nf, entry.aksara.trim());
        }
      }
    }

    const forms = [
      entry.casual,
      entry.formal,
      ...(entry.honorific ? [entry.honorific] : []),
      ...(entry.aliases ?? []),
    ];

    for (const rawForm of forms) {
      const normForm = cleanPhrase(rawForm);
      if (!normForm) continue;
      const foldedForm = foldDiacritics(normForm);

      for (const variant of [normForm, foldedForm]) {
        if (!variant) continue;
        if (!rev.has(variant)) {
          rev.set(variant, idNorm);
          const wc = variant.split(' ').length;
          if (wc > 1) {
            multiReg.push({ form: variant, idTerm: idNorm, wordCount: wc });
          } else {
            revSingle.add(variant);
          }
        }
      }
    }
  }

  multiReg.sort((a, b) => b.wordCount - a.wordCount || b.form.length - a.form.length);

  forwardIndexByLang[code] = fwd;
  reverseIndexByLang[code] = rev;
  reverseSingleWordsByLang[code] = revSingle;
  multiWordRegionalByLang[code] = multiReg;
  markerSetByLang[code] = markers;
  aksaraOverridesByLang[code] = aksaraMap;
}

const FIRST_PERSON_SUBJECTS = new Set(['saya', 'kami', 'kita']);
const RESPECTED_SUBJECTS = new Set([
  'kamu', 'anda', 'beliau', 'bapak', 'ibu', 'kakek', 'nenek', 'guru', 'kakak',
]);
const RESPECTED_NOUN_TITLES = new Set([
  'bapak', 'ibu', 'kakek', 'nenek', 'guru', 'kakak', 'anak', 'adik', 'teman', 'saudara',
]);
const PREPOSITIONS = new Set(['di', 'ke', 'dari', 'dengan', 'untuk', 'oleh']);

const BOUND_ENCLITICS = new Set([
  'ku', 'mu', 'hu', 'na', 'nyo', 'ne', 'nyane', 'ta',
]);

function selectEntryForm(
  entry: LexiconEntry,
  register: Register,
  useHonorific = false
): { text: string; registerFallback: boolean } {
  if (register !== 'krama') {
    return { text: entry.casual, registerFallback: false };
  }
  if (useHonorific && entry.honorific && entry.honorific.trim()) {
    return { text: entry.honorific, registerFallback: false };
  }
  if (entry.formal && entry.formal.trim()) {
    return { text: entry.formal, registerFallback: false };
  }
  // Honest fallback: entry has no polite/formal form (e.g. automatic corpus entry)
  return { text: entry.casual, registerFallback: true };
}

function formatTargetPossessive(
  baseWord: string,
  possessive: PossessiveType,
  targetLang: RegionalLanguageCode,
  register: Register
): string {
  const pack = LOCALE_MAP[targetLang];
  const rule = pack.possessives?.[possessive];
  if (!rule) {
    const idSuffix = possessive === 'my' ? 'ku' : possessive === 'your' ? 'mu' : 'nya';
    return `${baseWord}${idSuffix}`;
  }

  const possForm =
    register === 'krama'
      ? (possessive === 'your' && 'honorific' in rule && rule.honorific
          ? rule.honorific
          : rule.formal)
      : rule.casual;

  // Javanese phonological sandhi for -e/-ne and -ipun/-nipun
  if (targetLang === 'jv' && possForm === 'e') {
    return /[aiueo]$/i.test(baseWord) ? `${baseWord}ne` : `${baseWord}e`;
  }
  if (targetLang === 'jv' && possForm === 'ipun') {
    return /[aiueo]$/i.test(baseWord) ? `${baseWord}nipun` : `${baseWord}ipun`;
  }

  if (BOUND_ENCLITICS.has(possForm)) {
    return `${baseWord}${possForm}`;
  }

  return `${baseWord} ${possForm}`;
}

function getRegisterLabel(code: RegionalLanguageCode, register: Register): string {
  if (code === 'id') return 'Standar';
  const terms = LOCALE_MAP[code]?.meta.registerTerms;
  if (terms) {
    return register === 'krama' ? terms.politeLabel : terms.casualLabel;
  }
  return register === 'krama' ? 'Halus / Formal' : 'Sehari-hari';
}

function buildAksaraFields(
  text: string,
  targetLang: RegionalLanguageCode,
  fallbackScript: AksaraScript,
  nativeScript: AksaraScript | undefined,
  options?: {
    directEntryAksara?: string;
    extraOverrides?: ReadonlyMap<string, string>;
  }
): { aksaraText: string; nativeAksaraText: string | null; aksaraAuto: boolean } {
  const baseOverrides = aksaraOverridesByLang[targetLang];
  let mergedOverrides: ReadonlyMap<string, string> | undefined = baseOverrides;
  if (options?.extraOverrides && options.extraOverrides.size > 0) {
    const combined = new Map<string, string>(baseOverrides);
    for (const [k, v] of options.extraOverrides.entries()) {
      combined.set(k, v);
    }
    mergedOverrides = combined;
  }

  if (nativeScript) {
    const nativeMeta = transliterateWithMeta(text, nativeScript, {
      entryAksara: options?.directEntryAksara,
      lexiconOverrides: mergedOverrides,
    });
    const fallbackMeta =
      fallbackScript === nativeScript
        ? nativeMeta
        : transliterateWithMeta(text, fallbackScript);
    return {
      aksaraText: fallbackMeta.text,
      nativeAksaraText: nativeMeta.text,
      aksaraAuto: nativeMeta.aksaraAuto,
    };
  }

  const fallbackMeta = transliterateWithMeta(text, fallbackScript);
  return {
    aksaraText: fallbackMeta.text,
    nativeAksaraText: null,
    aksaraAuto: fallbackMeta.aksaraAuto,
  };
}

/**
 * Deterministic local regional language detector across all Nusantara languages.
 * Scores script range, parallel sentences, multi-word phrases, language markers,
 * and distinctive lexicon entries while avoiding false-friend collisions with Indonesian.
 */
export function detectRegionalLanguageLocal(text: string): {
  code: RegionalLanguageCode;
  name: string;
} {
  const rawTrimmed = text.trim();
  if (!rawTrimmed) return { code: 'id', name: 'Indonesia' };

  const scriptLang = detectAksaraScriptInText(rawTrimmed);
  if (scriptLang) {
    return { code: scriptLang, name: LOCALE_MAP[scriptLang].meta.name };
  }

  const clean = cleanPhrase(rawTrimmed);
  const folded = foldDiacritics(clean);
  if (!clean) return { code: 'id', name: 'Indonesia' };

  const scores: Record<RegionalLanguageCode, number> = {
    id: 0,
    jv: 0,
    sun: 0,
    ban: 0,
    mad: 0,
    bbc: 0,
    min: 0,
    bug: 0,
    ace: 0,
    bjn: 0,
    nij: 0,
  };

  // 1. Parallel corpus exact matches
  for (const p of bhasantaraParallel) {
    const idNorm = cleanPhrase(p.idText);
    const targetNorm = cleanPhrase(p.targetText);
    if (p.sourceLang === 'id' && p.targetLang !== 'id') {
      if (clean === idNorm) scores.id += 8;
      if (clean === targetNorm || folded === foldDiacritics(targetNorm)) scores[p.targetLang] += 10;
    } else if (p.sourceLang !== 'id' && p.targetLang === 'id') {
      if (clean === idNorm) scores.id += 8;
      if (clean === targetNorm || folded === foldDiacritics(targetNorm)) scores[p.sourceLang] += 10;
    } else if (p.sourceLang !== 'id' && p.targetLang !== 'id') {
      if (clean === idNorm) scores[p.sourceLang] += 10;
      if (clean === targetNorm) scores[p.targetLang] += 10;
    }
  }

  // 2. Multi-word phrase matches
  if (KNOWN_ID_TERMS.has(clean) && clean.includes(' ')) {
    scores.id += 6;
  }
  for (const pack of LOCALE_PACKS) {
    const code = pack.meta.code;
    if (code === 'id') continue;
    for (const mp of multiWordRegionalByLang[code]) {
      if (!KNOWN_ID_TERMS.has(mp.form) && (clean.includes(mp.form) || folded.includes(mp.form))) {
        scores[code] += 5;
      }
    }
  }

  // 3. Token-level scoring
  const tokens = clean.split(/\s+/);
  for (const rawTok of tokens) {
    const tok = rawTok.replace(/^[^a-z0-9'èéêëôâ-]+|[^a-z0-9'èéêëôâ-]+$/gi, '');
    if (!tok) continue;
    const tokFolded = foldDiacritics(tok);
    const idAnalyzed = analyzeIndonesianToken(tokFolded, KNOWN_ID_SINGLE_WORDS);
    const isKnownId =
      KNOWN_ID_SINGLE_WORDS.has(tokFolded) ||
      KNOWN_ID_SINGLE_WORDS.has(idAnalyzed.stem) ||
      KNOWN_ID_TERMS.has(idAnalyzed.normalized);

    if (markerSetByLang.id.has(tokFolded)) {
      scores.id += 3;
    } else if (isKnownId) {
      scores.id += 2;
    }

    for (const pack of LOCALE_PACKS) {
      const code = pack.meta.code;
      if (code === 'id') continue;

      const isMarker = markerSetByLang[code].has(tok) || markerSetByLang[code].has(tokFolded);
      if (isMarker) {
        scores[code] += 3.5;
      }

      const regAnalyzed = analyzeRegionalToken(tok, reverseSingleWordsByLang[code]);
      const regFolded = analyzeRegionalToken(tokFolded, reverseSingleWordsByLang[code]);
      const inRev =
        reverseSingleWordsByLang[code].has(regAnalyzed.stem) ||
        reverseSingleWordsByLang[code].has(regFolded.stem);

      if (inRev) {
        scores[code] += isKnownId ? 0.5 : 2.5;
      }
    }
  }

  let bestCode: RegionalLanguageCode = 'id';
  let bestScore = scores.id;

  for (const pack of LOCALE_PACKS) {
    const code = pack.meta.code;
    if (code === 'id') continue;
    if (scores[code] > bestScore) {
      bestScore = scores[code];
      bestCode = code;
    }
  }

  return { code: bestCode, name: LOCALE_MAP[bestCode].meta.name };
}

interface PivotResult {
  indonesianText: string;
  matchedCount: number;
  totalTokens: number;
  untranslated: string[];
  matchedMeaning?: string;
  method: 'parallel' | 'glossary' | 'pivot' | 'passthrough';
}

/**
 * Converts regional text (`sourceLang !== 'id'`) into canonical Bahasa Indonesia pivot text.
 * Supports parallel sentences, multi-word phrases, clitic stripping, and word-by-word lookup.
 */
function pivotRegionalToIndonesian(
  rawText: string,
  sourceLang: RegionalLanguageCode
): PivotResult {
  const clean = rawText.trim().replace(/\s+/g, ' ');
  const norm = cleanPhrase(clean);
  const folded = foldDiacritics(norm);
  const revMap = reverseIndexByLang[sourceLang];
  const revSingle = reverseSingleWordsByLang[sourceLang];

  // 1. Check parallel sentences involving sourceLang and id
  for (const p of bhasantaraParallel) {
    if (
      (p.sourceLang === 'id' && p.targetLang === sourceLang) ||
      (p.sourceLang === sourceLang && p.targetLang === 'id')
    ) {
      const targetNorm = cleanPhrase(p.targetText);
      if (norm === targetNorm || folded === foldDiacritics(targetNorm)) {
        return {
          indonesianText: p.idText,
          matchedCount: norm.split(' ').length,
          totalTokens: norm.split(' ').length,
          untranslated: [],
          matchedMeaning: p.context,
          method: 'parallel',
        };
      }
    }
  }

  // 2. Exact phrase match in sourceLang reverse index
  const exactIdTerm = revMap.get(norm) ?? revMap.get(folded);
  if (exactIdTerm) {
    const entry = forwardIndexByLang[sourceLang].get(exactIdTerm);
    return {
      indonesianText: exactIdTerm,
      matchedCount: norm.split(' ').length,
      totalTokens: norm.split(' ').length,
      untranslated: [],
      matchedMeaning: entry?.meaning || undefined,
      method: 'glossary',
    };
  }

  // 3. Compositional multi-word + token-by-token regional -> Indonesian pivot
  const rawTokens = clean.split(' ');
  const outTokens: string[] = [];
  const untranslated: string[] = [];
  let matchedCount = 0;
  let i = 0;

  while (i < rawTokens.length) {
    let phraseMatched = false;
    const maxLen = Math.min(4, rawTokens.length - i);
    for (let len = maxLen; len >= 2; len--) {
      const sliceRaw = rawTokens.slice(i, i + len).join(' ');
      const trailMatch = sliceRaw.match(/([?.!,;:]+)$/);
      const trail = trailMatch ? trailMatch[1] : '';
      const candNorm = cleanPhrase(sliceRaw);
      const candFolded = foldDiacritics(candNorm);
      const hit = revMap.get(candNorm) ?? revMap.get(candFolded);
      if (hit) {
        outTokens.push(`${hit}${trail}`);
        matchedCount += len;
        i += len;
        phraseMatched = true;
        break;
      }
    }
    if (phraseMatched) continue;

    const tok = rawTokens[i];
    const punctMatch = tok.match(/^([^a-z0-9'èéêëôâ-]*)([a-z0-9'èéêëôâ-]+)([^a-z0-9'èéêëôâ-]*)$/i);
    if (!punctMatch) {
      outTokens.push(tok);
      i++;
      continue;
    }

    const [, lead, core, trail] = punctMatch;
    const regDirect = analyzeRegionalToken(core, revSingle);
    const regFold = analyzeRegionalToken(foldDiacritics(core), revSingle);

    const idStem = revMap.get(regDirect.stem) ?? revMap.get(regFold.stem);
    const poss = regDirect.possessive ?? regFold.possessive;

    if (idStem) {
      const possSuffix =
        poss === 'my' ? 'ku' : poss === 'your' ? 'mu' : poss === 'their' ? 'nya' : '';
      outTokens.push(`${lead}${idStem}${possSuffix}${trail}`);
      matchedCount++;
    } else {
      const idCheck = analyzeIndonesianToken(foldDiacritics(core), KNOWN_ID_SINGLE_WORDS);
      if (
        KNOWN_ID_SINGLE_WORDS.has(idCheck.stem) ||
        KNOWN_ID_TERMS.has(idCheck.normalized)
      ) {
        outTokens.push(`${lead}${idCheck.normalized}${trail}`);
        matchedCount++;
      } else {
        outTokens.push(tok);
        if (!/^\d+$/.test(core)) {
          untranslated.push(core.toLowerCase());
        }
      }
    }
    i++;
  }

  return {
    indonesianText: matchedCount > 0 ? outTokens.join(' ') : clean,
    matchedCount,
    totalTokens: rawTokens.length,
    untranslated,
    method: matchedCount > 0 ? 'pivot' : 'passthrough',
  };
}

function preserveInitialCap(sourceText: string, translated: string): string {
  if (!translated || !sourceText) return translated;
  // Preserve lexicon capitalization if it already starts uppercase, otherwise match sentence case
  if (/^[A-Z]/.test(translated)) return translated;
  const isSentenceCase = /^[A-Z][a-z]/.test(sourceText.trim());
  if (isSentenceCase) {
    return translated.charAt(0).toUpperCase() + translated.slice(1);
  }
  return translated;
}

/**
 * Primary modular translation engine supporting:
 * 1. Sign mode (`inputMode: 'sign'`): BISINDO -> Bahasa Indonesia -> Target Regional Language
 * 2. Text mode (`inputMode: 'text'`): Source Language (Indonesia / Regional A / Auto) <-> Target Language (Indonesia / Regional B)
 * 3. Context-aware speech levels (`casual`, self-polite `formal`, elder-respecting `honorific`)
 *    with honest `registerFallback: true` when a formal form is unavailable
 * 4. Honest native Aksara availability (`hasNativeAksara`, `nativeAksaraText`, `aksaraAuto`) & `coverage` metrics
 */
export function translateText(options: TranslationOptions): SpelledTranslationResult {
  const {
    text: rawInput,
    sourceLang = 'auto',
    targetLang,
    register = 'ngoko',
    inputMode = 'text',
    fallbackConceptId,
    selectedScript,
  } = options;

  const langMeta = regionalLanguages.find((l) => l.code === targetLang) || regionalLanguages[0];
  const nativeScript = getNativeScriptForLanguage(targetLang);
  const hasNativeAksara = Boolean(nativeScript);
  const fallbackScript: AksaraScript = selectedScript || nativeScript || 'JAVANESE';
  const registerLabel = getRegisterLabel(targetLang, register);

  // Convert Aksara Unicode input to Latin transparently if entered directly
  const inputScriptLang = detectAksaraScriptInText(rawInput);
  const workingRaw = AKSARA_UNICODE_REGEX.test(rawInput)
    ? aksaraToLatinLocal(rawInput)
    : rawInput;

  const clean = workingRaw.trim().replace(/\s+/g, ' ');
  const norm = cleanPhrase(clean);

  const detectedSourceLang = inputScriptLang
    ? { code: inputScriptLang, name: LOCALE_MAP[inputScriptLang].meta.name }
    : detectRegionalLanguageLocal(clean);

  const resolvedSourceLang: RegionalLanguageCode =
    inputMode === 'sign'
      ? 'id'
      : sourceLang === 'auto'
      ? detectedSourceLang.code
      : sourceLang;

  // Empty input fallback (single fingerspelled letter preview)
  if (!norm) {
    const letter = fallbackConceptId?.startsWith('LETTER_') ? fallbackConceptId.slice(7) : '';
    const aksara = letter ? transliterateToAksara(letter, fallbackScript) : '—';
    const nativeAksara =
      nativeScript && letter ? transliterateToAksara(letter, nativeScript) : null;
    return {
      indonesianText: letter || '—',
      translatedText: letter || '—',
      sourceLang: resolvedSourceLang,
      detectedSourceLang,
      languageName: langMeta.name,
      nativeName: langMeta.nativeName,
      registerLabel,
      registerFallback: false,
      hasSpeechLevels: langMeta.hasSpeechLevels,
      hasNativeAksara,
      nativeScript,
      aksaraText: aksara,
      nativeAksaraText: nativeAksara,
      aksaraAuto: Boolean(letter),
      aksaraLabel: nativeScript ? AKSARA_LABELS[nativeScript] : AKSARA_LABELS[fallbackScript],
      untranslatedTokens: [],
      coverage: letter ? 1 : 0,
      sourceMethod: 'letter',
    };
  }

  // Same-language passthrough when source === target === 'id'
  if (resolvedSourceLang === 'id' && targetLang === 'id') {
    return {
      indonesianText: clean,
      translatedText: clean,
      sourceLang: 'id',
      detectedSourceLang,
      languageName: langMeta.name,
      nativeName: langMeta.nativeName,
      registerLabel: 'Standar',
      registerFallback: false,
      hasSpeechLevels: false,
      hasNativeAksara: false,
      aksaraText: transliterateToAksara(clean, fallbackScript),
      nativeAksaraText: null,
      aksaraAuto: true,
      aksaraLabel: AKSARA_LABELS[fallbackScript],
      untranslatedTokens: [],
      coverage: 1,
      sourceMethod: 'passthrough',
    };
  }

  // Step A: Pivot Source Regional Language -> Canonical Bahasa Indonesia
  let effectiveIndonesian = clean;
  let pivotInfo: PivotResult | null = null;

  if (resolvedSourceLang !== 'id') {
    pivotInfo = pivotRegionalToIndonesian(clean, resolvedSourceLang);
    effectiveIndonesian = pivotInfo.indonesianText;
  }

  const effectiveNorm = cleanPhrase(effectiveIndonesian);

  // Target is Bahasa Indonesia: return the pivoted Indonesian result directly
  if (targetLang === 'id') {
    const total = pivotInfo?.totalTokens || effectiveNorm.split(' ').length;
    const untrans = pivotInfo?.untranslated ?? [];
    const cov = total > 0 ? Math.max(0, (total - untrans.length) / total) : 1;
    return {
      indonesianText: effectiveIndonesian,
      translatedText: effectiveIndonesian,
      sourceLang: resolvedSourceLang,
      detectedSourceLang,
      languageName: langMeta.name,
      nativeName: langMeta.nativeName,
      registerLabel: 'Standar',
      registerFallback: false,
      hasSpeechLevels: false,
      hasNativeAksara: false,
      aksaraText: transliterateToAksara(effectiveIndonesian, fallbackScript),
      nativeAksaraText: null,
      aksaraAuto: true,
      aksaraLabel: AKSARA_LABELS[fallbackScript],
      matchedMeaning: pivotInfo?.matchedMeaning,
      untranslatedTokens: untrans,
      coverage: Number(cov.toFixed(2)),
      sourceMethod:
        pivotInfo?.method === 'parallel'
          ? 'parallel'
          : pivotInfo?.method === 'glossary'
          ? 'glossary'
          : pivotInfo && pivotInfo.matchedCount > 0
          ? 'pivot'
          : 'passthrough',
    };
  }

  // Direct cross-regional parallel sentence check (e.g., jv <-> sun)
  if (resolvedSourceLang !== 'id' && resolvedSourceLang !== targetLang) {
    const crossParallel = bhasantaraParallel.find(
      (p) =>
        p.sourceLang === resolvedSourceLang &&
        p.targetLang === targetLang &&
        cleanPhrase(p.idText) === norm
    );
    if (crossParallel) {
      const out = crossParallel.targetText;
      const aksaraFields = buildAksaraFields(out, targetLang, fallbackScript, nativeScript);
      return {
        indonesianText: effectiveIndonesian,
        translatedText: out,
        sourceLang: resolvedSourceLang,
        detectedSourceLang,
        languageName: langMeta.name,
        nativeName: langMeta.nativeName,
        registerLabel,
        registerFallback: false,
        hasSpeechLevels: langMeta.hasSpeechLevels,
        hasNativeAksara,
        nativeScript,
        ...aksaraFields,
        aksaraLabel: nativeScript ? AKSARA_LABELS[nativeScript] : AKSARA_LABELS[fallbackScript],
        matchedMeaning: crossParallel.context,
        untranslatedTokens: [],
        coverage: 1,
        sourceMethod: 'parallel',
      };
    }
  }

  // Step B1: Parallel sentence match (Indonesia <-> targetLang)
  const parallelHit = bhasantaraParallel.find(
    (p) =>
      ((p.sourceLang === 'id' && p.targetLang === targetLang) ||
        (p.sourceLang === targetLang && p.targetLang === 'id')) &&
      (cleanPhrase(p.idText) === effectiveNorm || cleanPhrase(p.targetText) === norm)
  );
  if (parallelHit) {
    const out =
      register === 'krama' && parallelHit.formalText
        ? parallelHit.formalText
        : parallelHit.targetText;
    const isNusaXAutoParallel =
      register === 'krama' &&
      !parallelHit.formalText &&
      /NusaX/i.test(parallelHit.context);
    const aksaraFields = buildAksaraFields(out, targetLang, fallbackScript, nativeScript);
    return {
      indonesianText: parallelHit.idText,
      translatedText: out,
      sourceLang: resolvedSourceLang,
      detectedSourceLang,
      languageName: langMeta.name,
      nativeName: langMeta.nativeName,
      registerLabel,
      registerFallback: isNusaXAutoParallel,
      hasSpeechLevels: langMeta.hasSpeechLevels,
      hasNativeAksara,
      nativeScript,
      ...aksaraFields,
      aksaraLabel: nativeScript ? AKSARA_LABELS[nativeScript] : AKSARA_LABELS[fallbackScript],
      matchedMeaning: parallelHit.context,
      untranslatedTokens: [],
      coverage: 1,
      sourceMethod: 'parallel',
    };
  }

  const fwdMap = forwardIndexByLang[targetLang];

  // Step B2: Exact phrase glossary match in targetLang
  const exactSingleCheck = !effectiveNorm.includes(' ')
    ? analyzeIndonesianToken(effectiveNorm, KNOWN_ID_SINGLE_WORDS)
    : null;
  const exactKey =
    fwdMap.has(effectiveNorm)
      ? effectiveNorm
      : exactSingleCheck && !exactSingleCheck.possessive && !exactSingleCheck.locativePrefix && fwdMap.has(exactSingleCheck.normalized)
      ? exactSingleCheck.normalized
      : null;

  if (exactKey) {
    const exactEntry = fwdMap.get(exactKey)!;
    const selected = selectEntryForm(exactEntry, register, false);
    const translated = selected.text;
    const honorificVariant =
      register === 'krama' &&
      exactEntry.honorific &&
      exactEntry.honorific !== exactEntry.formal
        ? exactEntry.honorific
        : undefined;
    const aksaraFields = buildAksaraFields(translated, targetLang, fallbackScript, nativeScript, {
      directEntryAksara: exactEntry.aksara,
    });
    return {
      indonesianText: resolvedSourceLang !== 'id' ? effectiveIndonesian : clean,
      translatedText: translated,
      honorificVariant,
      sourceLang: resolvedSourceLang,
      detectedSourceLang,
      languageName: langMeta.name,
      nativeName: langMeta.nativeName,
      registerLabel,
      registerFallback: selected.registerFallback,
      hasSpeechLevels: langMeta.hasSpeechLevels,
      hasNativeAksara,
      nativeScript,
      ...aksaraFields,
      aksaraLabel: nativeScript ? AKSARA_LABELS[nativeScript] : AKSARA_LABELS[fallbackScript],
      matchedMeaning: exactEntry.meaning || undefined,
      untranslatedTokens: [],
      coverage: 1,
      sourceMethod: resolvedSourceLang !== 'id' ? 'pivot' : 'glossary',
    };
  }

  // Step B3: Compositional Multi-Word, Morphological & Context-Aware Honorific Translation
  const rawTokens = effectiveIndonesian.trim().split(/\s+/);
  const outTokens: string[] = [];
  const untranslatedSet = new Set<string>(pivotInfo?.untranslated ?? []);
  const meanings: string[] = [];
  const localAksaraOverrides = new Map<string, string>();
  let honorificNote: string | undefined;
  let didRegisterFallback = false;
  let matchedUnits = 0;
  let totalContentUnits = 0;

  let clauseSubject: 'neutral' | 'first_person' | 'respected' = 'neutral';
  let prevStem = '';

  let i = 0;
  while (i < rawTokens.length) {
    // Greedy longest-phrase match (4 down to 2 words)
    let matchedPhrase = false;
    const maxLen = Math.min(4, rawTokens.length - i);
    for (let len = maxLen; len >= 2; len--) {
      const slice = rawTokens.slice(i, i + len);
      const lastTok = slice[slice.length - 1];
      const trailMatch = lastTok.match(/([?.!,;:]+)$/);
      const trail = trailMatch ? trailMatch[1] : '';
      const normalizedSlice = slice
        .map((w) => normalizeIndonesianToken(w.replace(/^[^a-z0-9'-]+|[^a-z0-9'-]+$/gi, '')))
        .join(' ');

      const entry = fwdMap.get(normalizedSlice);
      if (entry) {
        const useHonorific =
          register === 'krama' &&
          clauseSubject === 'respected' &&
          Boolean(entry.honorific) &&
          !RESPECTED_NOUN_TITLES.has(entry.idTerm);

        const selected = selectEntryForm(entry, register, useHonorific);
        if (selected.registerFallback) didRegisterFallback = true;
        if (entry.aksara && entry.aksara.trim()) {
          localAksaraOverrides.set(cleanPhrase(selected.text), entry.aksara.trim());
        }

        outTokens.push(`${selected.text}${trail}`);
        matchedUnits += len;
        totalContentUnits += len;
        if (entry.meaning && meanings.length < 2) {
          meanings.push(`${entry.idTerm}: ${entry.meaning}`);
        }
        if (/[?.!,;:]/.test(trail)) {
          clauseSubject = 'neutral';
          prevStem = '';
        } else {
          prevStem = entry.idTerm;
        }
        i += len;
        matchedPhrase = true;
        break;
      }
    }
    if (matchedPhrase) continue;

    // Single token morphological analysis
    const tok = rawTokens[i];
    const punctMatch = tok.match(/^([^a-z0-9'-]*)([a-z0-9'-]+)([^a-z0-9'-]*)$/i);
    if (!punctMatch) {
      outTokens.push(tok);
      i++;
      continue;
    }

    const [, lead, core, trail] = punctMatch;
    totalContentUnits++;

    const analyzed = analyzeIndonesianToken(core, KNOWN_ID_SINGLE_WORDS);

    // Check if colloquial normalization expanded to a multi-word phrase (e.g. "makasih" -> "terima kasih")
    if (analyzed.normalized.includes(' ') && fwdMap.has(analyzed.normalized)) {
      const phraseEntry = fwdMap.get(analyzed.normalized)!;
      const selected = selectEntryForm(phraseEntry, register, false);
      if (selected.registerFallback) didRegisterFallback = true;
      if (phraseEntry.aksara && phraseEntry.aksara.trim()) {
        localAksaraOverrides.set(cleanPhrase(selected.text), phraseEntry.aksara.trim());
      }
      outTokens.push(`${lead}${selected.text}${trail}`);
      matchedUnits++;
      if (phraseEntry.meaning && meanings.length < 2) {
        meanings.push(`${phraseEntry.idTerm}: ${phraseEntry.meaning}`);
      }
      prevStem = analyzed.normalized;
      i++;
      continue;
    }

    // Update subject tracking when not preceded by a preposition
    if (!PREPOSITIONS.has(prevStem) && !analyzed.locativePrefix) {
      if (FIRST_PERSON_SUBJECTS.has(analyzed.stem)) {
        clauseSubject = 'first_person';
      } else if (RESPECTED_SUBJECTS.has(analyzed.stem) && clauseSubject === 'neutral') {
        clauseSubject = 'respected';
      }
    }

    const entry = fwdMap.get(analyzed.stem);
    if (entry) {
      const useHonorific =
        register === 'krama' &&
        clauseSubject === 'respected' &&
        Boolean(entry.honorific) &&
        !RESPECTED_NOUN_TITLES.has(analyzed.stem);

      const selected = selectEntryForm(entry, register, useHonorific);
      if (selected.registerFallback) didRegisterFallback = true;
      const baseChosen = selected.text;

      if (entry.aksara && entry.aksara.trim() && !analyzed.possessive) {
        localAksaraOverrides.set(cleanPhrase(baseChosen), entry.aksara.trim());
      }

      if (
        register === 'krama' &&
        !useHonorific &&
        entry.honorific &&
        entry.honorific !== entry.formal &&
        !honorificNote
      ) {
        honorificNote = entry.honorific;
      }

      const withPossessive = analyzed.possessive
        ? formatTargetPossessive(baseChosen, analyzed.possessive, targetLang, register)
        : baseChosen;

      let withLocative = withPossessive;
      if (analyzed.locativePrefix) {
        const locEntry = fwdMap.get(analyzed.locativePrefix);
        let locWord: string = analyzed.locativePrefix;
        if (locEntry) {
          const locSel = selectEntryForm(locEntry, register, false);
          if (locSel.registerFallback) didRegisterFallback = true;
          locWord = locSel.text;
        }
        withLocative = `${locWord} ${withPossessive}`;
      }

      outTokens.push(`${lead}${withLocative}${trail}`);
      matchedUnits++;
      if (entry.meaning && meanings.length < 2) {
        meanings.push(`${entry.idTerm}: ${entry.meaning}`);
      }
    } else {
      const fallbackWord = /^[A-Z]{2,}$/.test(core) ? core.toLowerCase() : core;
      outTokens.push(`${lead}${fallbackWord}${trail}`);
      if (!/^\d+$/.test(core)) {
        untranslatedSet.add(core.toLowerCase());
      }
    }

    if (/[?.!,;:]/.test(trail)) {
      clauseSubject = 'neutral';
      prevStem = '';
    } else {
      prevStem = analyzed.stem;
    }
    i++;
  }

  const rawJoined = matchedUnits > 0 ? outTokens.join(' ') : clean;
  const finalTranslated =
    matchedUnits > 0 ? preserveInitialCap(clean, rawJoined) : clean;

  const untranslatedTokens = Array.from(untranslatedSet);
  const coverage =
    totalContentUnits > 0
      ? Number(Math.max(0, (totalContentUnits - untranslatedTokens.length) / totalContentUnits).toFixed(2))
      : 0;

  const aksaraFields = buildAksaraFields(finalTranslated, targetLang, fallbackScript, nativeScript, {
    extraOverrides: localAksaraOverrides,
  });

  return {
    indonesianText: resolvedSourceLang !== 'id' ? effectiveIndonesian : clean,
    translatedText: finalTranslated,
    honorificVariant: honorificNote,
    sourceLang: resolvedSourceLang,
    detectedSourceLang,
    languageName: langMeta.name,
    nativeName: langMeta.nativeName,
    registerLabel,
    registerFallback: didRegisterFallback,
    hasSpeechLevels: langMeta.hasSpeechLevels,
    hasNativeAksara,
    nativeScript,
    ...aksaraFields,
    aksaraLabel: nativeScript ? AKSARA_LABELS[nativeScript] : AKSARA_LABELS[fallbackScript],
    matchedMeaning: meanings.length ? meanings.join(' · ') : undefined,
    untranslatedTokens,
    coverage,
    sourceMethod:
      matchedUnits === 0
        ? 'passthrough'
        : resolvedSourceLang !== 'id'
        ? 'pivot'
        : 'glossary',
  };
}

/**
 * Backward-compatible wrapper around `translateText()` for BISINDO / quick-text callers.
 */
export function translateSpelledText(
  rawText: string,
  targetLang: RegionalLanguageCode,
  register: Register,
  fallbackConceptId?: string | null,
  selectedScript?: AksaraScript
): SpelledTranslationResult {
  return translateText({
    text: rawText,
    sourceLang: 'auto',
    targetLang,
    register,
    inputMode: 'text',
    fallbackConceptId,
    selectedScript,
  });
}

export function analyzeCulturalLiteracy(
  query: string,
  targetLang: RegionalLanguageCode
): CulturalLiteracyItem {
  const norm = cleanPhrase(query);
  const hit = culturalLiteracyCorpus.find(
    (c) => norm && (norm.includes(c.term) || c.term.includes(norm))
  );
  if (hit) return hit;

  const langMeta = regionalLanguages.find((l) => l.code === targetLang) || regionalLanguages[0];
  const glossaryHit = bhasantaraGlossary.find(
    (g) =>
      g.targetLang === targetLang &&
      (cleanPhrase(g.idTerm) === norm ||
        cleanPhrase(g.casual) === norm ||
        (g.formal && cleanPhrase(g.formal) === norm) ||
        (g.honorific && cleanPhrase(g.honorific) === norm))
  );

  if (glossaryHit) {
    const hasFormal = Boolean(glossaryHit.formal && glossaryHit.formal.trim());
    const primaryForm = hasFormal ? glossaryHit.formal : glossaryHit.casual;
    const honText =
      glossaryHit.honorific && glossaryHit.honorific !== glossaryHit.formal
        ? ` · Hormat (Inggil/Luhur): ${glossaryHit.honorific}`
        : '';
    return {
      term: `${primaryForm} (${glossaryHit.idTerm})`,
      languageCode: targetLang,
      analysis: hasFormal
        ? `"${glossaryHit.formal}" (ragam halus) dan "${glossaryHit.casual}" (ragam sehari-hari) adalah padanan draf dalam ${langMeta.nativeName} untuk "${glossaryHit.idTerm}"${glossaryHit.meaning ? ` (${glossaryHit.meaning})` : ''}.`
        : `"${glossaryHit.casual}" adalah padanan korpus otomatis dalam ${langMeta.nativeName} untuk "${glossaryHit.idTerm}" (bentuk halus belum tersedia).`,
      etymology: `Termasuk kategori kelas kata ${glossaryHit.partOfSpeech} dalam kamus draf ${langMeta.name} (${langMeta.region}).`,
      culturalInsight: hasFormal
        ? `Pemilihan antara bentuk sehari-hari ("${glossaryHit.casual}") dan bentuk halus ("${glossaryHit.formal}") mencerminkan tata krama sosial terhadap lawan bicara.`
        : `Entri ini berasal dari korpus otomatis dan belum memiliki padanan ragam halus yang divalidasi penutur.`,
      registerLevel: hasFormal
        ? `Sehari-hari: ${glossaryHit.casual} · Halus: ${glossaryHit.formal}${honText}`
        : `Sehari-hari: ${glossaryHit.casual} · Bentuk halus belum tersedia`,
      usageExamples: hasFormal
        ? [
            `${glossaryHit.formal} (${glossaryHit.idTerm} — ragam halus)`,
            `${glossaryHit.casual} (${glossaryHit.idTerm} — ragam akrab)`,
          ]
        : [`${glossaryHit.casual} (${glossaryHit.idTerm} — ragam sehari-hari)`],
    };
  }

  return {
    term: query.trim() || langMeta.nativeName,
    languageCode: targetLang,
    analysis: `Istilah atau ungkapan "${query.trim()}" dianalisis dalam konteks ${langMeta.name} (${langMeta.nativeName}) yang dituturkan di wilayah ${langMeta.region}.`,
    etymology: `Bagian dari tradisi lisan dan tulisan ${langMeta.nativeName} (${langMeta.speakers}).`,
    culturalInsight: `${langMeta.description} Gunakan ragam halus ketika berbicara kepada orang yang lebih tua atau dihormati.`,
    registerLevel: getRegisterLabel(targetLang, 'krama'),
    usageExamples: bhasantaraParallel
      .filter((p) => p.targetLang === targetLang || p.sourceLang === targetLang)
      .slice(0, 2)
      .map((p) => `${p.targetText} — "${p.idText}"`),
  };
}

export const quickSignWords = [
  'MAKAN',
  'SAYA',
  'RUMAH',
  'AIR',
  'TERIMA KASIH',
  'SELAMAT PAGI',
  'APA KABAR',
  'MAAF',
  'SELAMAT DATANG',
];

const ALL_UPPER_ID_TERMS = Array.from(KNOWN_ID_TERMS).map((t) => t.toUpperCase());

export function suggestWords(spelledText: string): string[] {
  const clean = spelledText.trim().toUpperCase();
  if (!clean) return quickSignWords.slice(0, 6);
  const lastToken = clean.split(/\s+/).pop() || clean;
  const matches = ALL_UPPER_ID_TERMS.filter(
    (t) => t.startsWith(lastToken) || t.startsWith(clean)
  );
  return matches.length ? matches.slice(0, 6) : quickSignWords.slice(0, 5);
}

export function speakText(text: string, lang = 'id-ID'): void {
  if (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    text &&
    text !== '—'
  ) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  }
}
