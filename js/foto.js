// ============================================================
// foto.js — halaman KELOLA FOTO (PIN-gated, ala dapur).
// Tiga blok: foto latar (bg), foto QRIS, foto menu.
// Semua foto dikompres dulu di browser (canvas → JPEG), upload ke
// bucket terasmbun-media, URL-nya disimpen lewat RPC wajib PIN.
// ============================================================

const Foto = (function () {
  "use strict";

  let pin = sessionStorage.getItem(TM_PIN_KEY) || "";
  let menuFoto = [];                  // isi tabel menu
  let media = { bg: "", qris: "" };   // URL foto warung dari setting
  let target = null;                  // { tipe: "bg"|"qris"|"menu", id }

  const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const emojiKat = (k) => ({ nasi: "🍚", minuman: "🥤", lauk: "🍗", lauk_pauk: "🍗", snack: "🍘" }[String(k || "").toLowerCase()] || "🍽️");
  const labelKat = (k) => String(k || "lain").replace(/_/g, " ");

  // ── gerbang PIN ──
  async function cobaMasuk() {
    const input = document.getElementById("inputPin");
    const btn = document.getElementById("btnMasuk");
    btn.disabled = true;
    try {
      const ok = await TmDb.cekPin(input.value);
      if (!ok) {
        showToast("PIN salah. Coba lagi.", "error");
        input.value = "";
        input.focus();
        return;
      }
      pin = input.value;
      sessionStorage.setItem(TM_PIN_KEY, pin);
      buka();
    } catch (err) {
      showToast(TmDb.pesanRamah(err), "error");
    } finally {
      btn.disabled = false;
    }
  }

  async function buka() {
    document.getElementById("gate").hidden = true;
    document.getElementById("isi").hidden = false;
    await muat();
  }

  async function muat() {
    try {
      const [m, info] = await Promise.all([TmDb.muatMenu(), TmDb.infoWarung()]);
      menuFoto = m;
      media.bg = info.bg || "";
      media.qris = info.qris || "";
      render();
    } catch (err) {
      showToast(TmDb.pesanRamah(err), "error");
    }
  }

  // ── render ──
  function render() {
    renderPreview("prevBg", media.bg, "Belum ada foto latar — web tampil gradient hangat.");
    renderPreview("prevQris", media.qris, "Belum ada foto QRIS — pelanggan gak liat gambar QR.");

    const kotak = document.getElementById("daftarFoto");
    if (!menuFoto.length) { kotak.innerHTML = '<p class="kosong">Menu masih kosong.</p>'; return; }
    // dikelompokin per kategori biar rapi
    const peta = new Map();
    menuFoto.forEach((m) => {
      const k = m.kategori || "lain";
      if (!peta.has(k)) peta.set(k, []);
      peta.get(k).push(m);
    });
    kotak.innerHTML = [...peta.entries()].map(([kat, items]) => `
      <div class="kat-judul-kecil"><span>${emojiKat(kat)}</span> ${esc(labelKat(kat))}</div>
      ${items.map((m) => `<div class="baris-foto">
        <div class="thumb-foto">${m.gambar
          ? `<img src="${esc(m.gambar)}" alt="${esc(m.nama)}" loading="lazy">`
          : `<span class="emoji-foto">${emojiKat(m.kategori)}</span>`}</div>
        <div class="info-foto">
          <b>${esc(m.nama)}</b>
          <small>${rupiah(m.harga)}</small>
        </div>
        <div class="aksi-foto">
          <button class="btn btn-kecil btn-foto" data-menu-ganti="${m.id}"><i class="fa-solid fa-camera"></i> ${m.gambar ? "Ganti" : "Pasang"}</button>
          ${m.gambar ? `<button class="btn btn-kecil btn-kaca" data-menu-hapus="${m.id}" title="Hapus foto"><i class="fa-solid fa-trash"></i></button>` : ""}
        </div>
      </div>`).join("")}`).join("");
  }

  function renderPreview(id, url, teksKosong) {
    const kotak = document.getElementById(id);
    kotak.innerHTML = url
      ? `<img src="${esc(url)}" alt="preview" loading="lazy">`
      : `<span class="kosong-foto-txt">${esc(teksKosong)}</span>`;
  }

  // ── ganti foto: pilih dari galeri → kompres → upload → simpan URL ──
  async function prosesFoto(file) {
    if (!file || !target) return;
    const { tipe, id } = target;
    target = null;
    try {
      showToast("Kompres & unggah foto…", "info");
      const blob = await TmDb.kompresFoto(file); // resize + JPEG di browser
      let urlBaru;
      if (tipe === "menu") {
        urlBaru = await TmDb.uploadFoto(`menu-${id}`, blob);
        const ok = await TmDb.ubahMenuGambar(id, urlBaru, pin);
        if (!ok) return gagalPin();
        const m = menuFoto.find((x) => x.id === id);
        if (m && m.gambar) TmDb.hapusFotoLama(m.gambar).catch(() => {});
        if (m) m.gambar = urlBaru;
        showToast(`Foto "${m ? m.nama : "menu"}" disimpan ✅`);
      } else {
        urlBaru = await TmDb.uploadFoto(tipe, blob);
        const ok = await TmDb.ubahMedia(tipe, urlBaru, pin);
        if (!ok) return gagalPin();
        if (media[tipe]) TmDb.hapusFotoLama(media[tipe]).catch(() => {});
        media[tipe] = urlBaru;
        if (tipe === "bg") TmDb.terapkanBg(urlBaru); // latar ganti langsung
        showToast(tipe === "bg" ? "Foto latar disimpan ✅" : "Foto QRIS disimpan ✅");
      }
      render();
    } catch (err) {
      showToast(TmDb.pesanRamah(err), "error");
    }
  }

  // ── hapus foto ──
  async function hapus(target2) {
    const { tipe, id } = target2;
    try {
      if (tipe === "menu") {
        const m = menuFoto.find((x) => x.id === id);
        if (!m || !m.gambar) return;
        if (!(await showPopup(`Hapus foto "${esc(m.nama)}"?`, "confirm"))) return;
        if (!(await TmDb.ubahMenuGambar(id, "", pin))) return gagalPin();
        TmDb.hapusFotoLama(m.gambar).catch(() => {});
        m.gambar = null;
      } else {
        if (!media[tipe]) { showToast("Belum ada foto yang dihapus.", "info"); return; }
        const apa = tipe === "bg" ? "Foto latar" : "Foto QRIS";
        if (!(await showPopup(`Hapus ${apa.toLowerCase()}?`, "confirm"))) return;
        if (!(await TmDb.ubahMedia(tipe, "", pin))) return gagalPin();
        TmDb.hapusFotoLama(media[tipe]).catch(() => {});
        media[tipe] = "";
        if (tipe === "bg") TmDb.terapkanBg(""); // balik ke gradient hangat
      }
      render();
      showToast("Foto dihapus.");
    } catch (err) {
      showToast(TmDb.pesanRamah(err), "error");
    }
  }

  function gagalPin() {
    showToast("PIN gak valid. Masuk ulang ya.", "error");
    keluar();
  }

  function keluar() {
    sessionStorage.removeItem(TM_PIN_KEY);
    pin = "";
    document.getElementById("isi").hidden = true;
    document.getElementById("gate").hidden = false;
    document.getElementById("inputPin").value = "";
  }

  // ── init ──
  function mulai() {
    document.getElementById("btnMasuk").addEventListener("click", cobaMasuk);
    document.getElementById("inputPin").addEventListener("keydown", (e) => {
      if (e.key === "Enter") cobaMasuk();
    });
    document.getElementById("btnKeluar").addEventListener("click", () => {
      showPopup("Keluar dari mode kelola foto?", "confirm").then((y) => { if (y) keluar(); });
    });

    // tombol ganti/hapus foto warung (data-media="bg:ganti")
    document.getElementById("isi").addEventListener("click", (e) => {
      const wm = e.target.closest("[data-media]");
      const gantiMenu = e.target.closest("[data-menu-ganti]");
      const hapusMenu = e.target.closest("[data-menu-hapus]");
      if (wm) {
        const [tipe, aksi] = wm.dataset.media.split(":");
        if (aksi === "ganti") { target = { tipe, id: null }; document.getElementById("inputFoto").click(); }
        else hapus({ tipe, id: null });
      } else if (gantiMenu) {
        target = { tipe: "menu", id: Number(gantiMenu.dataset.menuGanti) };
        document.getElementById("inputFoto").click();
      } else if (hapusMenu) {
        hapus({ tipe: "menu", id: Number(hapusMenu.dataset.menuHapus) });
      }
    });

    document.getElementById("inputFoto").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = ""; // reset biar file sama bisa dipilih ulang
      prosesFoto(file);
    });

    // udah pernah masuk PIN di tab ini? langsung buka
    if (pin) cobaMasuk();
  }

  document.addEventListener("DOMContentLoaded", mulai);
  return {};
})();
