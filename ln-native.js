/* LNMusic — jembatan ke aplikasi Android (Capacitor).
   Di browser biasa file ini tidak melakukan apa-apa. */
(function () {
  var C = window.Capacitor;
  var native = !!(C && ((C.isNativePlatform && C.isNativePlatform()) || (C.getPlatform && C.getPlatform() !== 'web')));
  if (!native) return;
  if (window.__lnNativeLoaded) return;
  window.__lnNativeLoaded = true;

  // 1) Di aplikasi tidak perlu tombol "Mulai • Layar Penuh"
  function hideSplash() { var s = document.getElementById('splash'); if (s) s.remove(); }
  hideSplash();
  document.addEventListener('DOMContentLoaded', hideSplash);
  setTimeout(hideSplash, 300);

  // 2) Putar di latar belakang
  var BP = null;
  try { BP = (C.Plugins && C.Plugins.BackgroundPlay) || C.registerPlugin('BackgroundPlay'); } catch (e) {}
  var svcOn = false, wantPlay = false, lastChange = Date.now(), notPlayingSince = 0, lastTitle = '';

  // __lnBg diisi oleh MainActivity (onPause/onResume). document.hidden hanya cadangan.
  function bg() { return window.__lnBg === true || document.hidden; }
  function mark() { lastChange = Date.now(); }
  window.addEventListener('ln-bg', mark);
  window.addEventListener('ln-fg', mark);
  document.addEventListener('visibilitychange', mark);

  function title() {
    try { if (typeof currentTrack !== 'undefined' && currentTrack && currentTrack.title) return currentTrack.title; } catch (e) {}
    return 'LNMusic sedang memutar';
  }
  function ytState() {
    try { if (typeof ytPlayer !== 'undefined' && ytPlayer && ytPlayer.getPlayerState) return ytPlayer.getPlayerState(); } catch (e) {}
    return -2;
  }
  function resume() {
    try { if (ytState() === 2) ytPlayer.playVideo(); } catch (e) {}
  }

  // Layanan foreground cuma boleh DIMULAI saat app terlihat (aturan Android 12+),
  // jadi di latar belakang kita hanya boleh mempertahankan / menghentikannya.
  function sync(on) {
    if (!BP) return;
    try {
      if (on && !svcOn) {
        if (bg()) return;
        svcOn = true; lastTitle = title();
        BP.start({ title: lastTitle }).catch(function () { svcOn = false; });
      } else if (on && svcOn && !bg() && title() !== lastTitle) {
        lastTitle = title();
        BP.start({ title: lastTitle }).catch(function () {});   // perbarui judul di notifikasi
      } else if (!on && svcOn) {
        svcOn = false; BP.stop().catch(function () {});
      }
    } catch (e) {}
  }

  function hook() {
    if (typeof window.setPlayingUI !== 'function' || window.setPlayingUI.__ln) return;
    var orig = window.setPlayingUI;
    var wrapped = function (p) {
      var r = orig.apply(this, arguments);
      if (p) wantPlay = true;
      // Jeda otomatis di latar belakang BUKAN pilihan pengguna -> jangan matikan layanan
      else if (!bg() && Date.now() - lastChange > 2500) wantPlay = false;
      sync(wantPlay);
      return r;
    };
    wrapped.__ln = true;
    window.setPlayingUI = wrapped;
  }
  hook(); setTimeout(hook, 1000); setTimeout(hook, 3000);

  // Pemeriksa berkala
  setInterval(function () {
    try {
      if (bg()) {
        if (!wantPlay) return;
        var st = ytState();
        if (st === 2) resume();                       // YouTube terjeda sendiri -> lanjutkan
        if (st === 1 || st === 3) notPlayingSince = 0;
        else if (!notPlayingSince) notPlayingSince = Date.now();
        else if (Date.now() - notPlayingSince > 90000) { // lagu/daftar putar sudah habis
          wantPlay = false; notPlayingSince = 0; sync(false);
        }
      } else {
        notPlayingSince = 0;
        if (typeof isPlaying !== 'undefined' && Date.now() - lastChange > 2500) wantPlay = !!isPlaying;
        sync(wantPlay);
      }
    } catch (e) {}
  }, 1500);

  // Begitu masuk latar belakang, langsung coba lanjutkan kalau pemutar ikut terjeda
  function onBg() { setTimeout(resume, 400); setTimeout(resume, 1200); }
  window.addEventListener('ln-bg', function () { if (wantPlay) onBg(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && wantPlay) onBg(); });

  // 4) Notifikasi (mis. "Pasangan kamu sedang online")
  var notifOK = false;
  function refreshPerm() {
    if (!BP || !BP.checkPerm) return;
    try { BP.checkPerm().then(function (r) { notifOK = !!(r && r.granted); }).catch(function () {}); } catch (e) {}
  }
  refreshPerm();

  function lnNotify(title, body, tag) {
    if (!BP) return Promise.resolve(false);
    try {
      return BP.notify({ title: String(title || 'LNMusic'), body: String(body || ''), tag: String(tag || 'ln') })
        .then(function () { notifOK = true; return true; }, function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }
  // Pasangan online: hanya munculkan notifikasi kalau app sedang di latar belakang
  function lnPartnerOnline(name, force) {
    if (!force && !bg()) return Promise.resolve(false);
    return lnNotify((name || 'Pasanganmu') + ' sedang online', 'Ketuk untuk membuka LNMusic', 'partner-online');
  }
  window.lnNotify = lnNotify;
  window.lnPartnerOnline = lnPartnerOnline;

  // WebView Android tidak punya Notification API. Pasang pengganti supaya kode situs
  // yang sudah memakai `new Notification(...)` otomatis jadi notifikasi asli.
  function NativeNotification(title, opts) {
    opts = opts || {};
    this.title = title; this.body = opts.body || ''; this.tag = opts.tag || '';
    this.onclick = null; this.onclose = null; this.onerror = null; this.onshow = null;
    this.close = function () {};
    lnNotify(title, opts.body, opts.tag);
  }
  Object.defineProperty(NativeNotification, 'permission', { get: function () { return notifOK ? 'granted' : 'default'; } });
  NativeNotification.requestPermission = function (cb) {
    var p = (BP && BP.requestPerm ? BP.requestPerm() : Promise.resolve({ granted: false }))
      .then(function (r) { notifOK = !!(r && r.granted); return notifOK ? 'granted' : 'denied'; })
      .catch(function () { return 'denied'; });
    if (typeof cb === 'function') p.then(cb);
    return p;
  };
  try { window.Notification = NativeNotification; } catch (e) {}
})();
