// Dipanggil ln-guard.js tiap ~60 detik: catat pengunjung + room, balas status kunci/blokir.
const { r, rp, ip, okAdmin, body } = require('./_r');
const t = (x, n = 80) => String(x == null ? '' : x).slice(0, n);
module.exports = async (q, s) => {
  if (require('./_cors').cors(q, s)) return;
  s.setHeader('Cache-Control', 'no-store');
  if (q.method !== 'POST') return s.status(405).end();
  const b = body(q), vid = t(b.vid, 40).replace(/[^\w]/g, '');
  if (!vid) return s.status(400).end();
  const now = Date.now(), a = ip(q), admin = okAdmin(q.headers['x-admin-token']);
  let cfg = {}; try { cfg = JSON.parse(await r('GET', 'lncfg') || '{}'); } catch (e) {}
  const banned = !admin && ((cfg.banIps || []).includes(a) || (cfg.banVids || []).includes(vid));
  let old = null; try { old = JSON.parse(await r('GET', 'lnv:' + vid) || 'null'); } catch (e) {}
  const rm = b.room && b.room.code ? { code: t(b.room.code, 20), title: t(b.room.title, 40), role: t(b.room.role, 10), n: Math.min(+b.room.n || 1, 99) } : null;
  let city = ''; try { city = decodeURIComponent(q.headers['x-vercel-ip-city'] || ''); } catch (e) {}
  const v = {
    vid, ip: a, country: t(q.headers['x-vercel-ip-country'], 4), region: t(q.headers['x-vercel-ip-country-region'], 20), city: t(city, 40),
    ua: t(b.ua, 300), pf: t(b.pf, 30), lang: t(b.lang, 12), tz: t(b.tz, 40), scr: t(b.scr, 20), cpu: +b.cpu || 0, mem: +b.mem || 0,
    net: t(b.net, 8), touch: +b.touch || 0, pwa: !!b.pwa, name: t(b.name, 30), session: t(b.session, 10), room: rm ? rm.code : '',
    first: old ? old.first : now, last: now, hits: (old ? old.hits : 0) + 1
  };
  const cmds = [['SET', 'lnv:' + vid, JSON.stringify(v), 'EX', 2592000], ['ZADD', 'lnseen', now, vid]];
  const log = (type, extra) => cmds.push(['LPUSH', 'lnlog', JSON.stringify({ t: now, type, vid, ip: a, name: v.name, ...extra })], ['LTRIM', 'lnlog', 0, 499]);
  if (!old) log('visit', { city: v.city, country: v.country });
  if (rm) {
    const owner = rm.role === 'host' || rm.role === 'nuki';
    if (owner) {
      let ex = null; try { ex = JSON.parse(await r('GET', 'lnroom:' + rm.code) || 'null'); } catch (e) {}
      if (!ex) log('room_create', { room: rm.code, title: rm.title });
      cmds.push(['SET', 'lnroom:' + rm.code, JSON.stringify({ code: rm.code, title: rm.title, host: v.name, hostVid: vid, ip: a, city: v.city, country: v.country, n: rm.n, created: ex ? ex.created : now, last: now }), 'EX', 180], ['ZADD', 'lnrooms', now, rm.code]);
    } else if (!old || old.room !== rm.code) log('room_join', { room: rm.code });
  }
  try { await rp(cmds); } catch (e) {}
  const closeRoom = !!(rm && !admin && (cfg.closed || []).includes(rm.code));
  s.json({ locked: !!cfg.locked && !admin, msg: cfg.msg || '', banned, closeRoom, broadcast: cfg.bc ? cfg.bc.text : '', bid: cfg.bc ? cfg.bc.id : '' });
};
