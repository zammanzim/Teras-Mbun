// ============================================================
// menu.js — sisi CUSTOMER (index): showcase menu
// Pesenan PINDAH ke pesen (js/pesen.js).
// ============================================================

const Menu = (function () {
  "use strict";

  let daftar = []; // isi tabel menu

  // ── util ──
  const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
  const esc = (s) =>
    String(s == null ? "" : s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  // ── render ──
  // grouping: menu dikelompokin per kategori — SEMUA tampil
  // (gak ada lagi tombol "lihat menu lain")
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

  // showcase: foto di atas, judul+deskripsi di bawahnya — per kategori
  function renderTampil() {
    const box = document.getElementById("menuTampil");
    if (!daftar.length) {
      box.innerHTML = '<p class="kosong">Belum ada menu nih.</p>';
      return;
    }
    box.innerHTML = kelompokkan()
      .map(
        (g) => `
      <div class="menu-grup">
        <div class="kat-judul"><span class="ikon">${emojiKategori(g.kat)}</span><span class="label">${esc(labelKat(g.kat))}</span></div>
        ${g.items.map((m, ix) => blokTampil(m, ix)).join("")}
      </div>`,
      )
      .join("");
  }

  function blokTampil(m, ix) {
    const adaFoto = !!m.gambar;
    return `<div class="tampil-blok" style="animation-delay:${ix * 40}ms">
      <div class="tampil-foto ${adaFoto ? "" : "kosong-foto"}">
        ${
          adaFoto
            ? `<img src="${esc(m.gambar)}" alt="${esc(m.nama)}" loading="lazy"
                  onerror="this.closest('.tampil-foto').classList.add('kosong-foto'); this.remove();">`
            : ""
        }
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
    const peta = {
      nasi: "🍚",
      minuman: "🥤",
      lauk: "🍗",
      lauk_pauk: "🍗",
      snack: "🍘",
    };
    return peta[String(kat || "").toLowerCase()] || "🍽️";
  }

  // ── daftar section di dropdown hamburger ──
  // (pindah ke js/nav.js — header seragam di semua halaman)

  // ── init ──
  async function mulai() {
    renderTampil();
    // (dropdown hamburger diurus js/nav.js — header seragam)

    // tombol scroll ke daerah menu
    ["btnLihatMenu", "btnScrollMenu"].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const el = document.getElementById("daftar");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    });

    // muat menu
    try {
      daftar = await TmDb.muatMenu();
      renderTampil();
    } catch (err) {
      document.getElementById("menuTampil").innerHTML =
        '<p class="kosong">Menu gagal dimuat. Coba refresh.</p>';
      showToast(TmDb.pesanRamah(err), "error");
    }

    // foto latar dari setting (kosong = gradient hangat)
    try {
      TmDb.terapkanBg((await TmDb.infoWarung()).bg || "");
    } catch (e) {
      /* latar default tetep jalan */
    }
  }

  document.addEventListener("DOMContentLoaded", mulai);
  return {};
})();
