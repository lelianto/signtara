import type { Register } from './types';

export interface Concept {
  id: string;
  idText: string;
  ngoko: string;
  krama: string;
  note: string;
  source: string;
  verification: 'draft';
}

export const concepts: Concept[] = [
  {
    id: 'EAT',
    idText: 'makan',
    ngoko: 'mangan',
    krama: 'nedha',
    note: 'Nedha adalah bentuk krama untuk diri sendiri; penghormatan kepada orang lain memerlukan konteks berbeda.',
    source: 'https://www.sastra.org/leksikon',
    verification: 'draft',
  },
  {
    id: 'WATER',
    idText: 'air',
    ngoko: 'banyu',
    krama: 'toya',
    note: 'Padanan kata terpisah; bukan terjemahan kalimat.',
    source: 'https://www.sastra.org/leksikon',
    verification: 'draft',
  },
  {
    id: 'HOUSE',
    idText: 'rumah',
    ngoko: 'omah',
    krama: 'griya',
    note: 'Pemilihan ragam bergantung pada hubungan penutur dan lawan bicara.',
    source: 'https://www.sastra.org/leksikon',
    verification: 'draft',
  },
  {
    id: 'I',
    idText: 'saya',
    ngoko: 'aku',
    krama: 'kula',
    note: 'Aku digunakan dalam suasana akrab. Kula digunakan dalam ragam krama.',
    source: 'https://www.sastra.org/leksikon',
    verification: 'draft',
  },
];

export interface LanguageAdapter {
  code: string;
  resolve: (conceptId: string, register: Register) => string | undefined;
}

export const indonesian: LanguageAdapter = {
  code: 'id',
  resolve: (id) =>
    id.startsWith('LETTER_') ? id.slice(7) : concepts.find((c) => c.id === id)?.idText,
};

export const javanese: LanguageAdapter = {
  code: 'jv',
  resolve: (id, r) =>
    id.startsWith('LETTER_') ? id.slice(7) : concepts.find((c) => c.id === id)?.[r],
};

export const adapters: Record<string, LanguageAdapter> = {
  id: indonesian,
  jv: javanese,
};

export * from './bhasantara';
