/* LNMusic APK: saat HP diputar (landscape) tampilan tetap layout mobile yang sama dengan portrait.
   Breakpoint lebar (md:/lg: Tailwind dan @media min-width) dimatikan, aturan khusus mobile (max-width) dibuat selalu aktif.
   Hanya berjalan di APK (html.ln-android); web biasa tidak terpengaruh. */
(function () {
  var R = document.documentElement;
  if (!R.classList.contains('ln-android')) return;
  var MIN_OFF = 440;                 // min-width >= 440px dianggap "layar lebar" -> dimatikan
  var MAX_ON_FROM = 411, MAX_ON_TO = 2000; // max-width di rentang ini -> selalu aktif
  var done = typeof WeakSet === 'function' ? new WeakSet() : null;

  function mapQuery(mt) {
    if (!/width/.test(mt)) return null;
    var changed = false;
    var out = mt.split(',').map(function (p) {
      var mn = p.match(/min-width:\s*([\d.]+)px/), mx = p.match(/max-width:\s*([\d.]+)px/);
      if (mn && +mn[1] >= MIN_OFF) { changed = true; return 'not all'; }
      if (mx && +mx[1] >= MAX_ON_FROM && +mx[1] <= MAX_ON_TO) { changed = true; return p.replace(/\(\s*max-width:\s*[\d.]+px\s*\)/g, '(min-width: 0px)'); }
      return p;
    }).join(',');
    return changed ? out : null;
  }
  function walk(rules) {
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (done && done.has(r)) continue;
      if (done) done.add(r);
      if (r.type === 4 && r.media) {             // CSSMediaRule
        var m = mapQuery(r.media.mediaText);
        if (m !== null) { try { r.media.mediaText = m; } catch (e) {} }
      }
      if (r.cssRules && r.cssRules.length) walk(r.cssRules);   // @media / @supports / @layer bersarang
    }
  }
  function run() {
    var sheets = document.styleSheets;
    for (var i = 0; i < sheets.length; i++) { try { walk(sheets[i].cssRules); } catch (e) {} }
  }
  var t = 0;
  function soon() { if (t) return; t = setTimeout(function () { t = 0; run(); }, 60); }   // throttle (bukan debounce) supaya tetap jalan walau halaman terus berubah
  run();
  document.addEventListener('DOMContentLoaded', run);
  window.addEventListener('load', function () { run(); setTimeout(run, 400); setTimeout(run, 1500); });
  window.addEventListener('resize', soon);
  window.addEventListener('orientationchange', soon);
  // Tailwind CDN menulis ulang <style> saat ada class baru: pantau supaya patch ikut diterapkan ulang
  try {
    var hd = document.head || document.documentElement; new MutationObserver(soon).observe(hd, { childList: true, subtree: true, characterData: true });   // cukup pantau <head> (tempat <style> Tailwind)
  } catch (e) {}
})();
