// ============================================================
// pesen.js — halaman PESAN (form).
// Alur: pilih menu (per kartu: foto + stepper − qty + yang LANGSUNG
// masuk keranjang + level pedas buat makanan) → nama & WA
// → diantar (cod) atau ambil di toko → QRIS/tunai → kirim.
// Validasi berat ada di server (RPC), sini cuma ngecek cepet.
// ============================================================

const Pesen = (function () {
  "use strict";

  let daftar = [];        // isi tabel menu
  let lvlDraf = new Map();// level pedas pilihan per kartu (id → 0..5)
  let keranjang = [];     // committed: [{id, nama, harga, qty, level}]
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

  // ── ongkir COD ──
  // angka AWAL aja — server (RPC buat_pesanan) yang nentuin final,
  // UI cuma nampilin + keterangan "gak fix" (bisa beda deket/jauh).
  // KALAU NGUBAH ANGKA INI: samain sama db/012-ongkir-cod.sql (3000).
  const ONGKIR_COD = 3000;
  const ongkir = () => (nilai("ambil") === "cod" ? ONGKIR_COD : 0);
  const totalBayar = () => total() + ongkir();

  // level pedas terpilih — default MID (2) kalo belum pernah disentuh
  const LVL_AWAL = 2;
  const lvlAt = (id) => (lvlDraf.has(id) ? lvlDraf.get(id) : LVL_AWAL);

  // makanan = kategori bukan minuman — level pedas cuma nongol di kartu ini
  const isMakanan = (id) => {
    const m = daftar.find((x) => x.id === id);
    return !!m && String(m.kategori || "").toLowerCase() !== "minuman";
  };

  // emoji placeholder kalo foto menu belum ada
  const emojiKat = (k) =>
    ({ nasi: "🍚", minuman: "🥤", lauk: "🍗", lauk_pauk: "🍗", snack: "🍘" }[String(k || "").toLowerCase()]) || "🍽️";

  // ── render kartu menu ──
  // 1 kartu = 1 menu: foto, nama+harga, stepper − qty + (LANGSUNG masuk
  // keranjang), level pedas (khusus makanan, selalu tampil).
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
    const q = ada(m.id) ? ada(m.id).qty : 0;
    const lvlNow = lvlAt(m.id);
    const adaFoto = !!m.gambar;
    // level pedas per kartu — khusus makanan, SELALU tampil;
    // kalo qty-nya 0 chips-nya disabled
    const levelBaris = isMakanan(m.id) ? `
      <div class="level-baris${q ? "" : " mati"}">
        <span class="lvl-label"><i class="fa-solid fa-pepper-hot"></i> Pedas</span>
        <div class="lvl-chips">
          ${LEVEL.map((l) => `<button type="button" class="lvl-chip lv-${l.v}${lvlNow === l.v ? " aktif" : ""}"
            data-level="${m.id}:${l.v}" aria-label="${l.label}" title="${l.label}" ${q ? "" : "disabled"}>${l.v}</button>`).join("")}
        </div>
      </div>` : "";
    return `<div class="kartu-menu${q ? " di-keranjang" : ""}${anim ? " anim" : ""}"
            data-kartu="${m.id}"
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
    </div>`;
  }

  // ── aksi kartu ──
  // Stepper − / + LANGSUNG nulis ke keranjang (gak ada tombol "masuk
  // keranjang" lagi). Patch SATU kartu doang tanpa render ulang grid —
  // kalo grid di-innerHTMl ulang, SEMUA <img> dilepas+di-decode lagi
  // tiap klik → foto pada kedip.
  function patchKartu(id) {
    const kartu = document.querySelector(`[data-kartu="${id}"]`);
    if (!kartu) return; // grid belum ke-render (atau menu gagal muat)
    const item = ada(id);
    const q = item ? item.qty : 0;
    const lvlNow = lvlAt(id);

    kartu.classList.toggle("di-keranjang", q > 0);
    kartu.querySelector(".qty-num").textContent = q;
    kartu.querySelector("[data-kurang]").disabled = !q;

    const baris = kartu.querySelector(".level-baris");
    if (baris) {
      baris.classList.toggle("mati", !q);
      baris.querySelectorAll(".lvl-chip").forEach((chip) => {
        const v = Number(chip.dataset.level.split(":")[1]);
        chip.disabled = !q;
        chip.classList.toggle("aktif", v === lvlNow);
      });
    }
  }

  function ubahQty(id, delta) {
    const m = daftar.find((x) => x.id === id);
    if (!m) return;
    const item = ada(id);
    const q = Math.max(0, Math.min(50, (item ? item.qty : 0) + delta));
    if (!q) {
      if (item) keranjang = keranjang.filter((i) => i.id !== id); // 0 = keluar keranjang
    } else if (item) {
      item.qty = q;
    } else {
      // pertama kali masuk: level = pilihan sekarang (default 2 / mid);
      // minuman gak bawa level (server juga maksa 0)
      keranjang.push({
        id: m.id, nama: m.nama, harga: m.harga, qty: q,
        level: isMakanan(id) ? lvlAt(id) : 0,
      });
    }
    patchKartu(id);
    renderRingkas();
  }

  function ubahLevel(id, v) {
    lvlDraf.set(id, Math.max(0, Math.min(5, v)));
    const item = ada(id);
    if (item) item.level = isMakanan(id) ? lvlDraf.get(id) : 0; // ikut kalo udah di keranjang
    patchKartu(id);
    renderRingkas();
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
          ${ongkir() ? `<li class="rincian-ongkir"><span>Ongkir COD <i class="fa-solid fa-circle-info" title="gak fix"></i></span><b>+${rupiah(ongkir())}</b></li>` : ""}
          <li class="rincian-total"><span>Total</span><b>${rupiah(totalBayar())}</b></li>
        </ul>
        ${ongkir() ? '<p class="catatan-ongkir kecil"><i class="fa-solid fa-motorcycle"></i> Ongkir gak fix ya — Rp3.000 cuma perkiraan awal, bisa berubah tergantung deket / jauh.</p>' : ""}`;
    }
    document.getElementById("barJml").textContent = jml() + " item";
    document.getElementById("barTotal").textContent = rupiah(totalBayar());
  }

  function renderSemua() { renderPilih(); renderRingkas(); }

  // ── wizard: 1 kartu tampil per langkah ──
  // langkah 1..5 = form, 6 = konfirmasi (tombol kirim ada di dalem kartu,
  // bar bawah sengaja disembunyiin di langkah 6 — ilang + gak ganggu)
  const MAKS_LANGKAH = 6;
  let langkah = 1;

  const nilai = (nama) =>
    (document.querySelector(`input[name="${nama}"]:checked`) || {}).value || "";

  function tampilLangkah(n, gulir = true) {
    langkah = Math.max(1, Math.min(MAKS_LANGKAH, n));
    document.querySelectorAll("[data-langkah]").forEach((el) => {
      el.hidden = Number(el.dataset.langkah) !== langkah;
    });

    // dots + caption indikator
    document.querySelectorAll("#stepDots i").forEach((dot, ix) => {
      dot.classList.toggle("aktif", ix < langkah - 1);   // udah dilewatin
      dot.classList.toggle("kini", ix === langkah - 1);   // lagi di sini
    });
    document.getElementById("stepCap").textContent = `Langkah ${langkah} dari ${MAKS_LANGKAH}`;

    // bar bawah: ilang di langkah konfirmasi, tombol ← ilang di langkah 1
    document.getElementById("barKirim").hidden = langkah === MAKS_LANGKAH;
    document.getElementById("btnBack").hidden = langkah === 1;

    if (langkah === MAKS_LANGKAH) renderKonfirmasi(); // snapshot isi form

    if (gulir) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function lanjut() {
    if (!validLangkah(langkah)) return;
    tampilLangkah(langkah + 1);
  }
  function mundur() { tampilLangkah(langkah - 1); }

  // validasi isi SATU langkah; false = ada yang kurang
  // (toast + fokus elemennya udah diurus di dalem)
  function validLangkah(n) {
    if (n === 1) {
      if (!keranjang.length) { showToast("Pilih menu dulu ya.", "info"); return false; }
      return true;
    }
    if (n === 2) {
      const nama = document.getElementById("inNama").value.trim();
      const wa = formatWa(normWa(document.getElementById("inWa").value));
      if (!nama) { showToast("Isi nama dulu ya.", "error"); document.getElementById("inNama").focus(); return false; }
      if (!wa) { showToast("Isi nomor WA dulu ya.", "error"); document.getElementById("inWa").focus(); return false; }
      if (!/^08\d{9,12}$/.test(wa.replace(/\D/g, ""))) {
        showToast("Nomor WA kayaknya belum bener (harus 08…).", "error");
        document.getElementById("inWa").focus(); return false;
      }
      return true;
    }
    if (n === 3) {
      const ambil = nilai("ambil");
      if (!ambil) { showToast("Pilih mau diantar atau ambil sendiri.", "info"); document.getElementById("opsiAmbil").scrollIntoView({ behavior: "smooth", block: "center" }); return false; }
      if (ambil === "cod" && !document.getElementById("inAlamat").value.trim()) {
        showToast("Isi alamat buat diantar.", "error"); document.getElementById("inAlamat").focus(); return false;
      }
      return true;
    }
    if (n === 4) {
      if (!nilai("bayar")) { showToast("Pilih mau bayar QRIS atau tunai.", "info"); document.getElementById("opsiBayar").scrollIntoView({ behavior: "smooth", block: "center" }); return false; }
      return true;
    }
    if (n === 5) {
      if (nilai("kapan") === "custom" && !document.getElementById("inWaktu").value.trim()) {
        showToast("Tulis jam kirimnya dulu ya.", "error"); document.getElementById("inWaktu").focus(); return false;
      }
      return true;
    }
    return true;
  }

  // teks jadwal kirim yang enak dibaca (kartu konfirmasi)
  function teksKapan(kapan, waktuTeks) {
    if (kapan === "besok") {
      const b = new Date(Date.now() + 864e5);
      return "Besok (" + b.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" }) + ")";
    }
    if (kapan === "custom" && waktuTeks) return waktuTeks; // teks bebas user ("jam 5 sore")
    return "Sekarang";
  }

  // isi kartu konfirmasi: ringkasan (#ringkas) udah ke-render sendiri,
  // sini cuma nambah baris info (nama, terima, bayar, jadwal)
  function renderKonfirmasi() {
    const nama = document.getElementById("inNama").value.trim();
    const wa = formatWa(normWa(document.getElementById("inWa").value));
    const ambil = nilai("ambil");
    const bayar = nilai("bayar");
    const kapan = nilai("kapan") || "sekarang";
    const alamat = document.getElementById("inAlamat").value.trim();
    const waktuTeks = document.getElementById("inWaktu").value.trim();

    const baris = [];
    if (nama) baris.push(["fa-solid fa-user", "Nama", nama]);
    if (wa) baris.push(["fa-brands fa-whatsapp", "No. WA", wa]);
    baris.push([ambil === "cod" ? "fa-solid fa-motorcycle" : "fa-solid fa-store",
      "Terima", ambil === "cod" ? "Diantar (COD)" : "Ambil di toko"]);
    if (ambil === "cod" && alamat) baris.push(["fa-solid fa-location-dot", "Alamat", alamat]);
    if (ambil === "cod") baris.push(["fa-solid fa-truck", "Ongkir*", "+Rp3.000 (gak fix)"]);
    if (bayar) baris.push([bayar === "qris" ? "fa-solid fa-qrcode" : "fa-solid fa-money-bill-wave",
      "Bayar", bayar === "qris" ? "QRIS" : "Tunai"]);
    baris.push(["fa-regular fa-calendar", "Diantar kapan", teksKapan(kapan, waktuTeks)]);

    document.getElementById("konfInfo").innerHTML = baris.map(([ikon, label, nilaiTeks]) => `
      <div class="aku-baris"><i class="${ikon}"></i>
        <span class="lbl">${esc(label)}</span>
        <span class="val">${esc(nilaiTeks)}</span>
      </div>`).join("") +
      (ambil === "cod"
        ? `<p class="catatan-ongkir kecil"><i class="fa-solid fa-circle-info"></i>
             *Ongkir <b>gak fix</b> — Rp3.000 cuma awal, bisa berubah
             tergantung makin deket / makin jauh. Penjual yang konfirmasi.</p>`
        : "");
  }

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
    ["opsiAmbil", "opsiBayar", "opsiKapan"].forEach((id) => {
      document.getElementById(id).addEventListener("change", (e) => {
        const lbl = e.target.closest(".opsi");
        if (!lbl) return;
        lbl.parentElement.querySelectorAll(".opsi").forEach((o) => o.classList.toggle("pilih", o === lbl));
        // alamat cuma muncul kalo COD; peta ilustrasi cuma muncul kalo ambil di toko
        if (e.target.name === "ambil") {
          const cod = e.target.value === "cod";
          document.getElementById("fieldAlamat").hidden = !cod;
          if (!cod) document.getElementById("inAlamat").value = "";
          document.getElementById("petaToko").hidden = e.target.value !== "ambil";
          document.getElementById("catatanOngkir").hidden = !cod; // keterangan ongkir
          renderRingkas(); // total bar + ringkasan ikut +ongkir
        }
        // isian jam kirim cuma muncul kalo pilih "Pilih waktu"
        if (e.target.name === "kapan") {
          const custom = e.target.value === "custom";
          document.getElementById("fieldWaktu").hidden = !custom;
          if (!custom) document.getElementById("inWaktu").value = "";
        }
      });
    });

    // tanggal besok buat label opsi "Besok" ("Min, 1 Nov")
    document.getElementById("capBesok").textContent =
      new Date(Date.now() + 864e5).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
  }

  // ── kirim ──
  async function kirim(e) {
    e.preventDefault();
    // safety net: kirim cuma boleh jalan kalo SEMUA langkah lolos.
    // (kirim tombolnya cuma ada di langkah konfirmasi, tapi jaga-jaga
    //  misal user ngelewatin lewat devtools dll)
    for (let n = 1; n < MAKS_LANGKAH; n++) {
      if (!validLangkah(n)) { tampilLangkah(n); return; }
    }

    const nama = document.getElementById("inNama").value.trim();
    const wa = formatWa(normWa(document.getElementById("inWa").value)); // biar konsisten sama tampilan
    const ambil = nilai("ambil");
    const bayar = nilai("bayar");
    const alamat = document.getElementById("inAlamat").value.trim();
    const kapan = nilai("kapan") || "sekarang";
    const waktuTeks = kapan === "custom" ? document.getElementById("inWaktu").value.trim() : null;

    const btn = document.getElementById("btnKirim");
    btn.disabled = true;

    try {
      const res = await TmDb.kirimPesanan({
        nama, wa, catatan: "",
        items: keranjang.map((i) => ({ id: i.id, qty: i.qty, level: i.level || 0 })),
        // level_pedas kolom = level tertinggi (buat ringkasan dapur/lama);
        // detail per item ada di dalam items
        level: keranjang.reduce((mx, i) => Math.max(mx, i.level || 0), 0),
        ambil, alamat, bayar, kapan, waktuTeks,
      });
      // gak ada popup di sini — langsung lempar ke halaman "Pesenan Aku"
      // (snapshot disimpen dulu biar halaman barunya bisa gambar detail
      //  tanpa nunggu jaringan, terus diganti data asli dari DB)
      simpanLaluPergi(res, {
        nama, ambil, alamat, bayar, kapan, waktuTeks,
        items: keranjang.map((i) => ({ nama: i.nama, qty: i.qty, level: i.level || 0, harga: i.harga })),
      });
    } catch (err) {
      showToast(TmDb.pesanRamah(err), "error");
    } finally {
      btn.disabled = false;
    }
  }

  // ── abis pesenan masuk: simpen snapshot + pindah halaman ──
  // bentuk snapshot SAMA kaya baris tabel pesanan (render di halaman baru
  // gak perlu tau bedanya data snapshot / data asli).
  function simpanLaluPergi(res, f) {
    const snap = {
      kode: res.kode,
      nama: f.nama,
      status: "menunggu",
      items: f.items,
      total: res.total,
      ongkir: res.ongkir || 0, // ongkir COD dari server (0 kalo ambil di toko)
      metode_ambil: f.ambil,
      alamat: f.alamat,
      metode_bayar: f.bayar,
      kapan: f.kapan,
      waktu_teks: f.waktuTeks || null,
      created_at: new Date().toISOString(),
      _snapshot: true, // tanda: ini data sementara, nanti ditimpa data DB
    };
    try {
      sessionStorage.setItem("tm_pesenan_aku", JSON.stringify(snap));
    } catch (e) { /* private mode dll — halaman baru tinggal minta kode */ }

    // form + keranjang dibersihin dulu: kalo pelanggan tombol "back",
    // halaman gak nunjukin keranjang basi (bisa kekirim dobel)
    keranjang = [];
    lvlDraf.clear();
    document.getElementById("formPesen").reset();
    document.getElementById("fieldAlamat").hidden = true;
    document.getElementById("petaToko").hidden = true;
    document.getElementById("fieldWaktu").hidden = true;
    document.getElementById("catatanOngkir").hidden = true; // gak ada pilihan COD lagi
    document.querySelectorAll("#opsiAmbil .opsi, #opsiBayar .opsi").forEach((o) => o.classList.remove("pilih"));
    // reset() balikin radio "sekarang" ke checked — class .pilih-nya ikut dipasang lagi
    document.querySelector('#opsiKapan .opsi input[value="sekarang"]').closest(".opsi").classList.add("pilih");
    daftar.forEach((m) => patchKartu(m.id)); // patch per kartu — foto gak dilepas, gak kedip
    renderRingkas();
    tampilLangkah(1, false); // balik ke langkah 1 (kalo redirect kepentok)

    location.href = "pesenan-aku.html?kode=" + encodeURIComponent(res.kode);
  }

  // ── init ──
  async function mulai() {
    renderSemua();
    pasangOpsi();

    // link "Lihat Google Maps" di peta ilustrasi (kata kunci dari config)
    document.getElementById("btnGmaps").href =
      "https://maps.app.goo.gl/4pnqfbtSeEEeg9NC9" ;

    // klik di kartu menu: stepper − qty + / level pedas
    document.getElementById("gridPilih").addEventListener("click", (e) => {
      const t = e.target.closest("[data-tambah]");
      const k = e.target.closest("[data-kurang]");
      const lv = e.target.closest("[data-level]");
      if (t) ubahQty(Number(t.dataset.tambah), 1);
      else if (k) ubahQty(Number(k.dataset.kurang), -1);
      else if (lv) {
        const [id, v] = lv.dataset.level.split(":").map(Number);
        ubahLevel(id, v);
      }
    });

    document.getElementById("formPesen").addEventListener("submit", kirim);

    // navigasi wizard: Lanjutkan / ← balik / "Ubah lagi" di kartu konfirmasi
    document.getElementById("btnLanjut").addEventListener("click", lanjut);
    document.getElementById("btnBack").addEventListener("click", mundur);
    document.getElementById("btnBalik").addEventListener("click", mundur);

    // mulai dari langkah 1 (gulir=false: halaman baru jangan langsung nge-scroll)
    tampilLangkah(1, false);

    // muat menu
    try {
      daftar = await TmDb.muatMenu();
      renderSemua();
    } catch (err) {
      document.getElementById("gridPilih").innerHTML = '<p class="kosong">Menu gagal dimuat. Coba refresh.</p>';        
      showToast(TmDb.pesanRamah(err), "error");
    }
    try {
      const info = await TmDb.infoWarung();
      TmDb.terapkanBg(info.bg || ""); // foto latar dari setting (kosong = gradient)
    } catch (e) { /* latar tetep gradient hangat kalo gagal */ }
  }

  document.addEventListener("DOMContentLoaded", mulai);
  return {};
})();
