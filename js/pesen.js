// ============================================================
// pesen.js — halaman PESAN (form).
// Alur: pilih menu → level pedas (kalo ada makanan) → nama & WA
// → diantar (cod) atau ambil di toko → QRIS/tunai → kirim.
// Validasi berat ada di server (RPC), sini cuma ngecek cepet.
// ============================================================

const Pesen = (function () {
  "use strict";

  let daftar = [];        // isi tabel menu
  let keranjang = [];     // [{id, nama, harga, qty}]
  let levelAktif = 0;     // 0 = gak pedas, 1..5
  let waPenjual = "";

  const LEVEL = [
    { v: 0, label: "Gak pedas", emoji: "🙂" },
    { v: 1, label: "Level 1", emoji: "🌶️" },
    { v: 2, label: "Level 2", emoji: "🌶️🌶️" },
    { v: 3, label: "Level 3", emoji: "🌶️🌶️🌶️" },
    { v: 4, label: "Level 4", emoji: "🔥" },
    { v: 5, label: "Level 5", emoji: "💀" },
  ];

  const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const ada = (id) => keranjang.find((i) => i.id === id);
  const total = () => keranjang.reduce((s, i) => s + i.qty * i.harga, 0);
  const jml = () => keranjang.reduce((s, i) => s + i.qty, 0);

  // makanan = kategori bukan minuman — level pedas cuma buat ini
  const makananDipilih = () => keranjang.some((i) => {
    const m = daftar.find((x) => x.id === i.id);
    return m && String(m.kategori || "").toLowerCase() !== "minuman";
  });

  // ── render ──
  // grouping: maks 3 per kategori, sisanya lewat "liat menu lain"
  const MAKS_TAMPIL = 3;
  const bukaPilih = new Set(); // kategori pilih-menu yang lagi dibuka

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
  const emojiKat = (k) =>
    ({ nasi: "🍚", minuman: "🥤", lauk: "🍗", lauk_pauk: "🍗", snack: "🍘" }[String(k || "").toLowerCase()]) || "🍽️";

  const tombolLain = (sisa) => `
    <button class="btn-lain" type="button" data-buka>
      <span class="lbl-buka"><i class="fa-solid fa-arrow-down"></i> Lihat menu lain (${sisa} lagi)</span>
      <span class="lbl-tutup"><i class="fa-solid fa-arrow-up"></i> Sembunyikan</span>
    </button>`;

  function toggleGrup(btn) {
    const grup = btn.closest(".menu-grup");
    const buka = grup.classList.toggle("buka");
    const kat = grup.dataset.kat;
    if (buka) bukaPilih.add(kat); else bukaPilih.delete(kat);
  }

  function renderPilih() {
    const grid = document.getElementById("gridPilih");
    if (!daftar.length) {
      grid.innerHTML = '<p class="kosong">Belum ada menu nih.</p>';
      return;
    }
    grid.innerHTML = kelompokkan().map((g) => `
      <div class="menu-grup ${bukaPilih.has(g.kat) ? "buka" : ""}" data-kat="${esc(g.kat)}">
        <div class="kat-judul"><span class="ikon">${emojiKat(g.kat)}</span><span class="label">${esc(labelKat(g.kat))}</span></div>
        ${g.items.map((m, ix) => {
          const k = ada(m.id);
          return `<div class="menu-baris${ix >= MAKS_TAMPIL ? " lebih" : ""}">
            <div class="info">
              <span class="nama">${esc(m.nama)}</span>
              <span class="harga">${rupiah(m.harga)}</span>
            </div>
            <div class="aksi">
              <button type="button" class="qty-btn" data-kurang="${m.id}" ${k ? "" : "disabled"} aria-label="Kurangi ${esc(m.nama)}">−</button>
              <span class="qty-num">${k ? k.qty : 0}</span>
              <button type="button" class="qty-btn" data-tambah="${m.id}" aria-label="Tambah ${esc(m.nama)}">+</button>
            </div>
          </div>`;
        }).join("")}
        ${g.items.length > MAKS_TAMPIL ? tombolLain(g.items.length - MAKS_TAMPIL) : ""}
      </div>`).join("");
  }

  function renderLevel() {
    const box = document.getElementById("langkahLevel");
    const perlu = makananDipilih();
    box.hidden = !perlu;
    if (!perlu) return;
    document.getElementById("opsiLevel").innerHTML = LEVEL.map((l) => `
      <label class="opsi ${l.v === levelAktif ? "pilih" : ""}">
        <input type="radio" name="level" value="${l.v}" ${l.v === levelAktif ? "checked" : ""}>
        <span class="lvl-emoji">${l.emoji}</span>
        <b>${l.label}</b>
      </label>`).join("");
  }

  function renderRingkas() {
    const box = document.getElementById("ringkas");
    if (!keranjang.length) {
      box.innerHTML = '<p class="kosong">Belum ada menu yang dipilih.</p>';
    } else {
      const lvl = makananDipilih() && levelAktif > 0
        ? `<li class="rincian-lain"><span>🌶️ Level pedas</span><b>${esc((LEVEL.find((l) => l.v === levelAktif) || {}).label)}</b></li>` : "";
      box.innerHTML = `
        <h2><i class="fa-solid fa-receipt"></i> Ringkasan</h2>
        <ul class="daftar-item">
          ${keranjang.map((i) => `<li><span>${esc(i.nama)} ${i.qty}x</span><b>${rupiah(i.qty * i.harga)}</b></li>`).join("")}
          ${lvl}
          <li class="rincian-total"><span>Total</span><b>${rupiah(total())}</b></li>
        </ul>`;
    }
    document.getElementById("barJml").textContent = jml() + " item";
    document.getElementById("barTotal").textContent = rupiah(total());
  }

  function renderSemua() { renderPilih(); renderLevel(); renderRingkas(); }

  // ── pilihan opsi (level / ambil / bayar) ──
  function pasangOpsi() {
    document.getElementById("opsiLevel").addEventListener("change", (e) => {
      if (e.target.name !== "level") return;
      levelAktif = Number(e.target.value);
      renderLevel();
      renderRingkas();
    });

    // ganti state pilih di kartu opsi mana pun (CSS ngikutin class .pilih)
    ["opsiAmbil", "opsiBayar"].forEach((id) => {
      document.getElementById(id).addEventListener("change", (e) => {
        const lbl = e.target.closest(".opsi");
        if (!lbl) return;
        lbl.parentElement.querySelectorAll(".opsi").forEach((o) => o.classList.toggle("pilih", o === lbl));
        // alamat cuma muncul kalo COD
        if (e.target.name === "ambil") {
          const cod = e.target.value === "cod";
          document.getElementById("fieldAlamat").hidden = !cod;
          if (!cod) document.getElementById("inAlamat").value = "";
        }
      });
    });
  }

  // ── kirim ──
  async function kirim(e) {
    e.preventDefault();
    if (!keranjang.length) { showToast("Pilih menu dulu ya.", "info"); return; }

    const nama = document.getElementById("inNama").value.trim();
    const wa = document.getElementById("inWa").value.trim();
    const ambil = (document.querySelector('input[name="ambil"]:checked') || {}).value || "";
    const bayar = (document.querySelector('input[name="bayar"]:checked') || {}).value || "";
    const alamat = document.getElementById("inAlamat").value.trim();

    if (!nama) { showToast("Isi nama dulu ya.", "error"); document.getElementById("inNama").focus(); return; }
    if (!wa) { showToast("Isi nomor WA dulu ya.", "error"); document.getElementById("inWa").focus(); return; }
    if (!/^[0-9]{9,15}$/.test(wa.replace(/\D/g, ""))) { showToast("Nomor WA kayaknya belum bener.", "error"); document.getElementById("inWa").focus(); return; }
    if (!ambil) { showToast("Pilih mau diantar atau ambil sendiri.", "info"); document.getElementById("opsiAmbil").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    if (ambil === "cod" && !alamat) { showToast("Isi alamat buat diantar.", "error"); document.getElementById("inAlamat").focus(); return; }
    if (!bayar) { showToast("Pilih mau bayar QRIS atau tunai.", "info"); document.getElementById("opsiBayar").scrollIntoView({ behavior: "smooth", block: "center" }); return; }

    const btn = document.getElementById("btnKirim");
    btn.disabled = true;

    // snapshot dulu (keranjang dibersihin sesudah sukses)
    const ringkasTeks = keranjang.map((i) => `• ${i.nama} ${i.qty}x`).join("%0A");
    const levelTeks = makananDipilih() && levelAktif > 0
      ? `%0ALevel pedas: ${LEVEL.find((l) => l.v === levelAktif).label}` : "";
    const ambilTeks = ambil === "cod" ? "Diantar (COD)" : "Ambil di toko";
    const bayarTeks = bayar === "qris" ? "QRIS" : "Tunai";

    try {
      const res = await TmDb.kirimPesanan({
        nama, wa, catatan: "",
        items: keranjang.map((i) => ({ id: i.id, qty: i.qty })),
        level: levelAktif, ambil, alamat, bayar,
      });
      sukses(res, ringkasTeks + levelTeks, alamat, ambilTeks, bayarTeks);
      keranjang = [];
      levelAktif = 0;
      document.getElementById("formPesen").reset();
      document.getElementById("fieldAlamat").hidden = true;
      document.querySelectorAll("#opsiAmbil .opsi, #opsiBayar .opsi").forEach((o) => o.classList.remove("pilih"));
      renderSemua();
    } catch (err) {
      showToast(TmDb.pesanRamah(err), "error");
    } finally {
      btn.disabled = false;
    }
  }

  function sukses(res, rincian, alamat, ambilTeks, bayarTeks) {
    showPopup(
      `Kode pesenanmu: <b>#${esc(res.kode)}</b><br>Total: <b>${rupiah(res.total)}</b><br><br>
       Simpen kode ini buat cek status.`, "success"
    );
    setTimeout(async () => {
      if (!waPenjual) return;
      const lanjut = await showPopup("Bagiin pesenan ini ke WhatsApp penjual?", "confirm");
      if (lanjut) {
        const teks = `Halo, mau pesen di Teras Mbun.%0A` +
          `Kode: *${res.kode}*%0A${rincian}%0ATotal: ${rupiah(res.total)}` +
          `%0ATerima: ${ambilTeks}` + (alamat ? `%0AAlamat: ${alamat}` : "") +
          `%0ABayar: ${bayarTeks}`;
        window.open(`https://wa.me/${waPenjual}?text=${teks}`, "_blank");
      }
    }, 400);
  }

  // ── init ──
  async function mulai() {
    renderSemua();
    pasangOpsi();

    // klik "liat menu lain" / +/- menu
    document.getElementById("gridPilih").addEventListener("click", (e) => {
      const l = e.target.closest("[data-buka]");
      if (l) { toggleGrup(l); return; }
      const t = e.target.closest("[data-tambah]");
      const k = e.target.closest("[data-kurang]");
      if (t) {
        const m = daftar.find((x) => x.id === Number(t.dataset.tambah));
        if (!m) return;
        const adaDi = ada(m.id);
        if (adaDi) adaDi.qty = Math.min(50, adaDi.qty + 1);
        else keranjang.push({ id: m.id, nama: m.nama, harga: m.harga, qty: 1 });
        renderSemua();
      } else if (k) {
        const item = ada(Number(k.dataset.kurang));
        if (!item) return;
        item.qty -= 1;
        if (item.qty <= 0) keranjang = keranjang.filter((i) => i.id !== item.id);
        renderSemua();
      }
    });

    document.getElementById("formPesen").addEventListener("submit", kirim);

    // muat menu + nomor WA penjual
    try {
      daftar = await TmDb.muatMenu();
      renderSemua();
    } catch (err) {
      document.getElementById("gridPilih").innerHTML = '<p class="kosong">Menu gagal dimuat. Coba refresh.</p>';
      showToast(TmDb.pesanRamah(err), "error");
    }
    try {
      const info = await TmDb.infoWarung();
      waPenjual = info.wa_penjual || "";
    } catch (e) { /* tombol WA jadi disembunyiin kalau gagal */ }
  }

  document.addEventListener("DOMContentLoaded", mulai);
  return {};
})();
