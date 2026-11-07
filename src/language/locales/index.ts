import type {
  BhasantaraGlossaryItem,
  BhasantaraParallelItem,
  LexiconEntry,
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
  nusaxLexiconSupplement,
  nusaxParallelSupplement,
} from './nusaxSupplement';

export { culturalLiteracyCorpus } from './culturalLiteracy';
export { NUSAX_ATTRIBUTION };

function enrichPackWithNusaX(basePack: RegionalLanguagePack): RegionalLanguagePack {
  const code = basePack.meta.code;
  if (code === 'id') return basePack;

  const extraLex = nusaxLexiconSupplement[code] ?? [];
  const extraPar = nusaxParallelSupplement[code] ?? [];

  const mergedMap = new Map<string, LexiconEntry>();
  for (const entry of basePack.lexicon) {
    mergedMap.set(entry.idTerm.trim().toLowerCase(), {
      ...entry,
      aliases: entry.aliases ? [...entry.aliases] : undefined,
    });
  }

  for (const sup of extraLex) {
    const key = sup.idTerm.trim().toLowerCase();
    const existing = mergedMap.get(key);
    if (existing) {
      // Preserve curated speech-level distinctions (casual/formal/honorific); enrich reverse aliases
      const aliasPool = new Set<string>(existing.aliases ?? []);
      const existingForms = new Set(
        [existing.casual, existing.formal, existing.honorific]
          .filter(Boolean)
          .map((x) => String(x).toLowerCase())
      );
      for (const f of [sup.casual, ...(sup.aliases ?? [])]) {
        if (f && !existingForms.has(f.toLowerCase())) {
          aliasPool.add(f);
        }
      }
      if (aliasPool.size > 0) {
        existing.aliases = Array.from(aliasPool);
      }
    } else {
      mergedMap.set(key, sup);
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

const RAW_PACKS: RegionalLanguagePack[] = [
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

export const LOCALE_PACKS: RegionalLanguagePack[] = RAW_PACKS.map(enrichPackWithNusaX);

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
  const lexCount = pack.lexicon.length;
  const parCount = (pack.parallel ?? []).length;
  return {
    ...pack.meta,
    entriesCount: `${lexCount} kosakata · ${parCount} kalimat`,
  };
});
