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
  // id = anchor di halaman ini; href = pindah halaman.
  // akses = true (PIN pernah diverifikasi di tab ini) → item Admin + Dapur
  // ikut muncul di bawah.
  const NAV_SECTIONS = [
    { id: "greeting", label: "Beranda", icon: "fa-house" },
    { id: "daftar", label: "Lihat Menu", icon: "fa-utensils" },
    { href: "pesen", label: "Pesan", icon: "fa-cart-shopping" },
  ];
  const NAV_ADMIN = [
    { href: "dapur", label: "Dapur", icon: "fa-fire-burner" },
    { href: "admin", label: "Admin", icon: "fa-gear" },
  ];

  // ── akses admin lewat URL: terasmbun.my.id/?password=XXXX ──
  // Kalo password-nya bener (= PIN dapur/admin, dicek server via RPC
  // cek_pin), simpen ke sessionStorage (TM_PIN_KEY). Efeknya:
  //   1) hamburger di index dapet item Dapur + Admin
  //   2) halaman dapur/admin langsung kebuka — gate PIN gak nongol
  //      (itu emang cara lama: kalo TM_PIN_KEY udah ada, auto cobaMasuk)
  // Sekali verifikasi di 1 tab, berlaku sampe tab ditutup.
  async function cekAksesAdmin() {
    if (sessionStorage.getItem(TM_PIN_KEY)) return true; // udah pernah di tab ini
    const pw = new URLSearchParams(location.search).get("password");
    if (!pw) return false;
    try {
      if (await TmDb.cekPin(pw)) {
        sessionStorage.setItem(TM_PIN_KEY, pw);
        // param dibuang dari address bar: PIN gak usah nongol di
        // history / screenshot / "halaman terakhir"
        history.replaceState(null, "", location.pathname);
        return true;
      }
    } catch (e) {
      /* offline / RPC error — anggap gak punya akses */
    }
    return false;
  }

  function pasangDropdown(aksesAdmin) {
    const btn = document.getElementById("btnNavMenu");
    const panel = document.getElementById("navPanel");
    if (!btn || !panel) return;

    // render link dari NAV_SECTIONS (+ Admin/Dapur kalo akses)
    const nav = aksesAdmin ? NAV_SECTIONS.concat(NAV_ADMIN) : NAV_SECTIONS;
    panel.innerHTML = nav.map(
      (s) =>
        `<a href="${esc(s.href || "#" + s.id)}"><i class="fa-solid ${esc(s.icon)}"></i> ${esc(s.label)}</a>`,
    ).join("");

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
      if (href && !href.startsWith("#")) {
        tutup();
        return;
      } // pindah halaman
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

    // cek akses admin (?password= / udah pernah verif di tab ini) dulu,
    // baru render dropdown — item Dapur/Admin muncul kalo akses oke
    let aksesAdmin = false;
    try {
      aksesAdmin = await cekAksesAdmin();
    } catch (e) {
      /* RPC mati — dropdown tetep jalan tanpa item admin */
    }
    pasangDropdown(aksesAdmin);

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
