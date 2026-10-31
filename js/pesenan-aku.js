// ============================================================
// pesenan-aku.js — halaman PESENAN AKU (riwayat pelanggan).
// Sumbernya LOCAL STORAGE (bukan ?kode=): tiap pesenan yang pernah
// dikirim kesimpen di situ sebagai baris mirip DB, halaman ini gambar
// SEMUA kartu riwayat, terus ditimpa data asli dari DB (status live).
// QRIS digabung di dalem kartu pesenannya — gak kartu terpisah.
// ============================================================

const PesenanAku = (function () {
  "use strict";

  const KEY = "tm_history_pesenan"; // localStorage: array baris pesanan
  const KEY_LAMA = "tm_pesenan_aku"; // snapshot lama (sekali pindahan)
  const MAKS = 20; // riwayat disimpen paling banyak 20

  let daftarPsn = []; // riwayat, paling baru di atas
  let waPenjual = "";
  let fotoQris = "";

  const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
  const esc = (s) =>
    String(s == null ? "" : s).replace(
      /[&<>\"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const tanggal = (iso) =>
    new Date(iso).toLocaleString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  // label status → ikon + teks + warna
  const STATUS = {
    menunggu: {
      ikon: "fa-solid fa-hourglass-half",
      teks: "Menunggu dapur",
      kelas: "s-menunggu",
    },
    dibuat: {
      ikon: "fa-solid fa-fire-burner",
      teks: "Lagi dibuat",
      kelas: "s-dibuat",
    },
    siap: { ikon: "fa-solid fa-check", teks: "Siap!", kelas: "s-siap" },
  };

  // ── baca / simpan riwayat di localStorage ──
  function bacaRiwayat() {
    try {
      const arr = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(arr) ? arr.filter((p) => p && p.kode) : [];
    } catch (e) {
      return [];
    }
  }
  function simpanRiwayat() {
    try {
      localStorage.setItem(KEY, JSON.stringify(daftarPsn.slice(0, MAKS)));
    } catch (e) {
      /* storage penuh / private mode — tampilan tetep jalan */
    }
  }
  function hapusRiwayat() {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(KEY_LAMA); // snapshot lama ikut dibuang
    } catch (e) {
      /* abaikan */
    }
  }

  // teks jadwal kirim yang enak dibaca
  function teksJadwal(p) {
    if (p.kapan === "besok") {
      const b = new Date(p.created_at);
      b.setDate(b.getDate() + 1);
      return (
        "Besok, " +
        b.toLocaleDateString("id-ID", {
          weekday: "short",
          day: "numeric",
          month: "short",
        })
      );
    }
    if (p.kapan === "custom" && p.waktu_teks) return p.waktu_teks; // teks bebas user
    return "Sekarang";
  }

  // ── 1 kartu riwayat (rincian + info + QRIS jadi satu) ──
  function kartuHtml(p, ix) {
    const items = Array.isArray(p.items) ? p.items : [];
    const s = STATUS[p.status] || STATUS.menunggu;
    const urut = ["menunggu", "dibuat", "siap"];
    const kini = urut.indexOf(p.status);

    // langkah progress Menunggu → Dibuat → Siap
    const langkah = [
      ["menunggu", "fa-solid fa-receipt", "Menunggu"],
      ["dibuat", "fa-solid fa-fire-burner", "Dibuat"],
      ["siap", "fa-solid fa-check", "Siap"],
    ]
      .map(
        ([v, ikon, teks], ixL) => `
      <li class="${ixL < kini ? "lewat" : ""}${ixL === kini ? " aktif" : ""}">
        <i class="${ikon}"></i><span>${teks}</span>
      </li>`,
      )
      .join("");

    // rincian item + ongkir (kalo COD)
    const ongkirBaris =
      Number(p.ongkir || 0) > 0
        ? `<li><span>Ongkir COD </span><b>+${rupiah(p.ongkir)}</b></li>`
        : "";
    const daftarItem =
      items
        .map(
          (i) =>
            `<li><span>${esc(i.nama || "Menu")} ${esc(i.qty || 1)}x${i.level > 0 ? ` <b class="lvl-item">🌶️${esc(i.level)}</b>` : ""}</span><b>${rupiah((i.harga || 0) * (i.qty || 1))}</b></li>`,
        )
        .join("") + ongkirBaris;

    // baris info
    const baris = [];
    baris.push(["fa-regular fa-clock", "Dibuat", tanggal(p.created_at)]);
    baris.push(["fa-regular fa-calendar", "Diantar kapan", teksJadwal(p)]);
    baris.push([
      p.metode_ambil === "cod" ? "fa-solid fa-motorcycle" : "fa-solid fa-store",
      p.metode_ambil === "cod" ? "Diantar" : "Ambil di toko",
      p.metode_ambil === "cod" ? p.alamat || "—" : "Teras Mbun",
    ]);
    if (p.metode_bayar) {
      baris.push([
        p.metode_bayar === "qris"
          ? "fa-solid fa-qrcode"
          : "fa-solid fa-money-bill-wave",
        "Bayar",
        p.metode_bayar === "qris" ? "QRIS" : "Tunai",
      ]);
    }
    const ongkirAda = Number(p.ongkir || 0) > 0;
    if (ongkirAda)
      baris.push(["fa-solid fa-truck", "Ongkir*", `+${rupiah(p.ongkir)}`]);
    const infoHtml =
      baris
        .map(
          ([ikon, label, nilai]) => `
      <div class="aku-baris"><i class="${ikon}"></i>
        <span class="lbl">${esc(label)}</span>
        <span class="val">${esc(nilai)}</span>
      </div>`,
        )
        .join("") +
      (ongkirAda
        ? `<p class="catatan-ongkir kecil"><i class="fa-solid fa-circle-info"></i>
             <span>*Ongkir — Rp${Number(p.ongkir).toLocaleString("id-ID")} cuma awal,
             bisa berubah tergantung makin deket / makin jauh.</span></p>`
        : "");

    // QRIS: di dalem kartu yang sama (gak kartu terpisah lagi)
    const qris = p.metode_bayar === "qris";
    const qrisHtml = `
      <div class="qris-bayar aku-qris" data-kode="${esc(p.kode)}" ${qris ? "" : "hidden"}>
        <h3 class="aku-judul"><i class="fa-solid fa-qrcode"></i> Bayar QRIS</h3>
        <p class="qris-total">Total bayar: ${rupiah(p.total)}</p>
        <div class="qris-foto" data-foto="${esc(p.kode)}"></div>
        <p class="catatan-qris" data-catatan="${esc(p.kode)}"></p>
        <div class="aksi-media">
          <button class="btn btn-kecil btn-foto" data-bukti="${esc(p.kode)}" ${qris && waPenjual ? "" : "hidden"}>
            <i class="fa-brands fa-whatsapp"></i> Kabari kalo udah bayar
          </button>
        </div>
      </div>`;

    return `<section class="kartu-form aku-detail" data-kode="${esc(p.kode)}" style="animation-delay:${ix * 40}ms">
      <div class="aku-head">
        <span class="aku-kode">Pesanan #${esc(p.kode)}</span>
        <span class="aku-status ${s.kelas}"><i class="${s.ikon}"></i> ${s.teks}</span>
      </div>
      <p class="aku-sapa">${
        p._snapshot
          ? "Lagi nunggu konfirmasi dari dapur…"
          : `Makasih udah pesen, ${esc(p.nama || "Kak")}!`
      }</p>

      <ol class="aku-langkah">${langkah}</ol>

      <h3 class="aku-judul"><i class="fa-solid fa-receipt"></i> Rincian</h3>
      <ul class="daftar-item">${daftarItem || "<li>Belum ada rincian.</li>"}</ul>
      <p class="rincian-total"><span>Total: </span><b>${rupiah(p.total)}</b></p>

      <h3 class="aku-judul"><i class="fa-solid fa-circle-info"></i> Info</h3>
      <div class="aku-info">${infoHtml}</div>

      ${qrisHtml}

      <div class="aku-baris-aksi">
        <button class="btn btn-kecil btn-hijau" data-wa="${esc(p.kode)}">
          <i class="fa-brands fa-whatsapp"></i> Hubungi Penjual
        </button>
        <a class="btn btn-kecil btn-kaca" href="pesen"><i class="fa-solid fa-plus"></i> Pesan lagi</a>
      </div>
    </section>`;
  }

  function render() {
    const box = document.getElementById("daftarAku");
    document.getElementById("akuMuat").hidden = true;
    const kosong = daftarPsn.length === 0;
    document.getElementById("akuKosong").hidden = !kosong;
    document.getElementById("akuAksi").hidden = kosong;
    box.innerHTML = daftarPsn.map(kartuHtml).join("");
    isiFotoQris(); // foto QRIS dari setting (kalo udah ke-load)
  }

  // patch status SATU kartu (pill + langkah) — gak render ulang detail
  function patchStatus(p) {
    const kartu = document.querySelector(
      `#daftarAku [data-kode="${CSS.escape(String(p.kode))}"]`,
    );
    if (!kartu) return;
    const s = STATUS[p.status] || STATUS.menunggu;
    const pill = kartu.querySelector(".aku-status");
    pill.className = "aku-status " + s.kelas;
    pill.innerHTML = `<i class="${s.ikon}"></i> ${s.teks}`;
    const kini = ["menunggu", "dibuat", "siap"].indexOf(p.status);
    kartu.querySelectorAll(".aku-langkah li").forEach((li, ix) => {
      li.classList.toggle("lewat", ix < kini);
      li.classList.toggle("aktif", ix === kini);
    });
  }

  // isi foto QRIS ke semua kartu qris (panggil lagi abis info warung sampai)
  function isiFotoQris() {
    document.querySelectorAll(".aku-qris").forEach((q) => {
      if (q.hidden) return;
      const kotak = q.querySelector(".qris-foto");
      const cat = q.querySelector(".catatan-qris");
      if (fotoQris) {
        kotak.innerHTML = `<img src="${esc(fotoQris)}" alt="QRIS Teras Mbun" loading="lazy">`;
        cat.textContent =
          "Scan pakai aplikasi apa aja, nominal sesuai total. Abis bayar, kabari penjual ya.";
      } else {
        kotak.innerHTML = "";
        cat.textContent =
          "QRIS-nya lagi disiapin — kabari penjual langsung ya.";
      }
      const btn = q.querySelector("[data-bukti]");
      btn.hidden = !waPenjual;
    });
  }

  // ── share WA ──
  function teksWa(p) {
    const items = (Array.isArray(p.items) ? p.items : [])
      .map(
        (i) =>
          `• ${i.nama} ${i.qty}x${i.level > 0 ? ` (Pedas Lv${i.level})` : ""}`,
      )
      .join("%0A");
    const ambilTeks =
      p.metode_ambil === "cod" ? "Diantar (COD)" : "Ambil di toko";
    const bayarTeks = p.metode_bayar === "qris" ? "QRIS" : "Tunai";
    return (
      `Halo, mau pesen di Teras Mbun.%0A` +
      `Kode: *${p.kode}*%0A${items}%0ATotal: ${rupiah(p.total)}` +
      `%0ATerima: ${ambilTeks}` +
      (p.alamat ? `%0AAlamat: ${p.alamat}` : "") +
      `%0ADiantar: ${teksJadwal(p)}%0ABayar: ${bayarTeks}`
    );
  }
  function cari(kode) {
    return daftarPsn.find((p) => p.kode === kode);
  }

  // ── tarik data asli dari DB buat semua kode (1 request) ──
  async function segarkan(diam) {
    try {
      const rows = await TmDb.muatPesananByKodes(daftarPsn.map((p) => p.kode));
      if (!rows.length) return;
      rows.forEach((r) => {
        const ix = daftarPsn.findIndex((p) => p.kode === r.kode);
        if (ix < 0) return;
        r._snapshot = false; // data asli dari DB — bukan snapshot lagi
        daftarPsn[ix] = Object.assign({}, daftarPsn[ix], r);
      });
      simpanRiwayat();
      daftarPsn.forEach(patchStatus); // patch pill/langkah doang, gak render ulang
    } catch (e) {
      if (!diam) showToast(TmDb.pesanRamah(e), "error");
    }
  }

  // ── tombol per kartu (event delegate) ──
  function pasangAksi() {
    document.getElementById("daftarAku").addEventListener("click", (e) => {
      const wa = e.target.closest("[data-wa]");
      const bukti = e.target.closest("[data-bukti]");
      if (wa) {
        const p = cari(wa.dataset.wa);
        if (!p) return;
        if (!waPenjual) {
          showToast("Nomor penjual belum diisi.", "info");
          return;
        }
        window.open(`https://wa.me/${waPenjual}?text=${teksWa(p)}`, "_blank");
      } else if (bukti) {
        const p = cari(bukti.dataset.bukti);
        if (!p) return;
        const teks = `Halo, udah bayar QRIS pesenan #${p.kode} total ${rupiah(p.total)} ya. Ini buktinya 🙏`;
        window.open(
          `https://wa.me/${waPenjual}?text=${encodeURIComponent(teks)}`,
          "_blank",
        );
      }
    });

    // bersihkan riwayat (2x klik biar gak keapus gara-gara salah pencet)
    let konfirmasi = false;
    document.getElementById("btnBersih").addEventListener("click", (e) => {
      if (!konfirmasi) {
        konfirmasi = true;
        e.currentTarget.innerHTML =
          '<i class="fa-solid fa-triangle-exclamation"></i> Yakin? Klik lagi';
        setTimeout(() => {
          konfirmasi = false;
          e.currentTarget.innerHTML =
            '<i class="fa-solid fa-broom"></i> Bersihkan';
        }, 4000);
        return;
      }
      hapusRiwayat();
      daftarPsn = [];
      render();
      showToast("Riwayat dibersihkan.", "info");
    });
  }

  async function mulai() {
    daftarPsn = bacaRiwayat();

    // pindahan dari snapshot lama (masa transisi, biar gak ilang)
    if (!daftarPsn.length) {
      try {
        const lama =
          JSON.parse(localStorage.getItem(KEY_LAMA) || "null") ||
          JSON.parse(sessionStorage.getItem(KEY_LAMA) || "null");
        if (lama && lama.kode) {
          daftarPsn = [lama];
          simpanRiwayat();
        }
      } catch (e) {
        /* snap rusak — abaikan */
      }
    }

    // link lama berbentuk ?kode=XXX: masukin ke riwayat biar gak ilang
    const urlKode = new URLSearchParams(location.search).get("kode");
    if (urlKode && !daftarPsn.some((p) => p.kode === urlKode)) {
      try {
        const p = await TmDb.muatPesananByKode(urlKode);
        if (p) daftarPsn.unshift(p);
      } catch (e) {
        /* offline — link lama diabaikan */
      }
    }

    if (!daftarPsn.length) {
      document.getElementById("akuMuat").hidden = true;
      document.getElementById("akuKosong").hidden = false;
      return;
    }

    simpanRiwayat();
    render(); // gambar dari lokal dulu (langsung keliatan, offline pun jalan)
    pasangAksi();
    await segarkan(); // abis itu tarik status terbaru dari DB (kartu gak dirender ulang)

    // info warung: latar + foto QRIS + nomor WA
    try {
      const info = await TmDb.infoWarung();
      waPenjual = info.wa_penjual || "";
      fotoQris = info.qris || "";
      TmDb.terapkanBg(info.bg || "");
      isiFotoQris();
      document.querySelectorAll("[data-bukti]").forEach((b) => {
        b.hidden = !waPenjual;
      });
    } catch (e) {
      /* QRIS/WA jadi teks fallback */
    }

    // live: apapun berubah di dapur → refresh semua kode, patch pill doang
    TmDb.subscribe(() => segarkan(true));
  }

  document.addEventListener("DOMContentLoaded", mulai);
  return {};
})();
