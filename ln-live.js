/* LNMusic live: (1) sembunyikan kartu header "Dengerin Musik & Nonton Film Bareng" saat sudah di dalam room,
   (2) daftar "Room Aktif" di halaman masuk room, bisa langsung gabung. Room Kita (Nuki & Nana) tidak ikut tampil. */
(function () {
  var API_PATH = '/api/rooms';
  function api() { try { return typeof lnApiUrl === 'function' ? lnApiUrl(API_PATH) : API_PATH; } catch (e) { return API_PATH; } }
  var $ = function (id) { return document.getElementById(id); };
  var OFFK = 'lnmusic_live_off';

  // ---------- 1) Kartu header disembunyikan saat di dalam room ----------
  var st = document.createElement('style');
  st.textContent = 'body.ln-in-room:not(.ln-room-min) #ln-together-head{display:none!important}' +
    'body.ln-in-room:not(.ln-room-min) #tab-together > .glass{padding-top:1rem}' +
    'body.ln-room-min #room-active-area{display:none!important}' +
    'body.ln-room-min #room-setup-area.hidden{display:block!important}' +
    'body.ln-room-min #room-setup-area.hidden > #lr-start{display:flex!important}' +
    '#ln-live{width:100%;box-sizing:border-box;margin:0 auto 16px}' +
    '@media(min-width:768px){#ln-live{max-width:460px}}' +
    /* header room: Undang Teman melebar, tombol bulat di sampingnya; kalau sempit otomatis turun ke baris kedua */
    'html #room-active-area > div:first-child > .lr-actions{display:flex!important;flex-wrap:wrap!important;align-items:center;justify-content:flex-start;gap:10px;width:100%}' +
    'html #room-active-area > div:first-child > .lr-actions > button:first-child{flex:1 1 170px!important;min-width:0;grid-column:auto!important}' +
    'html #room-active-area .ln-pill{flex:0 0 auto!important;width:44px!important;height:44px;padding:0!important;border-radius:999px!important;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;font-size:.85rem!important;font-weight:700!important;color:#e4e4ee!important;background:rgba(255,255,255,.07)!important;border:1px solid rgba(255,255,255,.12)!important;cursor:pointer;transition:background .15s,transform .1s}' +
    'html #room-active-area .ln-pill:hover{background:rgba(255,255,255,.13)!important}' +
    'html #room-active-area .ln-pill:active{transform:scale(.96)}' +
    'html #room-active-area .ln-pill.ln-pill-on{border-color:rgba(34,211,106,.4)!important;background:rgba(34,211,106,.12)!important;color:#86efac!important}';
  document.head.appendChild(st);

  function syncRoomState() {
    var a = $('room-active-area');
    document.body.classList.toggle('ln-in-room', !!(a && !a.classList.contains('hidden')));
  }

  // ---------- 2) Host: kirim denyut supaya room muncul di daftar ----------
  function tok(code) {
    var k = 'lnmusic_live_tok_' + code, t = '';
    try { t = localStorage.getItem(k) || ''; } catch (e) {}
    if (!/^[a-z0-9]{8,40}$/.test(t)) {
      t = Array.from(crypto.getRandomValues(new Uint8Array(12)), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      try { localStorage.setItem(k, t); } catch (e) {}
    }
    return t;
  }
  var lastCode = null;
  function hosting() {
    try { return session === 'custom' && customRoom && customRoom.code && isHost ? customRoom : null; } catch (e) { return null; }
  }
  function listedOff() { try { return localStorage.getItem(OFFK) === '1'; } catch (e) { return false; } }
  function send(b, beacon) {
    var s = JSON.stringify(b);
    if (beacon && navigator.sendBeacon) { try { return navigator.sendBeacon(api(), new Blob([s], { type: 'application/json' })); } catch (e) {} }
    return fetch(api(), { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: s }).catch(function () {});
  }
  function endLive(code, beacon) {
    code = code || lastCode; if (!code) return;
    lastCode = null;
    send({ action: 'end', code: code, tok: tok(code) }, beacon);
  }
  function beat() {
    var h = hosting();
    if (!h) { if (lastCode) endLive(); updateToggle(); return; }
    updateToggle();
    if (listedOff()) { if (lastCode) endLive(); return; }
    var n = 1, playing = '';
    try { n = Object.keys(members || {}).length || 1; } catch (e) {}
    try { playing = currentTrack && currentTrack.title ? currentTrack.title : ''; } catch (e) {}
    lastCode = h.code;
    send({ action: 'beat', code: h.code, tok: tok(h.code), title: h.title || '', host: (typeof myDisplayName !== 'undefined' && myDisplayName) || 'Host', count: n, playing: playing });
  }
  setInterval(beat, 20000);
  setTimeout(beat, 4000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) beat(); });
  window.addEventListener('pagehide', function () { if (lastCode) endLive(lastCode, true); });

  // keluar room -> langsung hapus dari daftar
  if (typeof window.logout === 'function') {
    var origLogout = window.logout;
    window.logout = function () {
      var c = lastCode, r = origLogout.apply(this, arguments);
      snap = null; setMin(false);
      if (c) endLive(c);
      setTimeout(refresh, 600);
      return r;
    };
  }

  // tombol host: tampilkan / sembunyikan room dari daftar
  var IC = {
    pip: '<path d="M21 9V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h4"/><rect width="10" height="7" x="12" y="13" rx="2"/>',
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    headphones: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>'
  };
  function svg(name, size, w) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.9) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0">' + IC[name] + '</svg>';
  }
  var tbtn = null, t0 = Date.now();
  // Wadah tombol header. Tampilan baru (ln-redesign) memindahkan semua tombol selain "Undang" ke menu titik tiga saat dimulai,
  // jadi tombol kita baru dipasang SETELAH itu, di luar menu (sebelum tombol titik tiga).
  function acts() {
    var area = $('room-active-area'); if (!area) return null;
    var bar = area.querySelector(':scope > div:first-child > div:last-child');
    if (!bar) return null;
    if (area.dataset.lr !== '1' && Date.now() - t0 < 6000) return null;
    return bar;
  }
  function place(btn, bar) {
    var more = bar.querySelector('.lr-more-wrap');
    if (more && more.parentNode === bar) bar.insertBefore(btn, more);
    else { var lv = $('btn-leave-room'); if (lv && lv.parentNode === bar) bar.insertBefore(btn, lv); else bar.appendChild(btn); }
  }
  function updateToggle() {
    var h = hosting();
    if (!tbtn || !tbtn.parentNode) {
      var bar = acts();
      if (!bar) return;
      tbtn = document.createElement('button');
      tbtn.type = 'button';
      tbtn.className = 'ln-pill';
      tbtn.onclick = function () {
        try { localStorage.setItem(OFFK, listedOff() ? '0' : '1'); } catch (e) {}
        beat();
      };
      place(tbtn, bar);
    }
    tbtn.style.display = h ? '' : 'none';
    var off = listedOff();
    var key = off ? 'off' : 'on';
    if (tbtn.dataset.s !== key) { tbtn.dataset.s = key; tbtn.innerHTML = svg(off ? 'eyeoff' : 'eye', 20); }
    tbtn.classList.toggle('ln-pill-on', !off);
    var tip = off ? 'Room disembunyikan dari daftar Room Aktif. Ketuk untuk menampilkan.' : 'Room tampil di daftar Room Aktif. Ketuk untuk menyembunyikan.';
    tbtn.title = tip; tbtn.setAttribute('aria-label', tip);
  }

  // ---------- 3) Daftar Room Aktif di halaman masuk ----------
  var box = null, listEl = null, nameIn = null, msgEl = null, busy = false, ban = null, banTxt = null;
  function el(tag, css, txt) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }

  function mount() {
    var area = $('room-setup-area');
    if (!area || $('ln-live')) return;
    box = el('div', 'background:rgba(255,255,255,.04);border:1px solid rgba(34,211,106,.22);border-radius:22px;padding:16px;display:none;flex-direction:column;gap:10px');
    box.id = 'ln-live';
    var head = el('div', 'display:flex;align-items:center;justify-content:space-between;gap:8px');
    var ht = el('div', 'display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px;color:#fff');
    ht.appendChild(el('span', 'width:9px;height:9px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.25);flex-shrink:0'));
    ht.appendChild(document.createTextNode('Room Aktif'));
    var rf = el('button', 'width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;border:1px solid #ffffff1f;background:rgba(255,255,255,.06);color:#d4d4d8;cursor:pointer;padding:0');
    rf.type = 'button'; rf.onclick = refresh; rf.innerHTML = svg('refresh', 16, 2); rf.title = 'Segarkan daftar'; rf.setAttribute('aria-label', 'Segarkan daftar');
    head.appendChild(ht); head.appendChild(rf);
    ban = el('div', 'display:none;align-items:center;gap:8px;padding:10px 12px;border-radius:14px;background:rgba(34,211,106,.12);border:1px solid rgba(34,211,106,.35)');
    banTxt = el('div', 'flex:1;min-width:0;font-size:12.5px;color:#bbf7d0;font-weight:600');
    var banBtn = el('button', 'padding:8px 14px;border:0;border-radius:12px;background:#22d36a;color:#04210f;font-size:12.5px;font-weight:700;cursor:pointer;flex-shrink:0', 'Kembali ke room');
    banBtn.type = 'button'; banBtn.onclick = goBack;
    ban.appendChild(banTxt); ban.appendChild(banBtn);
    var sub = el('div', 'font-size:12px;color:#a1a1aa;margin-top:-6px', 'Room publik yang sedang berjalan. Isi namamu lalu ketuk Masuk.');
    nameIn = el('input', 'width:100%;box-sizing:border-box;background:#09090b;border:1px solid #ffffff1a;border-radius:12px;padding:10px 13px;font-size:13px;color:#fff;outline:none');
    nameIn.type = 'text'; nameIn.maxLength = 20; nameIn.placeholder = 'Nama kamu'; nameIn.autocomplete = 'nickname';
    try { var lr = lastRoomInfo(); if (lr && lr.name) nameIn.value = lr.name; var ln = $('lr-name'); if (ln && ln.value) nameIn.value = ln.value; } catch (e) {}
    msgEl = el('div', 'color:#fda4af;font-size:12px;min-height:0');
    listEl = el('div', 'display:flex;flex-direction:column;gap:8px');
    [head, ban, sub, nameIn, msgEl, listEl].forEach(function (x) { box.appendChild(x); });
    area.parentNode.insertBefore(box, area);
    render(null);
    syncLive();
  }

  function render(rooms) {
    if (!listEl) return;
    listEl.textContent = '';
    if (rooms === null) { listEl.appendChild(el('div', 'font-size:12px;color:#71717a;padding:6px 2px', 'Memuat room aktif…')); return; }
    if (!rooms.length) { listEl.appendChild(el('div', 'font-size:12px;color:#71717a;padding:6px 2px', 'Belum ada room aktif saat ini. Buat room baru, atau gabung pakai kode dari teman.')); return; }
    var mine = null; try { var l = lastRoomInfo(); if (l && l.role === 'host') mine = l.code; } catch (e) {}
    rooms.forEach(function (rm) {
      var row = el('div', 'display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid #ffffff14');
      var info = el('div', 'min-width:0;flex:1');
      info.appendChild(el('div', 'font-size:14px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis', rm.title || rm.code));
      info.appendChild(el('div', 'font-size:11.5px;color:#a1a1aa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis', 'Host: ' + (rm.host || '-') + ' • ' + (rm.count || 1) + ' orang'));
      if (rm.playing) {
        var pl = el('div', 'display:flex;align-items:center;gap:5px;font-size:11.5px;color:#86efac;min-width:0');
        var pi = el('span', 'display:inline-flex;flex-shrink:0'); pi.innerHTML = svg('music', 12, 2);
        pl.appendChild(pi); pl.appendChild(el('span', 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis', rm.playing));
        info.appendChild(pl);
      }
      var here = false; try { here = roomActive() && customRoom && customRoom.code === rm.code; } catch (e) {}
      var go = el('button', 'padding:9px 16px;border:0;border-radius:12px;background:' + (here ? '#3f3f46' : '#22d36a') + ';color:' + (here ? '#fff' : '#04210f') + ';font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0', here ? 'Kembali' : (rm.code === mine ? 'Masuk lagi' : 'Masuk'));
      go.type = 'button';
      go.onclick = function () { if (here) goBack(); else join(rm, rm.code === mine); };
      row.appendChild(info); row.appendChild(go);
      listEl.appendChild(row);
    });
  }

  function renderErr() {
    if (!listEl) return;
    listEl.textContent = '';
    listEl.appendChild(el('div', 'font-size:12px;color:#fda4af;padding:6px 2px', 'Daftar room aktif tidak bisa dimuat. Cek koneksi, atau pastikan server (api/rooms.js) sudah ikut di-deploy. Ketuk Segarkan untuk coba lagi.'));
  }

  function join(rm, own) {
    if (roomActive() && !confirm('Pindah ke "' + (rm.title || rm.code) + '"? Kamu akan keluar dari room yang sekarang.')) return;
    if (own && typeof rejoinLastRoom === 'function') { rejoinLastRoom(); return; }
    var name = '';
    var raw = (nameIn.value || '').trim(); if (!raw) { var ln2 = $('lr-name'); raw = ln2 ? (ln2.value || '').trim() : ''; }
    try { name = cleanName(raw); } catch (e) { name = raw; }
    if (name.length < 2) { msgEl.textContent = 'Isi nama kamu dulu (minimal 2 huruf).'; nameIn.focus(); return; }
    msgEl.textContent = '';
    customRoom = { role: 'guest', origRole: 'guest', code: rm.code, peerId: 'lnmusic-croom-' + rm.code.toLowerCase(), title: rm.title || ('Room ' + rm.code), ownerUid: '' };
    try {
      localStorage.setItem(SESSION_KEY, 'custom');
      localStorage.setItem('lnmusic_custom_room', JSON.stringify(Object.assign({}, customRoom, { name: name })));
    } catch (e) {}
    enterRoom('custom', name);
  }

  function syncLive() {
    if (!box) return;
    var a = $('room-setup-area'), t = $('tab-together');
    var on = !!(a && t && !t.classList.contains('hidden') && (!a.classList.contains('hidden') || isMin()));
    box.style.display = on ? 'flex' : 'none';
  }
  function setupVisible() {
    var a = $('room-setup-area'), t = $('tab-together');
    return !!(a && (!a.classList.contains('hidden') || isMin()) && t && !t.classList.contains('hidden') && !document.hidden);
  }
  function refresh() {
    if (busy) return; busy = true;
    mount();
    fetch(api(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (j) { render((j && j.rooms) || []); })
      .catch(function () { renderErr(); })
      .then(function () { busy = false; });
  }

  // ---------- 4) Minimize room + bubble melayang + pindah room ----------
  var POSK = 'lnmusic_bubble_pos', snap = null, bub = null, bubLbl = null, mbtn = null;
  function roomActive() {
    var a = $('room-active-area');
    try { return !!(session && a && !a.classList.contains('hidden')); } catch (e) { return false; }
  }
  function isMin() { return document.body.classList.contains('ln-room-min'); }
  function tabHidden() { var t = $('tab-together'); return !!(t && t.classList.contains('hidden')); }
  function setMin(v) {
    if (v && !roomActive()) v = false;
    if (v) { try { snap = { cr: customRoom }; } catch (e) {} }
    document.body.classList.toggle('ln-room-min', !!v);
    syncRoomState(); updateBubble();
    if (v) { try { window.scrollTo({ top: 0 }); } catch (e) {} refresh(); }
  }
  function goBack() {
    setMin(false);
    if (tabHidden()) { try { switchTab('together'); } catch (e) {} }
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
    updateBubble();
  }
  function roomTitle() {
    var n = $('active-room-code'); return (n && n.textContent) || 'Room';
  }
  function ensureButtons() {
    updateToggle();
    if (mbtn && mbtn.parentNode) return;
    var bar = acts();
    if (!bar) return;
    mbtn = document.createElement('button');
    mbtn.type = 'button';
    mbtn.className = 'ln-pill';
    mbtn.innerHTML = svg('pip', 20);
    mbtn.title = 'Minimize room (musik & voice tetap jalan). Ketuk bubble untuk kembali.';
    mbtn.setAttribute('aria-label', 'Minimize room');
    mbtn.onclick = function () { setMin(true); };
    place(mbtn, bar);
    if (tbtn && tbtn.parentNode === bar) bar.insertBefore(mbtn, tbtn);
  }

  // bubble melayang (bisa digeser, menempel ke tepi layar)
  function pos() { try { return JSON.parse(localStorage.getItem(POSK) || 'null') || {}; } catch (e) { return {}; } }
  function applyPos(p) {
    if (!bub) return;
    p = p || pos();
    var h = bub.offsetHeight || 40, top = typeof p.top === 'number' ? p.top : window.innerHeight - 230;
    top = Math.max(60, Math.min(top, window.innerHeight - h - 90));
    bub.style.top = top + 'px'; bub.style.bottom = 'auto';
    if (p.side === 'l') { bub.style.left = '8px'; bub.style.right = 'auto'; } else { bub.style.right = '8px'; bub.style.left = 'auto'; }
  }
  function mkBubble() {
    if (bub) return;
    bub = el('div', 'position:fixed;z-index:45;display:none;align-items:center;gap:8px;padding:9px 15px 9px 11px;border-radius:999px;background:linear-gradient(135deg,#22d36a,#16a34a);color:#04210f;box-shadow:0 8px 24px rgba(0,0,0,.55);font:700 12.5px system-ui,sans-serif;max-width:210px;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab');
    bub.id = 'ln-room-bubble';
    var bi = el('span', 'display:inline-flex;position:relative;flex-shrink:0'); bi.innerHTML = svg('headphones', 18, 2);
    bi.appendChild(el('span', 'position:absolute;right:-3px;top:-3px;width:8px;height:8px;border-radius:50%;background:#4ade80;border:1.5px solid #16a34a'));
    bub.appendChild(bi);
    bubLbl = el('span', 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px');
    bub.appendChild(bubLbl);
    document.body.appendChild(bub);
    var sx = 0, sy = 0, ox = 0, oy = 0, drag = false, down = false;
    bub.addEventListener('pointerdown', function (e) {
      down = true; drag = false; sx = e.clientX; sy = e.clientY;
      var r = bub.getBoundingClientRect(); ox = r.left; oy = r.top;
      try { bub.setPointerCapture(e.pointerId); } catch (x) {}
    });
    bub.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!drag && Math.hypot(dx, dy) < 6) return;
      drag = true; bub.style.cursor = 'grabbing';
      var w = bub.offsetWidth, h = bub.offsetHeight;
      bub.style.left = Math.max(4, Math.min(ox + dx, window.innerWidth - w - 4)) + 'px';
      bub.style.top = Math.max(60, Math.min(oy + dy, window.innerHeight - h - 90)) + 'px';
      bub.style.right = 'auto'; bub.style.bottom = 'auto';
      e.preventDefault();
    });
    function up(e) {
      if (!down) return; down = false; bub.style.cursor = 'grab';
      try { bub.releasePointerCapture(e.pointerId); } catch (x) {}
      if (!drag) { goBack(); return; }
      var r = bub.getBoundingClientRect(), side = (r.left + r.width / 2) < window.innerWidth / 2 ? 'l' : 'r';
      var p = { side: side, top: r.top };
      try { localStorage.setItem(POSK, JSON.stringify(p)); } catch (x) {}
      applyPos(p);
    }
    bub.addEventListener('pointerup', up);
    bub.addEventListener('pointercancel', up);
  }
  function updateBubble() {
    var show = roomActive() && (isMin() || tabHidden());
    if (show) { mkBubble(); bubLbl.textContent = roomTitle(); bub.style.display = 'flex'; applyPos(); }
    else if (bub) bub.style.display = 'none';
    if (roomActive()) { try { snap = { cr: customRoom }; } catch (e) {} }
    if (ban) {
      var inRoom = roomActive();
      ban.style.display = inRoom ? 'flex' : 'none';
      if (inRoom) banTxt.textContent = 'Kamu masih di room “' + roomTitle() + '”. Memilih room lain akan keluar dari room ini.';
    }
  }

  // masuk room baru saat masih di room lama -> keluar dari room lama dulu (data room baru dipertahankan)
  if (typeof window.enterRoom === 'function') {
    var origEnter = window.enterRoom;
    window.enterRoom = function (u, name) {
      if (roomActive()) {
        var cr = null, ls = {};
        try { cr = customRoom; ls.c = localStorage.getItem('lnmusic_custom_room'); ls.s = localStorage.getItem(SESSION_KEY); } catch (e) {}
        try { if (snap) customRoom = snap.cr; } catch (e) {}
        try { window.logout(); } catch (e) {}
        try {
          customRoom = u === 'custom' ? cr : null;
          if (u === 'custom') {
            if (ls.c != null) localStorage.setItem('lnmusic_custom_room', ls.c);
            if (ls.s != null) localStorage.setItem(SESSION_KEY, ls.s);
          }
        } catch (e) {}
      }
      snap = null; setMin(false);
      return origEnter.apply(this, arguments);
    };
  }

  // ---------- 5) Foto profil tampil di tombol Profil (header / sidebar) ----------
  var AVK = 'lnmusic_my_avatar';
  function curAvatar() {
    var live = '';
    try { if (session) live = (myProfile && myProfile.avatar) || ''; } catch (e) {}
    if (live) { try { localStorage.setItem(AVK, live); } catch (e) {} return live; }
    try { return localStorage.getItem(AVK) || ''; } catch (e) { return ''; }
  }
  function applyAvatar() {
    var a = curAvatar();
    var list = document.querySelectorAll('#ln-appbar button[onclick^="openMyProfile"], #ln-top button[onclick^="openMyProfile"], .lr-sb[data-pf]');
    Array.prototype.forEach.call(list, function (b) {
      var img = b.querySelector('img.ln-av'), ic = b.querySelector('svg, i'), bar = !!b.closest('#ln-appbar');
      if (!a) {
        if (img) img.remove();
        if (ic) ic.style.display = '';
        if (bar) { b.style.width = b.style.height = b.style.padding = b.style.overflow = ''; delete b.dataset.lnAv; }
        return;
      }
      if (!img) {
        img = document.createElement('img'); img.className = 'ln-av'; img.alt = ''; img.draggable = false;
        b.insertBefore(img, b.firstChild);
      }
      if (img.getAttribute('src') !== a) img.src = a;
      if (ic) ic.style.display = 'none';
      var z = 20;
      if (bar) {
        if (!b.dataset.lnAv) { b.dataset.lnAv = String(Math.max(36, Math.min(48, Math.max(b.offsetWidth, b.offsetHeight) || 40))); }
        z = +b.dataset.lnAv;
        b.style.width = z + 'px'; b.style.height = z + 'px'; b.style.padding = '0'; b.style.overflow = 'hidden';
      }
      img.style.cssText = 'display:block;width:' + z + 'px;height:' + z + 'px;border-radius:50%;object-fit:cover;flex-shrink:0;' + (bar ? '' : 'margin-right:2px');
      img.style.setProperty('height', z + 'px', 'important');
    });
  }
  // setiap profil disimpan / dimuat / dikirim -> perbarui foto di header
  ['saveMyProfile', 'loadMyProfile', 'sendMyProfile'].forEach(function (n) {
    var o = window[n];
    if (typeof o !== 'function') return;
    window[n] = function () {
      var r = o.apply(this, arguments);
      if (n === 'saveMyProfile') { try { localStorage.setItem(AVK, (myProfile && myProfile.avatar) || ''); } catch (e) {} }
      try { applyAvatar(); } catch (e) {}
      return r;
    };
  });

  // pantau perubahan tampilan (masuk/keluar room, buka tab Bareng)
  function onChange() { if (!roomActive() && isMin()) setMin(false); syncRoomState(); syncLive(); ensureButtons(); updateBubble(); if (setupVisible()) refresh(); }
  function init() {
    mount(); syncRoomState(); updateToggle(); ensureButtons(); updateBubble();
    setInterval(function () { ensureButtons(); updateBubble(); applyAvatar(); }, 3000);
    setTimeout(ensureButtons, 1200);
    applyAvatar(); setTimeout(applyAvatar, 1500);
    window.addEventListener('resize', function () { applyPos(); });
    var mo = new MutationObserver(onChange);
    ['room-active-area', 'room-setup-area', 'tab-together'].forEach(function (id) {
      var n = $(id); if (n) mo.observe(n, { attributes: true, attributeFilter: ['class'] });
    });
    setInterval(function () { if (setupVisible()) refresh(); }, 10000);
    if (setupVisible()) refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
