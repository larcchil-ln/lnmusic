/* LNMusic nav: tombol Back ala aplikasi + rotasi otomatis saat fullscreen video YouTube. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var hidden = function (id) { var e = $(id); return !e || e.classList.contains('hidden'); };

  // ---- Tab Hub sudah dihapus: arahkan panggilan lama ke Beranda ----
  if (typeof window.switchTab === 'function') {
    var st = window.switchTab;
    window.switchTab = function (t) { return st.call(this, t === 'hub' ? 'online' : t); };
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
