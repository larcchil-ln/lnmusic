/* LNMusic — UI pemutar tab Offline: mini player + layar penuh "Sedang diputar".
   Digerakkan oleh ln-local.js (window.lnOfflineUI.sync dipanggil tiap status player berubah). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var S = {};
  var dragging = false;

  var ico = {
    play: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>',
    prev: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M6 5h2v14H6zM19 5.7v12.6a1 1 0 0 1-1.55.83L8.5 13a1.2 1.2 0 0 1 0-2l8.95-6.13A1 1 0 0 1 19 5.7z"/></svg>',
    next: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M16 5h2v14h-2zM5 5.7v12.6a1 1 0 0 0 1.55.83L15.5 13a1.2 1.2 0 0 0 0-2L6.55 4.87A1 1 0 0 0 5 5.7z"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
    repeat: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    note: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'
  };
  function fmt(ms) { var n = Math.max(0, Math.floor((Number(ms) || 0) / 1000)); return Math.floor(n / 60) + ':' + ('0' + (n % 60)).slice(-2); }
  function LM() { return window.__lnLM || null; }

  function injectCSS() {
    if ($('ln-offline-ui-css')) return;
    var st = document.createElement('style'); st.id = 'ln-offline-ui-css';
    st.textContent = [
      '#ln-offline-player{overflow:hidden}',
      '#ln-offline-player .ln-player-top{cursor:pointer}',
      '#ln-offline-player .ln-player-art{color:#fb8297;font-size:22px}',
      '#ln-offline-player .ln-player-controls button,#ln-offline-player .ln-player-top>button{display:grid;place-items:center;font-size:19px;-webkit-tap-highlight-color:transparent}',
      '#ln-offline-player .ln-player-main{font-size:20px}',
      '#ln-offline-player .ln-player-progress{margin-top:8px}',
      '#ln-offline-player input[type=range],#ln-np-seek{-webkit-appearance:none;appearance:none;height:4px;border-radius:99px;background:rgba(255,255,255,.14);accent-color:#f43f5e}',
      '#ln-offline-player.active .ln-player-art{animation:lnPulse 2.4s ease-in-out infinite}',
      '@keyframes lnPulse{50%{box-shadow:0 0 0 6px rgba(244,63,94,.12)}}',
      'body.ln-off-mini #btn-play-pause{}',
      '.ln-global-bar-hidden{display:none!important}',
      '#ln-now-playing .ln-np-close{display:grid;place-items:center;font-size:22px}',
      '#ln-now-playing .ln-np-cover{color:#f9a8d4}#ln-now-playing .ln-np-cover svg{width:34%;height:34%}',
      '#ln-now-playing .ln-np-badge{align-self:center;font-size:9px;letter-spacing:2px;font-weight:800;color:#f28db5;margin-top:-34px;margin-bottom:6px}',
      '#ln-now-playing .ln-np-seekrow{display:flex;align-items:center;gap:10px;margin-top:22px;color:#a1a1aa;font-size:11px;font-variant-numeric:tabular-nums}',
      '#ln-np-seek{flex:1;min-width:0;height:5px}',
      '#ln-now-playing .ln-np-controls{gap:clamp(14px,6vw,30px)}',
      '#ln-now-playing .ln-np-controls button{display:grid;place-items:center;width:46px;height:46px;border:0;border-radius:50%;background:transparent;font-size:26px;-webkit-tap-highlight-color:transparent}',
      '#ln-now-playing .ln-np-controls button.active{color:#fb7185}',
      '#ln-now-playing .ln-np-controls #ln-np-toggle{width:64px;height:64px;font-size:30px}',
      '#ln-now-playing .ln-np-controls #ln-np-repeat{position:relative}',
      '#ln-now-playing .ln-np-controls #ln-np-repeat.two::after{content:"2";position:absolute;right:6px;top:5px;font-size:10px;font-weight:800}'
    ].join('');
    document.head.appendChild(st);
  }

  function build() {
    if ($('ln-now-playing')) return;
    var d = document.createElement('div'); d.id = 'ln-now-playing'; d.setAttribute('aria-hidden', 'true');
    d.innerHTML =
      '<button class="ln-np-close" id="ln-np-close" type="button" aria-label="Tutup">' + ico.down + '</button>' +
      '<div class="ln-np-cover">' + ico.note + '</div>' +
      '<div class="ln-np-badge">SEDANG DIPUTAR · OFFLINE</div>' +
      '<div class="ln-np-title" id="ln-np-title">Belum ada lagu diputar</div>' +
      '<div class="ln-np-artist" id="ln-np-artist">Pilih lagu dari koleksi</div>' +
      '<div class="ln-np-seekrow"><span id="ln-np-pos">0:00</span><input id="ln-np-seek" type="range" min="0" max="1" value="0"><span id="ln-np-dur">0:00</span></div>' +
      '<div class="ln-np-controls">' +
      '<button id="ln-np-shuffle" type="button" aria-label="Acak">' + ico.shuffle + '</button>' +
      '<button id="ln-np-prev" type="button" aria-label="Sebelumnya">' + ico.prev + '</button>' +
      '<button id="ln-np-toggle" type="button" aria-label="Putar / jeda">' + ico.play + '</button>' +
      '<button id="ln-np-next" type="button" aria-label="Berikutnya">' + ico.next + '</button>' +
      '<button id="ln-np-repeat" type="button" aria-label="Ulangi">' + ico.repeat + '</button>' +
      '</div>';
    document.body.appendChild(d);

    $('ln-np-close').addEventListener('click', close);
    $('ln-np-toggle').addEventListener('click', function () { var m = LM(); if (m) m.toggle(); });
    $('ln-np-prev').addEventListener('click', function () { var m = LM(); if (m) m.prev(); });
    $('ln-np-next').addEventListener('click', function () { var m = LM(); if (m) m.next(); });
    $('ln-np-shuffle').addEventListener('click', function () { var m = LM(); if (m) m.setMode({ shuffle: !S.shuffle, repeat: S.repeat || 0 }); });
    $('ln-np-repeat').addEventListener('click', function () { var m = LM(); if (m) m.setMode({ shuffle: !!S.shuffle, repeat: ((S.repeat || 0) + 1) % 3 }); });
    var sk = $('ln-np-seek');
    sk.addEventListener('input', function () { dragging = true; $('ln-np-pos').textContent = fmt(this.value); });
    sk.addEventListener('change', function () { dragging = false; var m = LM(); if (m) m.seek({ ms: Number(this.value) || 0 }); });
  }

  function open() {
    if (!S.active) return;
    build(); var n = $('ln-now-playing');
    n.classList.add('open'); n.setAttribute('aria-hidden', 'false');
    sync(S);
  }
  function close() { var n = $('ln-now-playing'); if (n) { n.classList.remove('open'); n.setAttribute('aria-hidden', 'true'); } }

  function globalBar() { var b = $('btn-play-pause'); return b ? b.closest('.glass') : null; }
  function offlineTabVisible() { var t = $('tab-offline'); return !!t && !t.classList.contains('hidden'); }

  function sync(s) {
    S = s || S || {};
    var mini = $('ln-offline-player');
    var on = !!S.active;
    if (mini) mini.classList.toggle('active', on);
    var gb = globalBar();
    if (gb) gb.classList.toggle('ln-global-bar-hidden', on && offlineTabVisible()); // hindari dua pemutar bertumpuk
    var tg = $('ln-offline-toggle'); if (tg) tg.innerHTML = S.playing ? ico.pause : ico.play;
    var pv = $('ln-offline-prev'); if (pv) pv.innerHTML = ico.prev;
    var nx = $('ln-offline-next'); if (nx) nx.innerHTML = ico.next;
    var ex = $('ln-player-expand'); if (ex) ex.setAttribute('aria-label', 'Buka layar penuh');
    var art = mini && mini.querySelector('.ln-player-art'); if (art && !art.__ln) { art.innerHTML = ico.note; art.__ln = 1; }

    var np = $('ln-now-playing');
    if (np && np.classList.contains('open')) {
      if (!on) { close(); return; }
      $('ln-np-title').textContent = S.title || 'Tanpa judul';
      $('ln-np-artist').textContent = S.artist || 'Artis tidak dikenal';
      $('ln-np-toggle').innerHTML = S.playing ? ico.pause : ico.play;
      $('ln-np-dur').textContent = fmt(S.dur);
      var sk = $('ln-np-seek');
      if (!dragging) {
        $('ln-np-pos').textContent = fmt(S.pos);
        sk.max = Math.max(1, Number(S.dur) || 1); sk.value = Math.min(Number(S.pos) || 0, Number(sk.max));
      }
      $('ln-np-shuffle').classList.toggle('active', !!S.shuffle);
      var rp = $('ln-np-repeat'); rp.classList.toggle('active', !!S.repeat); rp.classList.toggle('two', S.repeat === 2);
    }
  }

  function init() {
    injectCSS();
    var top = document.querySelector('#ln-offline-player .ln-player-top');
    if (top && !top.__ln) {
      top.__ln = 1;
      top.addEventListener('click', function (e) { if (e.target.closest('button')) return; open(); }); // ketuk area judul/cover
    }
    var ex = $('ln-player-expand'); if (ex) ex.addEventListener('click', open);
    // Tampilkan kembali bar global saat pindah dari tab offline
    var orig = window.switchTab;
    if (typeof orig === 'function' && !orig.__lnOffUi) {
      var w = function (tab) { var r = orig.apply(this, arguments); setTimeout(function () { sync(S); }, 30); return r; };
      w.__lnOffUi = true; if (orig.__lnOfflineHook) w.__lnOfflineHook = true; window.switchTab = w;
    }
    // Tombol Back Android menutup layar penuh dulu
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  window.lnOfflineUI = { sync: sync, open: open, close: close };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
