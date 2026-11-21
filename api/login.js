/* POST /api/login  { user, pass }  →  200 {ok:true} | 401 | 429 | 501 (belum dikonfigurasi)
 *
 * Env var di Vercel (Project → Settings → Environment Variables):
 *   LN_HASH_NUKI, LN_HASH_NANA  = nilai `hash:` yang sekarang ada di USERS pada index.html
 *                                 (format: sha256 dari "lnmusic|<user>|<password>")
 * Opsional, untuk pembatasan percobaan yang bertahan antar request (Upstash dari integrasi Vercel):
 *   KV_REST_API_URL + KV_REST_API_TOKEN   (atau UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 * Tanpa Upstash, pembatasan tetap jalan tapi hanya di memori instance (kurang rapat).
 */
const crypto = require('crypto');

const HASHES = {
  nuki: () => process.env.LN_HASH_NUKI,
  nana: () => process.env.LN_HASH_NANA
};
const MAX_FAILS = 8;          // gagal berturut-turut per IP
const WINDOW_SEC = 10 * 60;   // jendela pembatasan

const REST_URL = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const mem = new Map(); // fallback: ip -> { n, exp }

async function redis(cmds) {
  const r = await fetch(REST_URL().replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REST_TOKEN(), 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  return r.json();
}
const useRedis = () => !!(REST_URL() && REST_TOKEN());

async function failCount(key) {
  if (useRedis()) {
    try { const [g] = await redis([['GET', key]]); return +g.result || 0; } catch (e) { /* jatuh ke memori */ }
  }
  const m = mem.get(key);
  return m && m.exp > Date.now() ? m.n : 0;
}
async function addFail(key) {
  if (useRedis()) {
    try { await redis([['INCR', key], ['EXPIRE', key, WINDOW_SEC]]); return; } catch (e) { /* jatuh ke memori */ }
  }
  const m = mem.get(key);
  mem.set(key, m && m.exp > Date.now() ? { n: m.n + 1, exp: m.exp } : { n: 1, exp: Date.now() + WINDOW_SEC * 1000 });
}
async function clearFail(key) {
  if (useRedis()) { try { await redis([['DEL', key]]); } catch (e) {} }
  mem.delete(key);
}

function safeEqualHex(a, b) {
  const x = Buffer.from(String(a), 'utf8'), y = Buffer.from(String(b), 'utf8');
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false }); }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const user = String(body.user || '').trim().toLowerCase();
  const pass = String(body.pass || '');

  // Belum dikonfigurasi → 501 supaya klien boleh memakai cadangan lokal.
  if (!HASHES.nuki() && !HASHES.nana()) return res.status(501).json({ ok: false, error: 'not_configured' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const key = 'ln:login:fail:' + ip;

  if ((await failCount(key)) >= MAX_FAILS) return res.status(429).json({ ok: false, error: 'rate_limited' });

  let ok = false;
  const getHash = HASHES[user];
  if (getHash && getHash() && pass.length > 0 && pass.length < 200) {
    const h = crypto.createHash('sha256').update(`lnmusic|${user}|${pass}`).digest('hex');
    ok = safeEqualHex(h, getHash().trim().toLowerCase());
  }

  if (!ok) {
    await addFail(key);
    await new Promise(r => setTimeout(r, 400)); // memperlambat tebak-tebakan
    return res.status(401).json({ ok: false });
  }
  await clearFail(key);
  return res.status(200).json({ ok: true });
};
