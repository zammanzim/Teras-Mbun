// ============================================================
// dapur.js — sisi ADMIN DAPUR: masuk PIN, lihat daftar pesenan
// realtime, ceklis status (menunggu → dibuat → siap), share WA.
// PIN disimpan di sessionStorage (hilang kalau tab ditutup).
// ============================================================

const Dapur = (function () {
  "use strict";

  let pesanan = [];        // semua yang dimuat
  let tabAktif = "menunggu";
  let hariIniSaja = true;
  let waPenjual = "";
  let pin = sessionStorage.getItem(TM_PIN_KEY) || "";

  const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const jam = (iso) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

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
      bukaDapur();
    } catch (err) {
      showToast(TmDb.pesanRamah(err), "error");
    } finally {
      btn.disabled = false;
    }
  }

  async function bukaDapur() {
    document.getElementById("gate").hidden = true;
    document.getElementById("isi").hidden = false;
    Notice.show("live", "Live", { icon: "fa-solid fa-satellite-dish", type: "green" });
    try {
      const info = await TmDb.infoWarung();
      waPenjual = info.wa_penjual || "";
    } catch (e) { /* tombol WA tetap jalan tanpa nomor (diblokir) */ }
    await muat();
    TmDb.subscribe(() => muat(true)); // realtime: list ke-update sendiri
  }

  // ── muat + render ──
  async function muat(diam) {
    try {
      pesanan = await TmDb.muatPesanan(hariIniSaja);
      render();
    } catch (err) {
      if (!diam) showToast(TmDb.pesanRamah(err), "error");
      else Notice.show("live", "Gagal muat ulang", { icon: "fa-solid fa-triangle-exclamation", type: "red" });
    }
  }

  function render() {
    // hitung per status buat angka tab
    ["menunggu", "dibuat", "siap"].forEach((s) => {
      document.getElementById("jml" + s.charAt(0).toUpperCase() + s.slice(1))
        .textContent = pesanan.filter((p) => p.status === s).length;
    });

    const daftar = document.getElementById("daftar");
    const tampil = pesanan.filter((p) => p.status === tabAktif);
    if (!tampil.length) {
      daftar.innerHTML = `<p class="kosong">Gak ada pesenan ${tabAktif === "menunggu" ? "baru" : "di tab ini"} 🎉</p>`;
      return;
    }
    daftar.innerHTML = tampil.map((p, ix) => kartu(p, ix)).join("");
  }

  function kartu(p, ix) {
    const items = Array.isArray(p.items) ? p.items : [];
    // tombol aksi sesuai status
    let aksi = "";
    if (p.status === "menunggu") {
      aksi = `<button class="btn btn-kuning btn-lebar" data-mulai="${p.id}">
        <i class="fa-solid fa-fire-burner"></i> Mulai masak</button>`;
    } else if (p.status === "dibuat") {
      aksi = `<button class="btn btn-hijau btn-lebar" data-siap="${p.id}">
        <i class="fa-solid fa-check"></i> Beres, siap diambil</button>`;
    }
    return `<div class="baris-pesanan" style="animation-delay:${ix * 30}ms">
      <div class="head">
        <span class="kode">#${esc(p.kode)}</span>
        <span class="pembeli">${esc(p.nama)}</span>
        <span class="jam"><i class="fa-regular fa-clock"></i> ${jam(p.created_at)}</span>
      </div>
      <ul class="daftar-item">
        ${items.map((i) => `<li>• ${esc(i.nama || "Menu")} <b>${esc(i.qty || 1)}x</b></li>`).join("")}
      </ul>
      ${p.catatan ? `<p style="color:var(--kuning);font-size:.85rem"><i class="fa-solid fa-comment-dots"></i> ${esc(p.catatan)}</p>` : ""}
      <p class="total">${rupiah(p.total)}</p>
      <div class="aksi">${aksi}</div>
    </div>`;
  }

  // ── ubah status (kirim PIN tersembunyi tiap kali) ──
  async function ubah(id, status, tombol) {
    tombol.disabled = true;
    try {
      const ok = await TmDb.ubahStatus(id, status, pin);
      if (!ok) {
        showToast("PIN gak valid. Masuk ulang ya.", "error");
        keluar();
        return;
      }
      showToast(status === "dibuat" ? "Oke, lagi dimasak." : "Mantap, siap diambil!");
      await muat(true);
    } catch (err) {
      showToast(TmDb.pesanRamah(err), "error");
      tombol.disabled = false;
    }
  }

  // ── share WA: ringkasan pesenan hari ini ──
  function shareWa() {
    if (!pesanan.length) { showToast("Belum ada pesenan.", "info"); return; }
    const baris = pesanan.map((p, ix) => {
      const items = (Array.isArray(p.items) ? p.items : [])
        .map((i) => `${i.nama} ${i.qty}x`).join(", ");
      return `${ix + 1}. #${p.kode} ${p.nama} — ${items} (${rupiah(p.total)}) [${p.status}]`;
    });
    const teks = `*PESenan TERAS MBUN*\n${hariIniSaja ? "Hari ini" : "Semua"}:\n\n` +
      baris.join("\n") + `\n\nTotal: ${rupiah(pesanan.reduce((s, p) => s + p.total, 0))}`;
    // nomor penjual dari setting; kalau belum diisi, share ke nomor kosong = popup WA biasa
    const nomor = waPenjual ? waPenjual : "";
    window.open(`https://wa.me/${nomor}?text=${encodeURIComponent(teks)}`, "_blank");
  }

  function keluar() {
    sessionStorage.removeItem(TM_PIN_KEY);
    pin = "";
    document.getElementById("isi").hidden = true;
    document.getElementById("gate").hidden = false;
    document.getElementById("inputPin").value = "";
    Notice.hide("live");
  }

  // ── init ──
  function mulai() {
    document.getElementById("btnMasuk").addEventListener("click", cobaMasuk);
    document.getElementById("inputPin").addEventListener("keydown", (e) => {
      if (e.key === "Enter") cobaMasuk();
    });

    document.getElementById("tabs").addEventListener("click", (e) => {
      const b = e.target.closest("[data-tab]");
      if (!b) return;
      tabAktif = b.dataset.tab;
      document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("aktif", t === b));
      render();
    });

    document.getElementById("daftar").addEventListener("click", (e) => {
      const mulai = e.target.closest("[data-mulai]");
      const siap = e.target.closest("[data-siap]");
      if (mulai) ubah(mulai.dataset.mulai, "dibuat", mulai);
      else if (siap) ubah(siap.dataset.siap, "siap", siap);
    });

    document.getElementById("btnSegarkan").addEventListener("click", () => muat());
    document.getElementById("btnKeluar").addEventListener("click", () => {
      showPopup("Keluar dari mode dapur?", "confirm").then((y) => { if (y) keluar(); });
    });
    document.getElementById("btnHariIni").addEventListener("click", () => {
      hariIniSaja = !hariIniSaja;
      document.getElementById("subJudul").textContent = hariIniSaja ? "PESENAN HARI INI" : "SEMUA PESENAN";
      showToast(hariIniSaja ? "Filter: hari ini" : "Filter: semua pesenan", "info");
      muat();
    });
    document.getElementById("btnShareWa").addEventListener("click", shareWa);

    // udah pernah masuk PIN di tab ini? langsung buka
    if (pin) cobaMasuk();
  }

  document.addEventListener("DOMContentLoaded", mulai);
  return {};
})();
