/* LNMusic — pemutar musik lokal (scan musik di HP). Hanya aktif di aplikasi Android. */
(function () {
  var C = window.Capacitor;
  var native = !!(C && ((C.isNativePlatform && C.isNativePlatform()) || (C.getPlatform && C.getPlatform() !== 'web')));
  if (!native || window.__lnLocalLoaded) return;
  window.__lnLocalLoaded = true;

  var LM = null, BP = null;
  try { LM = (C.Plugins && C.Plugins.LocalMusic) || C.registerPlugin('LocalMusic'); } catch (e) {}
  try { BP = (C.Plugins && C.Plugins.BackgroundPlay) || C.registerPlugin('BackgroundPlay'); } catch (e) {}
  if (!LM) return;

  var lib = [], view = [], shown = 0, st = {}, dragging = false, notifAsked = false, CHUNK = 80;
  var $ = function (id) { return document.getElementById(id); };
  function fmt(ms) { var s = Math.max(0, Math.round((ms || 0) / 1000)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  function build() {
    var css = document.createElement('style');
    css.textContent =
      '.lnl-fab{position:fixed;right:14px;bottom:calc(env(safe-area-inset-bottom,0px) + 150px);z-index:9998;width:48px;height:48px;border-radius:50%;border:0;background:#1db954;color:#000;font-size:22px;box-shadow:0 4px 14px #0008}' +
      '.lnl-panel{position:fixed;inset:0;z-index:9999;background:#000;color:#fff;display:flex;flex-direction:column;font-family:sans-serif;padding-top:env(safe-area-inset-top,0px)}' +
      '.lnl-panel[hidden]{display:none}' +
      '.lnl-top{display:flex;align-items:center;gap:10px;padding:12px 14px}.lnl-top b{flex:1;font-size:18px}.lnl-top small{opacity:.6}' +
      '.lnl-top button{background:#222;color:#fff;border:0;border-radius:8px;width:38px;height:38px;font-size:18px}' +
      '#lnl-q{margin:0 14px 8px;padding:11px 14px;border-radius:10px;border:0;background:#1a1a1a;color:#fff;font-size:15px;outline:0}' +
      '#lnl-list{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}' +
      '.lnl-row{padding:10px 14px;border-bottom:1px solid #151515}.lnl-row.on{background:#10261a}' +
      '.lnl-row div:first-child{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.lnl-row div:last-child{font-size:12px;opacity:.6;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#lnl-msg{padding:22px 18px;text-align:center;opacity:.8;font-size:14px}' +
      '#lnl-msg button{margin-top:12px;background:#1db954;color:#000;border:0;border-radius:20px;padding:10px 22px;font-size:15px;font-weight:600}' +
      '.lnl-bar{background:#111;padding:10px 14px calc(env(safe-area-inset-bottom,0px) + 10px);border-top:1px solid #222}' +
      '#lnl-now{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#lnl-art{font-size:12px;opacity:.6;margin-bottom:6px}' +
      '.lnl-seek{display:flex;align-items:center;gap:8px;font-size:11px;opacity:.85}.lnl-seek input{flex:1}' +
      '.lnl-ctl{display:flex;justify-content:space-around;margin-top:6px}.lnl-ctl button{background:none;border:0;color:#fff;font-size:24px;padding:6px 12px}.lnl-ctl .big{font-size:30px}.lnl-ctl .act{color:#1db954}';
    document.head.appendChild(css);

    var fab = document.createElement('button');
    fab.className = 'lnl-fab'; fab.textContent = '\uD83C\uDFB5'; fab.title = 'Musik di HP';
    document.body.appendChild(fab);

    var p = document.createElement('div');
    p.className = 'lnl-panel'; p.id = 'lnl-panel'; p.hidden = true;
    p.innerHTML =
      '<div class="lnl-top"><b>Musik di HP</b><small id="lnl-count"></small><button id="lnl-refresh" title="Scan ulang">\u21BB</button><button id="lnl-close">\u2715</button></div>' +
      '<input id="lnl-q" type="search" placeholder="Cari judul / artis">' +
      '<div id="lnl-list"></div>' +
      '<div class="lnl-bar"><div id="lnl-now">Belum ada lagu diputar</div><div id="lnl-art"></div>' +
      '<div class="lnl-seek"><span id="lnl-pos">0:00</span><input id="lnl-seek" type="range" min="0" max="1" value="0"><span id="lnl-dur">0:00</span></div>' +
      '<div class="lnl-ctl"><button id="lnl-sh">\uD83D\uDD00</button><button id="lnl-prev">\u23EE</button><button id="lnl-pp" class="big">\u25B6</button><button id="lnl-next">\u23ED</button><button id="lnl-rp">\uD83D\uDD01</button></div></div>';
    document.body.appendChild(p);

    fab.onclick = openPanel;
    $('lnl-close').onclick = function () { p.hidden = true; };
    $('lnl-refresh').onclick = scan;
    $('lnl-q').oninput = applyFilter;
    $('lnl-list').onscroll = function () { var l = this; if (l.scrollTop + l.clientHeight > l.scrollHeight - 300) renderMore(); };
    $('lnl-pp').onclick = function () { st.active ? LM.toggle() : (view.length && playIndex(0)); };
    $('lnl-prev').onclick = function () { LM.prev(); };
    $('lnl-next').onclick = function () { LM.next(); };
    $('lnl-sh').onclick = function () { LM.setMode({ shuffle: !st.shuffle, repeat: st.repeat || 0 }); };
    $('lnl-rp').onclick = function () { LM.setMode({ shuffle: !!st.shuffle, repeat: ((st.repeat || 0) + 1) % 3 }); };
    var sk = $('lnl-seek');
    sk.oninput = function () { dragging = true; $('lnl-pos').textContent = fmt(+sk.value); };
    sk.onchange = function () { dragging = false; LM.seek({ ms: +sk.value }); };
  }

  function msg(html, btnText, btnFn) {
    var m = $('lnl-list'); m.innerHTML = '';
    var d = document.createElement('div'); d.id = 'lnl-msg'; d.textContent = html;
    if (btnText) { var b = document.createElement('button'); b.textContent = btnText; b.onclick = btnFn; d.appendChild(document.createElement('br')); d.appendChild(b); }
    m.appendChild(d);
  }

  function openPanel() {
    $('lnl-panel').hidden = false;
    if (!lib.length) {
      LM.checkPerm().then(function (r) {
        if (r && r.granted) scan();
        else msg('LNMusic butuh izin untuk membaca musik di HP kamu.', 'Izinkan', function () { LM.requestPerm().then(function (r2) { r2 && r2.granted ? scan() : msg('Izin ditolak. Aktifkan lewat Pengaturan \u2192 Aplikasi \u2192 LNMusic \u2192 Izin.'); }); });
      }).catch(function () { scan(); });
    }
    poll();
  }

  function scan() {
    msg('Memindai musik\u2026');
    LM.scan({ minDuration: 30000 }).then(function (r) {
      lib = (r && r.items) || [];
      applyFilter();
      if (!lib.length) msg('Tidak ada musik ditemukan di HP ini.');
    }).catch(function (e) { msg('Gagal memindai: ' + ((e && e.message) || e)); });
  }

  function applyFilter() {
    var q = ($('lnl-q').value || '').trim().toLowerCase();
    view = q ? lib.filter(function (s) { return (s.title + ' ' + s.artist + ' ' + s.album).toLowerCase().indexOf(q) >= 0; }) : lib;
    $('lnl-count').textContent = view.length + ' lagu';
    $('lnl-list').innerHTML = ''; shown = 0; $('lnl-list').scrollTop = 0;
    if (!view.length && lib.length) msg('Tidak ada yang cocok.');
    renderMore();
  }

  function renderMore() {
    var l = $('lnl-list'), end = Math.min(view.length, shown + CHUNK);
    for (var i = shown; i < end; i++) l.appendChild(row(view[i], i));
    shown = end;
  }

  function row(s, i) {
    var r = document.createElement('div');
    r.className = 'lnl-row' + (s.id === st.id ? ' on' : ''); r.setAttribute('data-id', s.id);
    var a = document.createElement('div'); a.textContent = s.title;
    var b = document.createElement('div'); b.textContent = s.artist + ' \u00B7 ' + fmt(s.dur);
    r.appendChild(a); r.appendChild(b);
    r.onclick = function () { playIndex(i); };
    return r;
  }

  function pauseOthers() {
    try { if (typeof ytPlayer !== 'undefined' && ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo(); } catch (e) {}
    try { if (typeof htmlAudio !== 'undefined' && htmlAudio) htmlAudio.pause(); } catch (e) {}
  }

  function playIndex(i) {
    pauseOthers();
    var go = function () {
      LM.play({ ids: view.map(function (s) { return s.id; }), index: i }).catch(function (e) { alert('Gagal memutar: ' + ((e && e.message) || e)); });
    };
    if (!notifAsked && BP && BP.requestPerm) { notifAsked = true; BP.requestPerm().then(go, go); } else go();
  }

  function apply(s) {
    st = s || {};
    $('lnl-now').textContent = st.active && st.title ? st.title : 'Belum ada lagu diputar';
    $('lnl-art').textContent = st.active ? (st.artist || '') : '';
    $('lnl-pp').textContent = st.playing ? '\u23F8' : '\u25B6';
    $('lnl-sh').className = st.shuffle ? 'act' : '';
    $('lnl-rp').className = st.repeat ? 'act' : '';
    $('lnl-rp').textContent = st.repeat === 2 ? '\uD83D\uDD02' : '\uD83D\uDD01';
    var sk = $('lnl-seek');
    if (!dragging) { sk.max = st.dur || 1; sk.value = st.pos || 0; $('lnl-pos').textContent = fmt(st.pos); }
    $('lnl-dur').textContent = fmt(st.dur);
    var rows = $('lnl-list').children;
    for (var i = 0; i < rows.length; i++) {
      var on = rows[i].getAttribute('data-id') === String(st.id);
      if (on !== rows[i].classList.contains('on')) rows[i].classList.toggle('on', on);
    }
  }

  function poll() { try { LM.getState().then(apply).catch(function () {}); } catch (e) {} }

  function init() {
    build();
    try { LM.addListener('state', apply); } catch (e) {}
    setInterval(function () { if (!document.hidden && !$('lnl-panel').hidden) poll(); }, 1000);
    poll();

    // Kalau lagu YouTube / offline mulai diputar, hentikan pemutar lokal supaya tidak tumpang tindih
    function hook() {
      if (typeof window.setPlayingUI !== 'function' || window.setPlayingUI.__lnl) return;
      var orig = window.setPlayingUI;
      var w = function (p) { if (p && st.playing) { try { LM.pause(); } catch (e) {} } return orig.apply(this, arguments); };
      w.__lnl = true; w.__ln = orig.__ln; window.setPlayingUI = w;
    }
    hook(); setTimeout(hook, 1500); setTimeout(hook, 3500);
  }
  window.lnOpenLocalMusic = function () { if ($('lnl-panel')) openPanel(); };
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
