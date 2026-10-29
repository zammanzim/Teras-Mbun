// ============================================================
// CONFIG — TERAS MBUN
// Key di bawah ANON (publik, aman di frontend). Jangan service_role.
// Numpang project Supabase e-learniz-v3 — semua benda di skema `terasmbun`.
// ============================================================
const TM_SUPABASE_URL = "https://vttmwtlqzbbiaromohrp.supabase.co";
const TM_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0dG13dGxxemJiaWFyb21vaHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg4NTMsImV4cCI6MjA4MDg0NDg1M30.16SwOEqD5ZNAgk1oWhLrL41Eqw4kkeAKTyHxkSqmpiY";

// Skema Supabase khusus project ini (lihat db/001-terasmbun.sql)
const TM_SCHEMA = "terasmbun";

// Kunci storage
const TM_KERANJANG_KEY = "tm_keranjang";   // keranjang customer (localStorage)
const TM_PIN_KEY = "tm_pin";               // PIN dapur sesudah verifikasi (sessionStorage)
