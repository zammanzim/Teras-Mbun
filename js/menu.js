// ============================================================
// menu.js — sisi CUSTOMER (index): showcase menu + cek status
// pakai kode. Pesenan PINDAH ke pesen.html (js/pesen.js).
// ============================================================

const Menu = (function () {
  "use strict";

  let daftar = [];          // isi tabel menu

  // ── util ──
  const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ── render ──
  // grouping: menu dikelompokin per kategori — maks 3 tampil,
  // sisanya lewat tombol "▼ liat menu lain" di bawah grup
  const MAKS_TAMPIL = 3;
  const bukaTampil = new Set(); // kategori showcase yang lagi dibuka

  function kelompokkan() {
    const peta = new Map();
    daftar.forEach((m) => {
      const k = m.kategori || "lain";
      if (!peta.has(k)) peta.set(k, []);
      peta.get(k).push(m);
    });
    return [...peta.entries()].map(([kat, items]) => ({ kat, items }));
  }

  const labelKat = (k) => String(k || "lain").replace(/_/g, " ");

  // tombol "liat menu lain" (muncul kalo kategori lebih dari MAKS_TAMPIL)
  const tombolLain = (sisa) => `
    <button class="btn-lain" type="button" data-buka>
      <span class="lbl-buka"><i class="fa-solid fa-arrow-down"></i> Lihat menu lain (${sisa} lagi)</span>
      <span class="lbl-tutup"><i class="fa-solid fa-arrow-up"></i> Sembunyikan</span>
    </button>`;

  // showcase: foto di atas, judul+deskripsi di bawahnya — per kategori
  function renderTampil() {
    const box = document.getElementById("menuTampil");
    if (!daftar.length) {
      box.innerHTML = '<p class="kosong">Belum ada menu nih.</p>';
      return;
    }
    box.innerHTML = kelompokkan().map((g) => `
      <div class="menu-grup ${bukaTampil.has(g.kat) ? "buka" : ""}" data-kat="${esc(g.kat)}">
        <div class="kat-judul"><span class="ikon">${emojiKategori(g.kat)}</span><span class="label">${esc(labelKat(g.kat))}</span></div>
        ${g.items.map((m, ix) => blokTampil(m, ix)).join("")}
        ${g.items.length > MAKS_TAMPIL ? tombolLain(g.items.length - MAKS_TAMPIL) : ""}
      </div>`).join("");
  }

  function blokTampil(m, ix) {
    const adaFoto = !!m.gambar;
    return `<div class="tampil-blok${ix >= MAKS_TAMPIL ? " lebih" : ""}" style="animation-delay:${ix * 40}ms">
      <div class="tampil-foto ${adaFoto ? "" : "kosong-foto"}">
        ${adaFoto
          ? `<img src="${esc(m.gambar)}" alt="${esc(m.nama)}" loading="lazy"
                  onerror="this.closest('.tampil-foto').classList.add('kosong-foto'); this.remove();">`
          : ""}
        <span class="foto-emoji">${emojiKategori(m.kategori)}</span>
      </div>
      <div class="tampil-info">
        <div class="baris-atas">
          <span class="nama">${esc(m.nama)}</span>
          <span class="harga">${rupiah(m.harga)}</span>
        </div>
        ${m.deskripsi ? `<p class="deskripsi">${esc(m.deskripsi)}</p>` : ""}
      </div>
    </div>`;
  }

  // emoji placeholder kalo foto menu belum ada
  function emojiKategori(kat) {
    const peta = { nasi: "🍚", minuman: "🥤", lauk: "🍗", lauk_pauk: "🍗", snack: "🍘" };
    return peta[String(kat || "").toLowerCase()] || "🍽️";
  }

  // ── cek status ──
  async function cekStatus(kode) {
    const box = document.getElementById("hasilStatus");
    kode = String(kode || "").trim();
    if (!kode) { showToast("Isi kode pesenan dulu.", "info"); return; }
    try {
      const p = await TmDb.cariPesanan(kode);
      if (!p) {
        box.className = "hasil-status tampil";
        box.innerHTML = `<p>Kode <b>${esc(kode)}</b> gak ketemu. Cek lagi ya.</p>`;
        return;
      }
      renderHasilStatus(box, p);
    } catch (err) {
      showToast(TmDb.pesanRamah(err), "error");
    }
  }

  const LABEL_STATUS = { menunggu: "Menunggu — antrian dapur", dibuat: "Lagi dimasak 👨‍🍳", siap: "Siap! Tinggal diambil ✅" };
  const IKON_STATUS = { menunggu: "fa-clock", dibuat: "fa-fire-burner", siap: "fa-circle-check" };

  function renderHasilStatus(box, p) {
    const items = Array.isArray(p.items) ? p.items : [];
    // level nempel per item; baris global cuma buat data lama
    const adaLevelItem = items.some((i) => i.level > 0);
    const lvl = (!adaLevelItem && p.level_pedas > 0)
      ? `<li>🌶️ Level pedas: <b>${esc(p.level_pedas)}</b></li>` : "";
    const ambil = p.metode_ambil
      ? `<li>${p.metode_ambil === "cod" ? "🛵 Diantar ke rumah" : "🏪 Ambil di toko"}</li>` : "";
    const bayar = p.metode_bayar ? `<li>💳 Bayar: <b>${p.metode_bayar === "qris" ? "QRIS" : "Tunai"}</b></li>` : "";
    box.className = "hasil-status tampil";
    box.innerHTML = `
      <span class="pill-status st-${esc(p.status)}"><i class="fa-solid ${IKON_STATUS[p.status] || "fa-circle-info"}"></i> ${LABEL_STATUS[p.status] || esc(p.status)}</span>
      <ul class="daftar-item">
        ${items.map((i) => `<li>• ${esc(i.nama || "Menu")} ${esc(i.qty || 1)}x${i.level > 0 ? ` 🌶️<b>${esc(i.level)}</b>` : ""}</li>`).join("")}
        ${lvl}${ambil}${bayar}
        <li><b>Total: ${rupiah(p.total)}</b></li>
      </ul>`;
  }

  // ── daftar section di dropdown titik tiga ──
  // id = anchor di halaman ini; href = pindah halaman.
  const NAV_SECTIONS = [
    { id: "greeting", label: "Beranda", icon: "fa-house" },
    { id: "daftar", label: "Lihat Menu", icon: "fa-utensils" },
    { href: "pesen.html", label: "Pesan", icon: "fa-cart-shopping" },
    { id: "cekStatus", label: "Cek Status Pesenan", icon: "fa-magnifying-glass" },
  ];

  function pasangDropdown() {
    const btn = document.getElementById("btnNavMenu");
    const panel = document.getElementById("navPanel");
    if (!btn || !panel) return;

    // render link dari NAV_SECTIONS
    panel.innerHTML = NAV_SECTIONS
      .map((s) => `<a href="${esc(s.href || "#" + s.id)}"><i class="fa-solid ${esc(s.icon)}"></i> ${esc(s.label)}</a>`)
      .join("");

    const tutup = () => {
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    };

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const buka = panel.hidden;
      panel.hidden = !buka;
      btn.setAttribute("aria-expanded", String(buka));
    });

    // klik link → kalo anchor, smooth scroll; kalo halaman, biarin jalan
    panel.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (href && !href.startsWith("#")) { tutup(); return; } // pindah halaman
      e.preventDefault();
      if (href === "#greeting") {
        // Beranda: scroll ke paling atas beneran (0px).
        // scrollIntoView#greeting mentok di bawah header karena header ikut alur dokumen.
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const el = document.querySelector(href);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      tutup();
    });

    // klik di luar / ESC → tutup
    document.addEventListener("click", (e) => {
      if (!panel.hidden && !e.target.closest("#navDropdown")) tutup();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") tutup();
    });
  }

  // ── init ──
  async function mulai() {
    renderTampil();
    pasangDropdown();

    // klik "liat menu lain" di showcase (state disimpen biar gak nutup pas re-render)
    document.getElementById("menuTampil").addEventListener("click", (e) => {
      const l = e.target.closest("[data-buka]");
      if (!l) return;
      const grup = l.closest(".menu-grup");
      const buka = grup.classList.toggle("buka");
      const kat = grup.dataset.kat;
      if (buka) bukaTampil.add(kat); else bukaTampil.delete(kat);
    });

    // tombol di greeting: ke cek status
    document.getElementById("btnLihatStatus").addEventListener("click", () => {
      const el = document.getElementById("cekStatus");
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => document.getElementById("inputKode").focus(), 500);
    });

    document.getElementById("btnCek").addEventListener("click", () => cekStatus(document.getElementById("inputKode").value));
    document.getElementById("inputKode").addEventListener("keydown", (e) => {
      if (e.key === "Enter") cekStatus(e.target.value);
    });

    // muat menu
    try {
      daftar = await TmDb.muatMenu();
      renderTampil();
    } catch (err) {
      document.getElementById("menuTampil").innerHTML = '<p class="kosong">Menu gagal dimuat. Coba refresh.</p>';
      showToast(TmDb.pesanRamah(err), "error");
    }

    // foto latar dari setting (kosong = gradient hangat)
    try { TmDb.terapkanBg((await TmDb.infoWarung()).bg || ""); } catch (e) { /* latar default tetep jalan */ }

    // realtime: kalau lagi cek status, statusnya ke-update sendiri
    TmDb.subscribe(() => {
      const box = document.getElementById("hasilStatus");
      const kode = document.getElementById("inputKode").value.trim();
      if (!kode || !box.classList.contains("tampil")) return;
      TmDb.cariPesanan(kode).then((p) => { if (p) renderHasilStatus(box, p); }).catch(() => {});
    });
  }

  document.addEventListener("DOMContentLoaded", mulai);
  return {};
})();
