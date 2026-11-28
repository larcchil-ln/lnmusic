/* LNMusic guard: lapor kunjungan/room ke /api/track, terapkan kunci & blokir dari admin. */
(function () {
  var vid; try { vid = localStorage.getItem('ln_vid'); if (!vid) { vid = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('ln_vid', vid); } } catch (e) { vid = 'x' + Math.random().toString(36).slice(2); }
  var adm = function () { try { return localStorage.getItem('ln_admin_tok') || ''; } catch (e) { return ''; } };
  function info() { var n = navigator, c = n.connection || {}; return { ua: n.userAgent, pf: n.platform, lang: n.language, tz: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone, scr: screen.width + 'x' + screen.height + '@' + (devicePixelRatio || 1), cpu: n.hardwareConcurrency || 0, mem: n.deviceMemory || 0, net: c.effectiveType || '', touch: n.maxTouchPoints || 0, pwa: matchMedia('(display-mode: standalone)').matches }; }
  function state() {
    var s = {};
    try {
      s.session = session || ''; s.name = myDisplayName || '';
      var n = connections.filter(function (c) { return c.open; }).length + 1;
      if (session === 'custom' && customRoom) s.room = { code: customRoom.code, title: customRoom.title, role: customRoom.role, n: n };
      else if (session === 'nuki' || session === 'nana' || session === 'guest') s.room = { code: 'PRIVAT', title: ROOM_LABEL, role: session, n: n };
    } catch (e) {}
    return s;
  }
  var lastB = '', box = null;
  function lock(msg) {
    if (!box) {
      box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#060609;color:#fafafa;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px;gap:12px;font-family:system-ui,sans-serif';
      document.body.appendChild(box);
      try { teardownPeer(); } catch (e) {} try { ytPlayer.pauseVideo(); } catch (e) {}
    }
    box.innerHTML = '<div style="font-size:48px">🔒</div><div style="font-size:18px;font-weight:700">LNMusic ditutup sementara</div><div style="font-size:13px;color:#a1a1aa;max-width:320px"></div>';
    box.lastChild.textContent = msg;
  }
  function unlock() { if (box) { box.remove(); box = null; location.reload(); } }
  function apply(d) {
    if (d.locked || d.banned) lock(d.banned ? 'Akses perangkatmu diblokir oleh admin.' : (d.msg || 'Website sedang dalam perbaikan. Coba lagi nanti.')); else unlock();
    if (d.closeRoom) { try { logout(); } catch (e) {} try { showToast('Room ditutup oleh admin'); } catch (e) {} }
    if (d.broadcast && d.bid !== lastB) { lastB = d.bid; try { showToast('📢 ' + d.broadcast); } catch (e) {} }
  }
  async function ping() {
    try {
      var r = await fetch((function (p) { try { return typeof lnApiUrl === 'function' ? lnApiUrl(p) : p; } catch (e) { return p; } })('/api/track'), { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', 'x-admin-token': adm() }, body: JSON.stringify(Object.assign({ vid: vid, page: location.pathname }, info(), state())) });
      if (r.ok) apply(await r.json());
    } catch (e) {}
  }
  var t; function soon(ms) { clearTimeout(t); t = setTimeout(ping, ms); }
  if (typeof window.enterRoom === 'function') { var o = window.enterRoom; window.enterRoom = function () { var x = o.apply(this, arguments); soon(2000); return x; }; }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) ping(); });
  setInterval(ping, 15000);
  ping();
})();
