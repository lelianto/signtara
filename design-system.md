# ISYARA × BHASANTARA — Design System
**Edisi Khusus: Aksesibilitas Dewasa Senior & Lansia (Mature & Senior Friendly)**  
*Dokumentasi Sistem Desain UI/UX Komprehensif — Standar Emas Ergonomi & Aksesibilitas*

---

## 1. Filosofi Desain: "Keanggunan Tradisi, Kejernihan Aksesibilitas"

Desain antarmuka ISYARA dirancang dengan pendekatan humanis, anggun, dan berwibawa. Ditujukan khusus untuk kalangan **orang dewasa matang hingga lanjut usia (rentang usia 45 – 65+ tahun)** di Indonesia yang ingin mempelajari bahasa isyarat BISINDO serta melestarikan bahasa daerah Nusantara tanpa hambatan teknis.

Prinsip desain utama:
1. **Zero Eye-Strain (Bebas Kelelahan Mata)**: Tidak menggunakan latar putih silau (#FFFFFF murni) dan menghapus total tipografi mikro (8px–10px) yang menyulitkan mata dengan presbiopi (*mata tua*).
2. **Generous Touch & Click Targets**: Setiap elemen interaktif (tombol, input, opsi tab) memiliki area klik minimal **48px – 56px**, mencegah salah tekan akibat penurunan kendali motorik halus (*fine motor tremor*).
3. **High Cognitive Reassurance (Kepastian Kognitif Tinggi)**: Navigasi yang lugas, status sistem yang diungkapkan dengan bahasa santun dan gamblang, serta ikon yang selalu diperkuat dengan label teks yang mudah dibaca.
4. **Harmoni Warna Tradisi Nusantara**: Perpaduan warna kain tenun/batik pusaka (Krem Linen, Merah Marun Ningrat, Emas Kuningan, dan Biru Malam Obsidian) yang menciptakan nuansa teduh, hangat, dan berkelas.

---

## 2. Riset Target Pengguna (Mature & Senior Adults)

| Karakteristik Penuaan | Dampak pada Interaksi UI | Solusi Desain ISYARA |
|---|---|---|
| **Presbiopi & Penurunan Sensitivitas Kontras** | Kesulitan membaca teks kecil, warna tipis/abu-abu pudar, dan garis batas yang samar. | • Ukuran font dasar dinaikkan menjadi **16px – 18px** (tidak ada teks di bawah 13px).<br>• Rasio kontras teks minimum **7:1 (WCAG AAA)**.<br>• Border kartu tegas dan jelas (minimal 1.5px solid). |
| **Penurunan Akurasi Motorik Halus** | Jari gemetar atau klik mouse kurang presisi; frustrasi jika tombol terlalu berdekatan. | • Tombol utama berukuran minimum **48px – 52px**.<br>• Jarak renggang (*padding & gap*) antar elemen minimal **12px – 16px**.<br>• Indikator fokus (*focus ring*) tebal dan kontras tinggi. |
| **Kapasitas Beban Kerja Memori Menurun** | Bingung dengan ikon abstrak tanpa teks, animasi cepat, atau istilah teknis bahasa Inggris. | • Setiap ikon selalu disertai label teks deskriptif.<br>• Istilah teknis disederhanakan ke bahasa Indonesia yang ramah (misal: "On-device" → "Di Perangkat Anda").<br>• Alur linear yang tidak membingungkan. |
| **Sensitivitas Terhadap Silau (*Glare Sensitivity*)** | Layar putih terang membuat mata cepat perih dan lelah. | • Latar belakang dominan menggunakan **Krem Linen Hangat (`#FCF7F0`)** yang menyerupai kertas buku tua berkualitas tinggi. |

---

## 3. Palet Warna (Penerapan Aturan 60 - 20 - 10 - 10)

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│   DOMINAN 60% : Krem Linen Hangat (#FCF7F0)            │
│   Latar belakang aplikasi, kanvas utama, ruang lapang  │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │                                                │   │
│   │   SEKUNDER 20% : Obsidian Midnight (#101827)    │   │
│   │   Sidebar, kartu kontras tinggi, teks utama    │   │
│   │                                                │   │
│   │   ┌───────────────┐        ┌───────────────┐   │   │
│   │   │ AKSEN (#421719)│        │ IKON (#D4B16E)│   │   │
│   │   │ Marun Ningrat │        │ Emas Kuningan │   │   │
│   │   │ Tombol primer │        │ Badge & Aksen │   │   │
│   │   └───────────────┘        └───────────────┘   │   │
│   └────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

### Spesifikasi Kode Warna Resmi

| Peran Warna | Proporsi | Kode HEX | RGB | Penggunaan Utama |
|---|---|---|---|---|
| **Primer (Latar Utama)** | **60%** | `#FCF7F0` | `rgb(252, 247, 240)` | Latar belakang seluruh halaman, kanvas utama, latar dialog, menciptakan atmosfer nyaman dan sejuk di mata. |
| **Sekunder (Struktur)** | **~20%** | `#101827` | `rgb(16, 24, 39)` | Sidebar navigasi, kartu hasil kamera kontras tinggi, *footer*, serta warna tipografi utama pada latar terang. |
| **Ikon (Pusaka Gold)** | **~10%** | `#D4B16E` | `rgb(212, 177, 110)` | Ikon navigasi, badge pencapaian, bingkai lingkaran/rounded ikon, aksen visual mewah dan terhormat. |
| **Aksen (Marun Ningrat)** | **~10%** | `#421719` | `rgb(66, 23, 25)` | Tombol aksi utama (CTA / Nyalakan Kamera), tab aktif, status penanda fokus, *tagline* penegas. |
| **Font Khusus (Terang)** | — | `#FCFBFB` | `rgb(252, 251, 251)` | Warna teks untuk segala elemen yang berada di atas latar gelap (`#101827` atau `#421719`). |
| **Font Kontras (Gelap)** | — | `#101827` | `rgb(16, 24, 39)` | Warna teks tajam untuk membaca di atas latar krem `#FCF7F0` (Rasio Kontras > 14:1, lolos WCAG AAA). |
| **Border & Divider** | — | `#E7DDCF` | `rgb(231, 221, 207)` | Garis pemisah tegas dan hangat, menghindari kesan kaku abu-abu dingin. |

---

## 4. Tipografi Khusus Lansia & Orang Dewasa

### A. Hirarki Skala Tipografi (Anti-Huruf Kecil)

*Catatan: Seluruh ukuran mikro di bawah 12px yang ada di versi lawas dihapuskan total.*

| Tingkat | Ukuran (px / rem) | Berat | Tinggi Baris | Contoh Penggunaan |
|---|---|---|---|---|
| **Display (Huruf Isyarat)** | `72px` (4.5rem) | 700 (Bold) | `1.1` | Huruf alfabet yang sedang dikenali kamera (`A`, `B`, `C`). |
| **Judul Halaman (H1)** | `34px – 38px` (2.25rem) | 600 (Semibold) | `1.3` | "Dari tangan, jadi makna." / "Latih alfabet hari ini." |
| **Subjudul Bagian (H2)** | `24px – 26px` (1.5rem) | 600 (Semibold) | `1.4` | "Alfabet BISINDO", "Kamus Bahasa Nusantara". |
| **Judul Kartu (H3)** | `19px – 21px` (1.25rem) | 600 (Semibold) | `1.4` | Nama bahasa daerah, judul panduan kamera. |
| **Teks Utama (Body Text)** | **`16px – 17px`** (1.05rem) | 400 (Regular) | `1.7` | Deskripsi, petunjuk posisi tangan, paragraf kamus. |
| **Label Tombol & Input** | `16px` (1.0rem) | 600 (Semibold) | `1.5` | Tombol "Nyalakan kamera", pilihan ragam bahasa. |
| **Keterangan Terkecil (Small)** | **`13px – 14px`** (0.85rem) | 500 (Medium) | `1.6` | Status kamera, metadata lisensi, catatan ragam tutur. |

### B. Pemilihan Font
* **Font Judul & Budaya**: `Georgia`, `Playfair Display`, atau `serif` berwibawa yang memberikan nuansa literatur klasik yang hangat bagi orang tua.
* **Font Antarmuka & Teks**: `Plus Jakarta Sans`, `Inter`, atau `sans-serif` berkarakter tinggi (*x-height tinggi*) dengan bukaan huruf yang lebar sehingga mudah dibaca tanpa mengernyitkan mata.
* **Font Aksara**: `KemasyuranJawa` untuk tampilan otentik Aksara Nusantara.

---

## 5. Sistem Ikonografi & Rounded Badging

Sesuai instruksi desain:
* **Warna Ikon**: Menggunakan palet emas kuningan `#D4B16E`.
* **Bentuk (*Rounded Style*)**: Setiap ikon fungsional dilingkupi dengan kontainer rounded yang lembut (*squircle* dengan `border-radius: 12px` hingga `16px`, atau lingkaran penuh `50%`).
* **Ketebalan Garis (*Stroke Width*)**: Menggunakan ketebalan `1.75px – 2px` (tidak menggunakan garis tipis 1px yang sulit dilihat mata tua).
* **Kontras Latar Ikon**:
  * Di atas latar gelap `#101827`: Ikon `#D4B16E` bersinar kontras dan anggun.
  * Di atas latar krem `#FCF7F0`: Ikon diletakkan di dalam wadah rounded berlatar Marun `#421719` atau Obsidian `#101827`, sehingga siluet emas tampak menonjol.

---

## 6. Spesifikasi Komponen UI (Design Tokens)

### A. Tombol Utama (Primary CTA)
* **Latar Belakang**: `#421719` (Marun Ningrat).
* **Warna Teks**: `#FCFBFB` (Putih Bersih).
* **Ikon Pendamping**: `#D4B16E` (Emas).
* **Tinggi Minimal**: `52px` (Sangat ramah jari lansia).
* **Border Radius**: `12px` (Rounded elegan).
* **Efek Hover**: Warna menggelap sedikit ke `#321113` dengan bayangan lembut `box-shadow: 0 4px 14px rgba(66, 23, 25, 0.25)`.
* **Efek Fokus**: `outline: 3px solid #D4B16E; outline-offset: 3px`.

### B. Navigasi Samping (Sidebar)
* **Latar Belakang**: `#101827` (Obsidian Midnight).
* **Warna Brand**: Teks `#FCFBFB` dengan titik aksen `#D4B16E`.
* **Tombol Navigasi Normal**:
  * Teks `#C4CDD5`, Ikon `#D4B16E`.
  * Padding: `16px 18px`, Font: `16px`, Border Radius: `10px`.
* **Tombol Navigasi Aktif**:
  * Latar: `#421719` (Marun Ningrat).
  * Teks: `#FCFBFB` tebal.
  * Indikator titik: `#D4B16E` (Emas).

### C. Bingkai Kamera & Pelacak Tangan
* **Latar Saat Mati**: `#101827` berpadu tekstur hangat dengan ikon tangan emas `#D4B16E` berdiameter `96px`.
* **Label Status Kamera**: Kotak pill rounded di sudut atas dengan teks berukuran `14px` tebal, status titik hijau/merah berukuran `10px` jelas.
* **Indikator Jumlah Tangan**: Teks besar "Pelacak: 2 / 2 Tangan Terdeteksi", berlatar marun pekat `#421719` dengan teks `#FCFBFB`.

### D. Kartu Hasil Terjemahan (Recognition Output)
* **Latar Belakang**: `#FFFFFF` atau `#FCF7F0` dengan border tegas `#E7DDCF` selebar `2px`.
* **Tampilan Huruf Utama**: Ukuran `76px`, font serif berwibawa, berwarna `#421719` (Marun) dengan kontras maksimal.
* **Meter Akurasi / Skor**: Tinggi `10px` (bukan 4px tipis), berwarna emas `#D4B16E` dengan latar belakang `#E5E7EB`.
* **Area Ejaan Teks**: Kotak input teks besar dengan font berukuran `18px`, dilengkapi tombol aksi bertombol besar (Suara, Spasi, Hapus, Bersihkan) setinggi minimal `44px`.

### E. Kartu Kamus & Aksara
* **Latar Kartu**: Putih bersih `#FFFFFF` berpadu garis batas ganda tipis `#E7DDCF`.
* **Label Status**: Badge "Draf · Belum Diverifikasi" berlatar `#FCF7F0` dengan teks marun `#421719`.
* **Tombol Audio (TTS)**: Tombol dengarkan suara berdiameter `40px` dengan ikon emas `#D4B16E` yang langsung melafalkan kosakata bahasa daerah.

---

## 7. Pemetaan Variabel CSS (`:root` Blueprint)

Berikut adalah variabel resmi yang disiapkan untuk diinjeksikan ke dalam `src/style.css`:

```css
:root {
  /* ===================================================
     1. PALET WARNA RESMI ISYARA (60 - 20 - 10 - 10)
     =================================================== */
  --bg-primary: #FCF7F0;        /* 60%: Krem Linen Hangat */
  --bg-secondary: #101827;      /* 20%: Obsidian Midnight */
  --icon-gold: #D4B16E;         /* 10%: Emas Kuningan Rounded */
  --accent-maroon: #421719;     /* 10%: Marun Ningrat / CTA */
  --text-light: #FCFBFB;        /* Font Terang di atas gelap */
  
  /* ===================================================
     2. WARNA FUNGSIONAL & AKSESIBILITAS TINGGI
     =================================================== */
  --text-dark-primary: #101827;  /* Teks Utama di atas krem (AAA) */
  --text-dark-muted: #4B5563;    /* Teks Sekunder yang tetap terbaca */
  --border-warm: #E7DDCF;        /* Border hangat berkarakter */
  --border-dark: #1F293D;        /* Border pada elemen gelap */
  --surface-card: #FFFFFF;       /* Permukaan kartu baca */
  --surface-muted: #F5EFE6;      /* Permukaan penopang */
  --status-live: #15803D;        /* Hijau status aktif tajam */
  --status-off: #B91C1C;         /* Merah status nonaktif */
  
  /* ===================================================
     3. ERGONOMI & UKURAN TOMBOL UNTUK LANSIA
     =================================================== */
  --btn-min-height: 50px;
  --btn-radius: 12px;
  --card-radius: 16px;
  --focus-ring: 3px solid #D4B16E;
  --shadow-soft: 0 4px 20px rgba(16, 24, 39, 0.06);
  --shadow-elevated: 0 8px 30px rgba(16, 24, 39, 0.12);
}
```

---

## 8. Checklist Verifikasi Desain untuk Dewasa Senior

- [x] **Kontras Warna**: Semua teks di atas krem `#FCF7F0` menggunakan `#101827` atau `#421719` dengan kontras $\ge 7:1$.
- [x] **Kontras Elemen Gelap**: Semua teks di dalam panel Obsidian `#101827` menggunakan `#FCFBFB` dengan kontras $\ge 12:1$.
- [x] **Ikon Emas Terlindungi**: Ikon `#D4B16E` diletakkan di dalam kontainer rounded dengan kontras tinggi sehingga tidak tenggelam di latar krem.
- [x] **Bebas Huruf Mikro**: Tidak ada lagi font berukuran 8px, 9px, atau 10px. Ukuran teks terkecil adalah 13px–14px untuk metadata sekunder.
- [x] **Target Sentuh Nyaman**: Tombol dan elemen interaktif memiliki tinggi minimal 48px–52px.
- [x] **Keterbacaan Aksara**: Glif Aksara Jawa, Sunda, dan Bali disajikan dengan ukuran besar (minimal 28px–32px) agar goresan carakan terbaca jelas tanpa kaca pembesar.

