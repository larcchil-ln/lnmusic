// Daftar room aktif (publik). Host mengirim "beat" tiap ~20 detik; room hilang otomatis kalau 60 detik tanpa beat.
// GET  -> { rooms: [{ code, title, host, count, playing }] }
// POST -> { action: 'beat' | 'end', code, tok, title, host, count, playing }
// Room Kita (Nuki & Nana) tidak pernah dikirim ke sini, jadi tidak pernah tampil di daftar.
const { r, rp, ip, body } = require('./_r');
const { guard } = require('./_guard');
const TTL = 60;
const clean = (x, n) => String(x || '').replace(/[<>&"'`\r\n]/g, '').trim().slice(0, n);
module.exports = async (q, s) => {
  s.setHeader('Cache-Control', 'no-store');
  if (await guard(q, s)) return;
  const bad = (c, m) => s.status(c).json({ error: m });
  try {
    if (q.method === 'GET') {
      const now = Date.now(), min = now - TTL * 1000;
      await r('ZREMRANGEBYSCORE', 'lnlive', '-inf', min);
      const codes = await r('ZREVRANGEBYSCORE', 'lnlive', '+inf', min, 'LIMIT', 0, 30);
      if (!codes || !codes.length) return s.json({ rooms: [] });
      const vals = await r('MGET', ...codes.map(c => 'lnlive:' + c));
      const rooms = [];
      (vals || []).forEach(v => {
        try { const o = JSON.parse(v || 'null'); if (o) rooms.push({ code: o.code, title: o.title, host: o.host, count: o.count, playing: o.playing }); } catch (e) {}
      });
      return s.json({ rooms });
    }
    if (q.method !== 'POST') return s.status(405).end();
    const b = body(q), code = String(b.code || '').toUpperCase(), tok = String(b.tok || '');
    if (!/^LN-[A-Z0-9]{4,8}$/.test(code)) return bad(400, 'Kode tidak valid');
    if (!/^[a-z0-9]{8,40}$/.test(tok)) return bad(400, 'Token tidak valid');
    const rk = 'lnlr:' + ip(q), n = await r('INCR', rk); if (n === 1) await r('EXPIRE', rk, 60);
    if (n > 30) return bad(429, 'Terlalu sering. Coba lagi sebentar.');
    let cur = null; try { cur = JSON.parse(await r('GET', 'lnlive:' + code) || 'null'); } catch (e) {}
    if (cur && cur.tok !== tok) return bad(409, 'Room ini sedang dipakai host lain');
    if (b.action === 'end') {
      if (cur) await rp([['DEL', 'lnlive:' + code], ['ZREM', 'lnlive', code]]);
      return s.json({ ok: true });
    }
    if (b.action === 'beat') {
      const o = {
        code, tok,
        title: clean(b.title, 30) || 'Room ' + code,
        host: clean(b.host, 20) || 'Host',
        count: Math.max(1, Math.min(99, parseInt(b.count, 10) || 1)),
        playing: clean(b.playing, 60)
      };
      await rp([['SET', 'lnlive:' + code, JSON.stringify(o), 'EX', TTL], ['ZADD', 'lnlive', Date.now(), code]]);
      return s.json({ ok: true });
    }
    return bad(400, 'Aksi tidak dikenal');
  } catch (e) {
    return bad(500, 'Server tidak bisa dihubungi');
  }
};
