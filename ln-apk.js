/* LNMusic: tombol "Unduh APK Android" di header (HP/tablet: bar atas, desktop: sidebar kiri).
   - Tidak tampil di dalam aplikasi Android (APK), dan tidak tampil di iPhone/iPad (tidak bisa pasang APK).
   - Tombol hanya muncul kalau file APK memang ada di server.
   Cara pakai: taruh hasil build APK di root repo web dengan nama persis "lnmusic.apk"
   (atau ubah APK_URL di bawah, mis. ke link GitHub Releases). */
(function () {
  var APK_URL = '/lnmusic.apk';

  var ua = navigator.userAgent || '';
  var cap = window.Capacitor, native = false;
  try { native = !!(cap && ((cap.isNativePlatform && cap.isNativePlatform()) || (cap.getPlatform && cap.getPlatform() !== 'web'))); } catch (e) {}
  if (native || /; wv\)/.test(ua) || document.documentElement.classList.contains('ln-android')) return;
  if (/iPhone|iPad|iPod/i.test(ua)) return;

  var DL = '<svg xmlns="http://www.w3.org/2000/svg" width="__S__" height="__S__" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>';
  var tip = 'Unduh aplikasi Android (APK)';
  var btnTop = null, btnSide = null;

  function mk(css, html) {
    var a = document.createElement('a');
    a.style.cssText = css + ';box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;border:1.5px solid #22d36a;color:#4ade80;background:rgba(34,211,106,.08);text-decoration:none;cursor:pointer;flex-shrink:0;transition:background .15s,transform .1s;-webkit-tap-highlight-color:transparent';
    a.href = APK_URL; a.setAttribute('download', 'LNMusic.apk'); a.setAttribute('rel', 'noopener');
    a.title = tip; a.setAttribute('aria-label', tip);
    a.innerHTML = html;
    a.addEventListener('pointerdown', function () { a.style.transform = 'scale(.94)'; });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { a.addEventListener(ev, function () { a.style.transform = ''; }); });
    a.addEventListener('click', function () {
      try { if (typeof showToast === 'function') showToast('Mengunduh APK… Setelah selesai, buka file-nya dan izinkan “Install dari sumber ini” bila diminta.'); } catch (e) {}
    });
    return a;
  }

  function place() {
    // HP / tablet: bar atas, paling kiri dari deretan tombol (sebelum Bareng)
    var bar = document.querySelector('#ln-appbar > div:last-child');
    if (bar && (!btnTop || !btnTop.isConnected)) {
      var ref = bar.querySelector('button[onclick^="openMyProfile"]') || bar.querySelector('button');
      var size = Math.max(36, Math.min(48, (ref && ref.offsetHeight) || 40));
      btnTop = mk('width:' + size + 'px;height:' + size + 'px;border-radius:50%', DL.replace(/__S__/g, '19'));
      bar.insertBefore(btnTop, bar.firstChild);
    }
    // Desktop: di sidebar, tepat di bawah kotak kutipan
    var side = document.getElementById('ln-top');
    if (side && (!btnSide || !btnSide.isConnected)) {
      var q = side.querySelector('p');
      if (q && q.parentNode) {
        btnSide = mk('width:100%;height:42px;border-radius:999px;gap:8px;font-size:13.5px;font-weight:700;margin:-10px 0 18px', DL.replace(/__S__/g, '17') + '<span>Unduh APK Android</span>');
        q.parentNode.insertBefore(btnSide, q.nextSibling);
      }
    }
  }

  function start() { place(); setInterval(place, 3000); } // jaga-jaga kalau header dirender ulang

  function init() {
    var cross = /^https?:\/\//i.test(APK_URL) && new URL(APK_URL, location.href).origin !== location.origin;
    if (cross) { start(); return; } // link luar (mis. GitHub Releases): tidak bisa dicek, anggap ada
    fetch(APK_URL, { method: 'HEAD', cache: 'no-store' })
      .then(function (r) {
        var t = (r.headers.get('content-type') || '').toLowerCase();
        if (!r.ok || t.indexOf('text/html') >= 0) return; // 404 / halaman pengganti -> file belum ada, tombol tidak ditampilkan
        var n = +r.headers.get('content-length') || 0;
        if (n > 0) tip += ' · ' + (n / 1048576).toFixed(n > 10485760 ? 0 : 1) + ' MB';
        start();
      })
      .catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
