# ISYARA (`signtara`) — Ringkasan Sistem & Peta Pengembangan (Roadmap)

Dokumen ini merangkum arsitektur proyek **ISYARA (`signtara`)**, kapabilitas sistem yang sudah berjalan saat ini, serta daftar rencana pengembangan (*enhancement roadmap*) ke depan.

---

## Bagian 1: Gambaran Umum & Arsitektur Proyek

**ISYARA** adalah aplikasi web *local-first* (100% berjalan di browser tanpa server inferensi atau unggahan video) untuk:
1. **Pengenalan Ejaan Jari (Alfabet A–Z) BISINDO** menggunakan webcam dan MediaPipe.
2. **Penerjemahan & Pembelajaran Bahasa Daerah Nusantara** (10 bahasa daerah + Bahasa Indonesia sebagai bahasa poros/pivot) beserta **transliterasi Aksara Nusantara** (Jawa, Sunda Baku, dan Bali).

* **Stack Utama:** React 19 + TypeScript (strict) + Vite + `@mediapipe/tasks-vision` + `idb` (IndexedDB) + Vitest & Playwright.
* **Entry Point UI:** `src/main.tsx` dengan 4 halaman utama: **Terjemahkan (`Translate`)**, **Belajar (`Learn`)**, **Kamus (`Dictionary`)**, dan **Pengaturan (`Settings`)**.
* **Sistem Desain:** Didokumentasikan di `design-system.md` dengan stylesheet di `src/style.css` dan `src/premium.css`.

### Alur Pipeline Pengenalan Isyarat (`src/recognition/`)
```text
Kamera → TwoHandTracker (MediaPipe VIDEO + Recovery) → Worker → Ekstraksi 254 Fitur (twoHand.ts) → Nearest-Prototype Classifier → Konsensus 6/8 Frame → Huruf (A–Z)
```

---

## Bagian 2: Kapabilitas Sistem Saat Ini

### 1. Pengenalan Alfabet Isyarat BISINDO (A–Z) via Kamera
* **Deteksi 1 & 2 Tangan *Real-Time*:** Menggunakan MediaPipe Hand Landmarker dan model **TwoHand v1** (`src/recognition/twoHand.ts`, `src/recognition/worker.ts`) yang mengenali huruf A–Z berdasarkan bentuk masing-masing tangan (63×2) sekaligus posisi relatif antar-kedua tangan terhadap titik tengah pergelangan (63×2) ditambah 2 bit keberadaan tangan (total **254 fitur**).
* **Pemulihan Tangan Kedua (*Missing-Hand Recovery*):** Jika satu tangan tertutup/terlewat pada mode video, `src/recognition/TwoHandTracker.ts` dan `src/recognition/handRecovery.ts` otomatis mencari ulang pada frame yang sama (termasuk refleksi horizontal) untuk mendeteksi tangan kedua tanpa mengarang koordinat.
* **Koreksi Rasio Kamera Otomatis:** Menyesuaikan geometri fitur dari webcam rasio 16:9 (mis. 1280×720) ke geometri referensi 4:3 agar tetap konsisten dengan data pelatihan.
* **Filter Kestabilan (Konsensus Temporal):** Huruf baru dikomit ke teks setelah stabil selama **6 dari 8 frame** berturut-turut (jarak RMS maksimum `0.20`, skor pemisahan minimum `0.35`), lengkap dengan cincin indikator kestabilan (*Confidence Ring*) di layar dan pencegahan duplikasi saat tangan ditahan.
* **Kalibrasi Contoh Pribadi (*Personal Examples*):** Melalui `src/components/CameraHelp.tsx` dan `src/storage/calibration.ts`, pengguna bisa merekam **8 frame contoh pribadi** per huruf (maksimal 12 sampel/huruf) yang disimpan di IndexedDB lokal jika postur tangan mereka sulit dikenali oleh model bawaan.

### 2. Penerjemah Multi-Input & Lintas Bahasa Daerah (`Translate`)
* **Mode Isyarat (`sign`):**
  * Mengeja huruf demi huruf lewat kamera → membentuk kata/kalimat di kotak ejaan.
  * Pintasan keyboard (`Spasi` untuk spasi, `Backspace` untuk hapus) & **Saran Kata Otomatis** (`suggestWords` di `src/language/bhasantara.ts`) untuk mempercepat pengetikan dari ejaan jari.
* **Mode Teks & Suara (`text`):**
  * Mengetik kalimat langsung atau menggunakan **Input Suara (Web Speech API)** dan **Text-to-Speech (Suara bacaan)**.
  * **Deteksi Bahasa Otomatis (`detectRegionalLanguageLocal` di `src/language/engine.ts`):** Mengenali apakah input ditulis dalam Bahasa Indonesia, salah satu dari 10 bahasa daerah, atau langsung dalam karakter Aksara Nusantara.
  * **Terjemahan Dua Arah & Lintas Daerah (`translateText` di `src/language/engine.ts`):** Menerjemahkan `Indonesia ↔ Bahasa Daerah` maupun `Bahasa Daerah A ↔ Bahasa Daerah B` melalui Bahasa Indonesia sebagai bahasa poros (*pivot* via `pivotRegionalToIndonesian`), lengkap dengan tombol **Tukar bahasa**.
  * **10 Bahasa Daerah yang Didukung (`src/language/locales/`):**
    * Jawa (`jv`), Sunda (`sun`), Bali (`ban`), Madura (`mad`), Batak Toba (`bbc`), Minangkabau (`min`), Bugis (`bug`), Aceh (`ace`), Banjar (`bjn`), dan Dayak Ngaju (`nij`), diperkaya dengan suplemen korpus paralel NusaX (`src/language/locales/nusaxSupplement.ts`).
  * **Pemilihan Ragam Tutur (*Register*):** Mendukung ragam **Sehari-hari (`Ngoko`/Loma/Andap)** dan **Halus (`Krama`/Lemes/Alus)**, serta mendeteksi subjek kalimat (mis. *Saya* vs *Bapak/Ibu*) untuk memilih kosakata hormat (*Krama Inggil*) secara kontekstual dan memberi penanda `registerFallback` bila bentuk halus belum tersedia.
  * **Analisis Morfologi (`src/language/stemmer.ts`):** Mengurai imbuhan dan akhiran kepemilikan (`-ku`, `-mu`, `-nya` ↔ `-e/-ne`, `-ipun`, dll.).

### 3. Transliterasi & Panduan Aksara Nusantara
* **Transliterasi Otomatis & Berbasis Kamus (`src/language/aksara.ts`):** Mengubah hasil terjemahan menjadi:
  * **Aksara Jawa (Hanacaraka)**
  * **Aksara Sunda Baku** (mendukung pembedaan vokal `e`, `é`, dan `eu`)
  * **Aksara Bali**
* **Konversi Balik Aksara → Latin:** Membaca dan menerjemahkan teks beraksara Jawa/Sunda/Bali yang ditempelkan langsung ke kotak input.
* **Modul Belajar Aksara Interaktif (`src/components/BhasantaraAksaraGuide.tsx`):** Menampilkan tabel huruf dasar (*nglegena/ngalagena*), sandhangan/rarangken (vokal & tanda bunyi), pasangan, serta filosofi budaya Nusantara.

### 4. Mode Belajar Interaktif & Gamifikasi (`Learn`)
* **Latihan per Huruf A–Z:** Menampilkan foto referensi asli beserta petunjuk jumlah tangan (1 atau 2 tangan) dan peringatan jika huruf tersebut termasuk huruf yang rawan tertukar pada evaluasi foto.
* **Progres & XP Lokal (`src/storage/progress.ts`):** Menyimpan perolehan XP, daftar huruf yang sudah dikuasai (`.../26 huruf`), jumlah hari latihan (*streak*), dan pencapaian (*achievement*) di IndexedDB perangkat.

### 5. Kamus Terpadu 4-Tab (`Dictionary`) & Pengaturan (`Settings`)
* **Kamus 4-Tab:** (1) Alfabet BISINDO & asal-usul foto (`public/ref/provenance.json`), (2) Kosakata 10 bahasa daerah, (3) Kalimat Sejajar, dan (4) Aksara & Budaya.
* **Pengaturan & Diagnostik:** Pemilihan perangkat webcam, penghapusan data kalibrasi pribadi dari IndexedDB, dan panel diagnostik kamera transparan.

---

## Bagian 3: Rencana Pengembangan & Enhancement (Roadmap)

### 1. Pengenalan Isyarat & Pengalaman Kamera (`src/recognition/`)
1. **Gestur Kontrol Tanpa Menyentuh Keyboard (*Hands-Free Controls*):**
   * **Kondisi saat ini:** Di mode Isyarat (`src/main.tsx`), pengguna harus menekan tombol `Spasi` atau `Backspace` di keyboard untuk memisahkan kata atau menghapus huruf.
   * **Enhancement:** Tambahkan jeda otomatis (*auto-space on pause*, mis. saat tangan diturunkan selama 2 detik setelah sebuah kata) atau tombol kontrol cepat yang lebih ergonomis agar pengguna tidak perlu bolak-balik menyentuh keyboard saat sedang berisyarat.
2. **Panduan Visual *Overlay* Siluet / Kerangka Referensi di Kanvas Kamera:**
   * **Kondisi saat ini:** Pengguna melihat foto referensi kecil di samping kamera dan sering kesulitan menyamakan posisi/jarak kedua tangan.
   * **Enhancement:** Menggambar *ghost landmarks* (kerangka tangan bayangan dari prototipe medoid huruf target di `public/models/twohand-v1/model.json`) langsung di atas `<canvas>` kamera pada halaman **Belajar**, sehingga pengguna cukup mencocokkan posisi tangannya ke kerangka bayangan tersebut.
3. **Pengenalan Kosakata Dasar Berbasis Urutan Frame (*Dynamic / Temporal Sign Recognition*):**
   * **Kondisi saat ini:** Tab `Kosakata` di `src/main.tsx` masih berstatus *"Belum tersedia"* karena baru mendukung pose statis A–Z.
   * **Enhancement:** Membangun modul sekuens temporal ringan (mis. *Dynamic Time Warping* / DTW pada rangkaian *landmark* 15–30 frame di `src/recognition/worker.ts`) yang memungkinkan pengguna merekam dan mengenali 5–10 kosakata sehari-hari (seperti *"Terima kasih"*, *"Halo"*, *"Saya"*, *"Makan"*, *"Minum"*).
4. **Optimasi Performa *Missing-Hand Recovery*:**
   * **Kondisi saat ini:** `src/recognition/TwoHandTracker.ts` menjalankan pencarian ulang mode `IMAGE` + refleksi horizontal di *main thread* ketika tangan kedua hilang.
   * **Enhancement:** Mengatur *adaptive throttling* berdasarkan FPS perangkat agar di laptop spesifikasi rendah kamera tetap mulus (30+ FPS).

### 2. Mesin Bahasa Daerah & Aksara Nusantara (`src/language/`)
1. **Perluasan Dukungan Aksara Nusantara Baru:**
   * **Kondisi saat ini:** `src/language/aksara.ts` baru mendukung 3 aksara: **Jawa (`JAVANESE`)**, **Sunda Baku (`SUNDANESE`)**, dan **Bali (`BALINESE`)**, sementara bahasa daerahnya sudah ada 10.
   * **Enhancement:** Menambahkan transliterasi dan font lokal untuk **Aksara Lontara (Bugis — `bug`)** dan **Surat Batak (Batak Toba — `bbc`)**.
2. **Audit & Peningkatan Kualitas Leksikon Bahasa Daerah:**
   * **Kondisi saat ini:** Sesuai catatan di `docs/LANGUAGE_REVIEW.md`, 3 bahasa (`jv`, `sun`, `ban`) sudah punya lembar audit awal, sedangkan 7 bahasa lainnya (`mad`, `bbc`, `min`, `bug`, `ace`, `bjn`, `nij`) belum diaudit, serta banyak kata Bahasa Jawa ber-vokal `e` yang belum memiliki *override* field `aksara`.
   * **Enhancement:** Menambahkan kamus `aksara` eksplisit untuk kata-kata ber-pepet di `src/language/locales/jv.ts` (seperti *sega*, *seneng*, *bener*, *tebih*, *celak*), merapikan diakritik `é` di `src/language/locales/sun.ts`, dan mengaudit entri inti di 7 bahasa daerah lainnya.
3. **Penjelasan Gramatikal & Ragam Tutur per Kata (*Word-by-Word Breakdown*):**
   * **Kondisi saat ini:** Hasil terjemahan di `src/language/engine.ts` langsung menampilkan kalimat utuh.
   * **Enhancement:** Menambahkan tampilan interaktif (klik kata pada hasil terjemahan untuk melihat arti kata dasar, imbuhan kepemilikan yang terdeteksi oleh `src/language/stemmer.ts`, serta perbandingan bentuk *Ngoko*, *Krama*, dan *Krama Inggil*-nya).

### 3. Mode Belajar & Interaktivitas (`Learn` & `Dictionary`)
1. **Mode Latihan Eja Kata (*Spell-a-Word Challenge*):**
   * **Kondisi saat ini:** Halaman **Belajar** (`src/main.tsx`) hanya melatih 1 huruf tunggal secara terpisah.
   * **Enhancement:** Menambahkan mode **"Eja Kata"** di mana pengguna ditantang mengeja kata pendek dengan kamera (mis. `A-K-U`, `B-A-N-Y-U`, `S-E-G-A`) sekaligus mempelajari artinya dalam bahasa daerah.
2. **Kuis Interaktif Aksara & Kosakata Daerah:**
   * **Kondisi saat ini:** Modul `src/components/BhasantaraAksaraGuide.tsx` bersifat bacaan/referensi statis.
   * **Enhancement:** Menambahkan latihan interaktif tebak aksara (*flashcard* / kuis mencocokkan Aksara Jawa/Sunda/Bali dengan bacaan Latinnya) yang terhubung dengan sistem XP di `src/storage/progress.ts`.
3. **Ekspor/Impor Data Kalibrasi & Progres Belajar + Persistensi Pengaturan:**
   * **Kondisi saat ini:** Progres belajar dan contoh kalibrasi pribadi hanya tersimpan di IndexedDB browser, dan pengaturan bahasa/kamera hilang saat tab ditutup.
   * **Enhancement:** Menyimpan preferensi pengguna di `localStorage` dan menyediakan fitur **Ekspor/Impor JSON** di halaman `Settings` agar contoh kalibrasi tangan pribadi tidak hilang saat berganti browser.

### 4. Arsitektur Kode & Kemampuan *Offline* (PWA)
1. **Modularisasi `src/main.tsx`:**
   * **Kondisi saat ini:** File `src/main.tsx` berukuran lebih dari 1.560 baris yang menggabungkan keempat halaman (`Translate`, `Learn`, `Dictionary`, `Settings`) dalam satu komponen besar.
   * **Enhancement:** Memecahnya menjadi komponen halaman terpisah (`src/pages/TranslatePage.tsx`, `LearnPage.tsx`, `DictionaryPage.tsx`, `SettingsPage.tsx`) dan menerapkan *code-splitting* (`React.lazy`) untuk korpus kamus yang besar.
2. **Dukungan PWA (*Progressive Web App*) 100% *Offline*:**
   * **Kondisi saat ini:** Semua aset model dan font sudah ada di `public/`, tetapi belum ada *Service Worker* atau `manifest.webmanifest`.
   * **Enhancement:** Menambahkan konfigurasi PWA sehingga aplikasi bisa di-*install* di desktop/HP dan tetap bisa dibuka walaupun perangkat sedang benar-benar *offline*.
