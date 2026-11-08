export type Register = 'ngoko' | 'krama';
export type PolitenessLevel = 'casual' | 'polite' | 'honorific';

export type RegionalLanguageCode =
  | 'id'
  | 'jv'
  | 'sun'
  | 'ban'
  | 'mad'
  | 'bbc'
  | 'min'
  | 'bug'
  | 'ace'
  | 'bjn'
  | 'nij';

export type AksaraScript = 'JAVANESE' | 'SUNDANESE' | 'BALINESE';
export type TransliterateDirection = 'LATIN_TO_AKSARA' | 'AKSARA_TO_LATIN';
export type TranslationInputMode = 'sign' | 'text';

export type PartOfSpeech =
  | 'phrase'
  | 'pronoun'
  | 'verb'
  | 'noun'
  | 'adjective'
  | 'number'
  | 'time'
  | 'question'
  | 'particle'
  | 'unknown';

export interface RegionalDialect {
  name: string;
  region: string;
  description: string;
}

export interface RegisterTerminology {
  casualLabel: string;
  politeLabel: string;
  honorificLabel?: string;
}

export interface RegionalLanguage {
  code: RegionalLanguageCode;
  isoCode: string;
  name: string;
  nativeName: string;
  description: string;
  region: string;
  speakers: string;
  preservationStatus: string;
  entriesCount: string;
  hasSpeechLevels: boolean;
  registerTerms?: RegisterTerminology;
  defaultScript?: AksaraScript;
  dialects: RegionalDialect[];
}

/**
 * Modular per-language lexicon entry anchored to canonical Bahasa Indonesia (`idTerm`).
 * - `casual`: everyday / akrab (Ngoko, Loma, Andap)
 * - `formal`: polite standard / self-polite (Krama Madya, Lemes Diri Sendiri, Alus Sor)
 * - `honorific`: elder/respected 2nd-3rd person (Krama Inggil, Lemes Luhur, Alus Singgih)
 */
export interface LexiconEntry {
  idTerm: string;
  casual: string;
  formal: string;
  honorific?: string;
  aliases?: string[];
  aksara?: string;
  source?: 'curated' | 'nusax-auto';
  verified?: boolean;
  meaning: string;
  partOfSpeech: PartOfSpeech;
}

export interface ParallelSentenceEntry {
  sourceLang: RegionalLanguageCode;
  targetLang: RegionalLanguageCode;
  idText: string;
  targetText: string;
  formalText?: string;
  context: string;
  domain: string;
}

export interface RegionalLanguagePack {
  meta: Omit<RegionalLanguage, 'entriesCount'>;
  lexicon: LexiconEntry[];
  parallel?: ParallelSentenceEntry[];
  markers: string[];
  possessives?: {
    my: { casual: string; formal: string; attachSuffix?: boolean };
    your: { casual: string; formal: string; honorific?: string; attachSuffix?: boolean };
    their: { casual: string; formal: string; attachSuffix?: boolean };
  };
}

export interface BhasantaraGlossaryItem {
  idTerm: string;
  targetLang: RegionalLanguageCode;
  casual: string;
  formal: string;
  honorific?: string;
  aksara?: string;
  source?: 'curated' | 'nusax-auto';
  verified?: boolean;
  meaning: string;
  partOfSpeech: PartOfSpeech;
}

export type BhasantaraParallelItem = ParallelSentenceEntry;

export interface CulturalLiteracyItem {
  term: string;
  languageCode: RegionalLanguageCode;
  analysis: string;
  etymology: string;
  culturalInsight: string;
  registerLevel: string;
  usageExamples: string[];
}

export interface AksaraItem {
  glyph: string;
  latin: string;
}

export interface TranslationOptions {
  text: string;
  sourceLang?: RegionalLanguageCode | 'auto';
  targetLang: RegionalLanguageCode;
  register?: Register;
  inputMode?: TranslationInputMode;
  fallbackConceptId?: string | null;
  selectedScript?: AksaraScript;
}

export interface SpelledTranslationResult {
  indonesianText: string;
  translatedText: string;
  honorificVariant?: string;
  sourceLang: RegionalLanguageCode;
  detectedSourceLang: { code: RegionalLanguageCode; name: string };
  languageName: string;
  nativeName: string;
  registerLabel: string;
  registerFallback?: boolean;
  hasSpeechLevels: boolean;
  hasNativeAksara: boolean;
  nativeScript?: AksaraScript;
  aksaraText: string;
  nativeAksaraText: string | null;
  aksaraAuto: boolean;
  aksaraLabel: string;
  matchedMeaning?: string;
  untranslatedTokens: string[];
  coverage: number;
  sourceMethod: 'parallel' | 'glossary' | 'pivot' | 'letter' | 'passthrough';
}

