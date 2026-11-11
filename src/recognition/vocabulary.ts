/**
 * Word concepts for the isolated-sign prototype. The sign itself is recorded by the user;
 * this list only proposes everyday words that already exist in the regional lexicons so the
 * recognized concept can be translated. No BISINDO sign descriptions are claimed here.
 */
export const SUGGESTED_WORDS = [
  'saya', 'mau', 'makan', 'minum', 'air', 'sakit', 'obat', 'tolong',
  'terima kasih', 'maaf', 'ya', 'tidak', 'rumah', 'pergi',
];

export const MAX_WORD_LENGTH = 30;

/** Lowercase Indonesian word or short phrase (letters, spaces, hyphen); '' when invalid. */
export function normalizeWord(input: string): string {
  const w = input.trim().toLowerCase().replace(/\s+/g, ' ');
  return /^[a-z]+(?:[ -][a-z]+)*$/.test(w) && w.length <= MAX_WORD_LENGTH ? w : '';
}

export function wordConceptId(word: string): string {
  const w = normalizeWord(word);
  if (!w) throw Error('Invalid word');
  return `WORD_${w.toUpperCase().replace(/[ -]/g, '_')}`;
}
