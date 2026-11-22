/* LNMusic nav: tombol Back ala aplikasi + rotasi otomatis saat fullscreen video YouTube. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var hidden = function (id) { var e = $(id); return !e || e.classList.contains('hidden'); };

  // ---- Pindah tab halus + penanda tab aktif ----
  var navStyle = document.createElement('style');
  navStyle.textContent =
    '.mnav{position:relative;-webkit-tap-highlight-color:transparent;transition:color .25s}' +
    '.mnav svg{transition:transform .35s cubic-bezier(.34,1.56,.64,1),background .25s}' +
    '.mnav.on svg{transform:translateY(-2px) scale(1.12)}' +
    '.mnav:active svg{transform:scale(.88)}' +
    '#ln-ind{position:absolute;top:0;left:0;height:3px;width:30px;border-radius:0 0 6px 6px;background:linear-gradient(90deg,#f43f5e,#8b5cf6);box-shadow:0 2px 14px rgba(244,63,94,.75);transition:transform .38s cubic-bezier(.22,1,.36,1);opacity:0;pointer-events:none}' +
    '.nav-btn{transition:background .25s,color .25s,box-shadow .25s}' +
    '.nav-btn.text-rose-400{box-shadow:inset 3px 0 0 #f43f5e}' +
    '@keyframes lnTabIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}' +
    '.ln-tab-in{animation:lnTabIn .38s cubic-bezier(.22,1,.36,1)}' +
    '@media (prefers-reduced-motion:reduce){.ln-tab-in{animation:none}#ln-ind,.mnav svg{transition:none}}';
  document.head.appendChild(navStyle);

  var indEl = null;
  function moveInd() {
    var cur = null; try { cur = curTab; } catch (e) {}
    var btn = $('mob-nav-' + (cur || 'online'));
    if (!btn) return;
    var nav = btn.parentElement, nr = nav.getBoundingClientRect();
    if (!nr.width) return; // nav bawah disembunyikan di layar lebar
    if (!indEl || !indEl.isConnected) {
      indEl = document.createElement('div'); indEl.id = 'ln-ind'; nav.appendChild(indEl);
    }
    var br = btn.getBoundingClientRect();
    indEl.style.opacity = '1';
    indEl.style.transform = 'translateX(' + Math.round(br.left - nr.left + br.width / 2 - 15) + 'px)';
  }
  window.addEventListener('resize', moveInd);
  window.addEventListener('load', function () { setTimeout(moveInd, 200); });
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
        if (el && t !== 'videocall') { el.classList.remove('ln-tab-in'); void el.offsetWidth; el.classList.add('ln-tab-in'); }
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
    vcEl.addEventListener('click', function (e) { if (dragMoved) { e.stopPropagation(); e.preventDefault(); dragMoved = false; } }, true);
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

  // ---- Tombol Back: tutup lapisan teratas -> kembali ke Beranda -> baru keluar ----
  var armed = 0;
  function trap() { try { history.pushState({ ln: 1 }, ''); } catch (e) {} }
  function toast(m) { try { showToast(m); } catch (e) {} }
  function closeTop() {
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
  function goHome() {
    try {
      if (curTab && curTab !== 'online') {
        var to = curTab === 'videocall' ? (vcPrev && vcPrev !== 'videocall' ? vcPrev : 'online') : 'online';
        switchTab(to); return true;
      }
    } catch (e) {}
    return false;
  }
  try { history.replaceState({ ln: 0 }, ''); } catch (e) {}
  trap();
  window.addEventListener('popstate', function (ev) {
    if (ev.state && ev.state.ln === 1) return; // maju ke jebakan, abaikan
    if (closeTop() || goHome()) { armed = 0; return trap(); }
    if (Date.now() - armed < 2000) { try { history.back(); } catch (e) {} return; } // back kedua: keluar
    armed = Date.now(); toast('Tekan Back sekali lagi untuk keluar'); trap();
  });
})();
