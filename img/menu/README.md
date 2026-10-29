# img/menu/

Foto per menu, satu file per menu. Dianjurkan:
- Rasio **16:10** (lebar), mis. 1200×750 px — pas sama kotaknya.
- Nama file gampang dikenali, mis. `ayam-penyet.jpg`, `es-teh.jpg`.

Isi kolom `gambar` di Supabase (SQL Editor):

```sql
update terasmbun.menu set gambar = 'img/menu/ayam-penyet.jpg' where id = 1;
```

Belum ada foto? Gak masalah — otomatis tampil placeholder
(gradient coklat + emoji kategori) di web.
