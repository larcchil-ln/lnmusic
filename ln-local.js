/* LNMusic — pemindai musik Android. Membaca MediaStore tanpa menyalin audio ke database/aplikasi. */
(function () {
  var C = window.Capacitor;
  var native = !!(C && ((C.isNativePlatform && C.isNativePlatform()) || (C.getPlatform && C.getPlatform() !== 'web')));
  if (!native || window.__lnLocalLoaded) return;
  window.__lnLocalLoaded = true;

  var LM = null, BP = null;
  try { LM = (C.Plugins && C.Plugins.LocalMusic) || C.registerPlugin('LocalMusic'); } catch (e) {}
  try { BP = (C.Plugins && C.Plugins.BackgroundPlay) || C.registerPlugin('BackgroundPlay'); } catch (e) {}
  if (!LM) return;

  var lib = [], view = [], shown = 0, st = {}, dragging = false, scanned = false, scanBusy = false, notifAsked = false;
  var CHUNK = 70;
  var $ = function (id) { return document.getElementById(id); };
  function fmt(ms) { var s = Math.max(0, Math.floor((ms || 0) / 1000)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }); }

  function build() {
    var section = $('tab-offline');
    if (!section || $('lnl-native-root')) return;
    var css = document.createElement('style');
    css.textContent = `
      #lnl-native-root{color:#f4f4f5;display:grid;gap:16px}
      #lnl-native-root .lnl-hero{position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.09);border-radius:24px;padding:20px;background:radial-gradient(100% 120% at 0% 0%,rgba(34,197,94,.17),transparent 55%),linear-gradient(135deg,#171b1a,#0b0c0e 70%)}
      #lnl-native-root .lnl-hero:after{content:'♫';position:absolute;right:18px;top:2px;font-size:100px;line-height:1;color:rgba(74,222,128,.07);pointer-events:none}
      #lnl-native-root .lnl-head{display:flex;align-items:center;gap:13px;position:relative;z-index:1}
      #lnl-native-root .lnl-mark{width:48px;height:48px;border-radius:16px;background:rgba(34,197,94,.15);color:#4ade80;display:grid;place-items:center;font-size:23px;flex:none}
      #lnl-native-root .lnl-title{font-size:19px;font-weight:800;letter-spacing:-.4px}#lnl-native-root .lnl-sub{font-size:12px;color:#a1a1aa;margin-top:4px;line-height:1.5}
      #lnl-native-root .lnl-actions{display:flex;gap:9px;margin-top:18px;position:relative;z-index:1;flex-wrap:wrap}
      #lnl-native-root button{cursor:pointer}#lnl-native-root .lnl-btn{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:10px 14px;font-size:12px;font-weight:700;background:rgba(255,255,255,.07);color:#f4f4f5;display:inline-flex;align-items:center;justify-content:center;gap:7px}
      #lnl-native-root .lnl-btn.primary{background:#22c55e;color:#07130b;border-color:#22c55e}#lnl-native-root .lnl-btn:disabled{opacity:.5}
      #lnl-native-root .lnl-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      #lnl-native-root .lnl-stat{background:#111315;border:1px solid rgba(255,255,255,.07);border-radius:17px;padding:13px 15px}
      #lnl-native-root .lnl-stat b{display:block;font-size:20px}#lnl-native-root .lnl-stat span{font-size:11px;color:#a1a1aa}
      #lnl-native-root .lnl-listbox{background:#101113;border:1px solid rgba(255,255,255,.08);border-radius:20px;overflow:hidden}
      #lnl-native-root .lnl-listhead{padding:15px;display:flex;align-items:center;justify-content:space-between;gap:10px}
      #lnl-native-root .lnl-listhead b{font-size:14px}#lnl-native-root .lnl-listhead small{color:#a1a1aa;font-size:11px}
      #lnl-native-root #lnl-q{width:100%;box-sizing:border-box;margin:0 14px 12px;width:calc(100% - 28px);padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:#1b1d20;color:white;font-size:13px;outline:none}
      #lnl-native-root #lnl-q:focus{border-color:rgba(34,197,94,.6)}#lnl-native-root #lnl-list{max-height:52vh;overflow:auto;-webkit-overflow-scrolling:touch}
      #lnl-native-root .lnl-row{width:100%;padding:11px 14px;display:flex;align-items:center;gap:12px;text-align:left;border:0;border-top:1px solid rgba(255,255,255,.055);background:transparent;color:white}
      #lnl-native-root .lnl-row:active{background:rgba(34,197,94,.1)}#lnl-native-root .lnl-row.on{background:rgba(34,197,94,.09)}
      #lnl-native-root .lnl-disc{width:40px;height:40px;border-radius:12px;background:#1d2921;color:#4ade80;display:grid;place-items:center;flex:none;font-size:17px}
      #lnl-native-root .lnl-meta{min-width:0;flex:1}#lnl-native-root .lnl-meta b{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#lnl-native-root .lnl-meta small{display:block;color:#a1a1aa;font-size:11px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #lnl-native-root .lnl-playmark{font-size:15px;color:#4ade80;padding:5px}
      #lnl-native-root #lnl-msg{padding:28px 16px;text-align:center;color:#a1a1aa;font-size:12px;line-height:1.6}
      #lnl-native-root .lnl-player{border:1px solid rgba(34,197,94,.18);border-radius:20px;padding:15px;background:linear-gradient(135deg,rgba(34,197,94,.10),rgba(17,19,21,.96) 55%)}
      #lnl-native-root #lnl-now{font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#lnl-native-root #lnl-art{font-size:11px;color:#a1a1aa;margin:4px 0 12px}
      #lnl-native-root .lnl-seek{display:flex;align-items:center;gap:8px;font-size:10px;color:#a1a1aa}#lnl-native-root .lnl-seek input{flex:1;accent-color:#22c55e;min-width:0}
      #lnl-native-root .lnl-ctl{display:flex;align-items:center;justify-content:center;gap:clamp(8px,4vw,22px);margin-top:8px}#lnl-native-root .lnl-ctl button{width:38px;height:38px;border:0;border-radius:50%;background:transparent;color:#e4e4e7;font-size:19px}
      #lnl-native-root .lnl-ctl button.big{width:48px;height:48px;background:#22c55e;color:#07130b;font-size:22px}#lnl-native-root .lnl-ctl button.act{color:#4ade80}
      #lnl-native-root .lnl-note{font-size:10px;color:#71717a;text-align:center;line-height:1.5}
      @media(min-width:768px){#lnl-native-root{max-width:1000px;margin:auto}#lnl-native-root .lnl-hero{padding:28px}#lnl-native-root .lnl-stats{grid-template-columns:repeat(3,minmax(0,1fr))}#lnl-native-root #lnl-list{max-height:560px}}
    `;
    document.head.appendChild(css);

    // Native scanner replaces the old browser-upload panel only inside Android APK.
    Array.from(section.children).forEach(function (el) { el.style.display = 'none'; });
    var root = document.createElement('div'); root.id = 'lnl-native-root';
    root.innerHTML = `
      <div class="lnl-hero"><div class="lnl-head"><div class="lnl-mark">♫</div><div><div class="lnl-title">Musik di Perangkat</div><div class="lnl-sub">Putar koleksi musik langsung dari penyimpanan HP. File asli tetap di tempatnya, tidak disalin ke aplikasi.</div></div></div>
        <div class="lnl-actions"><button id="lnl-refresh" class="lnl-btn primary">↻ &nbsp; Pindai Musik</button><button id="lnl-playall" class="lnl-btn">▶ &nbsp; Putar Semua</button></div>
      </div>
      <div class="lnl-stats"><div class="lnl-stat"><b id="lnl-count">0</b><span>Lagu ditemukan</span></div><div class="lnl-stat"><b>Internal</b><span>Penyimpanan perangkat</span></div><div class="lnl-stat"><b>SD Card</b><span>Jika terpasang & terbaca Android</span></div></div>
      <div class="lnl-listbox"><div class="lnl-listhead"><b>Semua Lagu</b><small id="lnl-subcount">Belum dipindai</small></div><input id="lnl-q" type="search" placeholder="Cari judul, artis, atau album…"><div id="lnl-list"><div id="lnl-msg">Tekan Pindai Musik untuk mencari lagu di perangkat.</div></div></div>
      <div class="lnl-player"><div id="lnl-now">Belum ada lagu diputar</div><div id="lnl-art">Pilih lagu dari daftar</div><div class="lnl-seek"><span id="lnl-pos">0:00</span><input id="lnl-seekbar" type="range" min="0" max="1" value="0"><span id="lnl-dur">0:00</span></div><div class="lnl-ctl"><button id="lnl-sh" title="Acak">⤨</button><button id="lnl-prev" title="Sebelumnya">|◀</button><button id="lnl-pp" class="big" title="Putar">▶</button><button id="lnl-next" title="Berikutnya">▶|</button><button id="lnl-rp" title="Ulangi">↻</button></div></div>
      <div class="lnl-note">LNMusic hanya membaca indeks musik Android. Lagu tidak diunggah dan tidak digandakan ke penyimpanan aplikasi.</div>`;
    section.appendChild(root);

    $('lnl-refresh').onclick = scan;
    $('lnl-playall').onclick = function () { if (view.length) playIndex(0); else scan(); };
    $('lnl-q').oninput = applyFilter;
    $('lnl-list').onscroll = function () { if (this.scrollTop + this.clientHeight > this.scrollHeight - 260) renderMore(); };
    $('lnl-pp').onclick = function () { st.active ? LM.toggle() : (view.length && playIndex(0)); };
    $('lnl-prev').onclick = function () { LM.prev(); };
    $('lnl-next').onclick = function () { LM.next(); };
    $('lnl-sh').onclick = function () { LM.setMode({ shuffle: !st.shuffle, repeat: st.repeat || 0 }); };
    $('lnl-rp').onclick = function () { LM.setMode({ shuffle: !!st.shuffle, repeat: ((st.repeat || 0) + 1) % 3 }); };
    var sk = $('lnl-seekbar');
    sk.oninput = function () { dragging = true; $('lnl-pos').textContent = fmt(+sk.value); };
    sk.onchange = function () { dragging = false; LM.seek({ ms: +sk.value }); };
  }

  function message(text) { var l = $('lnl-list'); if (l) l.innerHTML = '<div id="lnl-msg">' + esc(text) + '</div>'; }
  function scan() {
    if (scanBusy) return;
    scanBusy = true; $('lnl-refresh').disabled = true; $('lnl-refresh').textContent = 'Memindai…'; message('Sedang memindai musik di penyimpanan internal dan SD Card…');
    LM.scan({ minDuration: 30000 }).then(function (r) {
      lib = (r && r.items) || []; scanned = true; applyFilter();
      $('lnl-subcount').textContent = lib.length ? 'Hasil pemindaian perangkat' : 'Tidak ada lagu ditemukan';
      if (!lib.length) message('Belum ada file musik yang terbaca. Pastikan file audio tersimpan di perangkat dan izin musik sudah diberikan.');
    }).catch(function (e) { message('Gagal memindai: ' + ((e && e.message) || e)); })
      .finally(function () { scanBusy = false; $('lnl-refresh').disabled = false; $('lnl-refresh').textContent = '↻  Pindai Musik'; });
  }
  function applyFilter() {
    var q = ($('lnl-q').value || '').trim().toLowerCase();
    view = q ? lib.filter(function (s) { return (s.title + ' ' + s.artist + ' ' + s.album).toLowerCase().indexOf(q) >= 0; }) : lib;
    $('lnl-count').textContent = view.length; $('lnl-subcount').textContent = scanned ? view.length + ' dari ' + lib.length + ' lagu' : 'Belum dipindai';
    $('lnl-list').innerHTML = ''; shown = 0; $('lnl-list').scrollTop = 0;
    if (!view.length) { message(lib.length ? 'Tidak ada lagu yang cocok dengan pencarian.' : (scanned ? 'Belum ada musik yang ditemukan.' : 'Tekan Pindai Musik untuk memulai.')); return; }
    renderMore();
  }
  function renderMore() {
    var l = $('lnl-list'), end = Math.min(view.length, shown + CHUNK);
    for (var i = shown; i < end; i++) l.appendChild(row(view[i], i)); shown = end;
  }
  function row(s, i) {
    var r = document.createElement('button'); r.type = 'button'; r.className = 'lnl-row' + (String(s.id) === String(st.id) ? ' on' : ''); r.setAttribute('data-id', s.id);
    var disc = document.createElement('span'); disc.className = 'lnl-disc'; disc.textContent = '♫';
    var meta = document.createElement('span'); meta.className = 'lnl-meta';
    var title = document.createElement('b'); title.textContent = s.title || 'Tanpa judul';
    var sub = document.createElement('small'); sub.textContent = (s.artist || 'Artis tidak dikenal') + (s.album ? ' · ' + s.album : '') + ' · ' + fmt(s.dur);
    meta.appendChild(title); meta.appendChild(sub); var mark = document.createElement('span'); mark.className = 'lnl-playmark'; mark.textContent = String(s.id) === String(st.id) && st.playing ? '♫' : '▶';
    r.appendChild(disc); r.appendChild(meta); r.appendChild(mark); r.onclick = function () { playIndex(i); }; return r;
  }
  function pauseOthers() {
    try { if (typeof ytPlayer !== 'undefined' && ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo(); } catch (e) {}
    try { if (typeof htmlAudio !== 'undefined' && htmlAudio) htmlAudio.pause(); } catch (e) {}
  }
  function playIndex(i) {
    pauseOthers();
    var go = function () { LM.play({ ids: view.map(function (s) { return s.id; }), index: i }).catch(function (e) { alert('Gagal memutar: ' + ((e && e.message) || e)); }); };
    if (!notifAsked && BP && BP.requestPerm) { notifAsked = true; BP.requestPerm().then(go, go); } else go();
  }
  function apply(s) {
    st = s || {}; if (!$('lnl-now')) return;
    $('lnl-now').textContent = st.active && st.title ? st.title : 'Belum ada lagu diputar';
    $('lnl-art').textContent = st.active ? (st.artist || '') : 'Pilih lagu dari daftar';
    $('lnl-pp').textContent = st.playing ? 'Ⅱ' : '▶'; $('lnl-sh').className = st.shuffle ? 'act' : ''; $('lnl-rp').className = st.repeat ? 'act' : '';
    $('lnl-rp').textContent = st.repeat === 2 ? '↻²' : '↻'; var sk = $('lnl-seekbar');
    if (!dragging) { sk.max = st.dur || 1; sk.value = st.pos || 0; $('lnl-pos').textContent = fmt(st.pos); }
    $('lnl-dur').textContent = fmt(st.dur);
    var rows = $('lnl-list').querySelectorAll('.lnl-row');
    for (var i = 0; i < rows.length; i++) { var on = rows[i].getAttribute('data-id') === String(st.id); rows[i].classList.toggle('on', on); rows[i].lastChild.textContent = on && st.playing ? '♫' : '▶'; }
  }
  function openPanel() { if (!scanned && !scanBusy) scan(); poll(); }
  function poll() { try { LM.getState().then(apply).catch(function () {}); } catch (e) {} }
  function init() {
    build(); if (!$('lnl-native-root')) return;
    try { LM.addListener('state', apply); } catch (e) {}
    setInterval(function () { if (!document.hidden && $('tab-offline') && !$('tab-offline').classList.contains('hidden')) poll(); }, 1000);
    poll();
    // Scan otomatis saat tab Offline pertama kali dibuka, tanpa mengubah tab lain.
    var originalSwitch = window.switchTab;
    if (typeof originalSwitch === 'function' && !originalSwitch.__lnLocalHook) {
      var wrapped = function (tab) { var result = originalSwitch.apply(this, arguments); if (tab === 'offline') openPanel(); return result; };
      wrapped.__lnLocalHook = true; window.switchTab = wrapped;
    }
    // Hentikan native player saat audio/YouTube utama mulai diputar.
    function hook() {
      if (typeof window.setPlayingUI !== 'function' || window.setPlayingUI.__lnl) return;
      var orig = window.setPlayingUI; var w = function (p) { if (p && st.playing) { try { LM.pause(); } catch (e) {} } return orig.apply(this, arguments); };
      w.__lnl = true; w.__ln = orig.__ln; window.setPlayingUI = w;
    }
    hook(); setTimeout(hook, 1500); setTimeout(hook, 3500);
  }
  window.lnOpenLocalMusic = openPanel;
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
