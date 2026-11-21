// Backend dashboard admin. Env: ADMIN_USER, ADMIN_PASS, ADMIN_SECRET (acak panjang).
const { r, rp, ip, sign, okAdmin, same, body } = require('./_r');
const J = x => { try { return JSON.parse(x); } catch (e) { return null; } };
module.exports = async (q, s) => {
  s.setHeader('Cache-Control', 'no-store');
  if (q.method !== 'POST') return s.status(405).end();
  const b = body(q), now = Date.now();
  if (!process.env.ADMIN_PASS || !process.env.ADMIN_SECRET) return s.status(500).json({ error: 'ENV admin belum diisi' });
  if (b.action === 'login') {
    const k = 'lnadm:f:' + ip(q), n = await r('INCR', k); if (n === 1) await r('EXPIRE', k, 600);
    if (n > 8) return s.status(429).json({ error: 'Terlalu banyak percobaan, tunggu 10 menit' });
    if (same(b.user || '', process.env.ADMIN_USER || 'admin') && same(b.pass || '', process.env.ADMIN_PASS)) { await r('DEL', k); return s.json({ token: sign(now + 12 * 3600e3) }); }
    return s.status(401).json({ error: 'Username atau password salah' });
  }
  if (!okAdmin(b.token)) return s.status(401).json({ error: 'Sesi habis' });
  const cfg = J(await r('GET', 'lncfg')) || {};
  const save = () => r('SET', 'lncfg', JSON.stringify(cfg));
  const arr = k => (cfg[k] = cfg[k] || []);
  const add = (k, v) => { if (v && !arr(k).includes(v)) arr(k).push(v); };
  const del = (k, v) => { cfg[k] = arr(k).filter(x => x !== v); };
  switch (b.action) {
    case 'lock': cfg.locked = !!b.on; if (typeof b.msg === 'string') cfg.msg = b.msg.slice(0, 200); await save(); break;
    case 'ban': add(b.kind === 'vid' ? 'banVids' : 'banIps', String(b.value || '').slice(0, 60)); await save(); break;
    case 'unban': del(b.kind === 'vid' ? 'banVids' : 'banIps', String(b.value || '')); await save(); break;
    case 'closeRoom': add('closed', String(b.code || '').slice(0, 20)); await save(); break;
    case 'openRoom': del('closed', String(b.code || '')); await save(); break;
    case 'broadcast': cfg.bc = b.text ? { text: String(b.text).slice(0, 200), id: String(now) } : null; await save(); break;
    case 'clearLog': await r('DEL', 'lnlog'); break;
  }
  const [act, recent, rooms, total, log] = await rp([
    ['ZRANGEBYSCORE', 'lnseen', now - 120000, '+inf'], ['ZREVRANGE', 'lnseen', 0, 59],
    ['ZRANGEBYSCORE', 'lnrooms', now - 120000, '+inf'], ['ZCARD', 'lnseen'], ['LRANGE', 'lnlog', 0, 79]]);
  const ids = [...new Set([...(recent || []), ...(act || [])])];
  const vs = ids.length ? (await r('MGET', ...ids.map(i => 'lnv:' + i))).map(J).filter(Boolean) : [];
  const rs = (rooms || []).length ? (await r('MGET', ...rooms.map(c => 'lnroom:' + c))).map(J).filter(Boolean) : [];
  vs.forEach(v => { v.online = now - v.last < 120000; });
  vs.sort((x, y) => y.last - x.last);
  s.json({ now, cfg, online: (act || []).length, total, visitors: vs, rooms: rs, log: (log || []).map(J).filter(Boolean) });
};
