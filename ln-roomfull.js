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

  function visible() { return !area.classList.contains('hidden') && !area.classList.contains('lrf-away'); }

  // 2) Header: panah kembali + jumlah peserta
  function buildHeader() {
    var head = area.firstElementChild;
    if (!head || head.querySelector('.lrf-back')) return;
    var back = document.createElement('button');
    back.type = 'button'; back.className = 'lrf-back'; back.setAttribute('aria-label', 'Keluar dari room'); back.innerHTML = SVG_BACK;
    back.onclick = askLeave;
    head.insertBefore(back, head.firstChild);
    var cnt = document.createElement('span');
    cnt.className = 'lrf-count'; cnt.id = 'lrf-count'; cnt.textContent = '1';
    var acts = head.lastElementChild;
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
    if (!menu || menu.querySelector('[data-lrf-vc]')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.setAttribute('data-lrf-vc', '1'); b.textContent = 'Video Call';
    b.onclick = function () { try { switchTab('videocall'); } catch (e) {} };
    menu.insertBefore(b, menu.firstChild);
  }

  // 4) Strip lagu yang sedang diputar
  var np = document.createElement('div');
  np.id = 'lrf-np';
  np.innerHTML = '<img alt=""><div class="t"><b></b><small></small></div><button type="button" aria-label="Putar / jeda">' + SVG_PLAY + SVG_PAUSE + '</button>';
  var npImg = np.querySelector('img'), npT = np.querySelector('b'), npA = np.querySelector('small'), npBtn = np.querySelector('button');
  npBtn.onclick = function (e) { e.stopPropagation(); try { togglePlay(); } catch (x) {} setTimeout(tick, 120); };
  np.onclick = function () { try { openFullscreenPlayer(); } catch (e) {} };
  function placeNP() {
    var tabs = $('lr-tabs'), voice = $('tg-voice');
    var ref = tabs || voice;
    if (ref && ref.parentNode === area && np.parentNode !== area) area.insertBefore(np, ref);
  }
  function tick() {
    if (!visible()) return;
    var title = $('player-title'), art = $('player-artist'), th = $('player-thumb');
    var t = title ? (title.textContent || '').trim() : '';
    var has = !!t && !/^Belum ada lagu/i.test(t);
    np.style.display = has ? '' : 'none';
    if (has) {
      if (npT.textContent !== t) npT.textContent = t;
      var a = art ? (art.textContent || '').trim() : '';
      if (npA.textContent !== a) npA.textContent = a;
      var s = th && th.getAttribute('src');
      if (s && npImg.getAttribute('src') !== s) npImg.setAttribute('src', s);
      var p = false; try { p = !!isPlaying; } catch (e) {}
      np.classList.toggle('paused', !p);
    }
    placeNP();
    addMenuItems();
  }
  var tickTimer = null;

  // 5) Dialog keluar room
  var dlg = null;
  function buildDialog() {
    if (dlg) return dlg;
    dlg = document.createElement('div'); dlg.id = 'lrf-leave';
    dlg.innerHTML = '<div class="box" role="dialog" aria-modal="true"><h3>Keluar dari room?</h3><p>Kamu bisa masuk lagi kapan saja lewat kode room atau Room Kita.</p><div class="row"><button type="button" class="stay">Tetap di room</button><button type="button" class="quit">Keluar</button></div></div>';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) closeLeave(); });
    dlg.querySelector('.stay').onclick = closeLeave;
    dlg.querySelector('.quit').onclick = function () { closeLeave(); try { logout(); } catch (e) {} };
    return dlg;
  }
  function askLeave() { buildDialog().classList.add('on'); }
  function closeLeave() { if (dlg) dlg.classList.remove('on'); }
  function leaveOpen() { return !!(dlg && dlg.classList.contains('on')); }

  // Dipanggil dari tombol Back Android / riwayat (ln-nav.js closeTop)
  window.lnRoomBack = function () {
    if (leaveOpen()) { closeLeave(); return true; }
    if (!visible()) return false;
    askLeave();
    return true;
  };

  // 6) Tampil / sembunyi ikut status room
  function onState() {
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
      try { area.classList.toggle('lrf-away', typeof curTab !== 'undefined' && curTab !== 'together'); } catch (e) {}
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

  onState();
})();
