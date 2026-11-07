# Hasil uji lokal terbaru — TwoHand v1, 31 Oktober 2026

## Perbaikan

Model aktif diganti dari MLP 63 fitur satu tangan menjadi classifier nearest-prototype dengan 254 fitur gabungan bentuk dan posisi kedua tangan. Dataset asli MIT diperiksa langsung; pelatihan memakai 388 foto latih unik dengan ekstraksi tangan lengkap. Contoh dua tangan yang hanya terdeteksi satu tangan tidak lagi diajarkan sebagai isyarat satu tangan.

Referensi A–Z diganti dengan foto asli resolusi penuh dari bagian train, bukan foto test. Setiap gambar mencatat nama asli, SHA-256, commit sumber, lisensi dan jumlah tangan yang terlihat. Pratinjau tidak dicerminkan agar sesuai orientasi foto. Jumlah tangan dan huruf yang masih bermasalah pada uji foto ditampilkan di kamus/pelajaran.

## Hasil eksekusi nyata

- **26/26 aliran video foto referensi A–Z menghasilkan huruf yang sesuai**, melalui UI kamera, MediaPipe VIDEO, worker, model baru dan penyaring temporal. A berhasil dengan dua tangan terdeteksi. Laporan tiap huruf: `ml/evaluation/reference-video.json`.
- Ini adalah foto latih yang dialirkan sebagai video; **bukan akurasi webcam manusia atau penutur baru**. Hasil tidak boleh disebut akurasi 100% di dunia nyata.
- Pada 103 foto test unik dari split sumber, label teratas benar **97/103 (94,2%)**. Sesudah filter, **86 diterima dan semuanya benar pada set kecil ini**; 17 ditolak. Pembagian ini belum independen antarpenutur, dan telah digunakan pada pengembangan; perlu set konfirmasi baru. Semua prediksi, matriks kebingungan dan metrik tiap huruf tersedia di `ml/evaluation/report.json`.

## Pemeriksaan perangkat lunak

- **16 unit test lulus**, mencakup dua tangan, urutan hasil detektor, posisi relatif, invariansi translasi/skala, validasi fitur/model, unknown/no-hand, konsensus, duplikasi dan adapter bahasa.
- **9 pengujian browser lulus**: navigasi/register/progres, izin ditolak, model hilang + pelepasan kamera, kamera terputus, A dua tangan, C satu tangan, no-hand, worker dua tangan, tampilan responsif dan sumber referensi.
- Pemeriksaan TypeScript dan build produksi lulus. Audit dependensi npm melaporkan nol kerentanan yang diketahui.
- Webcam fisik dan ketepatan linguistik belum divalidasi langsung. Model masih eksperimental; kata, kalimat dan gerakan dinamis belum dikenali.

## Build produksi

Worker hasil bundling produksi juga diuji melalui video referensi A: **A dikenali dengan dua tangan terdeteksi**, skor pemisahan sekitar 0,69. Server produksi sementara di port 3002 dihentikan setelah pengujian; server pengembangan di port 3000 digunakan untuk mencoba aplikasi.

## v0.3: tindak lanjut kegagalan kamera pengguna

Pengguna melaporkan A dua tangan masih tidak terdeteksi. Hasil foto referensi sebelumnya tidak membantah laporan tersebut. Ditemukan cacat geometri: koordinat kamera 16:9 belum disesuaikan dengan rasio foto latih 4:3. Input kini dikoreksi memakai dimensi video sebenarnya; belum dipastikan apakah ini penyebab pada kamera pengguna.

Ditambahkan diagnostik jumlah tangan/resolusi/alasan penolakan dan contoh pribadi opt-in yang hanya menyimpan fitur di IndexedDB. Pengambilan contoh tidak menghasilkan huruf; setelah menyimpan, pengguna wajib menurunkan tangan lalu membentuk kembali agar terjadi inferensi dari frame baru. Hasil pribadi ditandai sebagai label pengguna, bukan verifikasi pengajar.

Pengujian terbaru: **19 unit test** dan **11 browser test lulus**, termasuk uji A pada video 1280×720, penyimpanan/penghapusan contoh pribadi, penahanan hasil selama perekaman dan pengujian ulang setelah pelepasan tangan. TypeScript/build lulus. Pengujian browser memakai foto sebagai masukan video, bukan webcam pengguna; keberhasilan langsung pada pengguna tetap belum terverifikasi.

### Konfirmasi pengguna dan diagnostik lanjutan

Pengguna mengonfirmasi bahwa titik/garis muncul pada kedua tangan tetapi A tidak keluar. Ini menempatkan gejala setelah pelacakan, pada pencocokan model atau konsensus temporal; penyebab spesifik belum terukur tanpa skor/jarak dari sesi pengguna. UI kini menampilkan progres frame stabil secara terpisah dari penolakan model. Memulai pengambilan contoh pribadi otomatis membersihkan hasil ejaan lama dan menampilkan referensi yang dapat dibuka di panel yang sama. Pengujian unit terbaru: 20 lulus; build TypeScript/produksi lulus.

### Indikator pelacak pada video

Saat pengguna melaporkan indikator 2/2 tidak muncul, indikator dipindahkan/ditambahkan langsung di pojok kanan atas pratinjau. Nilai di overlay bersumber langsung dari jumlah landmark MediaPipe pada frame terkini, terpisah dari tahap classifier. Tidak ada angka tangan yang disimulasikan atau dipaksa menjadi dua. Unit test (20) dan build tetap lulus; uji browser khusus memeriksa hitungan 2/2 pada aliran foto dua tangan dan 0/2 setelah stop. Ini pemeriksaan tampilan/alur, belum diagnosis penyebab pelacakan gagal pada webcam pengguna.

### Konfirmasi 1/2 dan pemulihan deteksi (v0.3.1)

Pengguna kemudian mengonfirmasi indikator **1/2 tangan**. Ini adalah bukti kehilangan tangan di tahap pelacakan, sehingga kalibrasi/pengenalan A belum dapat dijalankan dengan lengkap. Ditambahkan `TwoHandTracker`: setiap frame dibekukan sekali, tracker VIDEO dijalankan, dan bila kurang dari dua tangan dilakukan pencarian IMAGE baru serta pencarian pada salinan bercermin. Koordinat bercermin dipulihkan sebelum klasifikasi. Hasil antarlintasan dideduplikasi; tidak ada tangan yang dibuat dari koordinat lama atau dipaksa menjadi dua.

Pencarian cadangan berkala 300 ms saat kehilangan tangan; setelah berhasil menemukan dua, setiap frame baru diperiksa selama diperlukan agar tidak bergantung pada landmark kedaluwarsa. Ambang kandidat deteksi telapak pada pencarian cadangan 0,35; ambang kehadiran landmark tetap 0,5. Ambang klasifikasi huruf tidak diubah. Layar melaporkan ketersediaan pencarian cadangan. Kedua graph dan canvas dibersihkan saat stop. Biaya CPU/memori lebih besar, terutama ketika satu tangan hilang.

Diagnostik 22 foto sulit (termasuk satu salinan duplikat) menemukan dua tangan pada 4 foto dengan VIDEO primer dan 10 foto setelah pencarian tambahan; tiga foto berubah dari nol ke satu tangan. Ini set diagnostik terpilih, **bukan angka akurasi umum**. Banyak foto S/X/Y masih tidak lengkap. Contoh A yang sebelumnya terdeteksi satu pada ekstraksi IMAGE justru sudah terdeteksi dua pada VIDEO primer; hasil tersebut tidak boleh dianggap bukti keberhasilan pemulihan A. Bukti langsung pemulihan: foto H menghasilkan primer=1, akhir=2, recovered=true. Laporan mentah: `ml/evaluation/tracker-recovery.json`.

24 unit test lulus. Suite browser 14 pengujian lulus, diikuti uji tambahan H dan pengulangan tiga kasus pelacakan (frame kosong, C satu tangan, H pemulihan) yang semuanya lulus. TypeScript/build lulus. Kegagalan pada webcam pengguna belum dinyatakan selesai sampai percobaan langsung berikutnya.
