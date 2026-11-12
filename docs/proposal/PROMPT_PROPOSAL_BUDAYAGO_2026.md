# Prompt: Proposal BISARA untuk BUDAYA GO! 2026

> Cara pakai: isi bagian bertanda `[[...]]` dulu (terutama panduan resmi lomba dan data tim), lalu salin semua isi di bawah garis ke AI pilihan Om. Fakta proyek di bawah diambil dari repo per 12 Nov 2026 (commit `f78c82c`). Angka akurasi sengaja ditulis lengkap dengan batasannya.

---

## PERAN

Kamu adalah penulis proposal kompetisi inovasi digital yang berpengalaman, paham teknologi AI/web, dan peka terhadap isu kebudayaan serta disabilitas di Indonesia. Bantu saya menulis proposal untuk **BUDAYA GO! 2026 — Kompetisi Inovasi Digital Budaya Indonesia** yang diselenggarakan Kementerian Kebudayaan RI.

## KONTEKS LOMBA

Yang saya ketahui dari edisi sebelumnya (verifikasi lagi dengan panduan resmi di bawah; panduan resmi yang menang bila ada perbedaan):
- Tema: **"Titik Temu Budaya dan Teknologi"**, yaitu solusi digital untuk pemajuan kebudayaan. Teknologi dipakai secara proporsional dan tidak boleh menghilangkan makna serta nilai budaya.
- Kategori: Mahasiswa dan Profesional.
- Bentuk karya: Web App, Mobile App, AI, Game AR/VR, atau gabungannya.
- Tahapan: seleksi administrasi → pendalaman substansi → pendampingan mentor → penjurian grand final.

**Panduan resmi 2026 (format, batas halaman, kriteria penilaian beserta bobotnya, tenggat):**
[[TEMPEL PANDUAN / KRITERIA RESMI DI SINI. Kalau belum ada, tulis "belum ada".]]

**Kategori yang kami ikuti:** [[Mahasiswa / Profesional]]
**Data tim:** [[nama, peran, latar belakang. Sebutkan juga kalau ada anggota/mitra Tuli, juru bahasa isyarat, atau ahli bahasa daerah]]
**Batas panjang:** [[mis. maks. 10 halaman / 2.000 kata]]

## TENTANG KARYA: BISARA

**Nama:** BISARA, dari BISINDO, bicara, dan aksara.

**Satu kalimat:** Aplikasi web *local-first* yang membantu teman Tuli/speech-impaired bercakap dengan orang di sekitarnya. Isyarat BISINDO dibaca kamera, diubah menjadi teks Bahasa Indonesia, diterjemahkan ke salah satu dari 10 bahasa daerah (lengkap dengan aksara Nusantara), lalu diucapkan. Balasan lawan bicara lewat suara atau ketikan ditampilkan kembali sebagai teks.

**Alur utama (halaman "Bicara"):**
1. Pengguna mengeja jari BISINDO (A–Z) atau memperagakan isyarat kata, atau mengetik.
2. Mesin ejaan merapikan hasil: ekspansi singkatan, pemisahan kata yang menempel, koreksi salah huruf. Setiap perubahan ditampilkan ke pengguna dan bisa dibatalkan. Ada juga saran kata berikutnya dari korpus.
3. Pratinjau dalam bahasa target + aksara, lalu tombol **Ucapkan** (TTS) atau **Tunjukkan** (teks layar penuh yang bisa diputar 180° untuk lawan bicara).
4. Lawan bicara membalas dengan suara (speech recognition) atau ketikan. Balasan ditampilkan beserta arti Bahasa Indonesianya.

**Fitur lain:** Frasa sehari-hari dan frasa pribadi sekali ketuk; Belajar (latihan alfabet dan isyarat kata dengan XP/progres); Kamus 4 tab (alfabet BISINDO + asal-usul foto, kosakata 10 bahasa daerah, kalimat sejajar, aksara & budaya); modul belajar aksara (nglegena, sandhangan, pasangan, filosofi).

**Lapisan budaya:**
- **BISINDO** (Bahasa Isyarat Indonesia), bahasa yang lahir dan hidup di komunitas Tuli Indonesia, termasuk variasi daerahnya.
- **10 bahasa daerah:** Jawa, Sunda, Bali, Madura, Batak Toba, Minangkabau, Bugis, Aceh, Banjar, Dayak Ngaju. Bahasa Indonesia jadi bahasa poros, jadi bisa juga daerah ↔ daerah. Diperkaya korpus paralel NusaX.
- **Ragam tutur:** Ngoko/Krama (Jawa), Loma/Lemes (Sunda), Andap/Alus (Bali). Subjek kalimat dideteksi (mis. "saya" vs "Bapak/Ibu") untuk memilih kosakata hormat (Krama Inggil). Ada penanda bila bentuk halus belum tersedia.
- **Aksara Nusantara:** transliterasi otomatis dua arah untuk Aksara Jawa (Hanacaraka), Sunda Baku (membedakan e/é/eu), dan Bali.
- Analisis morfologi (imbuhan dan akhiran kepemilikan -ku/-mu/-nya ↔ -e/-ne/-ipun).

**Teknologi:**
- React 19 + TypeScript strict + Vite, MediaPipe (tangan, pose, wajah), IndexedDB. Mobile-first, mode terang/gelap.
- **Privasi:** semua inferensi berjalan di perangkat (browser). Tidak ada server inferensi, tidak ada unggahan video/gambar, tanpa akun, tanpa API berbayar. Contoh pribadi disimpan sebagai fitur landmark saja, bukan gambar.
- **Alfabet (TwoHand v1):** 254 fitur bentuk dan posisi relatif dua tangan, klasifikasi nearest-prototype, konsensus 6/8 frame. Ada pemulihan tangan kedua yang hilang dan koreksi rasio kamera.
- **Kata (words-v1):** 66 kata BISINDO. Temporal CNN atas urutan landmark holistik (tangan + posisi tubuh relatif bahu/hidung + 19 *blendshape* ekspresi wajah + rotasi kepala), karena ekspresi wajah adalah bagian dari tata bahasa isyarat. Dilatih pada WL-BISINDO (CC BY-NC 4.0), BISINDO 40 Kata (MIT), dan BISINDO Dinamis (MIT). Inferensi di browser sudah diuji paritasnya dengan PyTorch.
- **Kata pribadi (few-shot):** pengguna bisa mengajarkan isyarat versinya sendiri (cukup ±3 rekaman). Isyarat dicocokkan di ruang embedding 256-d model. Ini penting karena BISINDO punya variasi daerah dan variasi personal.
- **Sistem keputusan:** probabilitas ≥ 0,7 diterima otomatis, 0,3–0,7 menampilkan 3 saran (pengguna memilih), di bawahnya ditolak. Pilihan pengguna disimpan sebagai contoh pribadi, sehingga aplikasi beradaptasi.
- Pengujian: 88 unit test (Vitest) + 23 end-to-end (Playwright).

**Hasil evaluasi (kutip apa adanya, sertakan batasannya):**
- Alfabet: pada 103 foto uji, label teratas benar 97/103 (94,2%). Setelah filter penolakan, 86/103 diterima (cakupan 83,5%) dan 86/86 yang diterima benar. *Batasan: split per foto, bukan per penanda (signer); dataset kecil (±20 foto/huruf); belum diuji pada pengguna nyata secara sistematis.*
- Kata: pada penanda yang tidak pernah dilihat saat pelatihan, top-1 74,4% dan top-3 93,8% (penanda kedua: 90,9% top-1). Pada ambang 0,7, 6% isyarat tak dikenal salah diterima.
- Kata pribadi (simulasi pada 2 penanda baru, 10 kata × 3 rekaman): 88,9% diterima benar, 0,1% salah, 2,6% kata yang tidak diajarkan salah diterima. Pembanding metode lama (DTW tangan saja): 77,2% / 2,7% / 27,1%.

**Keterbatasan jujur (wajib muncul di proposal sebagai risiko + mitigasi, jangan disembunyikan):**
- Referensi isyarat dan label belum diverifikasi guru BISINDO atau komunitas Tuli.
- Leksikon bahasa daerah masih draf. Baru Jawa, Sunda, dan Bali yang punya lembar audit awal; 7 lainnya belum diaudit penutur/ahli.
- Belum ada penerjemahan kalimat isyarat utuh (tata bahasa BISINDO). Yang ada: ejaan jari + kata per kata.
- Kosakata isyarat baru 66 kata. Suara TTS/STT bahasa daerah tergantung dukungan browser (jv-ID, su-ID, sisanya fallback id-ID).
- Data WL-BISINDO berlisensi **non-komersial** (CC BY-NC 4.0). Ini berpengaruh pada model bisnis; perlu strategi data sendiri atau kerja sama.
- Aksara baru 3 (Jawa, Sunda, Bali); Lontara dan Surat Batak masih di roadmap.

**Roadmap yang sudah direncanakan:** PWA offline penuh (bisa di-install), aksara Lontara dan Surat Batak, audit leksikon bersama penutur asli, kuis aksara dan "Eja Kata", overlay kerangka tangan pada kamera, ekspor/impor data pribadi, penambahan kosakata isyarat.

## YANG SAYA MINTA

1. **Sebelum menulis**, sebutkan maksimal 5 pertanyaan klarifikasi yang paling memengaruhi kualitas proposal (mis. kriteria resmi, keterlibatan komunitas Tuli, target pengguna percontohan). Kalau saya bilang "lanjut saja", pakai asumsi yang wajar dan tandai sebagai `[ASUMSI]`.
2. **Tulis proposal lengkap** mengikuti format resmi bila ada. Bila tidak ada, gunakan struktur ini:
   1. Judul + tagline (beri 3 alternatif judul)
   2. Ringkasan eksekutif (≤ 200 kata)
   3. Latar belakang & masalah. Hubungkan tiga hal: hambatan komunikasi teman Tuli, bahasa daerah yang makin jarang dipakai generasi muda, dan aksara Nusantara yang jarang dibaca. Data statistik hanya boleh dipakai dengan sumber yang bisa diverifikasi; kalau tidak yakin, tulis `[PERLU DATA: ...]`, jangan mengarang angka.
   4. Keterkaitan dengan pemajuan kebudayaan: petakan ke Objek Pemajuan Kebudayaan dan empat langkah (pelindungan, pengembangan, pemanfaatan, pembinaan) dalam UU No. 5/2017. Jelaskan bagaimana teknologi di sini *melayani* budaya, bukan menggantikannya, sesuai tema "Titik Temu Budaya dan Teknologi".
   5. Solusi & cara kerja, berupa skenario pengguna nyata (mis. teman Tuli berbelanja di pasar dan berbicara dengan pedagang berbahasa Jawa krama).
   6. Kebaruan/inovasi dibanding solusi yang ada (penerjemah isyarat umum, kamus bahasa daerah, aplikasi aksara). Tekankan kombinasi isyarat + bahasa daerah + ragam tutur + aksara, privasi on-device, dan adaptasi few-shot terhadap variasi isyarat.
   7. Arsitektur teknologi (singkat, ramah juri non-teknis) + hasil evaluasi beserta batasannya.
   8. Dampak & indikator keberhasilan yang terukur (output, outcome, impact), dengan target realistis.
   9. Rencana pelibatan komunitas: validasi bersama komunitas Tuli/guru BISINDO dan penutur bahasa daerah. Prinsip "Nothing about us without us".
   10. Keberlanjutan & model pemanfaatan. Perhatikan lisensi non-komersial dataset.
   11. Rencana kerja / roadmap (tahapan lomba + pasca-lomba).
   12. Risiko, etika, privasi, dan mitigasinya.
   13. Tim.
   14. Rencana anggaran, *hanya jika* diminta panduan.
3. **Gaya bahasa:** Bahasa Indonesia baku tetapi hidup, persuasif, tidak berbunga-bunga, tanpa jargon kosong ("revolusioner", "disruptif", dll.). Gunakan istilah **"Tuli"** (huruf T kapital, sesuai preferensi komunitas), bukan "tuna rungu". Tulis BISINDO, bukan SIBI, kecuali saat membandingkan.
4. **Larangan:** jangan menambah fitur, angka, mitra, penghargaan, atau testimoni yang tidak ada di atas. Jangan mengklaim aplikasi "menerjemahkan bahasa isyarat secara penuh" atau "akurasi 94%" tanpa konteks. Klaim berlebih justru melemahkan kita di tahap pendalaman substansi.
5. **Di akhir**, tambahkan:
   - Tabel *self-assessment* terhadap tiap kriteria penilaian (resmi, atau kriteria umum bila belum ada): skor perkiraan 1–5, alasan, dan cara memperkuatnya.
   - 5 pertanyaan tersulit yang mungkin ditanyakan juri di grand final + draf jawabannya.
   - Naskah demo 3 menit (apa yang ditunjukkan di layar detik demi detik).
