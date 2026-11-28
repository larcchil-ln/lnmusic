/* LNMusic live: (1) sembunyikan kartu header "Dengerin Musik & Nonton Film Bareng" saat sudah di dalam room,
   (2) daftar "Room Aktif" di halaman masuk room, bisa langsung gabung. Room Kita (Nuki & Nana) tidak ikut tampil. */
(function () {
  var API_PATH = '/api/rooms';
  function api() { try { return typeof lnApiUrl === 'function' ? lnApiUrl(API_PATH) : API_PATH; } catch (e) { return API_PATH; } }
  var $ = function (id) { return document.getElementById(id); };
  var OFFK = 'lnmusic_live_off';

  // ---------- 1) Kartu header disembunyikan saat di dalam room ----------
  var st = document.createElement('style');
  st.textContent = 'body.ln-in-room #ln-together-head{display:none!important}' +
    'body.ln-in-room #tab-together > .glass{padding-top:1rem}';
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
      if (c) endLive(c);
      setTimeout(refresh, 600);
      return r;
    };
  }

  // tombol host: tampilkan / sembunyikan room dari daftar
  var tbtn = null;
  function updateToggle() {
    var h = hosting();
    if (!tbtn) {
      var bar = document.querySelector('#room-active-area > div:first-child > div:last-child');
      if (!bar) return;
      tbtn = document.createElement('button');
      tbtn.type = 'button';
      tbtn.className = 'px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center justify-center gap-1.5';
      tbtn.onclick = function () {
        try { localStorage.setItem(OFFK, listedOff() ? '0' : '1'); } catch (e) {}
        beat();
      };
      bar.insertBefore(tbtn, bar.children[1] || null);
    }
    tbtn.style.display = h ? '' : 'none';
    tbtn.textContent = listedOff() ? '🙈 Room disembunyikan' : '🟢 Tampil di Room Aktif';
    tbtn.title = listedOff() ? 'Ketuk untuk tampilkan room di daftar Room Aktif' : 'Ketuk untuk sembunyikan room dari daftar Room Aktif';
  }

  // ---------- 3) Daftar Room Aktif di halaman masuk ----------
  var box = null, listEl = null, nameIn = null, msgEl = null, busy = false;
  function el(tag, css, txt) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }

  function mount() {
    var area = $('room-setup-area');
    if (!area || $('ln-live')) return;
    box = el('div', 'grid-column:1/-1;background:rgba(255,255,255,.03);border:1px solid #ffffff1a;border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:10px');
    box.id = 'ln-live';
    var head = el('div', 'display:flex;align-items:center;justify-content:space-between;gap:8px');
    var ht = el('div', 'font-weight:800;font-size:15px;color:#fff', '🟢 Room Aktif');
    var rf = el('button', 'padding:6px 12px;border-radius:999px;border:1px solid #ffffff1f;background:transparent;color:#d4d4d8;font-size:12px;font-weight:700;cursor:pointer', '↻ Segarkan');
    rf.type = 'button'; rf.onclick = refresh;
    head.appendChild(ht); head.appendChild(rf);
    var sub = el('div', 'font-size:12px;color:#a1a1aa;margin-top:-6px', 'Room publik yang sedang berjalan. Isi namamu lalu ketuk Masuk.');
    nameIn = el('input', 'width:100%;box-sizing:border-box;background:#09090b;border:1px solid #ffffff1a;border-radius:12px;padding:10px 13px;font-size:13px;color:#fff;outline:none');
    nameIn.type = 'text'; nameIn.maxLength = 20; nameIn.placeholder = 'Nama kamu'; nameIn.autocomplete = 'nickname';
    try { var lr = lastRoomInfo(); if (lr && lr.name) nameIn.value = lr.name; } catch (e) {}
    msgEl = el('div', 'color:#fda4af;font-size:12px;min-height:0');
    listEl = el('div', 'display:flex;flex-direction:column;gap:8px');
    [head, sub, nameIn, msgEl, listEl].forEach(function (x) { box.appendChild(x); });
    area.insertBefore(box, area.firstChild);
    render(null);
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
      if (rm.playing) info.appendChild(el('div', 'font-size:11.5px;color:#fda4af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis', '🎵 ' + rm.playing));
      var go = el('button', 'padding:9px 16px;border:0;border-radius:12px;background:#e11d48;color:#fff;font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0', rm.code === mine ? 'Masuk lagi' : 'Masuk');
      go.type = 'button';
      go.onclick = function () { join(rm, rm.code === mine); };
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
    if (own && typeof rejoinLastRoom === 'function') { rejoinLastRoom(); return; }
    var name = '';
    try { name = cleanName((nameIn.value || '').trim()); } catch (e) { name = (nameIn.value || '').trim(); }
    if (name.length < 2) { msgEl.textContent = 'Isi nama kamu dulu (minimal 2 huruf).'; nameIn.focus(); return; }
    msgEl.textContent = '';
    customRoom = { role: 'guest', origRole: 'guest', code: rm.code, peerId: 'lnmusic-croom-' + rm.code.toLowerCase(), title: rm.title || ('Room ' + rm.code), ownerUid: '' };
    try {
      localStorage.setItem(SESSION_KEY, 'custom');
      localStorage.setItem('lnmusic_custom_room', JSON.stringify(Object.assign({}, customRoom, { name: name })));
    } catch (e) {}
    enterRoom('custom', name);
  }

  function setupVisible() {
    var a = $('room-setup-area'), t = $('tab-together');
    return !!(a && !a.classList.contains('hidden') && t && !t.classList.contains('hidden') && !document.hidden);
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

  // pantau perubahan tampilan (masuk/keluar room, buka tab Bareng)
  function onChange() { syncRoomState(); if (setupVisible()) refresh(); }
  function init() {
    mount(); syncRoomState(); updateToggle();
    var mo = new MutationObserver(onChange);
    ['room-active-area', 'room-setup-area', 'tab-together'].forEach(function (id) {
      var n = $(id); if (n) mo.observe(n, { attributes: true, attributeFilter: ['class'] });
    });
    setInterval(function () { if (setupVisible()) refresh(); }, 10000);
    if (setupVisible()) refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
