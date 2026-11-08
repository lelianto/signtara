import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LEXICON_DIR = path.join(ROOT, 'data/nusax-main/datasets/lexicon');
const MT_DIR = path.join(ROOT, 'data/nusax-main/datasets/mt');
const OUT_FILE = path.join(ROOT, 'src/language/locales/nusaxSupplement.ts');

const LANG_FILES = {
  jv: { csv: 'javanese.csv', mtCol: 'javanese' },
  sun: { csv: 'sundanese.csv', mtCol: 'sundanese' },
  ban: { csv: 'balinese.csv', mtCol: 'balinese' },
  mad: { csv: 'madurese.csv', mtCol: 'madurese' },
  bbc: { csv: 'toba_batak.csv', mtCol: 'toba_batak' },
  min: { csv: 'minangkabau.csv', mtCol: 'minangkabau' },
  bug: { csv: 'buginese.csv', mtCol: 'buginese' },
  ace: { csv: 'acehnese.csv', mtCol: 'acehnese' },
  bjn: { csv: 'banjarese.csv', mtCol: 'banjarese' },
  nij: { csv: 'ngaju.csv', mtCol: 'ngaju' },
};

const SKIP_AMBIGUOUS_ID_TERMS = new Set([
  'aku', 'beta', 'kau', 'engkau', 'gak', 'nggak', 'enggak', 'ndak', 'tak',
  'udah', 'sdh', 'blm', 'lg', 'banget', 'bgt', 'gimana', 'kenapa', 'makasih',
  'amat', 'pizza', 'nya', 'ku', 'mu', 'si', 'sang',
]);

// English / internet-slang source terms excluded from Indonesian pivot lexicon
const ENGLISH_ID_TERMS = new Set([
  'badass', 'lmao', 'lol', 'omg', 'wtf', 'striker', 'wow', 'oke', 'ok', 'okay',
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'damn', 'crap', 'slut', 'whore',
]);

// Mandatory cross-language profanity & slur blocklist + regional variants per language.
// Note: 'cok' is NOT blocked globally because in Acehnese ('ace') 'cok' means 'ambil'.
const COMMON_PROFANITY_BLOCKLIST = [
  'asu', 'bajingan', 'jancok', 'jancuk', 'dancuk', 'dancok', 'janjuk',
  'goblok', 'goblog', 'babi', 'anjing', 'anjir', 'anjay', 'kontol',
  'memek', 'pepek', 'puki', 'pantek', 'kimak', 'ngentot', 'tai', 'taik',
  'celeng', 'bangsat', 'kampret', 'brengsek', 'keparat', 'bedebah',
  'sialan', 'lonte', 'pelacur', 'sundal', 'perek',
];

const LANG_PROFANITY_BLOCKLIST = {
  jv: ['cuk', 'cok', 'modhar', 'modar', 'matamu', 'ndasmu', 'raimu'],
  sun: ['anying', 'koplok', 'kehed', 'modar'],
  ban: ['cicing', 'naskleng'],
  mad: ['jancok'],
  bbc: [],
  min: ['kalera', 'anciak'],
  bug: ['sundala', 'telaso'],
  ace: ['asee', 'paleh'],
  bjn: ['tambuk', 'bungul', 'kuyuk'],
  nij: [],
};

const BLOCKLIST_REGEX_BY_LANG = Object.fromEntries(
  Object.keys(LANG_FILES).map((code) => {
    const words = Array.from(
      new Set([...COMMON_PROFANITY_BLOCKLIST, ...(LANG_PROFANITY_BLOCKLIST[code] ?? [])])
    ).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return [
      code,
      new RegExp(`(^|[^a-z0-9'èéêëôâ])(${words.join('|')})(?=$|[^a-z0-9'èéêëôâ])`, 'i'),
    ];
  })
);

function hasBlockedWord(code, text) {
  if (!text) return false;
  const re = BLOCKLIST_REGEX_BY_LANG[code];
  return re ? re.test(text) : false;
}

const COMMERCIAL_NOISE_REGEX =
  /\b(grab|gojek|gofood|bni|bca|bri|mandiri|air\s*asia|shopee|tokopedia|traveloka|diskon|cicilan|kredit|promo|kasir|pelayan|hotel|resto|restoran|cafe|kafe|mall|wifi|ig|instagram|facebook|youtube|tiktok|admin|order|paket|ongkir|voucher|atm|bank|aplikasi|akun|login|online)\b|[0-9%@#]/i;

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && content[i + 1] === '\n') i++;
      row.push(field);
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function cleanTerm(raw) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[,.;:!?-]+|[,.;:!?-]+$/g, '')
    .trim();
}

const lexiconByLang = {};
let totalSupplementEntries = 0;
let discardedBlocklistEntries = 0;

for (const [code, cfg] of Object.entries(LANG_FILES)) {
  const filePath = path.join(LEXICON_DIR, cfg.csv);
  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));

  // Group ALL raw forms per idTerm first so that if ANY form/alias hits the blocklist,
  // the ENTIRE entry for that idTerm is discarded (Item 13a).
  const rawGrouped = new Map();

  for (let i = 1; i < rows.length; i++) {
    const [, rawId, rawReg] = rows[i];
    const idTerm = cleanTerm(rawId).toLowerCase();
    const regTerm = cleanTerm(rawReg).toLowerCase();
    if (!idTerm || !regTerm) continue;
    if (!rawGrouped.has(idTerm)) rawGrouped.set(idTerm, []);
    rawGrouped.get(idTerm).push(regTerm);
  }

  const entries = [];
  for (const [idTerm, rawForms] of rawGrouped.entries()) {
    if (idTerm.length < 2 || idTerm.length > 36) continue;
    if (SKIP_AMBIGUOUS_ID_TERMS.has(idTerm)) continue;
    if (ENGLISH_ID_TERMS.has(idTerm)) {
      discardedBlocklistEntries++;
      continue;
    }
    if (/[0-9@#$%^&*()_=+[\]{}<>/\\|]/.test(idTerm)) continue;

    // Discard ENTIRE entry if idTerm or ANY raw regional form/alias matches blocklist
    if (
      hasBlockedWord(code, idTerm) ||
      rawForms.some((f) => hasBlockedWord(code, f))
    ) {
      discardedBlocklistEntries++;
      continue;
    }

    const cleanForms = [];
    for (const regTerm of rawForms) {
      if (regTerm.length > 42) continue;
      if (/[0-9@#$%^&*()_=+[\]{}<>/\\|]/.test(regTerm)) continue;
      // Keep only authentic regional forms (filter out pure identical modern loanwords)
      if (regTerm === idTerm) continue;
      if (!cleanForms.includes(regTerm)) cleanForms.push(regTerm);
    }

    if (cleanForms.length === 0) continue;

    const primary = cleanForms[0];
    const aliases = cleanForms.slice(1, 5);
    const item = {
      idTerm,
      casual: primary,
      formal: '',
      ...(aliases.length ? { aliases } : {}),
      source: 'nusax-auto',
      verified: false,
      meaning: '',
      partOfSpeech: 'unknown',
    };
    entries.push(item);
  }

  lexiconByLang[code] = entries;
  totalSupplementEntries += entries.length;
}

// Extract clean cultural/daily parallel sentences from mt/{train,valid,test}.csv
const parallelByLang = Object.fromEntries(Object.keys(LANG_FILES).map((c) => [c, []]));
const seenSentenceByLang = Object.fromEntries(Object.keys(LANG_FILES).map((c) => [c, new Set()]));

for (const splitFile of ['valid.csv', 'train.csv', 'test.csv']) {
  const rows = parseCsv(fs.readFileSync(path.join(MT_DIR, splitFile), 'utf8'));
  if (!rows.length) continue;
  const header = rows[0];
  const idIdx = header.indexOf('indonesian');

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const idSent = cleanTerm(r[idIdx]);
    if (!idSent || idSent.length < 16 || idSent.length > 68) continue;
    if (COMMERCIAL_NOISE_REGEX.test(idSent)) continue;
    if ((idSent.match(/!/g) || []).length > 1) continue;

    for (const [code, cfg] of Object.entries(LANG_FILES)) {
      if (parallelByLang[code].length >= 16) continue;
      const colIdx = header.indexOf(cfg.mtCol);
      if (colIdx < 0) continue;
      const targetSent = cleanTerm(r[colIdx]);
      if (!targetSent || targetSent.length < 10 || targetSent.length > 85) continue;
      if (hasBlockedWord(code, idSent) || hasBlockedWord(code, targetSent)) continue;
      const key = idSent.toLowerCase();
      if (seenSentenceByLang[code].has(key)) continue;
      seenSentenceByLang[code].add(key);

      parallelByLang[code].push({
        sourceLang: 'id',
        targetLang: code,
        idText: idSent,
        targetText: targetSent,
        context: 'Kalimat keseharian korpus NusaX (CC BY-SA 4.0)',
        domain: 'daily',
      });
    }
  }
}

const out = `// AUTO-GENERATED FROM data/nusax-main (IndoNLP/nusax — CC BY-SA 4.0)
// Run \`node scripts/build-nusax-corpus.mjs\` to regenerate cleanly.
import type { LexiconEntry, ParallelSentenceEntry, RegionalLanguageCode } from '../types';

export const NUSAX_ATTRIBUTION = {
  name: 'IndoNLP / NusaX Parallel & Lexicon Corpus',
  authors: 'Winata et al. (ACL-IJCNLP / EACL 2023)',
  license: 'CC BY-SA 4.0',
  licensePath: '/licenses/NusaX-CC-BY-SA-4.0.txt',
  url: 'https://github.com/IndoNLP/nusax',
} as const;

export const NUSAX_COMMON_BLOCKLIST = ${JSON.stringify(COMMON_PROFANITY_BLOCKLIST)} as const;

export const NUSAX_LANG_BLOCKLIST: Record<Exclude<RegionalLanguageCode, 'id'>, readonly string[]> = ${JSON.stringify(
  LANG_PROFANITY_BLOCKLIST,
  null,
  2
)};

export const nusaxLexiconSupplement: Partial<Record<RegionalLanguageCode, LexiconEntry[]>> = ${JSON.stringify(
  lexiconByLang,
  null,
  2
)};

export const nusaxParallelSupplement: Partial<Record<RegionalLanguageCode, ParallelSentenceEntry[]>> = ${JSON.stringify(
  parallelByLang,
  null,
  2
)};
`;

fs.writeFileSync(OUT_FILE, out, 'utf8');

console.log('Generated nusaxSupplement.ts successfully!');
for (const code of Object.keys(LANG_FILES)) {
  console.log(
    `  ${code.padEnd(4)} -> +${lexiconByLang[code].length} authentic lexicon entries, +${parallelByLang[code].length} parallel sentences`
  );
}
console.log(`Discarded blocklisted / English entries: ${discardedBlocklistEntries}`);
console.log(`Total authentic regional lexicon supplement: ${totalSupplementEntries}`);
