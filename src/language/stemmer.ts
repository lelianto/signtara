export type PossessiveType = 'my' | 'your' | 'their';

export interface AnalyzedToken {
  original: string;
  normalized: string;
  stem: string;
  locativePrefix?: 'di' | 'ke';
  possessive?: PossessiveType;
}

const ID_SYNONYM_MAP: Record<string, string> = {
  aku: 'saya',
  beta: 'saya',
  kau: 'kamu',
  engkau: 'kamu',
   gak: 'tidak',
  nggak: 'tidak',
  enggak: 'tidak',
  ndak: 'tidak',
  tak: 'tidak',
  udah: 'sudah',
  sdh: 'sudah',
  blm: 'belum',
  lg: 'sedang',
  lagi: 'sedang',
  banget: 'sangat',
  bgt: 'sangat',
  gimana: 'bagaimana',
  kenapa: 'mengapa',
  makasih: 'terima kasih',
  ayah: 'bapak',
  kawan: 'teman',
  sahabat: 'teman',
  cewek: 'perempuan',
  cowok: 'laki-laki',
  duit: 'uang',
  ngomong: 'bicara',
  bilang: 'berkata',
  kasih: 'beri',
};

export function normalizeIndonesianToken(word: string): string {
  const lower = word.toLowerCase().trim();
  return ID_SYNONYM_MAP[lower] || lower;
}

/**
 * Generates candidate Indonesian root words from `meN-` and `ber-` prefixes.
 * Candidates are only accepted if verified against `knownTerms`.
 */
function candidateVerbalRoots(word: string): string[] {
  const candidates: string[] = [];
  if (word.startsWith('meng') && word.length > 6) {
    const rest = word.slice(4);
    candidates.push(rest, `k${rest}`);
  } else if (word.startsWith('meny') && word.length > 6) {
    const rest = word.slice(4);
    candidates.push(`s${rest}`);
  } else if (word.startsWith('mem') && word.length > 5) {
    const rest = word.slice(3);
    if (/^[bfv]/.test(rest)) {
      candidates.push(rest);
    } else if (/^[aiueo]/.test(rest)) {
      candidates.push(`m${rest}`, `p${rest}`);
    }
  } else if (word.startsWith('men') && word.length > 5) {
    const rest = word.slice(3);
    if (/^[cdjz]/.test(rest)) {
      candidates.push(rest);
    } else if (/^[aiueo]/.test(rest)) {
      candidates.push(`t${rest}`, `n${rest}`);
    }
  } else if (word.startsWith('me') && word.length > 4) {
    const rest = word.slice(2);
    if (/^[lmnrwy]/.test(rest)) {
      candidates.push(rest);
    }
  } else if (word.startsWith('ber') && word.length > 5) {
    candidates.push(word.slice(3));
  } else if (word.startsWith('be') && word.length > 4) {
    candidates.push(word.slice(2));
  }
  return candidates;
}

/**
 * Deterministic Indonesian token analyzer.
 * Exact matches in `knownTerms` always take precedence before stripping any affix.
 */
export function analyzeIndonesianToken(rawWord: string, knownTerms: ReadonlySet<string>): AnalyzedToken {
  const clean = rawWord.toLowerCase().replace(/^[^a-z0-9'-]+|[^a-z0-9'-]+$/gi, '');
  const normalized = normalizeIndonesianToken(clean);

  if (knownTerms.has(normalized)) {
    return { original: rawWord, normalized, stem: normalized };
  }

  let working = normalized;
  let locativePrefix: 'di' | 'ke' | undefined;
  let possessive: PossessiveType | undefined;

  // 1. Possessive enclitics (-ku, -mu, -nya) verified against knownTerms
  if (working.endsWith('nya') && working.length >= 6) {
    const base = working.slice(0, -3);
    if (knownTerms.has(base)) {
      return { original: rawWord, normalized, stem: base, possessive: 'their' };
    }
    working = base;
    possessive = 'their';
  } else if (working.endsWith('ku') && working.length >= 5) {
    const base = working.slice(0, -2);
    if (knownTerms.has(base)) {
      return { original: rawWord, normalized, stem: base, possessive: 'my' };
    }
    working = base;
    possessive = 'my';
  } else if (working.endsWith('mu') && working.length >= 5) {
    const base = working.slice(0, -2);
    if (knownTerms.has(base)) {
      return { original: rawWord, normalized, stem: base, possessive: 'your' };
    }
    working = base;
    possessive = 'your';
  } else {
    working = normalized;
  }

  // Reset possessive if stripped stem still isn't resolved with prefix below
  const checkWithPrefix = (target: string): { stem: string; loc?: 'di' | 'ke' } | null => {
    if (knownTerms.has(target)) return { stem: target };
    if (target.startsWith('di') && target.length >= 5) {
      const rest = target.slice(2);
      if (knownTerms.has(rest)) return { stem: rest, loc: 'di' };
    }
    if (target.startsWith('ke') && target.length >= 5) {
      const rest = target.slice(2);
      if (knownTerms.has(rest)) return { stem: rest, loc: 'ke' };
    }
    for (const root of candidateVerbalRoots(target)) {
      if (knownTerms.has(root)) return { stem: root };
    }
    return null;
  };

  if (possessive) {
    const hit = checkWithPrefix(working);
    if (hit) {
      return {
        original: rawWord,
        normalized,
        stem: hit.stem,
        locativePrefix: hit.loc,
        possessive,
      };
    }
  }

  const directHit = checkWithPrefix(normalized);
  if (directHit) {
    return {
      original: rawWord,
      normalized,
      stem: directHit.stem,
      locativePrefix: directHit.loc,
    };
  }

  return { original: rawWord, normalized, stem: normalized };
}

/**
 * Strips common regional enclitics (-ku, -mu, -ipun, -nipun, -ne, -e, -na, -nyo)
 * ONLY if the resulting root exists in `knownRegionalForms`.
 */
export function analyzeRegionalToken(
  rawWord: string,
  knownRegionalForms: ReadonlySet<string>
): { stem: string; possessive?: PossessiveType } {
  const clean = rawWord.toLowerCase().replace(/^[^a-z0-9'èéêë-]+|[^a-z0-9'èéêë-]+$/gi, '');
  if (knownRegionalForms.has(clean)) {
    return { stem: clean };
  }

  const suffixes: Array<[string, PossessiveType]> = [
    ['nipun', 'their'],
    ['ipun', 'their'],
    ['nyo', 'their'],
    ['nya', 'their'],
    ['ku', 'my'],
    ['mu', 'your'],
    ['na', 'their'],
    ['ne', 'their'],
    ['e', 'their'],
  ];

  for (const [sfx, poss] of suffixes) {
    if (clean.endsWith(sfx) && clean.length - sfx.length >= 3) {
      const base = clean.slice(0, -sfx.length);
      if (knownRegionalForms.has(base)) {
        return { stem: base, possessive: poss };
      }
    }
  }

  return { stem: clean };
}
