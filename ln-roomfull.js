/* LNMusic: room eksklusif layar penuh (tanpa kartu "Dengerin Musik & Nonton Bareng").
   - Memindahkan #room-active-area ke <body> supaya benar-benar menutup layar (bukan di dalam tab).
   - Tombol panah kembali -> dialog keluar room; Back Android ditangani lewat window.lnRoomBack.
   - Strip lagu diputar, jumlah peserta di header, penyesuaian keyboard HP. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var area = $('room-active-area');
  if (!area || area.dataset.lrf) return;
  area.dataset.lrf = '1';

  // 1) Lepas dari tab Bareng: aman dari efek transform/backdrop-filter milik kontainer lama
  if (area.parentNode !== document.body) document.body.appendChild(area);

  var root = document.documentElement;
  var SVG_BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var SVG_PLAY = '<svg viewBox="0 0 24 24" class="pl"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>';
  var SVG_PAUSE = '<svg viewBox="0 0 24 24" class="pa"><rect x="6" y="5" width="4.2" height="14" rx="1.3"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.3"/></svg>';

  var sheet = null;
  function visible() { return !area.classList.contains('hidden') && !area.classList.contains('lrf-away'); }

  // 2) Header: panah kembali + jumlah peserta
  function buildHeader() {
    var head = area.firstElementChild;
    if (!head || head.querySelector('.lrf-back')) return;
    var back = document.createElement('button');
    back.type = 'button'; back.className = 'lrf-back'; back.setAttribute('aria-label', 'Kembali ke Beranda'); back.innerHTML = SVG_BACK;
    back.onclick = goHome;
    head.insertBefore(back, head.firstChild);
    var cnt = document.createElement('span');
    cnt.className = 'lrf-count'; cnt.id = 'lrf-count'; cnt.textContent = '1';
    var acts = head.lastElementChild;
    cnt.setAttribute('role', 'button'); cnt.setAttribute('aria-label', 'Lihat peserta'); cnt.onclick = openSheet;
    head.insertBefore(cnt, acts && acts.tagName ? acts : null);
    var vc = $('voice-count');
    if (vc) {
      var sync = function () { cnt.textContent = (vc.textContent || '1').split('/')[0] || '1'; };
      new MutationObserver(sync).observe(vc, { childList: true, characterData: true, subtree: true });
      sync();
    }
  }

  // 3) Menu ⋯: tambah pintasan Video Call (nav bawah tertutup saat di room)
  function addMenuItems() {
    var menu = area.querySelector('.lr-menu');
    if (!menu) return;
    var lv = menu.querySelector('#btn-leave-room');
    if (lv && !lv.dataset.lrf) {
      lv.dataset.lrf = '1'; lv.textContent = 'Keluar dari room';
      lv.onclick = function (e) { e.stopPropagation(); askLeave(); };
    }
    if (menu.querySelector('[data-lrf-vc]')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.setAttribute('data-lrf-vc', '1'); b.textContent = 'Video Call';
    b.onclick = function () { try { switchTab('videocall'); } catch (e) {} };
    menu.insertBefore(b, menu.firstChild);
  }

  // 4) Dock: mic + lagu yang sedang diputar + kontrol
  var IC = {
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
    prev: '<svg viewBox="0 0 24 24" class="f"><path d="M7 5v14M19 5.8v12.4a1 1 0 0 1-1.6.8L9.6 12.8a1 1 0 0 1 0-1.6l7.8-6.2a1 1 0 0 1 1.6.8z"/></svg>',
    next: '<svg viewBox="0 0 24 24" class="f"><path d="M17 5v14M5 5.8v12.4a1 1 0 0 0 1.6.8l7.8-6.2a1 1 0 0 0 0-1.6L6.6 5a1 1 0 0 0-1.6.8z"/></svg>'
  };
  var np = document.createElement('div');
  np.id = 'lrf-np';
  np.innerHTML =
    '<button type="button" class="mic" id="lrf-mic" aria-label="Mic">' + IC.mic + '</button>' +
    '<div class="main"><img alt=""><div class="t"><b></b><small></small></div></div>' +
    '<div class="ctl"><button type="button" class="pv" aria-label="Sebelumnya">' + IC.prev + '</button>' +
    '<button type="button" class="pp" aria-label="Putar / jeda">' + SVG_PLAY + SVG_PAUSE + '</button>' +
    '<button type="button" class="nx" aria-label="Berikutnya">' + IC.next + '</button></div>';
  var npImg = np.querySelector('img'), npT = np.querySelector('b'), npA = np.querySelector('small');
  var hasTrack = false;
  np.querySelector('.pp').onclick = function (e) { e.stopPropagation(); try { togglePlay(); } catch (x) {} setTimeout(tick, 120); };
  np.querySelector('.pv').onclick = function (e) { e.stopPropagation(); try { playPrev(); } catch (x) {} setTimeout(tick, 300); };
  np.querySelector('.nx').onclick = function (e) { e.stopPropagation(); try { playNext(); } catch (x) {} setTimeout(tick, 300); };
  np.querySelector('.main').onclick = function () {
    if (hasTrack) { try { openFullscreenPlayer(); } catch (e) {} return; }
    var q = $('lr-tabs') && $('lr-tabs').querySelector('button[data-p="queue"]'); if (q) q.click();
  };
  np.querySelector('.mic').onclick = function (e) { e.stopPropagation(); try { toggleVoice(); } catch (x) {} setTimeout(micSync, 400); };
  function micSync() {
    var b = area.querySelector('.tg-mic-btn'), on = !!b && !/mati/i.test(b.textContent || '');
    np.querySelector('.mic').classList.toggle('on', on);
  }
  function placeNP() {
    var tabs = $('lr-tabs'), voice = $('tg-voice');
    var ref = tabs || voice;
    if (ref && ref.parentNode === area && np.parentNode !== area) area.insertBefore(np, ref);
  }
  function tick() {
    if (!visible()) return;
    var title = $('player-title'), art = $('player-artist'), th = $('player-thumb');
    var t = title ? (title.textContent || '').trim() : '';
    hasTrack = !!t && !/^Belum ada lagu/i.test(t);
    var tt = hasTrack ? t : 'Belum ada lagu', aa = hasTrack ? ((art && art.textContent) || '').trim() : 'Ketuk untuk pilih lagu bareng';
    if (npT.textContent !== tt) npT.textContent = tt;
    if (npA.textContent !== aa) npA.textContent = aa;
    var s = hasTrack && th && th.getAttribute('src');
    if (s) { if (npImg.getAttribute('src') !== s) npImg.setAttribute('src', s); npImg.style.visibility = ''; } else npImg.style.visibility = 'hidden';
    np.classList.toggle('empty', !hasTrack);
    var p = false; try { p = !!isPlaying; } catch (e) {}
    np.classList.toggle('paused', !p);
    placeNP(); addMenuItems(); micSync();
  }
  var tickTimer = null;

  // 5) Dialog keluar room
  var dlg = null;
  function buildDialog() {
    if (dlg) return dlg;
    dlg = document.createElement('div'); dlg.id = 'lrf-leave';
    dlg.innerHTML = '<div class="box" role="dialog" aria-modal="true"><h3>Keluar dari room?</h3><p>Musik dan suara akan berhenti. Mau tetap jalan di latar? Pakai tombol kembali untuk ke Beranda.</p><div class="row"><button type="button" class="stay">Tetap di room</button><button type="button" class="quit">Keluar</button></div></div>';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) closeLeave(); });
    dlg.querySelector('.stay').onclick = closeLeave;
    dlg.querySelector('.quit').onclick = function () { closeLeave(); try { logout(); } catch (e) {} };
    return dlg;
  }
  function askLeave() { buildDialog().classList.add('on'); }
  function closeLeave() { if (dlg) dlg.classList.remove('on'); }
  function leaveOpen() { return !!(dlg && dlg.classList.contains('on')); }

  // Kembali = ke Beranda; room tetap berjalan (musik & suara lanjut) dan bisa dibuka lagi dari chip "Kembali ke room"
  function goHome() { closeLeave(); closeSheet(); try { switchTab('online'); } catch (e) {} }
  // Dipanggil dari tombol Back Android / riwayat (ln-nav.js closeTop)
  window.lnRoomBack = function () {
    if (leaveOpen()) { closeLeave(); return true; }
    if (sheet && sheet.classList.contains('on')) { closeSheet(); return true; }
    if (!visible()) return false;
    goHome();
    return true;
  };

  // 6) Tampil / sembunyi ikut status room
  function onState() {
    if (area.classList.contains('hidden') && area.classList.contains('lrf-away')) area.classList.remove('lrf-away');
    var on = visible();
    root.classList.toggle('lrf-on', on);
    if (on) {
      buildHeader(); placeNP(); addMenuItems(); tick();
      if (!tickTimer) tickTimer = setInterval(tick, 700);
      try { window.scrollTo(0, 0); } catch (e) {}
    } else {
      if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
      closeLeave();
      root.classList.remove('lrf-kbd'); area.style.height = ''; area.style.top = '';
    }
  }
  new MutationObserver(onState).observe(area, { attributes: true, attributeFilter: ['class'] });

  // Pindah tab (mis. Video Call dari menu ⋯): room disembunyikan sementara, balik lagi saat tab Bareng dibuka
  var origSwitch = window.switchTab;
  if (typeof origSwitch === 'function') {
    window.switchTab = function () {
      var r = origSwitch.apply(this, arguments);
      try { area.classList.toggle('lrf-away', typeof curTab !== 'undefined' && curTab !== 'together'); chipSync(); } catch (e) {}
      return r;
    };
  }

  // 7) Keyboard HP: tinggi mengikuti area yang terlihat supaya kolom ketik tidak tertutup
  var vv = window.visualViewport;
  function fit() {
    if (!visible()) return;
    if (!vv) return;
    var shrunk = window.innerHeight - vv.height > 120;
    root.classList.toggle('lrf-kbd', shrunk);
    if (shrunk) { area.style.height = vv.height + 'px'; area.style.top = vv.offsetTop + 'px'; }
    else { area.style.height = ''; area.style.top = ''; }
  }
  if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); }
  area.addEventListener('focusin', function (e) {
    var el = e.target;
    if (el && el.matches && el.matches('input,textarea')) setTimeout(function () { fit(); try { el.scrollIntoView({ block: 'nearest' }); } catch (x) {} }, 280);
  });


  // 8) Daftar peserta (ketuk jumlah di header)
  function closeSheet() { if (sheet) sheet.classList.remove('on'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function openSheet() {
    if (!sheet) {
      sheet = document.createElement('div'); sheet.id = 'lrf-sheet';
      sheet.innerHTML = '<div class="box" role="dialog" aria-modal="true"><div class="grab"></div><h3>Peserta <span id="lrf-sheet-n"></span></h3><div class="list" id="lrf-sheet-list"></div></div>';
      document.body.appendChild(sheet);
      sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });
    }
    var list = [];
    try { list = Object.keys(members || {}).map(function (id) { var m = members[id]; return { id: id, name: m.name, seat: m.seat, role: m.role, owner: m.owner, mic: m.mic, locked: m.locked, ctl: m.ctl }; }); } catch (e) {}
    list.sort(function (a, b) { return (a.seat < 0 ? 99 : a.seat) - (b.seat < 0 ? 99 : b.seat); });
    $('lrf-sheet-n').textContent = list.length ? '(' + list.length + ')' : '';
    var me = ''; try { me = peer && peer.id; } catch (e) {}
    $('lrf-sheet-list').innerHTML = list.length ? list.map(function (m) {
      var role = m.owner ? 'Pemilik room' : (m.role === 'admin' ? 'Admin' : 'Tamu') + (m.ctl ? ' · bisa play' : '');
      var mic = m.locked ? '🔒' : (m.mic === 'on' ? '🎙️' : '🔇');
      var h = 0, n = String(m.name || '?'); for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) % 360;
      return '<div class="row"><span class="av" style="background:linear-gradient(135deg,hsl(' + h + ' 85% 62%),hsl(' + ((h + 55) % 360) + ' 85% 55%))">' + esc(n.charAt(0).toUpperCase()) + '</span>' +
        '<div class="who"><b>' + esc(n) + (m.id === me ? ' (kamu)' : '') + '</b><small>' + esc(role) + '</small></div><span class="mc">' + mic + '</span></div>';
    }).join('') : '<div class="empty">Belum ada peserta</div>';
    sheet.classList.add('on');
  }

  // 9) Chip "Kembali ke room" saat room berjalan tapi sedang di tab lain
  var chip = document.createElement('button');
  chip.type = 'button'; chip.id = 'lrf-return';
  chip.innerHTML = '<span class="dot"></span><span class="nm">Room</span><span class="go">Kembali</span>';
  chip.onclick = function () { try { switchTab('together'); } catch (e) {} };
  document.body.appendChild(chip);
  function chipSync() {
    var away = !area.classList.contains('hidden') && area.classList.contains('lrf-away');
    root.classList.toggle('lrf-away-on', away);
    if (away) { var c = $('active-room-code'); chip.querySelector('.nm').textContent = (c && c.textContent.trim()) || 'Room'; }
  }
  new MutationObserver(chipSync).observe(area, { attributes: true, attributeFilter: ['class'] });

  onState(); chipSync();
})();
