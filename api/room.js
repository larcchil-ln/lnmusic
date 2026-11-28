// Akun room pribadi: daftar & masuk. Setiap akun = 1 room tetap dengan kode LN-XXXXXX.
const crypto = require('crypto');
const { r, ip, body } = require('./_r');
const { guard } = require('./_guard');
const scrypt = (p, s) => new Promise((res, rej) => crypto.scrypt(p, s, 32, (e, k) => e ? rej(e) : res(k.toString('hex'))));
const clean = (x, n) => String(x || '').replace(/[<>&"'`]/g, '').trim().slice(0, n);
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => 'LN-' + Array.from(crypto.randomBytes(6), b => CH[b % CH.length]).join('');
module.exports = async (q, s) => {
  if (require('./_cors').cors(q, s)) return;
  s.setHeader('Cache-Control', 'no-store');
  if (q.method !== 'POST') return s.status(405).end();
  if (await guard(q, s)) return;
  const b = body(q), u = String(b.user || '').toLowerCase(), pw = String(b.pass || '');
  const bad = (c, m) => s.status(c).json({ error: m });
  if (!/^[a-z0-9_]{3,20}$/.test(u)) return bad(400, 'Username 3-20 karakter: huruf kecil, angka, atau _');
  if (pw.length < 6 || pw.length > 72) return bad(400, 'Password minimal 6 karakter');
  if (b.action === 'register') {
    if (['nuki', 'nana', 'admin', 'guest', 'tamu'].includes(u)) return bad(400, 'Username ini tidak tersedia');
    const name = clean(b.name, 20); if (name.length < 2) return bad(400, 'Nama tampilan minimal 2 huruf');
    const rk = 'lnreg:' + ip(q), n = await r('INCR', rk); if (n === 1) await r('EXPIRE', rk, 3600);
    if (n > 5) return bad(429, 'Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.');
    let code = ''; for (let i = 0; i < 8 && !code; i++) { const c = newCode(); if (await r('SET', 'lncode:' + c, u, 'NX')) code = c; }
    if (!code) return bad(500, 'Gagal membuat kode room, coba lagi');
    const salt = crypto.randomBytes(16).toString('hex'), title = clean(b.title, 30) || 'Room ' + name;
    const acct = { salt, hash: await scrypt(pw, salt), name, code, title, created: Date.now() };
    if (!(await r('SET', 'lnacct:' + u, JSON.stringify(acct), 'NX'))) { await r('DEL', 'lncode:' + code); return bad(409, 'Username sudah dipakai'); }
    return s.json({ ok: true, name, code, title });
  }
  if (b.action === 'login') {
    const fk = 'lnrf:' + ip(q), f = +(await r('GET', fk) || 0);
    if (f >= 10) return bad(429, 'Terlalu banyak percobaan. Coba lagi sekitar 10 menit lagi.');
    let a = null; try { a = JSON.parse(await r('GET', 'lnacct:' + u) || 'null'); } catch (e) {}
    const ok = a && same(await scrypt(pw, a.salt), a.hash);
    if (!ok) { const n = await r('INCR', fk); if (n === 1) await r('EXPIRE', fk, 600); return bad(401, 'Username atau password salah'); }
    return s.json({ ok: true, name: a.name, code: a.code, title: a.title });
  }
  bad(400, 'Aksi tidak dikenal');
};
