// ============================================================
// pesen.js — halaman PESAN (form).
// Alur: pilih menu (per kartu: foto + stepper + level pedas
// buat makanan + "Masukkan Keranjang") → nama & WA
// → diantar (cod) atau ambil di toko → QRIS/tunai → kirim.
// Validasi berat ada di server (RPC), sini cuma ngecek cepet.
// ============================================================

const Pesen = (function () {
  "use strict";

  let daftar = [];        // isi tabel menu
  let draf = new Map();   // qty draft per kartu (id → qty) — blom masuk keranjang
  let lvlDraf = new Map();// level pedas draft per kartu (id → 0..5)
  let keranjang = [];     // committed: [{id, nama, harga, qty, level}]
  let waPenjual = "";
  let fotoQris = "";      // URL foto QRIS dari setting (kosong = belum ada)
  let kodeTerakhir = "";  // kode pesenan terakhir (buat tombol WA di section QRIS)
  let totalTerakhir = 0;
  let renderPertama = true; // animasi entrance cuma sekali

  const LEVEL = [
    { v: 0, label: "Gak pedas" },
    { v: 1, label: "Level 1" },
    { v: 2, label: "Level 2" },
    { v: 3, label: "Level 3" },
    { v: 4, label: "Level 4" },
    { v: 5, label: "Level 5" },
  ];

  const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ── normalisasi nomor WA ──
  // +62812… / 62812… / 812… → 0812…, terus diformat 08XX-XXXX-XXXX.
  // Server (RPC _norm_wa) juga ngelakuin hal yang sama — ini biar user
  // liat hasilnya langsung pas ngetik.
  const normWa = (raw) => {
    let d = String(raw || "").replace(/\D/g, "");
    if (/^62\d{9,}$/.test(d)) d = "0" + d.slice(2);   // +62/62 → 0
    else if (/^8\d{8,}$/.test(d)) d = "0" + d;        // 812… → 0812…
    return d;
  };
  const formatWa = (d) =>
    /^08\d{8,}$/.test(d) ? d.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3") : d;

  const ada = (id) => keranjang.find((i) => i.id === id);
  const total = () => keranjang.reduce((s, i) => s + i.qty * i.harga, 0);
  const jml = () => keranjang.reduce((s, i) => s + i.qty, 0);

  // makanan = kategori bukan minuman — level pedas cuma nongol di kartu ini
  const isMakanan = (id) => {
    const m = daftar.find((x) => x.id === id);
    return !!m && String(m.kategori || "").toLowerCase() !== "minuman";
  };

  // emoji placeholder kalo foto menu belum ada
  const emojiKat = (k) =>
    ({ nasi: "🍚", minuman: "🥤", lauk: "🍗", lauk_pauk: "🍗", snack: "🍘" }[String(k || "").toLowerCase()]) || "🍽️";

  // ── render kartu menu ──
  // 1 kartu = 1 menu: foto, nama+harga, stepper − qty +,
  // level pedas (selalu tampil, disabled kalo qty 0),
  // tombol "✕ Batalin" & "Masukkan Keranjang".
  // Kartu dikelompokin per kategori, gaya sama kaya halaman utama.
  const labelKat = (k) => String(k || "lain").replace(/_/g, " ");

  function renderPilih() {
    const grid = document.getElementById("gridPilih");
    if (!daftar.length) {
      grid.innerHTML = '<p class="kosong">Belum ada menu nih.</p>';
      return;
    }
    // kelompokin per kategori
    const peta = new Map();
    daftar.forEach((m) => {
      const k = m.kategori || "lain";
      if (!peta.has(k)) peta.set(k, []);
      peta.get(k).push(m);
    });
    let ix = 0; // nomor urut global (buat jeda animasi antar kartu)
    grid.innerHTML = [...peta.entries()].map(([kat, items]) => `
      <div class="kat-seksi">
        <div class="kat-judul"><span class="ikon">${emojiKat(kat)}</span><span class="label">${esc(labelKat(kat))}</span></div>
        <div class="pilih-grid">
          ${items.map((m) => kartuPilih(m, ix++)).join("")}
        </div>
      </div>`).join("");
    if (daftar.length) renderPertama = false;
  }

  function kartuPilih(m, ix) {
    const anim = renderPertama; // entrance animasi cuma pas load pertama
    const q = draf.get(m.id) || 0;
    const lvlNow = lvlDraf.get(m.id) || 0;
    const komit = ada(m.id);
    const sinkron = komit && komit.qty === q && (komit.level || 0) === lvlNow; // sama semua
    const adaFoto = !!m.gambar;
    const aktif = !!(q || komit); // qty draft atau udah masuk keranjang
    const labelMasuk = sinkron
      ? '<i class="fa-solid fa-check"></i> Di keranjang'
      : komit ? "Update" : '<i class="fa-solid fa-cart-plus"></i> Keranjang';
    // level pedas per kartu — khusus makanan, SELALU tampil;
    // kalo qty-nya 0 chips-nya disabled (sama kayak tombol batal/masuk)
    const levelBaris = isMakanan(m.id) ? `
      <div class="level-baris${aktif ? "" : " mati"}">
        <span class="lvl-label"><i class="fa-solid fa-pepper-hot"></i> Pedas</span>
        <div class="lvl-chips">
          ${LEVEL.map((l) => `<button type="button" class="lvl-chip${lvlNow === l.v ? " aktif" : ""}"
            data-level="${m.id}:${l.v}" aria-label="${l.label}" title="${l.label}" ${aktif ? "" : "disabled"}>${l.v}</button>`).join("")}
        </div>
      </div>` : "";
    return `<div class="kartu-menu${sinkron ? " di-keranjang" : ""}${anim ? " anim" : ""}"
            ${anim ? `style="animation-delay:${ix * 30}ms"` : ""}>
      <div class="foto ${adaFoto ? "" : "kosong-foto"}">
        ${adaFoto
          ? `<img src="${esc(m.gambar)}" alt="${esc(m.nama)}" loading="lazy"
                  onerror="this.closest('.foto').classList.add('kosong-foto'); this.remove();">`
          : ""}
        <span class="foto-emoji">${emojiKat(m.kategori)}</span>
      </div>
      <div class="info">
        <span class="nama">${esc(m.nama)}</span>
        <span class="harga">${rupiah(m.harga)}</span>
      </div>
      <div class="aksi">
        <button type="button" class="qty-btn" data-kurang="${m.id}" ${q ? "" : "disabled"} aria-label="Kurangi ${esc(m.nama)}">−</button>
        <span class="qty-num">${q}</span>
        <button type="button" class="qty-btn" data-tambah="${m.id}" aria-label="Tambah ${esc(m.nama)}">+</button>
      </div>
      ${levelBaris}
      <div class="tombol-kartu">
        <button type="button" class="btn-batal" data-batal="${m.id}" aria-label="Batalin ${esc(m.nama)}" ${q || komit ? "" : "disabled"}>
          <i class="fa-solid fa-xmark"></i>
        </button>
        <button type="button" class="btn-masuk" data-masuk="${m.id}" ${q ? "" : "disabled"}>
          ${labelMasuk}
        </button>
      </div>
    </div>`;
  }

  // ── aksi kartu ──
  function ubahDraf(id, delta) {
    const q = Math.max(0, Math.min(50, (draf.get(id) || 0) + delta));
    if (q) draf.set(id, q); else draf.delete(id);
    renderPilih();
    renderRingkas();
  }

  function ubahLevel(id, v) {
    lvlDraf.set(id, Math.max(0, Math.min(5, v)));
    renderPilih();
    renderRingkas();
  }

  function batalKartu(id) {
    draf.delete(id);
    lvlDraf.delete(id);
    keranjang = keranjang.filter((i) => i.id !== id);
    renderSemua();
  }

  function masukKeranjang(id) {
    const q = draf.get(id) || 0;
    const m = daftar.find((x) => x.id === id);
    if (!q || !m) return;
    const lvl = isMakanan(id) ? (lvlDraf.get(id) || 0) : 0; // minuman gak bawa level
    const komit = ada(id);
    if (komit) { komit.qty = q; komit.level = lvl; }
    else keranjang.push({ id: m.id, nama: m.nama, harga: m.harga, qty: q, level: lvl });
    renderSemua();
    showToast(`${esc(m.nama)} masuk keranjang`, "success");
  }

  function renderRingkas() {
    const box = document.getElementById("ringkas");
    if (!keranjang.length) {
      box.innerHTML = '<p class="kosong">Belum ada menu yang dipilih.</p>';
    } else {
      box.innerHTML = `
        <h2><i class="fa-solid fa-receipt"></i> Ringkasan</h2>
        <ul class="daftar-item">
          ${keranjang.map((i) => `<li><span>${esc(i.nama)} ${i.qty}x${i.level > 0 ? ` <b class="lvl-item">🌶️${i.level}</b>` : ""}</span><b>${rupiah(i.qty * i.harga)}</b></li>`).join("")}
          <li class="rincian-total"><span>Total</span><b>${rupiah(total())}</b></li>
        </ul>`;
    }
    document.getElementById("barJml").textContent = jml() + " item";
    document.getElementById("barTotal").textContent = rupiah(total());
  }

  function renderSemua() { renderPilih(); renderRingkas(); }

  // ── pilihan opsi (level / ambil / bayar) + input WA ──
  function pasangOpsi() {
    // input WA: format otomatis 08XX-XXXX-XXXX pas ngetik.
    // kursor dipertahanin: diitung berapa digit sebelum kursor,
    // abis diformat kursor ditaruh lagi setelah jumlah digit yang sama.
    const inpWa = document.getElementById("inWa");
    inpWa.addEventListener("input", () => {
      const pos = inpWa.selectionStart;
      const digitSebelum = inpWa.value.slice(0, pos).replace(/\D/g, "").length;
      const baru = formatWa(normWa(inpWa.value));
      if (inpWa.value !== baru) {
        inpWa.value = baru;
        let hitung = 0, i = 0;
        for (; i < baru.length && hitung < digitSebelum; i++) {
          if (/\d/.test(baru[i])) hitung++;
        }
        inpWa.setSelectionRange(i, i);
      }
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
    const wa = formatWa(normWa(document.getElementById("inWa").value)); // biar konsisten sama tampilan
    const ambil = (document.querySelector('input[name="ambil"]:checked') || {}).value || "";
    const bayar = (document.querySelector('input[name="bayar"]:checked') || {}).value || "";
    const alamat = document.getElementById("inAlamat").value.trim();

    if (!nama) { showToast("Isi nama dulu ya.", "error"); document.getElementById("inNama").focus(); return; }
    if (!wa) { showToast("Isi nomor WA dulu ya.", "error"); document.getElementById("inWa").focus(); return; }
    if (!/^08\d{9,12}$/.test(wa.replace(/\D/g, ""))) {
      showToast("Nomor WA kayaknya belum bener (harus 08…).", "error");
      document.getElementById("inWa").focus(); return;
    }
    if (!ambil) { showToast("Pilih mau diantar atau ambil sendiri.", "info"); document.getElementById("opsiAmbil").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    if (ambil === "cod" && !alamat) { showToast("Isi alamat buat diantar.", "error"); document.getElementById("inAlamat").focus(); return; }
    if (!bayar) { showToast("Pilih mau bayar QRIS atau tunai.", "info"); document.getElementById("opsiBayar").scrollIntoView({ behavior: "smooth", block: "center" }); return; }

    const btn = document.getElementById("btnKirim");
    btn.disabled = true;
    document.getElementById("qrisBayar").hidden = true; // section QRIS lama disembunyiin

    // snapshot dulu (keranjang dibersihin sesudah sukses)
    const ringkasTeks = keranjang
      .map((i) => `• ${i.nama} ${i.qty}x${i.level > 0 ? ` (Pedas Lv${i.level})` : ""}`)
      .join("%0A");
    const ambilTeks = ambil === "cod" ? "Diantar (COD)" : "Ambil di toko";
    const bayarTeks = bayar === "qris" ? "QRIS" : "Tunai";

    try {
      const res = await TmDb.kirimPesanan({
        nama, wa, catatan: "",
        items: keranjang.map((i) => ({ id: i.id, qty: i.qty, level: i.level || 0 })),
        // level_pedas kolom = level tertinggi (buat ringkasan dapur/lama);
        // detail per item ada di dalam items
        level: keranjang.reduce((mx, i) => Math.max(mx, i.level || 0), 0),
        ambil, alamat, bayar,
      });
      sukses(res, ringkasTeks, alamat, ambilTeks, bayarTeks);
      if (bayar === "qris") tampilQris(res); // section foto QRIS
      keranjang = [];
      draf.clear();
      lvlDraf.clear();
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
    // satu popup aja: info kode + tombol bagikan WA (gak ada popup kedua lagi)
    const teks = `Halo, mau pesen di Teras Mbun.%0A` +
      `Kode: *${res.kode}*%0A${rincian}%0ATotal: ${rupiah(res.total)}` +
      `%0ATerima: ${ambilTeks}` + (alamat ? `%0AAlamat: ${alamat}` : "") +
      `%0ABayar: ${bayarTeks}`;

    showPopup(
      `Kode pesenanmu: <b>#${esc(res.kode)}</b><br>Total: <b>${rupiah(res.total)}</b><br><br>
       Simpen kode ini buat cek status.`, "success",
      {
        aksi: waPenjual ? [{
          id: "wa", label: "Bagikan ke WA", ikon: "fa-brands fa-whatsapp", cls: "uni-btn-wa",
          onClick: () => window.open(`https://wa.me/${waPenjual}?text=${teks}`, "_blank"),
        }] : [],
      }
    );
  }

  // ── section QRIS: muncul kalo pesenan barusan pilih bayar QRIS ──
  function tampilQris(res) {
    kodeTerakhir = res.kode;
    totalTerakhir = res.total;
    document.getElementById("qrisTotal").textContent = `Total bayar: ${rupiah(res.total)}`;
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
    const box = document.getElementById("qrisBayar");
    box.hidden = false;
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ── init ──
  async function mulai() {
    renderSemua();
    pasangOpsi();

    // klik di kartu menu: stepper / level pedas / batalin / masukkan keranjang
    document.getElementById("gridPilih").addEventListener("click", (e) => {
      const t = e.target.closest("[data-tambah]");
      const k = e.target.closest("[data-kurang]");
      const lv = e.target.closest("[data-level]");
      const b = e.target.closest("[data-batal]");
      const m = e.target.closest("[data-masuk]");
      if (t) ubahDraf(Number(t.dataset.tambah), 1);
      else if (k) ubahDraf(Number(k.dataset.kurang), -1);
      else if (lv) {
        const [id, v] = lv.dataset.level.split(":").map(Number);
        ubahLevel(id, v);
      }
      else if (b) batalKartu(Number(b.dataset.batal));
      else if (m) masukKeranjang(Number(m.dataset.masuk));
    });

    document.getElementById("formPesen").addEventListener("submit", kirim);

    // section QRIS: tombol tutup + kabari penjual lewat WA
    document.getElementById("btnTutupQris").addEventListener("click", () => {
      document.getElementById("qrisBayar").hidden = true;
    });
    document.getElementById("btnBuktiWa").addEventListener("click", () => {
      const teks = `Halo, udah bayar QRIS pesenan #${kodeTerakhir} total ${rupiah(totalTerakhir)} ya. Ini buktinya 🙏`;
      window.open(`https://wa.me/${waPenjual}?text=${encodeURIComponent(teks)}`, "_blank");
    });

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
      fotoQris = info.qris || "";
      TmDb.terapkanBg(info.bg || ""); // foto latar dari setting (kosong = gradient)
    } catch (e) { /* tombol WA jadi disembunyiin kalau gagal */ }
  }

  document.addEventListener("DOMContentLoaded", mulai);
  return {};
})();
