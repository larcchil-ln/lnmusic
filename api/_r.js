// Helper bersama (awalan _ = bukan endpoint). Memakai Upstash REST yang sudah kamu pakai.
const crypto = require('crypto');
const U = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const T = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SECRET = process.env.ADMIN_SECRET || '';
async function r(...cmd) {
  const x = await fetch(U, { method: 'POST', headers: { Authorization: 'Bearer ' + T }, body: JSON.stringify(cmd) });
  return (await x.json()).result;
}
async function rp(cmds) {
  const x = await fetch(U + '/pipeline', { method: 'POST', headers: { Authorization: 'Bearer ' + T }, body: JSON.stringify(cmds) });
  return (await x.json()).map(o => o.result);
}
const ip = q => (q.headers['x-real-ip'] || (q.headers['x-forwarded-for'] || '').split(',')[0] || '').trim() || '?';
const sign = exp => exp + '.' + crypto.createHmac('sha256', SECRET).update(String(exp)).digest('hex');
function okAdmin(t) {
  if (!SECRET || !t) return false;
  const [exp] = String(t).split('.');
  if (!(+exp > Date.now())) return false;
  const a = Buffer.from(sign(exp)), b = Buffer.from(String(t));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const body = q => { try { return typeof q.body === 'string' ? JSON.parse(q.body || '{}') : (q.body || {}); } catch (e) { return {}; } };
module.exports = { r, rp, ip, sign, okAdmin, same, body };
