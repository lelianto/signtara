# Laporan Tinjauan Data Bahasa Daerah (`signtara`)

> **PERNYATAAN TEGAS STATUS DATA**
>
> 1. **Seluruh isi leksikon, kalimat sejajar, catatan literasi budaya, dan keluaran transliterasi aksara di repositori `signtara` tetap berstatus DRAF hingga ditinjau serta divalidasi secara langsung oleh penutur jati (*native speakers*) dan/atau lembaga bahasa berwenang (Balai Bahasa / Badan Pengembangan dan Pembinaan Bahasa).**
> 2. **Tujuh paket bahasa daerah — yaitu Madura (`mad`), Batak Toba (`bbc`), Minangkabau (`min`), Bugis (`bug`), Aceh (`ace`), Banjar (`bjn`), dan Dayak Ngaju (`nij`) — BELUM DIAUDIT SAMA SEKALI pada pekerjaan ini.**
> 3. Tidak ada entri, kalimat, maupun aturan transliterasi dalam repositori ini yang diklaim bebas kekeliruan sebelum melalui proses validasi penutur.

---

## 1. Tabel Perubahan yang Diterapkan

Tabel berikut memuat seluruh perubahan yang telah diterapkan beserta alasan linguistik maupun teknisnya:

| File | `idTerm` / Elemen | Nilai Lama | Nilai Baru | Alasan |
| :--- | :--- | :--- | :--- | :--- |
| `src/language/locales/jv.ts` | Kalimat paralel: *"Saya ingin pergi ke pasar."* | `targetText: 'Kula badhe tindak dhateng peken.'` | `targetText: 'Kula badhe kesah dhateng peken.'` | `tindak` merupakan verba *krama inggil* sehingga tidak tepat dikenakan pada subjek diri sendiri (`kula`); diganti ke *krama* `kesah`. |
| `src/language/locales/jv.ts` | Kalimat paralel: *"Maaf, saya tidak bisa hadir."* | `targetText: 'Nyuwun pangapunten, kula mboten saged rawuh.'` | `targetText: 'Nyuwun pangapunten, kula mboten saged dhateng.'` | `rawuh` merupakan verba *krama inggil* untuk orang yang dihormati, bukan untuk diri sendiri (`kula`); diganti ke *krama* `dhateng`. |
| `src/language/locales/jv.ts` | `obat` | `casual: 'amba'` | `casual: 'tamba'` | `amba` dalam Bahasa Jawa berarti *"lebar/luas"*, sedangkan padanan *ngoko* untuk *"obat"* adalah `tamba`. |
| `src/language/locales/jv.ts` | `garam` | `formal: 'sareh', aliases: ['sarem']` | `formal: 'sarem'` | `sareh` berarti *"sabar/tenang"*, sedangkan bentuk *krama* untuk *"garam"* adalah `sarem`. |
| `src/language/locales/jv.ts` | `jawab` | `casual: 'wangsulan', formal: 'mangsuli'` | `casual: 'njawab', formal: 'mangsuli'` | `wangsulan` merupakan kata benda (*"jawaban"*); bentuk verba *ngoko* diganti ke `njawab`, sedangkan `formal: 'mangsuli'` dipertahankan. |
| `src/language/locales/jv.ts` | `berdiri` | `formal: 'jumeneng', honorific: 'jumeneng'` | `formal: 'ngadeg', honorific: 'jumeneng'` | `jumeneng` merupakan *krama inggil* (khusus orang yang dihormati); bentuk untuk diri sendiri menggunakan `ngadeg`, sedangkan `honorific` tetap `jumeneng`. |
| `src/language/locales/jv.ts` | `kakak` | `meaning: 'Saudara lebih tua'` (`aliases: ['mbak', 'mbakyu']`) | `meaning: 'Saudara lebih tua — mas (lk) / mbak (pr)'` (`aliases: ['mbak', 'mbakyu']`) | Mencatat secara eksplisit pembedaan sapaan laki-laki (`mas`) dan perempuan (`mbak`) untuk mengurangi bias gender pada entri `kakak`. |
| `src/language/locales/sun.ts` | `dengar` | `formal: 'nguping'` | `formal: 'ngadangu'` | `nguping` bernuansa *"menguping/mendengar diam-diam"*; bentuk *lemes* untuk diri sendiri diganti ke `ngadangu` (`honorific` tetap `ngadangukeun`). |
| `src/language/locales/sun.ts` | `bicara` | `formal: 'nyanggem', honorific: 'nyarios'` | `formal: 'matur', honorific: 'nyarios'` | `nyanggem` bermakna *"menyanggupi"*; bentuk *lemes* berbicara kepada yang dihormati diganti ke `matur`, sedangkan `honorific` tetap `nyarios`. |
| `src/language/locales/sun.ts` | `berkata` | `formal: 'nyanggem', honorific: 'nyarios'` | `formal: 'matur', honorific: 'nyarios'` | Alasan sama dengan `bicara`: `nyanggem` diganti ke `matur`, `honorific` tetap `nyarios`. |
| `src/language/locales/sun.ts` | `lihat` | `casual: 'ningali', formal: 'ningal'` | `casual: 'nempo', formal: 'ningali'` | `ningali` adalah bentuk *lemes* (dipindahkan ke `formal`), sedangkan bentuk *loma* memakai `nempo`. Entri `suami` (`salaki` / `caroge`) tidak diubah. |
| `src/language/locales/sun.ts` | Dialek `Sunda Banten` | `'Ragam Sunda arkais tanpa tingkatan lemes yang kompleks.'` | `'Ragam Sunda dengan sistem undak-usuk yang lebih sederhana dan egaliter.'` | Menghindari pelabelan *"arkais"* yang mereduksi ragam tutur hidup masyarakat Sunda Banten. |
| `src/language/locales/ban.ts` | `kamu` | `casual: 'cai', formal: 'ragane', honorific: 'ida'` | `casual: 'cai', formal: 'ragane'` (`honorific` dihapus) | `ida` adalah pronomina orang **ketiga** terhormat (*Alus Singgih*), bukan orang kedua. Field `honorific` dihapus tanpa menebak pengganti baru dan dicatat pada lembar validasi penutur Bali. |
| `src/language/locales/ban.ts` | `kakak` | `meaning: 'Kakak'` (`aliases: ['mbok']`) | `meaning: 'Kakak — beli (lk) / mbok (pr)'` (`aliases: ['mbok']`) | Mencatat sapaan laki-laki (`beli`) dan perempuan (`mbok`) secara berimbang pada `meaning` dan `aliases`. |
| `src/language/locales/{jv,sun,ban,bbc,min,bug,ace,bjn,mad,nij}.ts` | `meta.preservationStatus` | `'Kamus Lokal Terkurasi (...)'` / klaim status vital tanpa label draf | `'Kamus draf (...) · menunggu validasi penutur'` | Menghapus seluruh klaim *"terkurasi"* di `src/` agar status draf yang belum divalidasi penutur dinyatakan secara jujur. |
| `src/language/types.ts` | `PartOfSpeech`, `LexiconEntry`, `SpelledTranslationResult` | Tanpa `'unknown'`, `source`, `verified`, `aksara`, `registerFallback`, `aksaraAuto` | Menambah `'unknown'` pada `PartOfSpeech`; field opsional `aksara`, `source`, `verified` pada `LexiconEntry`; serta `registerFallback` dan `aksaraAuto` pada `SpelledTranslationResult` | Mendukung pelabelan jujur entri korpus otomatis, fallback ragam halus, dan pembedaan transliterasi aksara kamus vs algoritmik. |
| `scripts/build-nusax-corpus.mjs` & `src/language/locales/nusaxSupplement.ts` | Generator suplemen NusaX | `formal: primary`, `meaning: 'Korpus paralel NusaX...'`, `partOfSpeech: inferPos(...)`, tanpa blocklist umpatan/Inggris | Blocklist kata kasar/umpatan lintas bahasa & per bahasa + filter `idTerm` Inggris (`badass`, `lmao`, dll.) membuang seluruh entri (60 entri dibuang); `formal: ''`, `source: 'nusax-auto'`, `verified: false`, `meaning: ''`, `partOfSpeech: 'unknown'` | Mencegah duplikasi semu ragam halus, menyingkirkan kata kasar/umpatan dan istilah Inggris dari kamus, serta tidak menebak kelas kata secara heuristik. |
| `src/language/locales/index.ts` | `enrichPackWithNusaX` & `regionalLanguages.entriesCount` | Hitungan gabungan `"X kosakata · Y kalimat"` | Entri inti (`curated`) selalu menang atas NusaX (suplemen hanya menambah `aliases`); `entriesCount` dipisah menjadi `"X entri inti · Y entri korpus otomatis"` | Menjamin ragam tutur entri draf inti tidak pernah tertimpa korpus otomatis dan memisahkan statistik entri inti dari suplemen otomatis. |
| `src/language/engine.ts` & `src/main.tsx` | Penanganan `register: 'krama'` pada `formal: ''` | Mengambil `entry.formal` langsung (yang sebelumnya menduplikasi `casual`) | Mengembalikan `entry.casual` disertai `registerFallback: true` dan menampilkan catatan UI *"Bentuk halus belum tersedia — menampilkan bentuk sehari-hari."* | Transparansi ketika pengguna meminta ragam halus untuk kata yang baru memiliki bentuk sehari-hari dari korpus otomatis. |
| `src/language/aksara.ts` & `src/main.tsx` | `AKSARA_LABELS.SUNDANESE` & vokal Aksara Sunda / override Aksara Jawa | `'Aksara Sunda (Ngangalagena)'`; vokal `'eu'` belum ada, `'e'` memakai panéléng `ᮆ`, loop `3→2→1` | `'Aksara Sunda Baku'`; pembangkitan otomatis konsonan+vokal memuat `'eu'` (`ᮩ`/`ᮉ`), `'é'` (`ᮦ`/`ᮆ`), `'e'` pamepet (`ᮨ`/`ᮈ`) dengan loop `4→3→2→1`; Jawa mendukung override `LexiconEntry.aksara` + flag `aksaraAuto` tanpa menebak pepet | Memperbaiki pemetaan vokal Aksara Sunda Baku (termasuk silabel 4 huruf `ngeu`/`nyeu`) dan mencegah tebakan pepet Jawa secara algoritmik. |

---

## 2. Catatan Pencarian "Item Tidak Ditemukan"

Hasil pemeriksaan pencarian teks persis (*grep*) terhadap butir pemeriksaan Bagian 1 (Item 1–12):

- **Item 1–6 (Jawa), Item 8–10 (Sunda), dan Item 11–12 (Bali)**: **Seluruh entri dan kalimat sasaran ditemukan** di `src/language/locales/jv.ts`, `src/language/locales/sun.ts`, dan `src/language/locales/ban.ts`.
- **Sub-kondisi Item 5 (`jawab` di `jv.ts`)**: Instruksi berbunyi *"jika formal kosong/salah → `'mangsuli'`"*. Pada `jv.ts`, field `formal` sudah berisi `'mangsuli'`, sehingga bagian `formal` tidak perlu diganti (hanya `casual: 'wangsulan'` yang diubah menjadi `'njawab'`).
- **Pemeriksaan lanjutan Item 7 (kalimat paralel `jv` lainnya yang menggabungkan subjek orang pertama `kula`/`aku` dengan 10 verba *krama inggil*: `rawuh, tindak, kondur, dhahar, sare, ngunjuk, pinarak, ngendika, mriksani, midhanget`)**: Di luar dua kalimat pada Item 1 (`tindak`) dan Item 2 (`rawuh`), **tidak ditemukan** kalimat paralel lain di `jv.ts` maupun di `nusaxParallelSupplement.jv` yang memasangkan subjek `kula`/`aku` dengan kesepuluh kata *krama inggil* tersebut. Namun ditemukan sejumlah pencampuran ragam (*ngoko* vs *krama*) yang dicantumkan pada Bagian 3.1 di bawah untuk divalidasi penutur.

---

## 3. Daftar Usulan untuk Validasi Penutur Asli / Balai Bahasa (Siap Cetak)

> **Petunjuk bagi Peninjau Bahasa Daerah / Balai Bahasa:**
> Seluruh butir di bawah ini **BELUM DIUBAH secara otomatis** di kode sumber (kecuali penghapusan `honorific: 'ida'` pada Item 11 Bali yang memerlukan konfirmasi bentuk pengganti). Mohon berikan tanda centang pada kolom keputusan serta tuliskan bentuk revisi yang tepat menurut kaidah tutur di wilayah Bapak/Ibu.

---

### 3.1 Lembar Validasi — Bahasa Jawa (`jv` · Basa Jawa)

- **Nama Peninjau:** ............................................................
- **Wilayah / Dialek Rujukan (mis. Surakarta / Yogyakarta / Jawa Timur):** ............................................................
- **Instansi / Komunitas:** ............................................................
- **Tanggal Peninjauan & Tanda Tangan:** ............................................................

| No | Lokasi & `idTerm` / Kalimat | Isi Draf Saat Ini | Catatan Temuan Audit (Usulan, Perlu Validasi Penutur) | Keputusan & Koreksi Penutur |
| :-: | :--- | :--- | :--- | :--- |
| 1 | `jv.ts:232` (Kalimat paralel — *"Selamat datang di tanah Jawa, saudara."*) | `Sugeng rawuh wonten ing tanah Jawa, sedulur.` | Frasa pembuka memakai ragam *krama*/*krama inggil* (`Sugeng rawuh wonten ing`), tetapi diakhiri sapaan *ngoko* (`sedulur`, bandingkan *krama* `sedherek` / `para sedherek`). | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 2 | `sun.ts:224` (Kalimat paralel lintas bahasa Sunda → Jawa — *"Hatur nuhun kana kasaean anjeun."*) | `Matur nuwun marang kabecikan sampeyan.` | Mencampur ungkapan sopan `Matur nuwun` dan `sampeyan` (*krama madya*) dengan preposisi serta nomina *ngoko* (`marang kabecikan`, bandingkan *krama* `dhumateng kesaenan`). | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 3 | `jv.ts:234` (Kalimat paralel — *"Semoga kamu selalu diberi kesehatan."*) | `Muga-muga sampeyan tansah diparingi kesarasan.` | Mencampur penanda harapan *ngoko* (`Muga-muga`, bandingkan *krama* `Mugi-mugi`), pronomina *madya* (`sampeyan`), verba *krama inggil* (`diparingi`), dan nomina *krama* (`kesarasan`). | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 4 | `jv.ts:224` (Kalimat paralel — *"Selamat pagi, semoga harimu menyenangkan."*) | `Sugeng enjang, mugi dinten panjenengan nyenengaken.` | Struktur `mugi dinten panjenengan nyenengaken` tampak merupakan terjemahan harfiah dari ungkapan modern *"have a nice day"*; mohon tinjau kealamiannya dalam Basa Jawa. | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 5 | `jv.ts:44–45` (`selamat datang`, `selamat jalan`) | `casual: 'Sugeng rawuh'` dan `casual: 'Sugeng tindak'` | Kolom `casual` (*ngoko*) memuat bentuk *krama inggil* (`rawuh`, `tindak`). Mohon validasi apakah pada ragam akrab tetap dipakai bentuk tersebut atau ungkapan *ngoko* (mis. `ati-ati ning dalan` dsb.). | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 6 | `jv.ts:61` (`kamu`) | `casual: 'kowe', formal: 'panjenengan', honorific: 'panjenengan', aliases: ['sampeyan', 'awakmu']` | `formal` dan `honorific` keduanya diisi `'panjenengan'`. Mohon tinjau apakah `formal` (*krama* setara) sebaiknya `'sampeyan'` atau tetap `'panjenengan'`. | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 7 | `jv.ts:65–66` (`kami`, `kita`) | `casual: 'awak dhewe', formal: 'kita'` | Dalam Basa Jawa, `kita` bukan bentuk *krama* baku untuk `'kami'` eksklusif (sering memakai `kula sedaya` / `kula sakanca`). Mohon validasi padanan `formal` yang tepat. | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 8 | `jv.ts:86, 113, 144` (`guru`, `belajar`, `sekolah`) | `guru` → `formal: 'dwija'`; `belajar` → `formal: 'ngangsu kawruh'`; `sekolah` → `formal: 'pawiyatan'` | Ketiga bentuk `formal` memakai kosakata sastra/*Kawi* yang jarang dipakai dalam percakapan *krama* harian (bandingkan `guru`, `sinau`, `sekolah` / `pasekolahan`). | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 9 | `jv.ts:91, 93, 116, 147–149, 161–162, 193` (`minum`, `bangun`, `mandi`, `mata`, `tangan`, `kepala`, `lapar`, `haus`, `kapan`) | `formal` identik dengan `casual`: `ngombe`, `tangi`, `adus`, `mripat`, `tangan`, `sirah`, `luwe`, `ngelak`, `kapan` | Sebagian konsep memang netral (*krama ngoko*) untuk diri sendiri karena bentuk halusnya adalah *krama inggil* (`ngunjuk`, `wungu`, `siram`, `soca`, `asta`, `mustaka`), tetapi sebagian lain memiliki bentuk *krama* (mis. `kapan` vs `benjang menapa` / `kala menapa`, `luwe` vs `kaliren`). Mohon validasi per kata. | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 10 | `jv.ts` (Seluruh entri ber-huruf `e` untuk `LexiconEntry.aksara`) | `aksara: undefined` (belum diisi) | Ejaan Latin tidak membedakan `é`/`è` (taling `ꦺ`) dari `ê` (pepet `ꦼ`), sehingga kata seperti `sega` (`ꦱꦼꦒ`), `seneng` (`ꦱꦼꦤꦼꦁ`), `bener` (`ꦧꦼꦤꦼꦂ`), `tebih` (`ꦠꦼꦧꦶꦃ`), `celak` (`ꦕꦼꦭꦏ꧀`) memerlukan pengisian field `aksara` oleh ahli aksara Jawa. | `[ ]` Lampirkan daftar ejaan Hanacaraka |

---

### 3.2 Lembar Validasi — Bahasa Sunda (`sun` · Basa Sunda)

- **Nama Peninjau:** ............................................................
- **Wilayah / Dialek Rujukan (mis. Priangan / Cirebon-Kuningan / Banten):** ............................................................
- **Instansi / Komunitas:** ............................................................
- **Tanggal Peninjauan & Tanda Tangan:** ............................................................

| No | Lokasi & `idTerm` / Kalimat | Isi Draf Saat Ini | Catatan Temuan Audit (Usulan, Perlu Validasi Penutur) | Keputusan & Koreksi Penutur |
| :-: | :--- | :--- | :--- | :--- |
| 1 | `sun.ts:216` (Kalimat paralel — *"Saya ingin pergi ke pasar."*) | `Abdi hoyong angkat ka pasar.` | Dalam *undak-usuk basa* Sunda, `'angkat'` lazimnya merupakan *lemes ka batur* (untuk orang lain yang dihormati), sedangkan untuk diri sendiri (`abdi`) dipakai `'mios'` (`Abdi hoyong mios ka pasar.`, selaras dengan `sun.ts:92`). | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 2 | `sun.ts:106` (`ambil`) | `casual: 'nyokot', formal: 'ngabantun', honorific: 'nyandak'` | `'ngabantun'` dan `'nyandak'` lazimnya berarti *"membawa"* (identik dengan entri `bawa` pada `sun.ts:109`). Mohon validasi bentuk *lemes ka sorangan* dan *lemes ka batur* yang tepat untuk *"mengambil"* (mis. `ngambil` / `nyokot` / `mundut`). | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 3 | `sun.ts:89` (`minum`) | `casual: 'nginum', formal: 'nginum', honorific: 'ngaleueut'` | Mohon validasi apakah bentuk *lemes* untuk diri sendiri dalam percakapan sopan tetap `'nginum'` atau memakai bentuk lain (mis. `'ngarot'` / `'nginum'`). | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 4 | `sun.ts:95–96` (`duduk`, `berdiri`) | `duduk`: `formal: 'diuk', honorific: 'calik'`; `berdiri`: `formal: 'nangtung', honorific: 'ngadeg'` | Mohon validasi pemisahan bentuk *loma*, *lemes ka sorangan* (mis. `diuk`/`dongko`, `nangtung`/`ngadeg`), dan *lemes ka batur* (`calik`/`linggih`, `ngadeg`) menurut pemakaian baku saat ini. | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 5 | `sun.ts:120` (`lupa`) | `casual: 'poho', formal: 'hilap', honorific: 'lali'` | Mohon validasi distribusi `'hilap'` dan `'lali'` antara *lemes ka sorangan* vs *lemes ka batur*. | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 6 | `sun.ts:55` (`hati-hati`) | `casual: 'Kade', formal: 'Ati-ati'` | Mohon validasi bentuk sapaan pesan berhati-hati dalam ragam *lemes* (mis. `'Sing ati-ati'` / `'Kahade'`). | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 7 | `sun.ts:215` (Kalimat paralel — *"Selamat pagi, semoga harimu menyenangkan."*) | `Wilujeng enjing, mugi dinten anjeun pikaresepeun.` | Mohon tinjau kealamian susunan kalimat `mugi dinten anjeun pikaresepeun` bagi penutur jati Basa Sunda. | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 8 | `sun.ts` (Ejaan vokal `é` vs `e` vs `eu` pada teks Latin kamus) | Sebagian entri belum memakai tanda diakritik `é` secara konsisten (mis. `maneh`, `hade`, `gede`, ` kabeh`, `poe`, `engke`, `rek`, `mere`, `sare` vs `lungsé`, `badé`) | Karena mesin Aksara Sunda Baku kini membedakan `'é'` (`ᮦ` panéléng) dari `'e'` tanpa tanda (`ᮨ` pamepet), penulisan diakritik `'é'` pada entri Latin sangat menentukan ketepatan transliterasi aksara. Mohon audit ejaan diakritik `'é'` di seluruh `sun.ts`. | `[ ]` Lampirkan daftar koreksi `'é'` |

---

### 3.3 Lembar Validasi — Bahasa Bali (`ban` · Basa Bali)

- **Nama Peninjau:** ............................................................
- **Wilayah / Dialek Rujukan (mis. Badung-Denpasar / Gianyar / Buleleng / Karangasem):** ............................................................
- **Instansi / Komunitas:** ............................................................
- **Tanggal Peninjauan & Tanda Tangan:** ............................................................

| No | Lokasi & `idTerm` / Kalimat | Isi Draf Saat Ini | Catatan Temuan Audit (Usulan, Perlu Validasi Penutur) | Keputusan & Koreksi Penutur |
| :-: | :--- | :--- | :--- | :--- |
| 1 | `ban.ts:56` (`kamu` — **Item 11**) | `casual: 'cai', formal: 'ragane'` (`aliases: ['nyai']`; `honorific: 'ida'` telah dihapus) | Field `honorific: 'ida'` dihapus karena `'ida'` adalah pronomina orang **ketiga** terhormat (*Alus Singgih*), bukan orang kedua. Mohon validasi apakah orang kedua hormat sebaiknya dikosongkan atau diisi sapaan tertentu (mis. `I Ratu` / `Ratu` / `Ida Dane`) beserta batasan konteks adatnya. | `[ ]` Biarkan tanpa `honorific`<br>`[ ]` Isi `honorific`: .............................. |
| 2 | `ban.ts:45` (`terima kasih banyak` — **Item 12**) | `casual: 'Matur suksma', formal: 'Matur suksma ping banget'` | Tidak diubah pada audit ini. Mohon validasi apakah ungkapan `'Matur suksma ping banget'` lazim dan berterima dalam Basa Bali *Alus*, atau sebaiknya diganti (mis. `'Matur suksma dahat'` / `'Matur suksma banget'`). | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 3 | `ban.ts:150` & `culturalLiteracy.ts:44` (Kalimat paralel — *"Salam sejahtera, semoga semua menemukan keselamatan."*) | `Om Swastyastu, mugi sami ngemanggihan karahayuan.` | Kata `'mugi'` lazimnya merupakan kosakata Bahasa Jawa, sedangkan pada `ban.ts:149` digunakan bentuk Basa Bali `'dumogi'` (`Dumogi sami manggih karahayuan.`). Mohon validasi pilihan `'mugi'` vs `'dumogi'` dan `'ngemanggihan'` vs `'manggih'`/`'ngamanggihin'`. | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 4 | `ban.ts:40–41` (`selamat siang`, `selamat sore`) | `selamat siang`: `casual: 'Rahajeng tengai', formal: 'Rahajeng siang'`; `selamat sore`: `casual: 'Rahajeng sanja', formal: 'Rahajeng sore'` | Kolom `formal` menggunakan kata serapan `'siang'` dan `'sore'`, sementara kosakata Bali `'tengai'` dan `'sanja'` ditempatkan di `casual`. Mohon validasi kedudukan ragam *Andap* vs *Alus*-nya. | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 5 | `ban.ts:111` (`pasar`) | `casual: 'peken', formal: 'pasar'` | Dalam Basa Bali sehari-hari maupun halus, `'peken'` merupakan kosakata asli Bali sedangkan `'pasar'` adalah serapan Bahasa Indonesia. Mohon validasi apakah bentuk *Alus* memang `'pasar'` atau tetap `'peken'`. | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 6 | `ban.ts:84` (`pergi`) | `casual: 'luas', formal: 'lunga', honorific: 'mamargi'` | Dalam *anggah-ungguhing basa* Bali, `'lunga'` sering tergolong *Alus Singgih* (untuk orang yang dihormati), sedangkan `'mamargi'` (*Alus Mider*/*Alus Sor*) juga dipakai untuk diri sendiri saat berpamitan. Mohon validasi urutan `formal` vs `honorific`. | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |
| 7 | `ban.ts:81` (`minum`) | `casual: 'nginem', formal: 'nginem', honorific: 'ngayunang toya'` | Mohon validasi bentuk *Andap* (`nginum` vs `nginem`), *Alus Sor*, dan *Alus Singgih* (`ngrayunang toya` / `ngajeng toya`). | `[ ]` Pertahankan<br>`[ ]` Revisi: .............................. |

---

## 4. Paket Bahasa Daerah yang Belum Diaudit Sama Sekali

Tabel berikut merangkum 7 paket bahasa daerah di `src/language/locales/` yang **sama sekali belum menjalani audit linguistik** pada tahap ini. Seluruh entri inti maupun entri korpus otomatis NusaX di dalamnya wajib diperlakukan sebagai **draf mentah**:

| Kode | Bahasa Daerah | Nama Asli | Komposisi Draf Saat Ini | Status Audit |
| :---: | :--- | :--- | :--- | :--- |
| `mad` | Madura | Basa Madhura | `59 entri inti · 427 entri korpus otomatis` | **Belum diaudit sama sekali** — menunggu penutur asli / Balai Bahasa Jawa Timur |
| `bbc` | Batak Toba | Hata Batak Toba | `79 entri inti · 449 entri korpus otomatis` | **Belum diaudit sama sekali** — menunggu penutur asli / Balai Bahasa Sumatera Utara |
| `min` | Minangkabau | Baso Minang | `76 entri inti · 354 entri korpus otomatis` | **Belum diaudit sama sekali** — menunggu penutur asli / Balai Bahasa Sumatera Barat |
| `bug` | Bugis | Basa Ugi | `85 entri inti · 451 entri korpus otomatis` | **Belum diaudit sama sekali** — menunggu penutur asli / Balai Bahasa Sulawesi Selatan |
| `ace` | Aceh | Bahsa Acèh | `84 entri inti · 424 entri korpus otomatis` | **Belum diaudit sama sekali** — menunggu penutur asli / Balai Bahasa Aceh |
| `bjn` | Banjar | Basa Banjar | `98 entri inti · 375 entri korpus otomatis` | **Belum diaudit sama sekali** — menunggu penutur asli / Balai Bahasa Kalimantan Selatan |
| `nij` | Dayak Ngaju | Bahasa Dayak Ngaju | `63 entri inti · 378 entri korpus otomatis` | **Belum diaudit sama sekali** — menunggu penutur asli / Balai Bahasa Kalimantan Tengah |

