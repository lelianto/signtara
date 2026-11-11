import { useEffect, useState } from 'react';

export const WORD_MODEL_URL = '/models/words-v1/model.json';

/**
 * Apakah model kata bawaan sudah ada di server (tanpa mengunduh isinya).
 * Model baru dimuat oleh useWordRecognizer saat mode kata aktif; cek ini dipakai
 * supaya tombol "Kata isyarat" bisa muncul sebelum pengguna merekam kata sendiri.
 * Server dev mengembalikan index.html (200) untuk file yang tidak ada, jadi
 * yang dihitung hanya respons JSON.
 */
export function useWordModelAvailable() {
    const [available, setAvailable] = useState(false);
    useEffect(() => {
        let alive = true;
        fetch(WORD_MODEL_URL, { method: 'HEAD' })
            .then((r) => {
                if (alive) setAvailable(r.ok && (r.headers.get('content-type') ?? '').includes('json'));
            })
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, []);
    return available;
}
