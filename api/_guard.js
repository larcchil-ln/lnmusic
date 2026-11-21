// Penjaga sisi server: panggil di baris pertama tiap endpoint lama (store, login, push, search, turn).
// Kalau website terkunci atau IP diblokir, endpoint menolak permintaan walau skrip di browser dimatikan.
const { r, ip } = require('./_r');
let cache = { t: 0, cfg: {} };
async function guard(q, s) {
  try {
    if (Date.now() - cache.t > 5000) { // simpan 5 detik supaya hemat kuota Upstash
      cache = { t: Date.now(), cfg: JSON.parse((await r('GET', 'lncfg')) || '{}') };
    }
    const c = cache.cfg;
    if (c.locked) { s.status(503).json({ error: 'locked', msg: c.msg || 'Website sedang ditutup sementara.' }); return true; }
    if ((c.banIps || []).includes(ip(q))) { s.status(403).json({ error: 'banned' }); return true; }
  } catch (e) { /* kalau Redis error, biarkan lewat agar web tidak mati */ }
  return false;
}
module.exports = { guard };
