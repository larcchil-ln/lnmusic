/* LNMusic nav: tombol Back ala aplikasi + rotasi otomatis saat fullscreen video YouTube. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var hidden = function (id) { var e = $(id); return !e || e.classList.contains('hidden'); };

  // ---- Pindah tab halus + penanda tab aktif ----
  var navStyle = document.createElement('style');
  navStyle.textContent =
    '.mnav{position:relative;-webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:color .2s,background .2s,transform .12s}' +
    '.mnav svg{transition:transform .2s cubic-bezier(.2,0,0,1),background .2s}' +
    '.mnav.on svg{transform:translateY(-1px) scale(1.06)}' +
    '.mnav:active{transform:scale(.94)}' +
    '.mnav:active svg{transform:scale(.92)}' +
    '#ln-ind{position:absolute;top:0;left:0;height:3px;width:30px;border-radius:0 0 6px 6px;background:linear-gradient(90deg,#f43f5e,#8b5cf6);box-shadow:0 2px 14px rgba(244,63,94,.75);transition:transform .26s cubic-bezier(.2,0,0,1);opacity:0;pointer-events:none;will-change:transform}' +
    '.nav-btn{touch-action:manipulation;transition:background .18s,color .18s,box-shadow .18s,transform .12s}' +
    '.nav-btn:active{transform:scale(.98)}' +
    '.nav-btn.text-rose-400{box-shadow:inset 3px 0 0 #f43f5e}' +
    'button,[onclick],a{touch-action:manipulation}' +
    // Tab baru cukup memudar halus (tanpa geser): jauh lebih ringan daripada menganimasikan seluruh halaman
    '@keyframes lnTabIn{from{opacity:0}to{opacity:1}}' +
    '.ln-tab-in{animation:lnTabIn .16s ease-out}' +
    // Blur di bar yang menempel (nav bawah/header) dihitung ulang setiap frame gulir; di HP bikin berat & tersendat
    'html #ln-mnav{-webkit-backdrop-filter:none!important;backdrop-filter:none!important;background:rgba(14,14,18,.97)!important;transform:translateZ(0)}' +
    '@media (max-width:1023px){html header.glass{-webkit-backdrop-filter:none!important;backdrop-filter:none!important;background:rgba(9,9,11,.96)!important}}' +
    '@media (prefers-reduced-motion:reduce){.ln-tab-in{animation:none}#ln-ind,.mnav svg{transition:none}}';
  document.head.appendChild(navStyle);

  var indEl = null, centers = null;
  // Posisi tengah tiap tombol diukur SEKALI (saat load/resize), bukan di setiap ketukan,
  // supaya ketukan tidak memicu hitung ulang tata letak seluruh halaman.
  function measure() {
    var nav = $('ln-mnav'); if (!nav) return;
    var nr = nav.getBoundingClientRect();
    if (!nr.width) { centers = null; return; } // nav bawah disembunyikan di layar lebar
    centers = {};
    nav.querySelectorAll('.mnav').forEach(function (b) {
      var br = b.getBoundingClientRect();
      centers[b.id] = Math.round(br.left - nr.left + br.width / 2 - 15);
    });
  }
  function moveInd() {
    var cur = null; try { cur = curTab; } catch (e) {}
    var id = 'mob-nav-' + (cur || 'online');
    if (!centers) measure();
    var nav = $('ln-mnav');
    if (!nav || !centers || centers[id] == null) return;
    if (!indEl || !indEl.isConnected) { indEl = document.createElement('div'); indEl.id = 'ln-ind'; nav.appendChild(indEl); }
    indEl.style.opacity = '1';
    indEl.style.transform = 'translateX(' + centers[id] + 'px)';
  }
  window.addEventListener('resize', function () { centers = null; moveInd(); });
  window.addEventListener('orientationchange', function () { centers = null; setTimeout(moveInd, 200); });
  window.addEventListener('load', function () { setTimeout(function () { centers = null; moveInd(); }, 200); });
  setTimeout(moveInd, 400);

  // Tab Hub sudah dihapus: panggilan lama diarahkan ke Beranda
  if (typeof window.switchTab === 'function') {
    var origSwitchTab = window.switchTab;
    window.switchTab = function (t) {
      if (t === 'hub') t = 'online';
      var prev = null; try { prev = curTab; } catch (e) {}
      var res = origSwitchTab.call(this, t);
      if (t !== prev) {
        var el = $('tab-' + t);
        if (el && t !== 'videocall') el.classList.add('ln-tab-in');
        try { navigator.vibrate && navigator.vibrate(8); } catch (e) {}
      }
      moveInd();
      return res;
    };
  }

  // ---- Rotasi otomatis saat fullscreen video (bukan fullscreen halaman) ----
  function onFs() {
    var el = document.fullscreenElement || document.webkitFullscreenElement, o = screen.orientation;
    if (!o) return;
    try {
      if (el && el !== document.documentElement && el.id !== 'vc' && (el.tagName === 'IFRAME' || el.tagName === 'VIDEO' || (el.querySelector && el.querySelector('iframe,video')))) {
        var p = o.lock && o.lock('landscape'); if (p && p.catch) p.catch(function () {});
      } else if (!el && o.unlock) o.unlock();
    } catch (e) {}
  }
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);


  // ---- Video call: tampilkan seluruh badan (tidak terpotong/zoom) saat rasio video & layar beda jauh ----
  var fitStyle = document.createElement('style');
  fitStyle.textContent = '.ln-contain{object-fit:contain!important;background:transparent}';
  document.head.appendChild(fitStyle);
  function fit() {
    document.querySelectorAll('#vc video, #vc-self').forEach(function (v) {
      var w = v.videoWidth, h = v.videoHeight, r = v.getBoundingClientRect();
      if (!w || !h || !r.width || !r.height) return;
      var mode = v.dataset.fit, auto = Math.abs((w / h) / (r.width / r.height) - 1) > 0.1;
      v.classList.toggle('ln-contain', mode === 'fit' ? true : mode === 'fill' ? false : auto);
    });
  }
  setInterval(fit, 1000); window.addEventListener('resize', fit);
  document.addEventListener('dblclick', function (e) { // ketuk 2x pada video = ganti Penuh / Utuh
    var v = e.target && e.target.closest && e.target.closest('#vc video, #vc-self'); if (!v) return;
    v.dataset.fit = v.classList.contains('ln-contain') ? 'fill' : 'fit'; fit();
    toast(v.dataset.fit === 'fit' ? 'Tampilan utuh' : 'Tampilan penuh');
  });


  // ---- Video call mini: tampil di atas pemutar layar penuh, bisa digeser, posisinya diingat ----
  var miniStyle = document.createElement('style');
  miniStyle.textContent =
    '#vc.mini{z-index:60!important;touch-action:none;cursor:grab}' +
    '#vc.mini.ln-drag{right:auto!important;bottom:auto!important;transition:none!important;cursor:grabbing}' +
    'body.ln-fsopen #vc.mini:not(.ln-drag){bottom:24px!important}';
  document.head.appendChild(miniStyle);

  var vcEl = $('vc'), fsEl = $('fullscreen-player');
  function fsSync() { document.body.classList.toggle('ln-fsopen', !!fsEl && !fsEl.classList.contains('translate-y-full')); }
  if (fsEl) { new MutationObserver(fsSync).observe(fsEl, { attributes: true, attributeFilter: ['class'] }); fsSync(); }

  if (vcEl) {
    var dragOn = false, dragMoved = false, dsx = 0, dsy = 0, dox = 0, doy = 0;
    var clampXY = function (x, y) {
      var r = vcEl.getBoundingClientRect();
      return [Math.min(Math.max(8, x), Math.max(8, innerWidth - r.width - 8)), Math.min(Math.max(8, y), Math.max(8, innerHeight - r.height - 8))];
    };
    var putPos = function (x, y) { var p = clampXY(x, y); vcEl.classList.add('ln-drag'); vcEl.style.left = p[0] + 'px'; vcEl.style.top = p[1] + 'px'; };
    vcEl.addEventListener('pointerdown', function (e) {
      if (!vcEl.classList.contains('mini') || e.button > 0) return;
      var r = vcEl.getBoundingClientRect();
      dsx = e.clientX; dsy = e.clientY; dox = r.left; doy = r.top; dragOn = true; dragMoved = false;
      try { vcEl.setPointerCapture(e.pointerId); } catch (x) {}
    });
    vcEl.addEventListener('pointermove', function (e) {
      if (!dragOn) return;
      var dx = e.clientX - dsx, dy = e.clientY - dsy;
      if (!dragMoved && Math.hypot(dx, dy) < 6) return;
      dragMoved = true; putPos(dox + dx, doy + dy);
    });
    var dragEnd = function () {
      if (!dragOn) return; dragOn = false;
      if (dragMoved) { try { sessionStorage.setItem('ln_vc_pos', parseFloat(vcEl.style.left) + '|' + parseFloat(vcEl.style.top)); } catch (x) {} }
    };
    vcEl.addEventListener('pointerup', dragEnd); vcEl.addEventListener('pointercancel', dragEnd);
    vcEl.addEventListener('click', function (e) {
      if (dragMoved) { e.stopPropagation(); e.preventDefault(); dragMoved = false; return; }
      // diketuk saat nonton bareng (layar penuh terbuka): tutup pemutar dulu agar layar video call terlihat
      if (vcEl.classList.contains('mini') && fsEl && !fsEl.classList.contains('translate-y-full')) { try { closeFullscreenPlayer(); } catch (x) {} }
    }, true);
    // keluar dari mode mini -> bersihkan posisi geser; masuk mode mini -> pulihkan posisi tersimpan
    new MutationObserver(function () {
      if (!vcEl.classList.contains('mini')) { if (vcEl.classList.contains('ln-drag')) { vcEl.classList.remove('ln-drag'); vcEl.style.left = ''; vcEl.style.top = ''; } return; }
      if (!vcEl.classList.contains('ln-drag')) {
        var sv = null; try { sv = sessionStorage.getItem('ln_vc_pos'); } catch (x) {}
        if (sv) { var a = sv.split('|'); if (isFinite(+a[0]) && isFinite(+a[1])) putPos(+a[0], +a[1]); }
      }
    }).observe(vcEl, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', function () { if (vcEl.classList.contains('ln-drag')) putPos(parseFloat(vcEl.style.left) || 8, parseFloat(vcEl.style.top) || 8); });
  }

  // ---- Tombol Back: tutup lapisan teratas -> mundur tab demi tab -> Beranda -> dialog keluar ----
  var armed = 0;
  function trap() { try { history.pushState({ ln: 1 }, ''); } catch (e) {} }
  function toast(m) { try { showToast(m); } catch (e) {} }
  function closeTop() {
    try { if (window.lnOfflineUI && window.lnOfflineUI.back && window.lnOfflineUI.back()) return true; } catch (e) {}
    if ($('ln-qd') && $('ln-qd').classList.contains('open')) { try { lnQueueClose(); } catch (e) { $('ln-qd').classList.remove('open'); } return true; }
    if (document.fullscreenElement || document.webkitFullscreenElement) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) {} return true; }
    if (!hidden('photo-viewer-modal')) { try { closePhotoViewer(); } catch (e) { $('photo-viewer-modal').classList.add('hidden'); } return true; }
    if ($('ln-paste-preview')) { $('ln-paste-preview').remove(); return true; }
    if ($('ln-config-modal') && !hidden('ln-config-modal')) { try { LNExtras.closeConfigModal(); } catch (e) { $('ln-config-modal').classList.add('hidden'); } return true; }
    if (!hidden('profile-modal')) { try { closeProfile(); } catch (e) { $('profile-modal').classList.add('hidden'); } return true; }
    if (!hidden('modal-settings') || !hidden('modal-create-playlist') || !hidden('modal-add-to-playlist')) { try { closeModals(); } catch (e) {} return true; }
    var fs = $('fullscreen-player');
    if (fs && !fs.classList.contains('translate-y-full')) { try { closeFullscreenPlayer(); } catch (e) {} return true; }
    return false;
  }
  // Riwayat tab: Back kembali ke tab yang terakhir dibuka, sampai Beranda
  var tabHist = [], goingBack = false;
  (function () {
    var st = window.switchTab;
    if (typeof st !== 'function' || st.__lnHist) return;
    var w = function () {
      var prev = null; try { prev = curTab; } catch (e) {}
      var r = st.apply(this, arguments);
      try { if (!goingBack && prev && curTab !== prev) { tabHist.push(prev); if (tabHist.length > 25) tabHist.shift(); } } catch (e) {}
      return r;
    };
    w.__lnHist = true; window.switchTab = w;
  })();
  function goPrevTab() {
    try {
      var cur = curTab, to = null;
      while (tabHist.length) { var p = tabHist.pop(); if (p && p !== cur) { to = p; break; } }
      if (!to && cur && cur !== 'online') to = (cur === 'videocall' && vcPrev && vcPrev !== 'videocall') ? vcPrev : 'online';
      if (!to) return false;
      goingBack = true; try { switchTab(to); } finally { goingBack = false; }
      return true;
    } catch (e) { return false; }
  }

  // Dialog konfirmasi keluar (bottom sheet di HP, modal di desktop)
  var dlg = null;
  function exitOpen() { return !!(dlg && dlg.isConnected); }
  function exitClose() { if (dlg) { dlg.classList.remove('on'); var d = dlg; dlg = null; setTimeout(function () { d.remove(); }, 220); } }
  function exitApp() {
    exitClose();
    try { var P = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.BackgroundPlay; if (P && P.exitApp) { P.exitApp(); return; } } catch (e) {}
    try { if (navigator.app && navigator.app.exitApp) { navigator.app.exitApp(); return; } } catch (e) {}
    try { history.go(-2); } catch (e) {}
  }
  function showExit() {
    if (exitOpen()) return;
    if (!$('ln-exit-css')) {
      var s = document.createElement('style'); s.id = 'ln-exit-css';
      s.textContent =
        '#ln-exit{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0);transition:background .22s;padding:0}' +
        '#ln-exit.on{background:rgba(0,0,0,.62)}' +
        '#ln-exit .box{width:100%;max-width:440px;box-sizing:border-box;background:#1d1d24;border:1px solid rgba(255,255,255,.08);border-radius:28px 28px 0 0;padding:26px 22px calc(22px + env(safe-area-inset-bottom));text-align:center;transform:translateY(40px);opacity:0;transition:transform .26s cubic-bezier(.2,0,0,1),opacity .2s;box-shadow:0 -10px 40px rgba(0,0,0,.5)}' +
        '#ln-exit.on .box{transform:none;opacity:1}' +
        '#ln-exit img{width:60px;height:60px;border-radius:16px;display:block;margin:0 auto 14px;box-shadow:0 8px 24px rgba(0,0,0,.45)}' +
        '#ln-exit h2{margin:0;color:#fff;font-size:20px;font-weight:800;letter-spacing:-.02em}' +
        '#ln-exit p{margin:8px 0 0;color:#a1a1ab;font-size:14px;line-height:1.45}' +
        '#ln-exit .btns{display:flex;flex-direction:column;gap:10px;margin-top:22px}' +
        '#ln-exit button{height:52px;border:0;border-radius:26px;font-size:15px;font-weight:800;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
        '#ln-exit .stay{background:#22d36a;color:#04210f}' +
        '#ln-exit .quit{background:#26262f;color:#fda4af}' +
        '#ln-exit button:active{transform:scale(.98)}#ln-exit button:focus-visible{outline:2px solid #22d36a;outline-offset:2px}' +
        '@media (min-width:640px){#ln-exit{align-items:center}#ln-exit .box{border-radius:28px;transform:scale(.94)}#ln-exit .btns{flex-direction:row-reverse}#ln-exit button{flex:1}}';
      document.head.appendChild(s);
    }
    var playing = false; try { playing = !!isPlaying; } catch (e) {}
    var logo = ''; try { logo = DEFAULT_LOGO; } catch (e) {}
    dlg = document.createElement('div'); dlg.id = 'ln-exit'; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-labelledby', 'ln-exit-t');
    dlg.innerHTML = '<div class="box">' + (logo ? '<img alt="" src="' + logo + '">' : '') +
      '<h2 id="ln-exit-t">Keluar dari LNMusic?</h2>' +
      '<p>' + (playing ? 'Musik yang sedang diputar akan berhenti kalau kamu keluar.' : 'Kamu bisa tetap di aplikasi atau keluar sekarang.') + '</p>' +
      '<div class="btns"><button type="button" class="stay">Tetap di aplikasi</button><button type="button" class="quit">Keluar</button></div></div>';
    dlg.addEventListener('click', function (e) { if (e.target === dlg) exitClose(); });
    dlg.querySelector('.stay').addEventListener('click', exitClose);
    dlg.querySelector('.quit').addEventListener('click', exitApp);
    document.body.appendChild(dlg);
    requestAnimationFrame(function () { if (dlg) { dlg.classList.add('on'); try { dlg.querySelector('.stay').focus({ preventScroll: true }); } catch (e) {} } });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && exitOpen()) exitClose(); });
  try { history.replaceState({ ln: 0 }, ''); } catch (e) {}
  trap();
  // Dipanggil MainActivity (Android) setiap tombol Back ditekan; selalu "ditangani" di sini, tidak bergantung riwayat WebView
  window.lnBackPress = function () {
    if (exitOpen()) { exitClose(); return 'ok'; }
    if (closeTop() || goPrevTab()) return 'ok';
    showExit(); return 'ok';
  };
  window.addEventListener('popstate', function (ev) {
    if (ev.state && ev.state.ln === 1) return; // maju ke jebakan, abaikan
    if (exitOpen()) { exitClose(); return trap(); }            // Back saat dialog terbuka = tetap di aplikasi
    if (closeTop() || goPrevTab()) return trap();              // tutup lapisan teratas, lalu mundur tab demi tab
    showExit(); trap();                                        // sudah di Beranda: tanya dulu
  });
})();
