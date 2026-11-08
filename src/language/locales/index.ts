import type {
  BhasantaraGlossaryItem,
  BhasantaraParallelItem,
  LexiconEntry,
  ParallelSentenceEntry,
  RegionalLanguage,
  RegionalLanguageCode,
  RegionalLanguagePack,
} from '../types';
import { javanesePack } from './jv';
import { sundanesePack } from './sun';
import { balinesePack } from './ban';
import { maduresePack } from './mad';
import { batakTobaPack } from './bbc';
import { minangkabauPack } from './min';
import { bugisPack } from './bug';
import { acehPack } from './ace';
import { banjarPack } from './bjn';
import { ngajuPack } from './nij';
import { indonesianPack } from './id';
import {
  NUSAX_ATTRIBUTION,
  NUSAX_COMMON_BLOCKLIST,
  NUSAX_LANG_BLOCKLIST,
  nusaxLexiconSupplement,
  nusaxParallelSupplement,
} from './nusaxSupplement';

export { culturalLiteracyCorpus } from './culturalLiteracy';
export { NUSAX_ATTRIBUTION, NUSAX_COMMON_BLOCKLIST, NUSAX_LANG_BLOCKLIST };

export function enrichPackWithNusaX(
  basePack: RegionalLanguagePack,
  overrideSupplement?: {
    lexicon?: LexiconEntry[];
    parallel?: ParallelSentenceEntry[];
  }
): RegionalLanguagePack {
  const code = basePack.meta.code;
  if (code === 'id') return basePack;

  const extraLex = overrideSupplement?.lexicon ?? nusaxLexiconSupplement[code] ?? [];
  const extraPar = overrideSupplement?.parallel ?? nusaxParallelSupplement[code] ?? [];

  const mergedMap = new Map<string, LexiconEntry>();
  for (const entry of basePack.lexicon) {
    const key = entry.idTerm.trim().toLowerCase();
    if (!mergedMap.has(key)) {
      mergedMap.set(key, {
        ...entry,
        source: entry.source ?? 'curated',
        aliases: entry.aliases ? [...entry.aliases] : undefined,
      });
    }
  }

  for (const sup of extraLex) {
    const key = sup.idTerm.trim().toLowerCase();
    const existing = mergedMap.get(key);
    if (existing) {
      // Curated entry ALWAYS wins (casual, formal, honorific, meaning, partOfSpeech, aksara).
      // NusaX supplement may ONLY append reverse lookup aliases that do not collide.
      const aliasList = existing.aliases ? [...existing.aliases] : [];
      const seenForms = new Set(
        [existing.casual, existing.formal, existing.honorific, ...aliasList]
          .filter(Boolean)
          .map((x) => String(x).trim().toLowerCase())
      );
      for (const f of [sup.casual, ...(sup.aliases ?? [])]) {
        const trimmed = f ? f.trim() : '';
        if (trimmed && !seenForms.has(trimmed.toLowerCase())) {
          seenForms.add(trimmed.toLowerCase());
          aliasList.push(trimmed);
        }
      }
      if (aliasList.length > 0) {
        existing.aliases = aliasList;
      }
    } else {
      mergedMap.set(key, {
        ...sup,
        formal: sup.formal ?? '',
        source: sup.source ?? 'nusax-auto',
        verified: sup.verified ?? false,
        aliases: sup.aliases ? [...sup.aliases] : undefined,
      });
    }
  }

  const seenPar = new Set((basePack.parallel ?? []).map((p) => p.idText.trim().toLowerCase()));
  const mergedPar = [...(basePack.parallel ?? [])];
  for (const p of extraPar) {
    const k = p.idText.trim().toLowerCase();
    if (!seenPar.has(k)) {
      seenPar.add(k);
      mergedPar.push(p);
    }
  }

  return {
    ...basePack,
    lexicon: Array.from(mergedMap.values()),
    parallel: mergedPar,
  };
}

export const RAW_PACKS: RegionalLanguagePack[] = [
  javanesePack,
  sundanesePack,
  balinesePack,
  maduresePack,
  batakTobaPack,
  minangkabauPack,
  bugisPack,
  acehPack,
  banjarPack,
  ngajuPack,
  indonesianPack,
];

export const LOCALE_PACKS: RegionalLanguagePack[] = RAW_PACKS.map((p) =>
  enrichPackWithNusaX(p)
);

export const LOCALE_MAP: Record<RegionalLanguageCode, RegionalLanguagePack> = Object.fromEntries(
  LOCALE_PACKS.map((p) => [p.meta.code, p])
) as Record<RegionalLanguageCode, RegionalLanguagePack>;

export const bhasantaraGlossary: BhasantaraGlossaryItem[] = LOCALE_PACKS.flatMap((pack) =>
  pack.meta.code === 'id'
    ? []
    : pack.lexicon.map((entry) => ({
        idTerm: entry.idTerm,
        targetLang: pack.meta.code,
        casual: entry.casual,
        formal: entry.formal,
        honorific: entry.honorific,
        aksara: entry.aksara,
        source: entry.source,
        verified: entry.verified,
        meaning: entry.meaning,
        partOfSpeech: entry.partOfSpeech,
      }))
);

export const bhasantaraParallel: BhasantaraParallelItem[] = LOCALE_PACKS.flatMap(
  (pack) => pack.parallel ?? []
);

const uniquePivotConceptsCount = new Set(
  bhasantaraGlossary.map((item) => item.idTerm.toLowerCase())
).size;

export const regionalLanguages: RegionalLanguage[] = LOCALE_PACKS.map((pack) => {
  if (pack.meta.code === 'id') {
    return {
      ...pack.meta,
      entriesCount: `${uniquePivotConceptsCount} konsep poros · ${bhasantaraGlossary.length} padanan`,
    };
  }
  const coreCount = pack.lexicon.filter((e) => e.source !== 'nusax-auto').length;
  const autoCount = pack.lexicon.filter((e) => e.source === 'nusax-auto').length;
  return {
    ...pack.meta,
    entriesCount: `${coreCount} entri inti · ${autoCount} entri korpus otomatis`,
  };
});
