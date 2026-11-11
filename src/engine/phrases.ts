/**
 * Frasa siap pakai untuk percakapan sehari-hari. Ditulis dalam Bahasa Indonesia
 * (bahasa poros) lalu diterjemahkan ke bahasa daerah saat ditampilkan.
 */
export interface PhraseGroup {
    id: string;
    label: string;
    phrases: string[];
}

export const PHRASE_GROUPS: PhraseGroup[] = [
    {
        id: 'kenalan',
        label: 'Perkenalan',
        phrases: [
            'Halo',
            'Saya tunawicara, saya berkomunikasi dengan isyarat',
            'Tolong bicara pelan-pelan',
            'Saya bisa membaca tulisan',
            'Apa kabar?',
            'Terima kasih',
            'Maaf',
        ],
    },
    {
        id: 'butuh',
        label: 'Kebutuhan',
        phrases: ['Saya mau makan', 'Saya mau minum', 'Saya mau ke toilet', 'Saya mau pulang', 'Saya capek', 'Tolong tunggu sebentar'],
    },
    {
        id: 'jalan',
        label: 'Di jalan',
        phrases: ['Di mana toilet?', 'Saya mau ke pasar', 'Berapa harganya?', 'Saya mau beli ini', 'Tolong tulis jawabannya'],
    },
    {
        id: 'sehat',
        label: 'Kesehatan',
        phrases: ['Saya sakit', 'Kepala saya sakit', 'Saya perlu dokter', 'Saya perlu obat', 'Saya alergi'],
    },
    {
        id: 'darurat',
        label: 'Darurat',
        phrases: ['Tolong!', 'Tolong bantu saya', 'Panggil polisi', 'Panggil ambulans', 'Saya tersesat'],
    },
];
