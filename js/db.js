// ============================================================
// DB — layer Supabase TERAS MBUN (semua via skema terasmbun)
// Read menu/pesanan langsung; nulis lewat RPC (total dihitung
// server-side, ubah status wajib PIN).
// ============================================================
const TmDb = (function () {
  "use strict";

  const supa = supabase.createClient(TM_SUPABASE_URL, TM_SUPABASE_ANON_KEY);
  const T = TM_SCHEMA + "."; // prefix tabel

  // pesan error ramah dari RPC
  function pesanRamah(err) {
    const m = String((err && err.message) || "");
    if (m.includes("nama_kosong")) return "Isi nama dulu ya.";
    if (m.includes("keranjang_kosong")) return "Keranjang masih kosong.";
    if (m.includes("menu_tidak_tersedia")) return "Ada menu yang lagi gak tersedia.";
    if (m.includes("Failed to fetch")) return "Koneksi lagi mati. Coba lagi nanti.";
    return m ? "Gagal: " + m : "Ada yang salah nih.";
  }

  return {
    supa,
    pesanRamah,

    // ── baca ──
    async muatMenu() {
      const { data, error } = await supa
        .from(T + "menu")
        .select("id,nama,harga,kategori,urutan")
        .order("urutan", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async muatPesanan(hariIni) {
      let q = supa.from(T + "pesanan").select("*").order("created_at", { ascending: false }).limit(100);
      if (hariIni) q = q.gte("created_at", new Date().toISOString().slice(0, 10));
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    async cariPesanan(kode) {
      const { data, error } = await supa
        .from(T + "pesanan")
        .select("*")
        .eq("kode", String(kode || "").trim())
        .maybeSingle();
      if (error) throw error;
      return data; // null kalau gak ketemu
    },

    async infoWarung() {
      const { data, error } = await supa.rpc(T + "info_warung");
      if (error) throw error;
      return data || { wa_penjual: "" };
    },

    // ── nulis (RPC, wajib validasi server-side) ──
    // items: [{id, qty}] — total dihitung ulang oleh Postgres
    async kirimPesanan({ nama, wa, catatan, items }) {
      const { data, error } = await supa.rpc(T + "buat_pesanan", {
        p_nama: nama || "",
        p_wa: wa || "",
        p_catatan: catatan || "",
        p_items: items,
      });
      if (error) throw error;
      return data; // {id, kode, total}
    },

    async cekPin(pin) {
      const { data, error } = await supa.rpc(T + "cek_pin", { p_pin: String(pin || "") });
      if (error) throw error;
      return !!data;
    },

    async ubahStatus(id, status, pin) {
      const { data, error } = await supa.rpc(T + "ubah_status", {
        p_id: id, p_status: status, p_pin: String(pin || ""),
      });
      if (error) throw error;
      return !!data;
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
