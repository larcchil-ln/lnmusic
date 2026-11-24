/* LNMusic — jembatan ke aplikasi Android (Capacitor).
   Di browser biasa file ini tidak melakukan apa-apa. */
(function () {
  var C = window.Capacitor;
  var native = !!(C && ((C.isNativePlatform && C.isNativePlatform()) || (C.getPlatform && C.getPlatform() !== 'web')));
  if (!native) return;

  // 1) Di aplikasi tidak perlu tombol "Mulai • Layar Penuh" (sudah layar penuh dari sananya)
  function hideSplash() { var s = document.getElementById('splash'); if (s) s.remove(); }
  hideSplash();
  document.addEventListener('DOMContentLoaded', hideSplash);
  setTimeout(hideSplash, 300);

  // 2) Putar di latar belakang: nyalakan layanan Android selama lagu main
  var BP = null;
  try { BP = (C.Plugins && C.Plugins.BackgroundPlay) || C.registerPlugin('BackgroundPlay'); } catch (e) {}
  var svcOn = false, wantPlay = false;

  function title() {
    try { if (typeof currentTrack !== 'undefined' && currentTrack && currentTrack.title) return currentTrack.title; } catch (e) {}
    return 'LNMusic sedang memutar';
  }
  function sync(playing) {
    if (!BP) return;
    try {
      if (playing && !svcOn) { svcOn = true; BP.start({ title: title() }).catch(function () { svcOn = false; }); }
      else if (!playing && svcOn) { svcOn = false; BP.stop().catch(function () {}); }
    } catch (e) {}
  }

  // pantau status putar dari fungsi bawaan halaman
  function hook() {
    if (typeof window.setPlayingUI !== 'function' || window.setPlayingUI.__ln) return;
    var orig = window.setPlayingUI;
    var wrapped = function (p) {
      var r = orig.apply(this, arguments);
      if (!document.hidden) wantPlay = !!p;   // jeda otomatis di latar tidak dianggap pilihan pengguna
      sync(!!p);
      return r;
    };
    wrapped.__ln = true;
    window.setPlayingUI = wrapped;
  }
  hook(); setTimeout(hook, 1000);

  // jaring pengaman: cek berkala
  setInterval(function () {
    try { if (typeof isPlaying !== 'undefined') sync(!!isPlaying); } catch (e) {}
  }, 3000);

  // 3) Kalau pemutar YouTube ikut terjeda saat layar mati / app di latar, lanjutkan lagi
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) return;
    setTimeout(function () {
      try {
        if (wantPlay && typeof ytPlayer !== 'undefined' && ytPlayer && ytPlayer.getPlayerState && ytPlayer.getPlayerState() === 2) {
          ytPlayer.playVideo();
        }
      } catch (e) {}
    }, 700);
  });
})();
