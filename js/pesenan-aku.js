// ============================================================
// pesenan-aku.js — halaman PESENAN AKU (setelah kirim pesanan).
// Baca kode dari ?kode= (atau snapshot di sessionStorage), tampilin
// detail: status dapur (live), rincian item, info kirim/bayar,
// plus foto QRIS kalo pilih bayar QRIS.
// ============================================================

const PesenanAku = (function () {
  "use strict";

  let pesanan = null;     // baris pesanan (atau snapshot sementara)
  let waPenjual = "";
  let fotoQris = "";
  let kode = "";

  const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const jam = (iso) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const tanggal = (iso) => new Date(iso).toLocaleString("id-ID",
    { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  // label status → ikon + teks + warna (class dipasang di patchStatus)
  const STATUS = {
    menunggu: { ikon: "fa-solid fa-hourglass-half", teks: "Menunggu dapur", kelas: "s-menunggu" },
    dibuat:   { ikon: "fa-solid fa-fire-burner",    teks: "Lagi dibuat",     kelas: "s-dibuat" },
    siap:     { ikon: "fa-solid fa-check",          teks: "Siap!",           kelas: "s-siap" },
  };

  // teks jadwal kirim yang enak dibaca
  function teksJadwal(p) {
    if (p.kapan === "besok") {
      const b = new Date(p.created_at);
      b.setDate(b.getDate() + 1);
      return "Besok, " + b.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
    }
    if (p.kapan === "custom" && p.waktu_teks) return p.waktu_teks; // teks bebas user
    return "Sekarang";
  }

  // ── render ──
  function tampilkan(p) {
    pesanan = p;
    document.getElementById("akuMuat").hidden = true;
    document.getElementById("akuKosong").hidden = true;
    document.getElementById("akuDetail").hidden = false;
    document.getElementById("akuAksi").hidden = false;

    const items = Array.isArray(p.items) ? p.items : [];

    document.getElementById("dKode").textContent = p.kode || "—";
    document.getElementById("dSapa").textContent =
      `Makasih udah pesen, ${p.nama || "Kak"}! Simpen kode ini ya 🙌`;
    document.getElementById("dTotal").textContent = rupiah(p.total);

    // rincian item
    const ongkirBaris = Number(p.ongkir || 0) > 0
      ? `<li><span>Ongkir COD <b class="lvl-item">gak fix</b></span><b>+${rupiah(p.ongkir)}</b></li>` : "";
    document.getElementById("dItems").innerHTML = items.map((i) =>
      `<li><span>${esc(i.nama || "Menu")} ${esc(i.qty || 1)}x${i.level > 0 ? ` <b class="lvl-item">🌶️${esc(i.level)}</b>` : ""}</span><b>${rupiah((i.harga || 0) * (i.qty || 1))}</b></li>`
    ).join("") + ongkirBaris || '<li>Belum ada rincian.</li>';

    // info pesenan
    const baris = [];
    baris.push(['fa-regular fa-clock', "Dibuat", tanggal(p.created_at)]);
    baris.push(['fa-regular fa-calendar', "Diantar kapan", teksJadwal(p)]);
    baris.push([p.metode_ambil === "cod" ? "fa-solid fa-motorcycle" : "fa-solid fa-store",
      p.metode_ambil === "cod" ? "Diantar" : "Ambil di toko",
      p.metode_ambil === "cod" ? (p.alamat || "—") : "Teras Mbun"]);
    if (p.metode_bayar) {
      baris.push([p.metode_bayar === "qris" ? "fa-solid fa-qrcode" : "fa-solid fa-money-bill-wave",
        "Bayar", p.metode_bayar === "qris" ? "QRIS" : "Tunai"]);
    }
    const ongkirAda = Number(p.ongkir || 0) > 0;
    if (ongkirAda) baris.push(["fa-solid fa-truck", "Ongkir*", `+${rupiah(p.ongkir)} (gak fix)`]);
    document.getElementById("dInfo").innerHTML = baris.map(([ikon, label, nilai]) => `
      <div class="aku-baris"><i class="${ikon}"></i>
        <span class="lbl">${esc(label)}</span>
        <span class="val">${esc(nilai)}</span>
      </div>`).join("") +
      (ongkirAda
        ? `<p class="catatan-ongkir kecil"><i class="fa-solid fa-circle-info"></i>
             *Ongkir <b>gak fix</b> — Rp${Number(p.ongkir).toLocaleString("id-ID")} cuma awal,
             bisa berubah tergantung makin deket / makin jauh.</p>`
        : "");

    patchStatus(p);

    // QRIS: tampilin kalo pilih bayar QRIS
    const qris = p.metode_bayar === "qris";
    document.getElementById("qrisBayar").hidden = !qris;
    if (qris) {
      document.getElementById("qrisTotal").textContent = `Total bayar: ${rupiah(p.total)}`;
      const kotak = document.getElementById("qrisFoto");
      if (fotoQris) {
        kotak.innerHTML = `<img src="${esc(fotoQris)}" alt="QRIS Teras Mbun" loading="lazy">`;
        document.getElementById("qrisCatatan").textContent =
          "Scan pakai aplikasi apa aja, nominal sesuai total. Abis bayar, kabari penjual ya.";
      } else {
        kotak.innerHTML = "";
        document.getElementById("qrisCatatan").textContent =
          "QRIS-nya lagi disiapin — kabari penjual langsung ya.";
      }
      document.getElementById("btnBuktiWa").hidden = !waPenjual;
    }
  }

  // patch SEKARANG doang (pill status + langkah) tanpa render ulang
  // detail — biar gak ada gambar/list yang kedip pas update realtime
  function patchStatus(p) {
    const s = STATUS[p.status] || STATUS.menunggu;
    const pill = document.getElementById("dStatus");
    pill.className = "aku-status " + s.kelas;
    pill.innerHTML = `<i class="${s.ikon}"></i> ${s.teks}`;

    // langkah: yang udah kelewat dapet class "lewat", yang aktif "aktif"
    const urut = ["menunggu", "dibuat", "siap"];
    const kini = urut.indexOf(p.status);
    document.querySelectorAll("#dLangkah li").forEach((li, ix) => {
      li.classList.toggle("lewat", ix < kini);
      li.classList.toggle("aktif", ix === kini);
    });
  }

  // ── share WA ──
  function teksWa() {
    const p = pesanan;
    const items = (Array.isArray(p.items) ? p.items : [])
      .map((i) => `• ${i.nama} ${i.qty}x${i.level > 0 ? ` (Pedas Lv${i.level})` : ""}`).join("%0A");
    const ambilTeks = p.metode_ambil === "cod" ? "Diantar (COD)" : "Ambil di toko";
    const bayarTeks = p.metode_bayar === "qris" ? "QRIS" : "Tunai";
    return `Halo, mau pesen di Teras Mbun.%0A` +
      `Kode: *${p.kode}*%0A${items}%0ATotal: ${rupiah(p.total)}` +
      `%0ATerima: ${ambilTeks}` + (p.alamat ? `%0AAlamat: ${p.alamat}` : "") +
      `%0ADiantar: ${teksJadwal(p)}%0ABayar: ${bayarTeks}`;
  }

  // ── muat ──
  async function muat(diam) {
    try {
      const p = await TmDb.muatPesananByKode(kode);
      if (p) tampilkan(p);
      else if (!diam) tampilkanGakKetemu();
    } catch (err) {
      // offline / jaringan mati: snapshot lokal masih bisa dipake
      if (pesanan) return;
      if (!diam) {
        document.getElementById("akuMuat").hidden = true;
        document.getElementById("akuKosong").hidden = false;
        showToast(TmDb.pesanRamah(err), "error");
      }
    }
  }

  function tampilkanGakKetemu() {
    document.getElementById("akuMuat").hidden = true;
    document.getElementById("akuDetail").hidden = true;
    document.getElementById("qrisBayar").hidden = true;
    document.getElementById("akuAksi").hidden = true;
    document.getElementById("akuKosong").hidden = false;
  }

  async function mulai() {
    // kode dari URL; kalo gak ada, ambil snapshot terakhir
    kode = new URLSearchParams(location.search).get("kode") || "";
    let snap = null;
    try { snap = JSON.parse(sessionStorage.getItem("tm_pesenan_aku") || "null"); } catch (e) { /* snap rusak — abaikan */ }

    if (!kode && snap) kode = snap.kode || "";
    if (!kode) { tampilkanGakKetemu(); return; }

    // gambar dari snapshot dulu (langsung keliatan), nanti ditimpa data asli
    if (snap && snap.kode === kode) tampilkan(snap);
    await muat(!snap); // diam kalo snapshot udah nampil (jaringan mati bukan masalah)

    // tombol aksi
    document.getElementById("btnWa").addEventListener("click", () => {
      if (!waPenjual) { showToast("Nomor penjual belum diisi.", "info"); return; }
      window.open(`https://wa.me/${waPenjual}?text=${teksWa()}`, "_blank");
    });
    document.getElementById("btnBuktiWa").addEventListener("click", () => {
      const teks = `Halo, udah bayar QRIS pesenan #${pesanan.kode} total ${rupiah(pesanan.total)} ya. Ini buktinya 🙏`;
      window.open(`https://wa.me/${waPenjual}?text=${encodeURIComponent(teks)}`, "_blank");
    });

    // info warung: bg + foto QRIS + nomor WA
    try {
      const info = await TmDb.infoWarung();
      waPenjual = info.wa_penjual || "";
      fotoQris = info.qris || "";
      TmDb.terapkanBg(info.bg || "");
      if (pesanan && pesanan.metode_bayar === "qris" && fotoQris) tampilkan(pesanan);
    } catch (e) { /* QRIS/WA jadi fallback teks kalo gagal */ }

    // live: status di-patch doang (gak render ulang detail)
    TmDb.subscribe(async () => {
      try {
        const p = await TmDb.muatPesananByKode(kode);
        if (!p) return;
        if (pesanan && pesanan.status !== p.status) patchStatus(p); // patch ringan
        else if (!pesanan) tampilkan(p);
        pesanan = p;
      } catch (e) { /* realtime putus — tampilan lama tetap */ }
    });
  }

  document.addEventListener("DOMContentLoaded", mulai);
  return {};
})();
