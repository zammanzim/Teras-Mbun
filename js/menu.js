// ============================================================
// menu.js — sisi CUSTOMER: lihat menu, keranjang, kirim pesenan,
// cek status pakai kode. Tanpa login.
// ============================================================

const Menu = (function () {
  "use strict";

  let daftar = [];          // isi tabel menu
  let kategoriAktif = "semua";
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
  function renderChips() {
    const kats = ["semua", ...new Set(daftar.map((m) => m.kategori))];
    document.getElementById("chips").innerHTML = kats.map((k) =>
      `<button class="chip ${k === kategoriAktif ? "aktif" : ""}" data-kat="${esc(k)}">${esc(k === "semua" ? "Semua" : k)}</button>`
    ).join("");
  }

  function renderMenu() {
    const grid = document.getElementById("gridMenu");
    const tampil = daftar.filter((m) => kategoriAktif === "semua" || m.kategori === kategoriAktif);
    if (!tampil.length) {
      grid.innerHTML = '<p class="kosong">Belum ada menu nih.</p>';
      return;
    }
    grid.innerHTML = tampil.map((m, ix) => {
      const k = Keranjang.ada(m.id);
      return `<div class="kartu" style="animation-delay:${ix * 40}ms">
        <span class="kat">${esc(m.kategori)}</span>
        <span class="nama">${esc(m.nama)}</span>
        <span class="harga">${rupiah(m.harga)}</span>
        <div class="aksi">
          <button class="qty-btn" data-kurang="${m.id}" ${k ? "" : "disabled"}>−</button>
          <span class="qty-num">${k ? k.qty : 0}</span>
          <button class="qty-btn" data-tambah="${m.id}">+</button>
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

  function renderSemua() { renderMenu(); renderBar(); }

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

  // ── init ──
  async function mulai() {
    Keranjang.muat();
    renderChips();
    renderSemua();

    // klik chip kategori
    document.getElementById("chips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-kat]");
      if (!b) return;
      kategoriAktif = b.dataset.kat;
      renderChips();
      renderMenu();
    });

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
    document.getElementById("btnCek").addEventListener("click", () => cekStatus(document.getElementById("inputKode").value));
    document.getElementById("inputKode").addEventListener("keydown", (e) => {
      if (e.key === "Enter") cekStatus(e.target.value);
    });

    // muat menu + info warung (nomor WA penjual)
    try {
      daftar = await TmDb.muatMenu();
      renderChips();
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
