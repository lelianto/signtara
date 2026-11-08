import type {
  AksaraItem,
  AksaraScript,
  LexiconEntry,
  RegionalLanguageCode,
  Register,
  TransliterateDirection,
} from './types';

export const AKSARA_LABELS: Record<AksaraScript, string> = {
  JAVANESE: 'Aksara Jawa (Hanacaraka)',
  SUNDANESE: 'Aksara Sunda Baku',
  BALINESE: 'Aksara Bali (Carakan)',
};

const NATIVE_SCRIPT_BY_LANG: Partial<Record<RegionalLanguageCode, AksaraScript>> = {
  jv: 'JAVANESE',
  sun: 'SUNDANESE',
  ban: 'BALINESE',
};

export function getNativeScriptForLanguage(code: RegionalLanguageCode): AksaraScript | undefined {
  return NATIVE_SCRIPT_BY_LANG[code];
}

export function supportsNativeAksara(code: RegionalLanguageCode): boolean {
  return Boolean(NATIVE_SCRIPT_BY_LANG[code]);
}

/**
 * Deterministic Javanese Script Transliteration Engine (Hanacaraka Unicode).
 * Note: Latin orthography does not distinguish é/è from ê (pepet), so algorithmic
 * transliteration never guesses pepet by heuristic rule; verified pepet spellings
 * should be supplied via `LexiconEntry.aksara` or explicit `wordOverrides`.
 */
export function latinToJavaneseScriptLocal(text: string): string {
  if (!text) return '';
  const wordOverrides: Record<string, string> = {
    angkara: 'ꦲꦁꦏꦫ',
    bhasantara: 'ꦨꦱꦤ꧀ꦠꦫ',
    isyara: 'ꦲꦶꦱꦾꦫ',
    sugeng: 'ꦱꦸꦒꦼꦁ',
    enjang: 'ꦲꦺꦚ꧀ꦗꦁ',
    enjing: 'ꦲꦺꦚ꧀ꦗꦶꦁ',
    matur: 'ꦩꦠꦸꦂ',
    nuwun: 'ꦤꦸꦮꦸꦤ꧀',
    suwun: 'ꦱꦸꦮꦸꦤ꧀',
    mangga: 'ꦩꦁꦒ',
    sinten: 'ꦱꦶꦤ꧀ꦠꦼꦤ꧀',
    menika: 'ꦩꦼꦤꦶꦏ',
    piye: 'ꦥꦶꦪꦺ',
    kabare: 'ꦏꦧꦫꦺ',
    indonesia: 'ꦲꦶꦤ꧀ꦢꦺꦴꦤꦺꦱꦶꦪ',
    jawa: 'ꦗꦮ',
    mangan: 'ꦩꦔꦤ꧀',
    nedha: 'ꦤꦼꦝ',
    dhahar: 'ꦝꦲꦂ',
    banyu: 'ꦧꦚꦸ',
    toya: 'ꦠꦺꦴꦪ',
    omah: 'ꦲꦺꦴꦩꦃ',
    griya: 'ꦒꦿꦶꦪ',
    dalem: 'ꦢꦭꦼꦩ꧀',
    aku: 'ꦲꦏꦸ',
    kula: 'ꦏꦸꦭ',
    panjenengan: 'ꦥꦚ꧀ꦗꦼꦤꦼꦔꦤ꧀',
    sampeyan: 'ꦱꦩ꧀ꦥꦺꦪꦤ꧀',
    ngunjuk: 'ꦔꦸꦚ꧀ꦗꦸꦏ꧀',
    ngombe: 'ꦔꦺꦴꦩ꧀ꦧꦺ',
    sare: 'ꦱꦫꦺ',
    tilem: 'ꦠꦶꦭꦼꦩ꧀',
    tindak: 'ꦠꦶꦤ꧀ꦢꦏ꧀',
    kesah: 'ꦏꦺꦱꦃ',
    rawuh: 'ꦫꦮꦸꦃ',
  };

  const words = text.trim().split(/\s+/);
  if (words.length > 1) {
    return words.map((w) => latinToJavaneseScriptLocal(w)).join(' ');
  }

  const textLower = text.toLowerCase().replace(/[?.!,]+$/g, '').trim();
  if (wordOverrides[textLower]) return wordOverrides[textLower];

  const charMap: Record<string, string> = {
    nga: 'ꦔ', nya: 'ꦚ', dha: 'ꦝ', tha: 'ꦛ',
    ngi: 'ꦔꦶ', nyi: 'ꦚꦶ', dhi: 'ꦝꦶ', thi: 'ꦛꦶ',
    ngu: 'ꦔꦸ', nyu: 'ꦚꦸ', dhu: 'ꦝꦸ', thu: 'ꦛꦸ',
    nge: 'ꦔꦺ', nye: 'ꦚꦺ', dhe: 'ꦝꦺ', the: 'ꦛꦺ',
    ngo: 'ꦔꦺꦴ', nyo: 'ꦚꦺꦴ', dho: 'ꦝꦺꦴ', tho: 'ꦛꦺꦴ',
    ha: 'ꦲ', na: 'ꦤ', ca: 'ꦕ', ra: 'ꦫ', ka: 'ꦏ',
    da: 'ꦢ', ta: 'ꦠ', sa: 'ꦱ', wa: 'ꦮ', la: 'ꦭ',
    pa: 'ꦥ', ja: 'ꦗ', ya: 'ꦪ', ma: 'ꦩ', ga: 'ꦒ', ba: 'ꦧ',
    hi: 'ꦲꦶ', ni: 'ꦤꦶ', ci: 'ꦕꦶ', ri: 'ꦫꦶ', ki: 'ꦏꦶ',
    di: 'ꦢꦶ', ti: 'ꦠꦶ', si: 'ꦱꦶ', wi: 'ꦮꦶ', li: 'ꦭꦶ',
    pi: 'ꦥꦶ', ji: 'ꦗꦶ', yi: 'ꦪꦶ', mi: 'ꦩꦶ', gi: 'ꦒꦶ', bi: 'ꦧꦶ',
    hu: 'ꦲꦸ', nu: 'ꦤꦸ', cu: 'ꦕꦸ', ru: 'ꦫꦸ', ku: 'ꦏꦸ',
    du: 'ꦢꦸ', tu: 'ꦠꦸ', su: 'ꦱꦸ', wu: 'ꦮꦸ', lu: 'ꦭꦸ',
    pu: 'ꦥꦸ', ju: 'ꦗꦸ', yu: 'ꦪꦸ', mu: 'ꦩꦸ', gu: 'ꦒꦸ', bu: 'ꦧꦸ',
    he: 'ꦲꦺ', ne: 'ꦤꦺ', ce: 'ꦕꦺ', re: 'ꦫꦺ', ke: 'ꦏꦺ',
    de: 'ꦢꦺ', te: 'ꦠꦺ', se: 'ꦱꦺ', we: 'ꦮꦺ', le: 'ꦭꦺ',
    pe: 'ꦥꦺ', je: 'ꦗꦺ', ye: 'ꦪꦺ', me: 'ꦩꦺ', ge: 'ꦒꦺ', be: 'ꦧꦺ',
    ho: 'ꦲꦺꦴ', no: 'ꦤꦺꦴ', co: 'ꦕꦺꦴ', ro: 'ꦫꦺꦴ', ko: 'ꦏꦺꦴ',
    do: 'ꦢꦺꦴ', to: 'ꦠꦺꦴ', so: 'ꦱꦺꦴ', wo: 'ꦮꦺꦴ', lo: 'ꦭꦺꦴ',
    po: 'ꦥꦺꦴ', jo: 'ꦗꦺꦴ', yo: 'ꦪꦺꦴ', mo: 'ꦩꦺꦴ', go: 'ꦒꦺꦴ', bo: 'ꦧꦺꦴ',
    a: 'ꦲ', i: 'ꦲꦶ', u: 'ꦲꦸ', e: 'ꦲꦺ', o: 'ꦲꦺꦴ',
    ng: 'ꦁ', r: 'ꦂ', h: 'ꦃ',
    n: 'ꦤ꧀', k: 'ꦏ꧀', t: 'ꦠ꧀', s: 'ꦱ꧀', m: 'ꦩ꧀', l: 'ꦭ꧀',
    p: 'ꦥ꧀', b: 'ꦧ꧀', d: 'ꦢ꧀', g: 'ꦒ꧀', j: 'ꦗ꧀', y: 'ꦪ꧀', w: 'ꦮ꧀', c: 'ꦕ꧀',
  };

  let result = '';
  let i = 0;
  while (i < textLower.length) {
    const remaining = textLower.slice(i);
    let matched = false;
    for (const len of [3, 2, 1]) {
      if (remaining.length < len) continue;
      const sub = remaining.slice(0, len);
      if (charMap[sub]) {
        result += charMap[sub];
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result += textLower[i];
      i++;
    }
  }
  return result;
}

// Programmatically generated Aksara Sunda Baku syllable map (consonants × vowels, including 'eu', 'é', and 'e')
const SUNDANESE_CONSONANTS: ReadonlyArray<readonly [string, string]> = [
  ['ng', 'ᮍ'],
  ['ny', 'ᮑ'],
  ['kh', 'ᮮ'],
  ['sy', 'ᮯ'],
  ['k', 'ᮊ'],
  ['g', 'ᮌ'],
  ['c', 'ᮎ'],
  ['j', 'ᮏ'],
  ['t', 'ᮒ'],
  ['d', 'ᮓ'],
  ['n', 'ᮔ'],
  ['p', 'ᮕ'],
  ['b', 'ᮘ'],
  ['m', 'ᮙ'],
  ['y', 'ᮚ'],
  ['r', 'ᮛ'],
  ['l', 'ᮜ'],
  ['w', 'ᮝ'],
  ['s', 'ᮞ'],
  ['h', 'ᮠ'],
  ['f', 'ᮖ'],
  ['v', 'ᮗ'],
  ['z', 'ᮐ'],
  ['q', 'ᮊ'],
];

const SUNDANESE_VOWEL_SIGNS: ReadonlyArray<readonly [string, string]> = [
  ['eu', 'ᮩ'], // paneuleung
  ['a', ''],   // inherent vowel
  ['i', 'ᮤ'],  // panghulu
  ['u', 'ᮥ'],  // panyuku
  ['é', 'ᮦ'],  // panéléng
  ['è', 'ᮦ'],  // panéléng (grave variant)
  ['e', 'ᮨ'],  // pamepet (unmarked e)
  ['ê', 'ᮨ'],  // pamepet
  ['o', 'ᮧ'],  // panolong
];

const SUNDANESE_CHAR_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {
    eu: 'ᮉ',
    a: 'ᮃ',
    i: 'ᮄ',
    u: 'ᮅ',
    é: 'ᮆ',
    è: 'ᮆ',
    e: 'ᮈ',
    ê: 'ᮈ',
    o: 'ᮇ',
  };

  for (const [cons, glyph] of SUNDANESE_CONSONANTS) {
    for (const [vowel, sign] of SUNDANESE_VOWEL_SIGNS) {
      map[`${cons}${vowel}`] = `${glyph}${sign}`;
    }
    if (cons === 'ng') {
      map.ng = 'ᮀ';
    } else if (cons === 'r') {
      map.r = 'ᮁ';
    } else if (cons === 'h') {
      map.h = 'ᮂ';
    } else {
      map[cons] = `${glyph}᮪`;
    }
  }

  return map;
})();

/**
 * Deterministic Sundanese Script Transliteration Engine (Aksara Sunda Baku Unicode).
 */
export function latinToSundaneseScriptLocal(text: string): string {
  if (!text) return '';
  const wordOverrides: Record<string, string> = {
    sampurasun: 'ᮞᮙ᮪ᮕᮥᮛᮞᮥᮔ᮪',
    hatur: 'ᮠᮒᮥᮁ',
    nuhun: 'ᮔᮥᮠᮥᮔ᮪',
    wilujeng: 'ᮝᮤᮜᮥᮏᮨᮀ',
    enjing: 'ᮆᮔ᮪ᮏᮤᮀ',
    sumping: 'ᮞᮥᮙ᮪ᮕᮤᮀ',
    sunda: 'ᮞᮥᮔ᮪ᮓ',
    bhasantara: 'ᮘ᮪ᮠᮞᮔ᮪ᮒᮛ',
  };

  const normalized = text.normalize('NFC');
  const words = normalized.trim().split(/\s+/);
  if (words.length > 1) {
    return words.map((w) => latinToSundaneseScriptLocal(w)).join(' ');
  }

  const textLower = normalized.toLowerCase().replace(/[?.!,]+$/g, '').trim();
  if (wordOverrides[textLower]) return wordOverrides[textLower];

  let result = '';
  let i = 0;
  while (i < textLower.length) {
    const remaining = textLower.slice(i);
    let matched = false;
    // Greedy longest-match 4 -> 3 -> 2 -> 1 so 4-letter syllables ('ngeu', 'nyeu') match cleanly
    for (const len of [4, 3, 2, 1]) {
      if (remaining.length < len) continue;
      const sub = remaining.slice(0, len);
      if (SUNDANESE_CHAR_MAP[sub]) {
        result += SUNDANESE_CHAR_MAP[sub];
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result += textLower[i];
      i++;
    }
  }
  return result;
}

/**
 * Deterministic Balinese Script Transliteration Engine (Carakan Unicode).
 */
export function latinToBalineseScriptLocal(text: string): string {
  if (!text) return '';
  const wordOverrides: Record<string, string> = {
    angkara: 'ᬳᬁᬓᬭ',
    om: 'ᬒᬁ',
    swastiastu: 'ᬲ᭄ᬯᬲ᭄ᬢᬶᬅᬲ᭄ᬢᬸ',
    swastyastu: 'ᬲ᭄ᬯᬲ᭄ᬢᬶᬅᬲ᭄ᬢᬸ',
    suksma: 'ᬲᬸᬓ᭄ᬱ᭄ᬫ',
    matur: 'ᬫᬢᬸᬂ',
    bali: 'ᬩᬮᬶ',
    bhasantara: 'ᬪᬲᬦ᭄ᬢᬭ',
    rahajeng: 'ᬭᬳᬚᬾᬂ',
    semeng: 'ᬲᬾᬫᬾᬂ',
  };

  const words = text.trim().split(/\s+/);
  if (words.length > 1) {
    return words.map((w) => latinToBalineseScriptLocal(w)).join(' ');
  }

  const textLower = text.toLowerCase().replace(/[?.!,]+$/g, '').trim();
  if (wordOverrides[textLower]) return wordOverrides[textLower];

  const charMap: Record<string, string> = {
    nga: 'ᬗ', nya: 'ᬜ', dha: 'ᬟ', tha: 'ᬞ',
    ngi: 'ᬗᬶ', nyi: 'ᬜᬶ', dhi: 'ᬟᬶ', thi: 'ᬞᬶ',
    ngu: 'ᬗᬸ', nyu: 'ᬜᬸ', dhu: 'ᬟᬸ', thu: 'ᬞᬸ',
    nge: 'ᬗᬾ', nye: 'ᬜᬾ', dhe: 'ᬟᬾ', the: 'ᬞᬾ',
    ngo: 'ᬗᭀ', nyo: 'ᬜᭀ', dho: 'ᬟᭀ', tho: 'ᬞᭀ',
    ha: 'ᬳ', na: 'ᬦ', ca: 'ᬘ', ra: 'ᬭ', ka: 'ᬓ',
    da: 'ᬤ', ta: 'ᬢ', sa: 'ᬲ', wa: 'ᬯ', la: 'ᬮ',
    pa: 'ᬧ', ja: 'ᬚ', ya: 'ᬬ', ma: 'ᬫ', ga: 'ᬕ', ba: 'ᬩ',
    hi: 'ᬳᬶ', ni: 'ᬦᬶ', ci: 'ᬘᬶ', ri: 'ᬭᬶ', ki: 'ᬓᬶ',
    di: 'ᬤᬶ', ti: 'ᬢᬶ', si: 'ᬲᬶ', wi: 'ᬯᬶ', li: 'ᬮᬶ',
    pi: 'ᬧᬶ', ji: 'ᬚᬶ', yi: 'ᬬᬶ', mi: 'ᬫᬶ', gi: 'ᬕᬶ', bi: 'ᬩᬶ',
    hu: 'ᬳᬸ', nu: 'ᬦᬸ', cu: 'ᬘᬸ', ru: 'ᬭᬸ', ku: 'ᬓᬸ',
    du: 'ᬤᬸ', tu: 'ᬢᬸ', su: 'ᬲᬸ', wu: 'ᬯᬸ', lu: 'ᬮᬸ',
    pu: 'ᬧᬸ', ju: 'ᬚᬸ', yu: 'ᬬᬸ', mu: 'ᬫᬸ', gu: 'ᬕᬸ', bu: 'ᬩᬸ',
    he: 'ᬳᬾ', ne: 'ᬦᬾ', ce: 'ᬘᬾ', re: 'ᬭᬾ', ke: 'ᬓᬾ',
    de: 'ᬤᬾ', te: 'ᬢᬾ', se: 'ᬲᬾ', we: 'ᬯᬾ', le: 'ᬮᬾ',
    pe: 'ᬧᬾ', je: 'ᬚᬾ', ye: 'ᬬᬾ', me: 'ᬫᬾ', ge: 'ᬕᬾ', be: 'ᬩᬾ',
    ho: 'ᬳᭀ', no: 'ᬦᭀ', co: 'ᬘᭀ', ro: 'ᬭᭀ', ko: 'ᬓᭀ',
    do: 'ᬤᭀ', to: 'ᬢᭀ', so: 'ᬲᭀ', wo: 'ᬯᭀ', lo: 'ᬮᭀ',
    po: 'ᬧᭀ', jo: 'ᬚᭀ', yo: 'ᬬᭀ', mo: 'ᬫᭀ', go: 'ᬕᭀ', bo: 'ᬩᭀ',
    a: 'ᬳ', i: 'ᬳᬶ', u: 'ᬳᬸ', e: 'ᬳᬾ', o: 'ᬳᭀ',
    ng: 'ᬁ', r: 'ᬂ', h: 'ᬄ',
    k: 'ᬓ᭄', g: 'ᬕ᭄', t: 'ᬢ᭄', d: 'ᬤ᭄', n: 'ᬦ᭄',
    p: 'ᬧ᭄', b: 'ᬩ᭄', m: 'ᬫ᭄', y: 'ᬬ᭄',
    l: 'ᬮ᭄', w: 'ᬯ᭄', s: 'ᬲ᭄', c: 'ᬘ᭄', j: 'ᬚ᭄',
  };

  let result = '';
  let i = 0;
  while (i < textLower.length) {
    const remaining = textLower.slice(i);
    let matched = false;
    for (const len of [3, 2, 1]) {
      if (remaining.length < len) continue;
      const sub = remaining.slice(0, len);
      if (charMap[sub]) {
        result += charMap[sub];
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result += textLower[i];
      i++;
    }
  }
  return result;
}

/**
 * Reverse Aksara Nusantara (Jawa / Sunda / Bali) to Latin local engine.
 */
export function aksaraToLatinLocal(text: string): string {
  if (!text) return '';
  const phraseOverrides: Record<string, string> = {
    'ꦲꦁꦏꦫ': 'angkara',
    'ꦨꦱꦤ꧀ꦠꦫ': 'bhasantara',
    'ꦩꦠꦸꦂ ꦤꦸꦮꦸꦤ꧀': 'matur nuwun',
    'ꦩꦠꦸꦂ': 'matur',
    'ꦤꦸꦮꦸꦤ꧀': 'nuwun',
    'ꦱꦸꦒꦼꦁ': 'sugeng',
    'ᮞᮙ᮪ᮕᮥᮛᮞᮥᮔ᮪': 'sampurasun',
    'ᮠᮒᮥᮁ ᮔᮥᮠᮥᮔ᮪': 'hatur nuhun',
    'ᬫᬢᬸᬂ ᬲᬸᬓ᭄ᬱ᭄ᬫ': 'matur suksma',
    'ᬩᬮᬶ': 'bali',
  };
  const trimmed = text.trim();
  if (phraseOverrides[trimmed]) return phraseOverrides[trimmed];

  const glyphMap: Record<string, string> = {
    // Jawa
    'ꦲ': 'ha', 'ꦤ': 'na', 'ꦕ': 'ca', 'ꦫ': 'ra', 'ꦏ': 'ka',
    'ꦢ': 'da', 'ꦠ': 'ta', 'ꦱ': 'sa', 'ꦮ': 'wa', 'ꦭ': 'la',
    'ꦥ': 'pa', 'ꦝ': 'dha', 'ꦗ': 'ja', 'ꦪ': 'ya', 'ꦚ': 'nya',
    'ꦩ': 'ma', 'ꦒ': 'ga', 'ꦧ': 'ba', 'ꦛ': 'tha', 'ꦔ': 'nga',
    'ꦟ': 'na', 'ꦑ': 'ka', 'ꦡ': 'ta', 'ꦯ': 'sa', 'ꦦ': 'pa', 'ꦓ': 'ga', 'ꦨ': 'ba',
    'ꦄ': 'a', 'ꦆ': 'i', 'ꦈ': 'u', 'ꦌ': 'e', 'ꦎ': 'o',
    'ꦁ': 'ng', 'ꦂ': 'r', 'ꦃ': 'h',
    // Sunda
    'ᮊ': 'ka', 'ᮌ': 'ga', 'ᮍ': 'nga', 'ᮎ': 'ca', 'ᮏ': 'ja',
    'ᮑ': 'nya', 'ᮒ': 'ta', 'ᮓ': 'da', 'ᮔ': 'na', 'ᮕ': 'pa',
    'ᮘ': 'ba', 'ᮙ': 'ma', 'ᮚ': 'ya', 'ᮛ': 'ra', 'ᮜ': 'la',
    'ᮝ': 'wa', 'ᮞ': 'sa', 'ᮠ': 'ha', 'ᮖ': 'fa', 'ᮗ': 'va', 'ᮐ': 'za',
    'ᮮ': 'kha', 'ᮯ': 'sya',
    'ᮃ': 'a', 'ᮄ': 'i', 'ᮅ': 'u', 'ᮆ': 'é', 'ᮈ': 'e', 'ᮉ': 'eu', 'ᮇ': 'o',
    'ᮀ': 'ng', 'ᮁ': 'r', 'ᮂ': 'h',
    // Bali
    'ᬳ': 'ha', 'ᬦ': 'na', 'ᬘ': 'ca', 'ᬭ': 'ra', 'ᬓ': 'ka',
    'ᬤ': 'da', 'ᬢ': 'ta', 'ᬲ': 'sa', 'ᬯ': 'wa', 'ᬮ': 'la',
    'ᬧ': 'pa', 'ᬟ': 'dha', 'ᬚ': 'ja', 'ᬬ': 'ya', 'ᬜ': 'nya',
    'ᬫ': 'ma', 'ᬕ': 'ga', 'ᬩ': 'ba', 'ᬞ': 'tha', 'ᬗ': 'nga',
    'ᬅ': 'a', 'ᬇ': 'i', 'ᬉ': 'u', 'ᬋ': 'e', 'ᬍ': 'o',
    'ᬁ': 'ng', 'ᬂ': 'r', 'ᬄ': 'h',
  };

  const vowelMod: Record<string, string> = {
    'ꦶ': 'i', 'ꦸ': 'u', 'ꦺ': 'e', 'ꦼ': 'e',
    'ᮤ': 'i', 'ᮥ': 'u', 'ᮨ': 'e', 'ᮦ': 'é', 'ᮩ': 'eu', 'ᮧ': 'o',
    'ᬶ': 'i', 'ᬸ': 'u', 'ᬾ': 'e', 'ᭀ': 'o',
  };
  const virama = new Set(['꧀', '᮪', '᭄']);

  let out = '';
  const chars = Array.from(trimmed);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === ' ') {
      out += ' ';
      continue;
    }
    if (glyphMap[ch]) {
      let syllable = glyphMap[ch];
      const next = chars[i + 1];
      if (next && virama.has(next)) {
        syllable = syllable.replace(/a$/, '');
        i++;
      } else if (next && vowelMod[next]) {
        if (next === 'ꦺ' && chars[i + 2] === 'ꦴ') {
          syllable = syllable.replace(/a$/, 'o');
          i += 2;
        } else {
          syllable = syllable.replace(/a$/, vowelMod[next]);
          i++;
        }
      }
      out += syllable;
    } else if (!virama.has(ch) && !vowelMod[ch] && ch !== 'ꦴ') {
      out += ch;
    }
  }
  return out;
}

export function transliterateToAksara(
  text: string,
  script: AksaraScript,
  direction: TransliterateDirection = 'LATIN_TO_AKSARA',
  entryOverride?: Pick<LexiconEntry, 'aksara'> | null
): string {
  if (direction === 'AKSARA_TO_LATIN') return aksaraToLatinLocal(text);
  if (entryOverride?.aksara && entryOverride.aksara.trim()) {
    return entryOverride.aksara.trim();
  }
  if (script === 'SUNDANESE') return latinToSundaneseScriptLocal(text);
  if (script === 'BALINESE') return latinToBalineseScriptLocal(text);
  return latinToJavaneseScriptLocal(text);
}

export interface AksaraTransliterationResult {
  text: string;
  aksaraAuto: boolean;
}

/**
 * Transliterates Latin text to Aksara using explicit `LexiconEntry.aksara` overrides
 * when available, falling back to the deterministic syllable engine otherwise, and
 * tagging whether algorithmic fallback was used (`aksaraAuto`).
 */
export function transliterateWithMeta(
  text: string,
  script: AksaraScript,
  options?: {
    entryAksara?: string;
    lexiconOverrides?: ReadonlyMap<string, string> | Record<string, string>;
  }
): AksaraTransliterationResult {
  const trimmed = text.trim();
  if (!trimmed || trimmed === '—') {
    return { text: trimmed, aksaraAuto: false };
  }

  if (options?.entryAksara && options.entryAksara.trim()) {
    return { text: options.entryAksara.trim(), aksaraAuto: false };
  }

  const overrides = options?.lexiconOverrides;
  if (overrides) {
    const lookup = (key: string): string | undefined =>
      overrides instanceof Map
        ? overrides.get(key)
        : Object.prototype.hasOwnProperty.call(overrides, key)
        ? (overrides as Record<string, string>)[key]
        : undefined;

    const fullKey = trimmed.toLowerCase().replace(/[?.!,;:]+$/g, '');
    const fullHit = lookup(fullKey);
    if (fullHit && fullHit.trim()) {
      return { text: fullHit.trim(), aksaraAuto: false };
    }

    const words = trimmed.split(/\s+/);
    let anyAuto = false;
    const parts = words.map((w) => {
      const wKey = w.toLowerCase().replace(/[?.!,;:]+$/g, '');
      const hit = wKey ? lookup(wKey) : undefined;
      if (hit && hit.trim()) {
        return hit.trim();
      }
      anyAuto = true;
      return transliterateToAksara(w, script);
    });
    return { text: parts.join(' '), aksaraAuto: anyAuto };
  }

  return {
    text: transliterateToAksara(trimmed, script),
    aksaraAuto: true,
  };
}

export function transliterateLexiconEntry(
  entry: Pick<LexiconEntry, 'casual' | 'formal' | 'aksara'>,
  script: AksaraScript,
  register: Register = 'ngoko'
): AksaraTransliterationResult {
  const targetLatin =
    register === 'krama' && entry.formal ? entry.formal : entry.casual;
  return transliterateWithMeta(targetLatin, script, {
    entryAksara: entry.aksara,
  });
}

export const aksaraGuideData: Record<AksaraScript, Record<string, AksaraItem[]>> = {
  JAVANESE: {
    Nglegena: [
      { glyph: 'ꦲ', latin: 'ha' }, { glyph: 'ꦤ', latin: 'na' }, { glyph: 'ꦕ', latin: 'ca' }, { glyph: 'ꦫ', latin: 'ra' }, { glyph: 'ꦏ', latin: 'ka' },
      { glyph: 'ꦢ', latin: 'da' }, { glyph: 'ꦠ', latin: 'ta' }, { glyph: 'ꦱ', latin: 'sa' }, { glyph: 'ꦮ', latin: 'wa' }, { glyph: 'ꦭ', latin: 'la' },
      { glyph: 'ꦥ', latin: 'pa' }, { glyph: 'ꦝ', latin: 'dha' }, { glyph: 'ꦗ', latin: 'ja' }, { glyph: 'ꦪ', latin: 'ya' }, { glyph: 'ꦚ', latin: 'nya' },
      { glyph: 'ꦩ', latin: 'ma' }, { glyph: 'ꦒ', latin: 'ga' }, { glyph: 'ꦧ', latin: 'ba' }, { glyph: 'ꦛ', latin: 'tha' }, { glyph: 'ꦔ', latin: 'nga' },
    ],
    Sandhangan: [
      { glyph: 'ꦶ', latin: 'Wulu (i)' }, { glyph: 'ꦸ', latin: 'Suku (u)' }, { glyph: 'ꦺ', latin: 'Taling (é)' },
      { glyph: 'ꦺꦴ', latin: 'Taling-Tarung (o)' }, { glyph: 'ꦼ', latin: 'Pepet (ê)' }, { glyph: 'ꦁ', latin: 'Cecak (ng)' },
      { glyph: 'ꦂ', latin: 'Layar (r)' }, { glyph: 'ꦃ', latin: 'Wignyan (h)' }, { glyph: '꧀', latin: 'Pangkon' },
    ],
    Murda: [
      { glyph: 'ꦟ', latin: 'Na' }, { glyph: 'ꦑ', latin: 'Ka' }, { glyph: 'ꦡ', latin: 'Ta' },
      { glyph: 'ꦯ', latin: 'Sa' }, { glyph: 'ꦦ', latin: 'Pa' }, { glyph: 'ꦓ', latin: 'Ga' }, { glyph: 'ꦨ', latin: 'Ba' },
    ],
    Swara: [
      { glyph: 'ꦄ', latin: 'A' }, { glyph: 'ꦆ', latin: 'I' }, { glyph: 'ꦈ', latin: 'U' },
      { glyph: 'ꦌ', latin: 'E' }, { glyph: 'ꦎ', latin: 'O' },
    ],
  },
  SUNDANESE: {
    Ngangalagena: [
      { glyph: 'ᮊ', latin: 'ka' }, { glyph: 'ᮌ', latin: 'ga' }, { glyph: 'ᮍ', latin: 'nga' }, { glyph: 'ᮎ', latin: 'ca' }, { glyph: 'ᮏ', latin: 'ja' },
      { glyph: 'ᮑ', latin: 'nya' }, { glyph: 'ᮒ', latin: 'ta' }, { glyph: 'ᮓ', latin: 'da' }, { glyph: 'ᮔ', latin: 'na' }, { glyph: 'ᮕ', latin: 'pa' },
      { glyph: 'ᮘ', latin: 'ba' }, { glyph: 'ᮙ', latin: 'ma' }, { glyph: 'ᮚ', latin: 'ya' }, { glyph: 'ᮛ', latin: 'ra' }, { glyph: 'ᮜ', latin: 'la' },
      { glyph: 'ᮝ', latin: 'wa' }, { glyph: 'ᮞ', latin: 'sa' }, { glyph: 'ᮠ', latin: 'ha' }, { glyph: 'ᮖ', latin: 'fa' }, { glyph: 'ᮐ', latin: 'za' },
    ],
    Rarangken: [
      { glyph: 'ᮤ', latin: 'Panghulu (i)' }, { glyph: 'ᮥ', latin: 'Panyuku (u)' },
      { glyph: 'ᮦ', latin: 'Panéléng (é)' }, { glyph: 'ᮨ', latin: 'Pamepet (e)' },
      { glyph: 'ᮩ', latin: 'Paneuleung (eu)' }, { glyph: 'ᮧ', latin: 'Panolong (o)' },
      { glyph: 'ᮀ', latin: 'Panyecek (-ng)' }, { glyph: 'ᮁ', latin: 'Panglayar (-r)' },
      { glyph: 'ᮂ', latin: 'Pangwisad (-h)' }, { glyph: '᮪', latin: 'Pamaéh' },
    ],
    Swara: [
      { glyph: 'ᮃ', latin: 'A' }, { glyph: 'ᮄ', latin: 'I' }, { glyph: 'ᮅ', latin: 'U' },
      { glyph: 'ᮆ', latin: 'É' }, { glyph: 'ᮈ', latin: 'E' }, { glyph: 'ᮉ', latin: 'Eu' },
      { glyph: 'ᮇ', latin: 'O' },
    ],
  },
  BALINESE: {
    Wianjana: [
      { glyph: 'ᬳ', latin: 'ha' }, { glyph: 'ᬦ', latin: 'na' }, { glyph: 'ᬘ', latin: 'ca' }, { glyph: 'ᬭ', latin: 'ra' }, { glyph: 'ᬓ', latin: 'ka' },
      { glyph: 'ᬤ', latin: 'da' }, { glyph: 'ᬢ', latin: 'ta' }, { glyph: 'ᬲ', latin: 'sa' }, { glyph: 'ᬯ', latin: 'wa' }, { glyph: 'ᬮ', latin: 'la' },
      { glyph: 'ᬧ', latin: 'pa' }, { glyph: 'ᬟ', latin: 'dha' }, { glyph: 'ᬚ', latin: 'ja' }, { glyph: 'ᬬ', latin: 'ya' }, { glyph: 'ᬜ', latin: 'nya' },
      { glyph: 'ᬫ', latin: 'ma' }, { glyph: 'ᬕ', latin: 'ga' }, { glyph: 'ᬩ', latin: 'ba' }, { glyph: 'ᬞ', latin: 'tha' }, { glyph: 'ᬗ', latin: 'nga' },
    ],
    Pangangge: [
      { glyph: 'ᬶ', latin: 'Ulu (i)' }, { glyph: 'ᬸ', latin: 'Suku (u)' }, { glyph: 'ᬾ', latin: 'Taling (e)' },
      { glyph: 'ᭀ', latin: 'Tedung (o)' }, { glyph: 'ᬁ', latin: 'Cecek (ng)' }, { glyph: 'ᬂ', latin: 'Surang (r)' },
      { glyph: 'ᬄ', latin: 'Bisah (h)' }, { glyph: '᭄', latin: 'Adeg-adeg' },
    ],
    Swara: [
      { glyph: 'ᬅ', latin: 'A' }, { glyph: 'ᬇ', latin: 'I' }, { glyph: 'ᬉ', latin: 'U' },
      { glyph: 'ᬋ', latin: 'E' }, { glyph: 'ᬍ', latin: 'O' },
    ],
  },
};
