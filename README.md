# TERAS MBUN — Web Pesenan

Web pesenan buat jualan makanan, biar gak pusing nerima pesenan lewat WA.
Customer pilih menu + kirim pesenan tanpa login; admin dapur buka `dapur.html`,
masuk PIN, ceklis status pesenan (`menunggu → dibuat → siap`).

Stack: **vanilla HTML/CSS/JS, tanpa framework, tanpa build step.**
Backend: **Supabase** (project e-learniz-v3, skema terpisah `terasmbun`).
Deploy: **GitHub Pages** (`terasmbun.github.io`).

## Struktur

```
index.html            # sisi customer: menu, keranjang, kirim pesenan, cek status
dapur.html            # sisi admin dapur: gate PIN, daftar realtime, ceklis status
css/style.css         # design system (palet hangat coklat-krem-hijau)
js/config.js          # URL + anon key Supabase (publik, aman)
js/db.js              # layer DB: baca langsung, nulis via RPC
js/menu.js            # logic sisi customer
js/dapur.js           # logic sisi dapur
js/toast.js           # toast bawaan (pola osistarpanone)
js/notice.js          # pill nempel (live / error)
js/show-popup.js      # modal pengganti alert()
sw.js                 # service worker PWA
manifest.webmanifest
db/001-terasmbun.sql  # migrasi (sudah ke-apply di Supabase)
```

## Jalanin lokal

Gak ada npm/build. Dari root repo:

```
python -m http.server 8000
```

buka `http://localhost:8000`.

## Hal penting soal database

Semua benda di skema `terasmbun` (project Supabase e-learniz-v3).
Migrasi lengkap ada di `db/001-terasmbun.sql`.

- **Menu** (`terasmbun.menu`): anon cuma bisa SELECT. Ubah menu lewat SQL Editor:
  ```sql
  insert into terasmbun.menu (nama, harga, kategori, urutan)
  values ('Ayam Bakar Madu', 20000, 'nasi', 9);
  ```
- **Pesanan** (`terasmbun.pesanan`): insert **hanya lewat RPC** `buat_pesanan`
  (total dihitung server-side dari harga menu, jadi gak bisa dimanipulasi browser).
  Ubah status **hanya lewat RPC** `ubah_status` yang wajib PIN.
- **Setting** (`terasmbun.setting`): tertutup rapat buat anon. Isinya hash PIN + no WA.

### Ganti PIN dapur

PIN default: **1234**. Ganti sekarang juga di SQL Editor:

```sql
update terasmbun.setting
set value = encode(digest('PIN_BARU_LO', 'sha256'), 'hex')
where key = 'pin_dapur';
```

### Isi nomor WA penjual (buat tombol share)

```sql
update terasmbun.setting
set value = '628xxxxxxxxxx'   -- format internasional tanpa +
where key = 'wa_penjual';
```

## Alur pemakaian

1. Customer buka `index.html` → pilih menu → keranjang → isi nama → kirim.
2. Dapet kode pesenan (mis. `#007`) + opsi share ke WA penjual.
3. Admin buka `dapur.html` → PIN → lihat daftar (realtime, ke-update sendiri).
4. Ceklis: **Mulai masak** (`menunggu → dibuat`) → **Beres** (`dibuat → siap`).
5. Customer cek status di `index.html` pakai kodenya (juga realtime).

## Catatan jujur

- Tanpa login, siapa pun yang tau URL bisa **lihat** daftar pesenan. Risiko
  wajar skala warung — ngubah status tetap dikunci PIN.
- Kalau nanti mau lebih ketat (nomor WA disembunyikan, dsb), tinggal tambah
  filter di policy RLS.
