// ============================================================
// menu.js — sisi CUSTOMER: lihat menu, keranjang, kirim pesenan,
// cek status pakai kode. Tanpa login.
// ============================================================

const Menu = (function () {
  "use strict";

  let daftar = [];          // isi tabel menu
  let waPenjual = "";       // dari setting DB (tombol share WA)

  // ── keranjang (localStorage, awet kalau ke-refresh) ──
  const Keranjang = {
    items: [], // [{id, nama, harga, qty}]

    muat() {
      try { this.items = JSON.parse(localStorage.getItem(TM_KERANJANG_KEY)) || []; }
      catch (e) { this.items = []; }
    },
    simpan() { localStorage.setItem(TM_KERANJANG_KEY, JSON.stringify(this.items)); },
    jumlah() { return this.items.reduce((s, i) => s + i.qty, 0); },
    total() { return this.items.reduce((s, i) => s + i.qty * i.harga, 0); },
    ada(id) { return this.items.find((i) => i.id === id); },
    tambah(m) {
      const k = this.ada(m.id);
      if (k) k.qty = Math.min(50, k.qty + 1);
      else this.items.push({ id: m.id, nama: m.nama, harga: m.harga, qty: 1 });
      this.simpan();
    },
    kurang(id) {
      const k = this.ada(id);
      if (!k) return;
      k.qty -= 1;
      if (k.qty <= 0) this.items = this.items.filter((i) => i.id !== id);
      this.simpan();
    },
    kosongkan() { this.items = []; this.simpan(); },
  };

  // ── util ──
  const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ── render ──
  // showcase: kartu (nama, harga, deskripsi) + foto di bawahnya
  function renderTampil() {
    const box = document.getElementById("menuTampil");
    if (!daftar.length) {
      box.innerHTML = '<p class="kosong">Belum ada menu nih.</p>';
      return;
    }
    box.innerHTML = daftar.map((m, ix) => {
      const adaFoto = !!m.gambar;
      return `<div class="tampil-blok" style="animation-delay:${ix * 40}ms">
        <div class="tampil-info">
          <span class="kat">${esc(m.kategori)}</span>
          <div class="baris-atas">
            <span class="nama">${esc(m.nama)}</span>
            <span class="harga">${rupiah(m.harga)}</span>
          </div>
          ${m.deskripsi ? `<p class="deskripsi">${esc(m.deskripsi)}</p>` : ""}
        </div>
        <div class="tampil-foto ${adaFoto ? "" : "kosong-foto"}">
          ${adaFoto
            ? `<img src="${esc(m.gambar)}" alt="${esc(m.nama)}" loading="lazy"
                    onerror="this.closest('.tampil-foto').classList.add('kosong-foto'); this.remove();">`
            : ""}
          <span class="foto-emoji">${emojiKategori(m.kategori)}</span>
        </div>
      </div>`;
    }).join("");
  }

  // emoji placeholder kalo foto menu belum ada
  function emojiKategori(kat) {
    const peta = { nasi: "🍚", minuman: "🥤", lauk: "🍗", lauk_pauk: "🍗", snack: "🍘" };
    return peta[String(kat || "").toLowerCase()] || "🍽️";
  }

  // pesenan: daftar polos — nama + harga + tombol +/−
  function renderMenu() {
    const grid = document.getElementById("gridMenu");
    if (!daftar.length) {
      grid.innerHTML = '<p class="kosong">Belum ada menu nih.</p>';
      return;
    }
    // daftar polos: nama + harga + tombol +/−, tanpa judul/chips/foto
    grid.innerHTML = daftar.map((m, ix) => {
      const k = Keranjang.ada(m.id);
      return `<div class="menu-baris" style="animation-delay:${ix * 30}ms">
        <div class="info">
          <span class="nama">${esc(m.nama)}</span>
          <span class="harga">${rupiah(m.harga)}</span>
        </div>
        <div class="aksi">
          <button class="qty-btn" data-kurang="${m.id}" ${k ? "" : "disabled"} aria-label="Kurangi ${esc(m.nama)}">−</button>
          <span class="qty-num">${k ? k.qty : 0}</span>
          <button class="qty-btn" data-tambah="${m.id}" aria-label="Tambah ${esc(m.nama)}">+</button>
        </div>
      </div>`;
    }).join("");
  }

  function renderBar() {
    const bar = document.getElementById("barBawah");
    const jml = Keranjang.jumlah();
    bar.hidden = jml === 0;
    document.getElementById("barJml").textContent = jml + " item";
    document.getElementById("barTotal").textContent = rupiah(Keranjang.total());
  }

  function renderSemua() { renderTampil(); renderMenu(); renderBar(); }

  // ── alur pesen ──
  async function alurPesan() {
    if (!Keranjang.jumlah()) { showToast("Keranjang masih kosong.", "info"); return; }

    const isi = await showPopup("Data pemesan", "form", {
      title: " Data Pesenan",
      fields: [
        { name: "nama", label: "Nama kamu *", type: "text", placeholder: "mis. Budi" },
        { name: "wa", label: "No. WA (opsional, buat dikabarin)", type: "tel", placeholder: "08xxxxxxxxxx" },
        { name: "catatan", label: "Catatan (opsional)", type: "textarea", placeholder: "mis. gak pedas, sambel dipisah" },
      ],
    });
    if (!isi) return;
    if (!String(isi.nama || "").trim()) { showToast("Isi nama dulu ya.", "error"); return; }

    try {
      // snapshot item dulu sebelum keranjang dibersihin (buat teks WA)
      const ringkas = Keranjang.items.map((i) => `• ${i.nama} ${i.qty}x`).join("%0A");
      const res = await TmDb.kirimPesanan({
        nama: isi.nama, wa: isi.wa, catatan: isi.catatan,
        items: Keranjang.items.map((i) => ({ id: i.id, qty: i.qty })),
      });
      Keranjang.kosongkan();
      renderSemua();
      suksesPesen(res, ringkas);
    } catch (err) {
      showToast(TmDb.pesanRamah(err), "error");
    }
  }

  function suksesPesen(res, ringkas) {
    showPopup(
      `Kode pesenanmu: <b>#${esc(res.kode)}</b><br>Total: <b>${rupiah(res.total)}</b><br><br>
       Simpen kode ini buat cek status.`, "success"
    );
    // kasih opsi share ke WA penjual sekalian (biar penjual cepet tau)
    setTimeout(async () => {
      if (!waPenjual) return; // nomor belum diisi di DB, jangan ganggu
      const lanjut = await showPopup("Bagiin pesenan ini ke WhatsApp penjual?", "confirm");
      if (lanjut) {
        const teks = `Halo, mau pesen di Teras Mbun.%0A` +
          `Kode: *${res.kode}*%0A${ringkas}%0ATotal: ${rupiah(res.total)}`;
        window.open(`https://wa.me/${waPenjual}?text=${teks}`, "_blank");
      }
    }, 400);
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

  function renderHasilStatus(box, p) {
    const label = { menunggu: "Menunggu — antrian dapur", dibuat: "Lagi dimasak 👨‍🍳", siap: "Siap! Tinggal diambil ✅" };
    const ikon = { menunggu: "fa-clock", dibuat: "fa-fire-burner", siap: "fa-circle-check" };
    const items = Array.isArray(p.items) ? p.items : [];
    box.className = "hasil-status tampil";
    box.innerHTML = `
      <span class="pill-status st-${esc(p.status)}"><i class="fa-solid ${ikon[p.status] || "fa-circle-info"}"></i> ${label[p.status] || esc(p.status)}</span>
      <ul class="daftar-item">
        ${items.map((i) => `<li>• ${esc(i.nama || "Menu")} ${esc(i.qty || 1)}x</li>`).join("")}
        <li><b>Total: ${rupiah(p.total)}</b></li>
      </ul>`;
  }

  // ── daftar section di dropdown titik tiga ──
  // Nambah section baru: tambah entri di sini + bikin <section id="..."> di index.html
  const NAV_SECTIONS = [
    { id: "greeting", label: "Beranda", icon: "fa-house" },
    { id: "daftar", label: "Lihat Menu", icon: "fa-utensils" },
    { id: "menu", label: "Pesan", icon: "fa-cart-shopping" },
    { id: "cekStatus", label: "Cek Status Pesenan", icon: "fa-magnifying-glass" },
  ];

  function pasangDropdown() {
    const btn = document.getElementById("btnNavMenu");
    const panel = document.getElementById("navPanel");
    if (!btn || !panel) return;

    // render link dari NAV_SECTIONS
    panel.innerHTML = NAV_SECTIONS
      .map((s) => `<a href="#${esc(s.id)}"><i class="fa-solid ${esc(s.icon)}"></i> ${esc(s.label)}</a>`)
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

    // klik link → smooth scroll + tutup panel
    panel.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      e.preventDefault();
      const href = a.getAttribute("href");
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
    Keranjang.muat();
    renderSemua();

    // klik +/- menu
    document.getElementById("gridMenu").addEventListener("click", (e) => {
      const t = e.target.closest("[data-tambah]");
      const k = e.target.closest("[data-kurang]");
      if (t) {
        const m = daftar.find((x) => x.id === Number(t.dataset.tambah));
        if (m) { Keranjang.tambah(m); renderSemua(); }
      } else if (k) {
        Keranjang.kurang(Number(k.dataset.kurang));
        renderSemua();
      }
    });

    document.getElementById("btnPesan").addEventListener("click", alurPesan);

    // dropdown navigasi titik tiga
    pasangDropdown();

    // tombol di greeting: lompat ke menu / ke cek status
    document.getElementById("btnPesanSekarang").addEventListener("click", () => {
      document.getElementById("daftar").scrollIntoView({ behavior: "smooth" });
    });
    document.getElementById("btnLihatStatus").addEventListener("click", () => {
      const el = document.getElementById("cekStatus");
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => document.getElementById("inputKode").focus(), 500);
    });

    document.getElementById("btnCek").addEventListener("click", () => cekStatus(document.getElementById("inputKode").value));
    document.getElementById("inputKode").addEventListener("keydown", (e) => {
      if (e.key === "Enter") cekStatus(e.target.value);
    });

    // muat menu + info warung (nomor WA penjual)
    try {
      daftar = await TmDb.muatMenu();
      renderSemua();
    } catch (err) {
      document.getElementById("gridMenu").innerHTML = '<p class="kosong">Menu gagal dimuat. Coba refresh.</p>';
      showToast(TmDb.pesanRamah(err), "error");
    }
    try {
      const info = await TmDb.infoWarung();
      waPenjual = info.wa_penjual || "";
    } catch (e) { /* tombol WA jadi disembunyiin kalau gagal */ }

    // realtime: kalau lagi cek status, statusnya ke-update sendiri
    TmDb.subscribe(() => {
      const box = document.getElementById("hasilStatus");
      const kode = document.getElementById("inputKode").value.trim();
      if (!kode || !box.classList.contains("tampil")) return;
      TmDb.cariPesanan(kode).then((p) => { if (p) renderHasilStatus(box, p); }).catch(() => {});
    });
  }

  document.addEventListener("DOMContentLoaded", mulai);
  return { Keranjang };
})();
