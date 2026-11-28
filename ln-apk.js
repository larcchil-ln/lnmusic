/* LNMusic: kartu "Unduh APK Android" di Beranda untuk pengunjung web.
   - Tidak tampil di dalam aplikasi Android (APK), dan tidak tampil di iPhone/iPad (tidak bisa pasang APK).
   - Tombol hanya muncul kalau file APK memang ada di server.
   Cara pakai: taruh hasil build APK di root repo web dengan nama persis "lnmusic.apk"
   (atau ubah APK_URL di bawah, mis. ke link GitHub Releases). */
(function () {
  var APK_URL = '/lnmusic.apk';
  var DISMISS_KEY = 'lnmusic_apk_dismiss';
  var DAYS = 14;

  var ua = navigator.userAgent || '';
  var cap = window.Capacitor, native = false;
  try { native = !!(cap && ((cap.isNativePlatform && cap.isNativePlatform()) || (cap.getPlatform && cap.getPlatform() !== 'web'))); } catch (e) {}
  if (native || /; wv\)/.test(ua) || document.documentElement.classList.contains('ln-android')) return;
  if (/iPhone|iPad|iPod/i.test(ua)) return;
  try { var d = +localStorage.getItem(DISMISS_KEY) || 0; if (Date.now() - d < DAYS * 864e5) return; } catch (e) {}

  var IC = {
    phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
    dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
  };
  function svg(n, s, w) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0">' + IC[n] + '</svg>';
  }
  function el(tag, css, txt) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }

  var card = null, sizeEl = null;
  function build(sizeText) {
    card = el('div', 'position:relative;display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding:14px 44px 14px 14px;margin:0 0 16px;border-radius:22px;background:rgba(255,255,255,.04);border:1px solid rgba(34,211,106,.25);color:#fff;font-family:inherit');
    card.id = 'ln-apk-card';
    var ic = el('div', 'width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:rgba(34,211,106,.14);color:#4ade80;flex-shrink:0');
    ic.innerHTML = svg('phone', 24, 1.8);
    var tx = el('div', 'flex:1 1 180px;min-width:0');
    tx.appendChild(el('div', 'font-weight:800;font-size:15px;line-height:1.25', 'Pasang aplikasi Android'));
    tx.appendChild(el('div', 'font-size:12.5px;color:#a1a1aa;margin-top:2px;line-height:1.4', 'Musik dan voice tetap jalan saat layar mati. Gratis, langsung dari sini.'));
    sizeEl = el('div', 'font-size:11.5px;color:#71717a;margin-top:3px', sizeText || '');
    tx.appendChild(sizeEl);
    var a = el('a', 'display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;padding:0 20px;border-radius:999px;background:#22d36a;color:#04210f;font-size:14px;font-weight:800;text-decoration:none;flex-shrink:0;box-shadow:0 10px 26px -12px rgba(34,211,106,.7)');
    a.href = APK_URL; a.setAttribute('download', 'LNMusic.apk'); a.setAttribute('rel', 'noopener');
    a.innerHTML = svg('dl', 18, 2.2); a.appendChild(document.createTextNode('Unduh APK'));
    var x = el('button', 'position:absolute;top:8px;right:8px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;border:0;background:rgba(255,255,255,.07);color:#a1a1aa;cursor:pointer;padding:0');
    x.type = 'button'; x.innerHTML = svg('x', 15, 2.2); x.title = 'Sembunyikan'; x.setAttribute('aria-label', 'Sembunyikan');
    x.onclick = function () { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {} if (card) card.remove(); card = null; clearInterval(iv); };
    var note = el('div', 'flex:1 1 100%;font-size:11.5px;color:#71717a;line-height:1.45', 'Setelah terunduh, buka file-nya. Kalau Android bertanya, izinkan “Install dari sumber ini”.');
    [ic, tx, a, note, x].forEach(function (n) { card.appendChild(n); });
  }
  function place() {
    var host = document.getElementById('tab-online');
    if (!host || !card || card.isConnected) return;
    host.insertBefore(card, host.firstChild);
  }

  var iv = null;
  function start(sizeText) {
    build(sizeText); place();
    iv = setInterval(place, 3000); // jaga-jaga kalau Beranda dirender ulang
  }
  function mb(n) { return n > 0 ? 'Ukuran sekitar ' + (n / 1048576).toFixed(n > 10485760 ? 0 : 1) + ' MB' : ''; }

  function init() {
    var cross = /^https?:\/\//i.test(APK_URL) && new URL(APK_URL, location.href).origin !== location.origin;
    if (cross) { start(''); return; } // link luar (mis. GitHub Releases): tidak bisa dicek, anggap ada
    fetch(APK_URL, { method: 'HEAD', cache: 'no-store' })
      .then(function (r) {
        var t = (r.headers.get('content-type') || '').toLowerCase();
        if (!r.ok || t.indexOf('text/html') >= 0) return; // 404 / halaman pengganti -> file belum ada, kartu tidak ditampilkan
        start(mb(+r.headers.get('content-length') || 0));
      })
      .catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
