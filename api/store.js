// Vercel Serverless Function — penyimpanan Upstash Redis (pengganti localStorage)
const { Redis } = require('@upstash/redis');
const crypto = require('node:crypto');

const ALLOWED_ORIGINS = new Set(['https://lnmusic.web.id', 'https://lnmusic.vercel.app', 'https://localhost', 'http://localhost', 'capacitor://localhost', 'ionic://localhost']);
function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
});
// Hash login sama dengan di index.html (bisa dioverride lewat env LN_HASH_NUKI / LN_HASH_NANA)
const HASH = {
  nuki: process.env.LN_HASH_NUKI || '969a8ff0c04cacdbf3b1571fda2369c022cd11b8f20cd75feda6895df99e6043',
  nana: process.env.LN_HASH_NANA || 'c4314da79256da8fe80faa6e33c7ffb7bb26869ffe46e93e85c4040bf7bd0c77'
};
const SECRET = process.env.LN_DB_SECRET || (HASH.nuki + HASH.nana);
const sign = s => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function verify(tok) {
  const [u, exp, sig] = String(tok || '').split('.');
  if (!HASH[u] || !sig || Date.now() > +exp || !same(sig, sign(u + '.' + exp))) return null;
  return u;
}

module.exports = async (req, res) => {
  applyCors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};
  try {
    if (b.action === 'auth') {
      const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim();
      const n = await redis.incr('ln:rl:auth:' + ip);
      if (n === 1) await redis.expire('ln:rl:auth:' + ip, 600);
      if (n > 20) return res.status(429).json({ error: 'terlalu banyak percobaan' });
      const u = String(b.user || '').toLowerCase();
      if (!HASH[u] || !same(sha(`lnmusic|${u}|${b.pass || ''}`), HASH[u])) return res.status(401).json({ error: 'salah' });
      const exp = Date.now() + 30 * 864e5;
      return res.json({ token: `${u}.${exp}.${sign(u + '.' + exp)}` });
    }
    // ===== Room publik (kode LN-XXXX + PIN host) — tanpa login, supaya host bisa lanjut dari perangkat lain =====
    if (b.action === 'croom_create' || b.action === 'croom_claim') {
      const code = String(b.code || '').toUpperCase();
      const pin = String(b.pin || '');
      if (!/^LN-[A-Z0-9]{4,8}$/.test(code)) return res.status(400).json({ error: 'kode tidak valid' });
      if (!/^\d{4,8}$/.test(pin)) return res.status(400).json({ error: 'PIN harus 4-8 angka' });
      const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim();
      const lim = async (k, max) => {
        const n = await redis.incr(k);
        if (n === 1) await redis.expire(k, 600);
        return n > max;
      };
      if (await lim('ln:rl:croom:ip:' + ip, 40) || await lim('ln:rl:croom:code:' + code, 12))
        return res.status(429).json({ error: 'terlalu banyak percobaan' });
      const rk = 'ln:croom:' + code;
      const ttl = 30 * 86400; // 30 hari, diperpanjang tiap host masuk
      if (b.action === 'croom_create') {
        const salt = crypto.randomBytes(8).toString('hex');
        const rec = {
          salt, h: sha(`croom|${salt}|${code}|${pin}`),
          title: String(b.title || '').slice(0, 28),
          hostName: String(b.hostName || '').slice(0, 20),
          at: Date.now()
        };
        const ok = await redis.set(rk, rec, { nx: true, ex: ttl });
        if (!ok) return res.status(409).json({ error: 'kode sudah dipakai' });
        return res.json({ ok: true });
      }
      const rec = await redis.get(rk);
      if (!rec || !same(sha(`croom|${rec.salt}|${code}|${pin}`), rec.h)) return res.status(401).json({ error: 'kode atau PIN salah' });
      await redis.expire(rk, ttl); // perpanjang masa aktif tiap host masuk
      return res.json({ ok: true, title: rec.title, hostName: rec.hostName });
    }

    const user = verify(b.token);
    if (!user) return res.status(401).json({ error: 'token tidak valid' });
    const key = String(b.key || '');
    const shared = ['chat', 'state', 'playlists'].includes(key);
    if (!shared && key !== 'profile:' + user) return res.status(400).json({ error: 'key tidak diizinkan' });
    const rk = shared ? 'ln:shared:' + key : 'ln:' + key;

    if (b.action === 'get') return res.json({ value: (await redis.get(rk)) ?? null });
    if (b.action === 'set') {
      let v = b.value;
      if (JSON.stringify(v ?? null).length > 400000) return res.status(413).json({ error: 'terlalu besar' });
      if (key === 'chat') {
        if (!Array.isArray(v)) return res.status(400).json({ error: 'harus array' });
        if (!b.replace) { // gabungkan agar Nuki & Nana tidak saling menimpa
          const m = new Map(); [...((await redis.get(rk)) || []), ...v].forEach(x => x && x.id && m.set(x.id, x));
          v = [...m.values()].sort((a, c) => (a.ts || 0) - (c.ts || 0)).slice(-300);
        }
      }
      await redis.set(rk, v);
      return res.json({ ok: true });
    }
    return res.status(400).json({ error: 'action tidak dikenal' });
  } catch (e) {
    return res.status(500).json({ error: 'DB error' });
  }
};
