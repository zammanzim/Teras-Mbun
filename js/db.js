// ============================================================
// DB — layer Supabase TERAS MBUN (semua via skema terasmbun)
// Client-nya disetel `db.schema = terasmbun` SEKALI di createClient,
// jadi .from("menu") / .rpc("buat_pesanan") udah otomatis ke skema
// terasmbun — JANGAN di-prefix "terasmbun." manual (malah nyari
// tabel 'terasmbun.menu' di skema public → error).
// Read menu/pesanan langsung; nulis lewat RPC (total dihitung
// server-side, ubah status wajib PIN).
// ============================================================
const TmDb = (function () {
  "use strict";

  const supa = supabase.createClient(TM_SUPABASE_URL, TM_SUPABASE_ANON_KEY, {
    db: { schema: TM_SCHEMA }, // semua query ke skema terasmbun
  });

  // pesan error ramah dari RPC
  function pesanRamah(err) {
    const m = String((err && err.message) || "");
    if (m.includes("nama_kosong")) return "Isi nama dulu ya.";
    if (m.includes("keranjang_kosong")) return "Belum ada menu yang dipilih.";
    if (m.includes("menu_tidak_tersedia")) return "Ada menu yang lagi gak tersedia.";
    if (m.includes("ambil_kosong")) return "Pilih mau diantar atau ambil sendiri.";
    if (m.includes("alamat_kosong")) return "Isi alamatnya dulu (buat pesenan diantar).";
    if (m.includes("bayar_kosong")) return "Pilih mau bayar QRIS atau tunai.";
    if (m.includes("Failed to fetch")) return "Koneksi lagi mati. Coba lagi nanti.";
    return m ? "Gagal: " + m : "Ada yang salah nih.";
  }

  return {
    supa,
    pesanRamah,

    // ── baca ──
    async muatMenu() {
      const { data, error } = await supa
        .from("menu")
        .select("id,nama,harga,kategori,urutan,gambar,deskripsi")
        .order("urutan", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async muatPesanan(hariIni) {
      let q = supa.from("pesanan").select("*").order("created_at", { ascending: false }).limit(100);
      if (hariIni) q = q.gte("created_at", new Date().toISOString().slice(0, 10));
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    async cariPesanan(kode) {
      const { data, error } = await supa
        .from("pesanan")
        .select("*")
        .eq("kode", String(kode || "").trim())
        .maybeSingle();
      if (error) throw error;
      return data; // null kalau gak ketemu
    },

    async infoWarung() {
      const { data, error } = await supa.rpc("info_warung");
      if (error) throw error;
      return data || { wa_penjual: "" };
    },

    // ── nulis (RPC, wajib validasi server-side) ──
    // items: [{id, qty, level}] — level 0..5 per item (minuman dipaksa 0
    // server); total + level_pedas (tertinggi) dihitung ulang oleh Postgres
    // ambil: "cod" (diantar) | "ambil" (nyamperin ke toko)
    // bayar: "qris" | "tunai" — alamat wajib kalo ambil = "cod"
    async kirimPesanan({ nama, wa, catatan, items, level, ambil, alamat, bayar }) {
      const { data, error } = await supa.rpc("buat_pesanan", {
        p_nama: nama || "",
        p_wa: wa || "",
        p_catatan: catatan || "",
        p_items: items,
        p_level_pedas: Number(level || 0),
        p_ambil: ambil || "",
        p_alamat: alamat || "",
        p_bayar: bayar || "",
      });
      if (error) throw error;
      return data; // {id, kode, total}
    },

    async cekPin(pin) {
      const { data, error } = await supa.rpc("cek_pin", { p_pin: String(pin || "") });
      if (error) throw error;
      return !!data;
    },

    async ubahStatus(id, status, pin) {
      const { data, error } = await supa.rpc("ubah_status", {
        p_id: id, p_status: status, p_pin: String(pin || ""),
      });
      if (error) throw error;
      return !!data;
    },

    // ── foto menu (Supabase Storage, bucket terasmbun-media) ──
    // Kompres dulu di browser: sisi terpanjang dibatasi + dikirim sebagai
    // JPEG — foto dari HP biasanya 3-8MB, sesudah kompres tinggal ~100KB.
    async kompresFoto(file, sisiMaks = 1200, kualitas = 0.7) {
      const bitmap = await createImageBitmap(file); // EXIF rotasi dihormati browser
      const skala = Math.min(1, sisiMaks / Math.max(bitmap.width, bitmap.height));
      const lebar = Math.round(bitmap.width * skala);
      const tinggi = Math.round(bitmap.height * skala);
      const kanvas = document.createElement("canvas");
      kanvas.width = lebar;
      kanvas.height = tinggi;
      kanvas.getContext("2d").drawImage(bitmap, 0, 0, lebar, tinggi);
      if (bitmap.close) bitmap.close();
      const blob = await new Promise((res) => kanvas.toBlob(res, "image/jpeg", kualitas));
      if (!blob) throw new Error("gagal_kompres");
      return blob;
    },

    // Upload foto kompres ke bucket; nama file pakai stempel waktu biar
    // URL publiknya selalu baru (gak ketimpa cache browser/CDN).
    async uploadFotoMenu(idMenu, blob) {
      const nama = `menu-${idMenu}-${Date.now()}.jpg`;
      const { error } = await supa.storage.from(TM_BUCKET).upload(nama, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (error) throw error;
      return supa.storage.from(TM_BUCKET).getPublicUrl(nama).data.publicUrl;
    },

    // Simpan URL foto ke kolom menu.gambar — wajib PIN, URL divalidasi
    // server (harus dari bucket terasmbun-media).
    async ubahMenuGambar(idMenu, url, pin) {
      const { data, error } = await supa.rpc("ubah_menu_gambar", {
        p_id: idMenu, p_gambar: url || "", p_pin: String(pin || ""),
      });
      if (error) throw error;
      return !!data;
    },

    // Buang file lama di bucket (best-effort) biar gak numpuk —
    // cuma nyentuh file milik bucket ini, gak bakal nyentuh file lain.
    async hapusFotoLama(url) {
      const tanda = "/storage/v1/object/public/" + TM_BUCKET + "/";
      const i = String(url || "").indexOf(tanda);
      if (i < 0) return; // URL di luar bucket kita — biarin
      const nama = decodeURIComponent(url.slice(i + tanda.length).split("?")[0]);
      await supa.storage.from(TM_BUCKET).remove([nama]);
    },

    // ── realtime (update daftar dapur / status customer) ──
    // panggil cb() tiap ada perubahan di tabel pesanan
    subscribe(cb) {
      const ch = supa.channel("tm-pesanan");
      ch.on("postgres_changes", { event: "*", schema: TM_SCHEMA, table: "pesanan" }, cb);
      ch.subscribe((st) => {
        if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") {
          // biar gak sunyi: tandai offline lewat pill, list lama tetap tampil
          if (window.Notice) Notice.show("live", "Live putus — tarik ulang manual", { icon: "fa-solid fa-triangle-exclamation", type: "red" });
        }
      });
      return ch;
    },
  };
})();
