/* LNMusic — jembatan ke aplikasi Android (Capacitor).
   Di browser biasa file ini tidak melakukan apa-apa. */
(function () {
  function startNativeBridge() {
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

  // ---- Info lagu untuk notifikasi (judul, artis, sampul, status, posisi) ----
  function isOffline() {
    try { return !!(typeof currentTrack !== 'undefined' && currentTrack && currentTrack.type === 'offline'); } catch (e) { return false; }
  }
  function isActuallyPlaying() {
    try { if (isOffline() && typeof htmlAudio !== 'undefined') return !htmlAudio.paused; } catch (e) {}
    var s = ytState();
    if (s === 1 || s === 3) return true;
    if (s === -2) { try { return typeof isPlaying !== 'undefined' && !!isPlaying; } catch (e) {} }
    return false;
  }
  function info() {
    var o = { title: title(), artist: '', thumb: '', playing: isActuallyPlaying(), pos: -1, dur: 0 };
    try {
      if (typeof currentTrack !== 'undefined' && currentTrack) {
        o.artist = String(currentTrack.artist || '');
        var th = String(currentTrack.thumb || '');
        if (!th && currentTrack.type === 'youtube' && currentTrack.id) th = 'https://i.ytimg.com/vi/' + currentTrack.id + '/hqdefault.jpg';
        o.thumb = /^https?:/.test(th) ? th : '';
      }
    } catch (e) {}
    try {
      var p = 0, d = 0;
      if (isOffline() && typeof htmlAudio !== 'undefined') { p = htmlAudio.currentTime; d = htmlAudio.duration; }
      else if (typeof ytPlayer !== 'undefined' && ytPlayer && ytPlayer.getCurrentTime) { p = ytPlayer.getCurrentTime(); d = ytPlayer.getDuration(); }
      if (isFinite(p) && p >= 0) o.pos = Math.round(p * 1000);
      if (isFinite(d) && d > 0) o.dur = Math.round(d * 1000);
    } catch (e) {}
    return o;
  }
  var lastKey = '', lastPush = 0;
  function pushInfo(force) {
    if (!BP || !svcOn || !BP.update) return;
    try {
      var o = info();
      var key = o.title + '|' + o.artist + '|' + o.thumb + '|' + o.playing + '|' + o.dur;
      var now = Date.now();
      if (!force && key === lastKey && now - lastPush < 10000) return;   // posisi dikirim tiap ~10 detik saja
      lastKey = key; lastPush = now;
      BP.update(o).catch(function () {});
    } catch (e) {}
  }
  var holdUntil = 0;   // setelah dijeda dari notifikasi, layanan dibiarkan hidup supaya tombol Putar tetap ada
  function ctlToggle() { try { if (typeof togglePlay === 'function') togglePlay(); } catch (e) {} }
  function onMediaAction(ev) {
    var a = ev && ev.action;
    try {
      if (a === 'toggle') {
        var was = isActuallyPlaying();
        ctlToggle();
        if (was) { wantPlay = false; holdUntil = Date.now() + 10 * 60 * 1000; } else { wantPlay = true; holdUntil = 0; }
      } else if (a === 'play') {
        if (!isActuallyPlaying()) ctlToggle();
        wantPlay = true; holdUntil = 0;
      } else if (a === 'pause') {
        if (isActuallyPlaying()) ctlToggle();
        wantPlay = false; holdUntil = Date.now() + 10 * 60 * 1000;
      } else if (a === 'next') {
        wantPlay = true; holdUntil = 0;
        if (typeof playNext === 'function') playNext();
      } else if (a === 'prev') {
        wantPlay = true; holdUntil = 0;
        if (typeof playPrev === 'function') playPrev();
      } else if (a === 'seek') {
        var sec = (ev.arg || 0) / 1000;
        if (isOffline() && typeof htmlAudio !== 'undefined') htmlAudio.currentTime = sec;
        else if (typeof ytPlayer !== 'undefined' && ytPlayer && ytPlayer.seekTo) ytPlayer.seekTo(sec, true);
      } else if (a === 'stop') {
        wantPlay = false; holdUntil = 0; svcOn = false;
        if (isActuallyPlaying()) ctlToggle();
        try { BP.stop().catch(function () {}); } catch (e) {}
        return;
      }
    } catch (e) {}
    setTimeout(function () { pushInfo(true); }, 400);
    setTimeout(function () {
      // selaraskan dengan keadaan pemutar yang sebenarnya (mis. kontrol ditolak karena izin room)
      if (a === 'toggle' || a === 'play' || a === 'pause') {
        wantPlay = isActuallyPlaying();
        holdUntil = wantPlay ? 0 : Date.now() + 10 * 60 * 1000;
      }
      pushInfo(true);
    }, 1500);
  }
  try { if (BP && BP.addListener) BP.addListener('media', onMediaAction); } catch (e) {}

  // Layanan foreground cuma boleh DIMULAI saat app terlihat (aturan Android 12+),
  // jadi di latar belakang kita hanya boleh mempertahankan / menghentikannya.
  function sync(on) {
    if (!BP) return;
    try {
      if (on && !svcOn) {
        if (bg()) return;
        svcOn = true; lastTitle = title();
        var o = info(); o.playing = true;
        lastKey = ''; lastPush = Date.now();
        BP.start(o).catch(function () { svcOn = false; });
      } else if (on && svcOn) {
        pushInfo(false);   // judul/artis/sampul/status berubah -> perbarui notifikasi (boleh dari latar belakang)
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
        if (!wantPlay) {
          if (svcOn) {
            pushInfo(false);
            // dijeda dari notifikasi: tahan layanan sebentar, lalu lepas supaya baterai tidak terkuras
            if (Date.now() > holdUntil) { svcOn = false; BP.stop().catch(function () {}); }
          }
          return;
        }
        pushInfo(false);
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
        if (wantPlay || !svcOn) sync(wantPlay);
        else if (Date.now() > holdUntil) sync(false);   // dijeda: biarkan notifikasi dulu sampai masa tahan habis
        else pushInfo(false);
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
  }
  var ready = window.__lnCapacitorBridgeReady;
  if (ready && typeof ready.then === 'function') ready.then(startNativeBridge).catch(function () {});
  else startNativeBridge();
})();
