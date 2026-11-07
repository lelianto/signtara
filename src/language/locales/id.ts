import type { RegionalLanguagePack } from '../types';

export const indonesianPack: RegionalLanguagePack = {
  meta: {
    code: 'id',
    isoCode: 'id',
    name: 'Indonesia',
    nativeName: 'Bahasa Indonesia',
    description: 'Bahasa nasional Republik Indonesia dan poros penghubung (pivot) antar-bahasa daerah serta isyarat BISINDO.',
    region: 'Seluruh Kepulauan Nusantara',
    speakers: '270+ Juta Penutur',
    preservationStatus: 'Bahasa Nasional & Poros Terjemahan',
    hasSpeechLevels: false,
    dialects: [
      { name: 'Indonesia Baku', region: 'Nasional', description: 'Ragam resmi sesuai KBBI untuk pendidikan dan layanan publik.' },
      { name: 'Indonesia Percakapan', region: 'Nasional', description: 'Ragam tutur sehari-hari lintas daerah.' },
    ],
  },
  markers: [
    'selamat', 'terima', 'kasih', 'apa', 'kabar', 'saya', 'kamu', 'anda',
    'makan', 'minum', 'rumah', 'air', 'maaf', 'pergi', 'tidur', 'tidak', 'sudah', 'belum', 'sedang',
  ],
  lexicon: [],
  parallel: [],
};

