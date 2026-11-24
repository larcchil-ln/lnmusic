/* LNMusic Offline — Android MediaStore bridge.
   Memindai koleksi musik internal + SD Card tanpa menyalin file audio ke IndexedDB/aplikasi. */
(function () {
  'use strict';
  var C = null;
  function isNativeCapacitor() {
    if (!C) return false;
    try { if (typeof C.isNativePlatform === 'function' && C.isNativePlatform()) return true; } catch (e) {}
    try { if (typeof C.getPlatform === 'function' && C.getPlatform() !== 'web') return true; } catch (e) {}
    return !!(C.Plugins && C.Plugins.LocalMusic);
  }
  var native = false;
  var $ = function (id) { return document.getElementById(id); };
  var LM = null, BP = null;
  var lib = [], view = [], state = {}, scanned = false, busy = false, dragging = false;
  var PAGE = 60, rendered = 0, timer = null, category = 'all', favorites = JSON.parse(localStorage.getItem('lnOfflineFavorites') || '[]'), lyricCache = JSON.parse(localStorage.getItem('lnOfflineLyrics') || '{}'), lyricLines = [];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }); }
  function fmt(ms) { var n = Math.max(0, Math.floor((Number(ms) || 0) / 1000)); return Math.floor(n / 60) + ':' + ('0' + (n % 60)).slice(-2); }
  function setStatus(msg, kind) {
    var el = $('ln-offline-status'); if (!el) return;
    el.textContent = msg || '';
    el.className = 'ln-status' + (kind ? ' ' + kind : '');
  }
  function paintCount() {
    if ($('ln-offline-count')) $('ln-offline-count').textContent = String(view.length);
    if ($('ln-offline-total')) $('ln-offline-total').textContent = String(lib.length);
    if ($('ln-offline-subcount')) $('ln-offline-subcount').textContent = scanned ? (view.length + ' dari ' + lib.length + ' lagu') : 'Belum dipindai';
  }
  function renderEmpty(msg) {
    var list = $('ln-offline-list'); if (!list) return;
    list.innerHTML = '<div class="ln-empty"><div class="ln-empty-icon">♫</div><b>' + esc(msg) + '</b><span>File musik tetap berada di penyimpanan perangkat dan tidak disalin ke aplikasi.</span></div>';
  }
  function isFav(song) { return favorites.indexOf(String(song.id)) !== -1; }
  function row(song, index) {
    var active = String(song.id) === String(state.id);
    var el = document.createElement('button');
    el.type = 'button'; el.className = 'ln-song' + (active ? ' is-active' : ''); el.setAttribute('data-id', String(song.id));
    el.innerHTML = '<span class="ln-song-art">♫</span><span class="ln-song-info"><b>' + esc(song.title || 'Tanpa judul') + '</b><small>' + esc(song.artist || 'Artis tidak dikenal') + (song.album ? ' · ' + esc(song.album) : '') + (song.storage ? ' · ' + esc(song.storage) : '') + '</small></span><button type="button" class="ln-song-fav" aria-label="Favorit">' + (isFav(song) ? '♥' : '♡') + '</button><span class="ln-song-duration">' + fmt(song.dur) + '</span><span class="ln-song-play">' + (active && state.playing ? 'Ⅱ' : '▶') + '</span>';
    el.querySelector('.ln-song-fav').addEventListener('click', function (ev) { ev.stopPropagation(); var id=String(song.id), at=favorites.indexOf(id); if(at<0) favorites.push(id); else favorites.splice(at,1); localStorage.setItem('lnOfflineFavorites',JSON.stringify(favorites)); filter(); });
    el.addEventListener('click', function () { playIndex(index); });
    return el;
  }
  function renderMore() {
    var list = $('ln-offline-list'); if (!list) return;
    var end = Math.min(view.length, rendered + PAGE);
    for (var i = rendered; i < end; i++) list.appendChild(row(view[i], i));
    rendered = end;
  }
  function renderList() {
    var list = $('ln-offline-list'); if (!list) return;
    list.innerHTML = ''; rendered = 0; paintCount();
    if (!view.length) {
      renderEmpty(scanned ? (lib.length ? 'Tidak ada lagu yang cocok dengan pencarian.' : 'Belum ada musik yang ditemukan.') : 'Tekan Pindai Musik untuk mulai mencari lagu.');
      return;
    }
    renderMore();
  }
  function filter() {
    var q = (($('ln-offline-search') && $('ln-offline-search').value) || '').trim().toLowerCase();
    view = lib.filter(function (s) { var match = !q || [s.title, s.artist, s.album, s.storage].join(' ').toLowerCase().indexOf(q) !== -1; if (!match) return false; if (category === 'favorites') return isFav(s); if (category === 'artists') return !!s.artist; if (category === 'albums') return !!s.album; if (category === 'folders') return !!s.storage; return true; });
    renderList();
  }
  function pauseWebPlayers() {
    try { if (typeof ytPlayer !== 'undefined' && ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo(); } catch (e) {}
    try { if (typeof htmlAudio !== 'undefined' && htmlAudio) htmlAudio.pause(); } catch (e) {}
  }
  function scan() {
    if (busy) return;
    if (!native) {
      setStatus(/Android/i.test(navigator.userAgent || '')
        ? 'Jembatan Capacitor Android belum termuat. Tutup LNMusic sepenuhnya, buka lagi, lalu coba pindai.'
        : 'Pemindaian penyimpanan perangkat hanya tersedia di aplikasi LNMusic Android.', 'error');
      return;
    }
    if (!LM) {
      setStatus('Plugin LocalMusic belum terhubung ke APK. Periksa registrasi plugin Android dan build APK.', 'error');
      return;
    }
    busy = true;
    var btn = $('ln-offline-scan'); if (btn) { btn.disabled = true; btn.textContent = 'Memindai…'; }
    setStatus('Memindai penyimpanan internal dan SD Card…', 'loading');
    renderEmpty('Sedang mencari musik di perangkat…');
    LM.scan({ minDuration: 30000 }).then(function (result) {
      lib = (result && result.items) || [];
      scanned = true;
      filter();
      setStatus(lib.length ? 'Pemindaian selesai · ' + lib.length + ' lagu ditemukan' : 'Pemindaian selesai · belum ada lagu yang terbaca', lib.length ? 'success' : '');
    }).catch(function (err) {
      setStatus('Tidak dapat memindai: ' + ((err && err.message) || err), 'error');
      renderEmpty('Periksa izin akses musik, lalu coba pindai lagi.');
    }).finally(function () {
      busy = false;
      if (btn) { btn.disabled = false; btn.textContent = '⟳  Pindai Musik'; }
    });
  }
  function playIndex(index) {
    if (!LM || !view.length) return;
    pauseWebPlayers();
    LM.play({ ids: view.map(function (s) { return s.id; }), index: index }).then(function () {
      var s = view[index];
      state = Object.assign({}, state, { active: true, playing: true, id: s.id, title: s.title, artist: s.artist, dur: s.dur, pos: 0 });
      updatePlayer(state); renderList();
    }).catch(function (err) { setStatus('Gagal memutar lagu: ' + ((err && err.message) || err), 'error'); });
  }
  function updatePlayer(s) {
    state = s || {};
    if ($('ln-offline-now')) $('ln-offline-now').textContent = state.active && state.title ? state.title : 'Belum ada lagu diputar';
    if ($('ln-offline-artist')) $('ln-offline-artist').textContent = state.active ? (state.artist || 'Artis tidak dikenal') : 'Pilih lagu dari daftar';
    if (state.active && state.title) showLyrics(state.title, state.artist || '');
    if ($('ln-offline-toggle')) $('ln-offline-toggle').textContent = state.playing ? 'Ⅱ' : '▶';
    if ($('ln-offline-position') && !dragging) $('ln-offline-position').textContent = fmt(state.pos);
    if ($('ln-offline-duration')) $('ln-offline-duration').textContent = fmt(state.dur);
    var seek = $('ln-offline-seek');
    if (seek && !dragging) { seek.max = Math.max(1, Number(state.dur) || 1); seek.value = Math.min(Number(state.pos) || 0, Number(seek.max)); }
    if ($('ln-offline-shuffle')) $('ln-offline-shuffle').classList.toggle('active', !!state.shuffle);
    if ($('ln-offline-repeat')) { $('ln-offline-repeat').classList.toggle('active', !!state.repeat); $('ln-offline-repeat').textContent = state.repeat === 2 ? '↻²' : '↻'; }
    if(lyricLines.length && $('ln-offline-lyrics')){var activeLine=-1;for(var li=0;li<lyricLines.length;li++){if(Number(state.pos||0)>=lyricLines[li].time)activeLine=li;else break;}var lyricEls=$('ln-offline-lyrics').querySelectorAll('[data-lyric-index]');Array.prototype.forEach.call(lyricEls,function(el,i){el.classList.toggle('is-current',i===activeLine);});}
    var rows = $('ln-offline-list') ? $('ln-offline-list').querySelectorAll('.ln-song') : [];
    Array.prototype.forEach.call(rows, function (el) {
      var on = String(el.getAttribute('data-id')) === String(state.id) && !!state.active;
      el.classList.toggle('is-active', on);
      var mark = el.querySelector('.ln-song-play'); if (mark) mark.textContent = el.classList.contains('is-active') && state.playing ? 'Ⅱ' : '▶';
    });
  }
  function lyricKey(title,artist){return (String(title||'').toLowerCase().trim()+'|'+String(artist||'').toLowerCase().trim()).replace(/\\s+/g,' ');}
  function parseLrc(raw){var out=[],re=/\\[(\\d{1,2}):(\\d{2})(?:[.:](\\d{1,3}))?\\]([^\\r\\n]*)/g,m;while((m=re.exec(raw))){var frac=String(m[3]||'0');out.push({time:(Number(m[1])*60+Number(m[2]))*1000+Number((frac+'00').slice(0,2))*10,text:(m[4]||'').trim()});}return out.sort(function(a,b){return a.time-b.time;});}
  function renderLyrics(lines){var box=$('ln-offline-lyrics');if(!box)return;lyricLines=lines||[];box.innerHTML=lyricLines.length?lyricLines.map(function(l,i){return '<p data-lyric-index="'+i+'">'+esc(l.text||'♪')+'</p>';}).join(''):'<p class="ln-lyrics-empty">Lirik belum tersedia. Impor file .LRC atau coba cari online.</p>';}
  function showLyrics(title,artist){var key=lyricKey(title,artist);if(lyricCache[key]){renderLyrics(lyricCache[key]);return;}if(showLyrics.last===key)return;showLyrics.last=key;fetch('https://lrclib.net/api/get?'+new URLSearchParams({track_name:title,artist_name:artist}).toString()).then(function(r){if(!r.ok)throw new Error('not found');return r.json();}).then(function(data){var lines=parseLrc(data.syncedLyrics||'');if(!lines.length&&data.plainLyrics)lines=String(data.plainLyrics).split(/\\r?\\n/).map(function(t){return {time:0,text:t};});if(lines.length){lyricCache[key]=lines;localStorage.setItem('lnOfflineLyrics',JSON.stringify(lyricCache));renderLyrics(lines);}else renderLyrics([]);}).catch(function(){renderLyrics([]);});}
  function poll() { if (LM && $('tab-offline') && !$('tab-offline').classList.contains('hidden')) LM.getState().then(updatePlayer).catch(function () {}); }
  function bind() {
    var scanBtn = $('ln-offline-scan'); if (scanBtn) scanBtn.addEventListener('click', scan);
    var allBtn = $('ln-offline-playall'); if (allBtn) allBtn.addEventListener('click', function () { if (view.length) playIndex(0); else scan(); });
    var search = $('ln-offline-search'); if (search) search.addEventListener('input', filter);
    var cats = document.querySelectorAll('[data-ln-category]'); Array.prototype.forEach.call(cats,function(btn){btn.addEventListener('click',function(){category=btn.getAttribute('data-ln-category');Array.prototype.forEach.call(cats,function(b){b.classList.toggle('is-active',b===btn);});filter();});});
    var lrc = $('ln-offline-lrc-file'); if(lrc) lrc.addEventListener('change',function(ev){var file=ev.target.files&&ev.target.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(){var key=lyricKey(state.title||file.name.replace(/\\.lrc$/i,''),state.artist||'');lyricCache[key]=parseLrc(String(reader.result||''));localStorage.setItem('lnOfflineLyrics',JSON.stringify(lyricCache));renderLyrics(lyricCache[key]);setStatus('Lirik LRC berhasil disimpan di perangkat.','success');};reader.readAsText(file);});
    var list = $('ln-offline-list'); if (list) list.addEventListener('scroll', function () { if (this.scrollTop + this.clientHeight >= this.scrollHeight - 180) renderMore(); });
    var toggle = $('ln-offline-toggle'); if (toggle) toggle.addEventListener('click', function () { if (!LM) return; if (state.active) LM.toggle(); else if (view.length) playIndex(0); });
    var prev = $('ln-offline-prev'); if (prev) prev.addEventListener('click', function () { if (LM) LM.prev(); });
    var next = $('ln-offline-next'); if (next) next.addEventListener('click', function () { if (LM) LM.next(); });
    var shuffle = $('ln-offline-shuffle'); if (shuffle) shuffle.addEventListener('click', function () { if (LM) LM.setMode({ shuffle: !state.shuffle, repeat: state.repeat || 0 }); });
    var repeat = $('ln-offline-repeat'); if (repeat) repeat.addEventListener('click', function () { if (LM) LM.setMode({ shuffle: !!state.shuffle, repeat: ((state.repeat || 0) + 1) % 3 }); });
    var seek = $('ln-offline-seek'); if (seek) { seek.addEventListener('input', function () { dragging = true; if ($('ln-offline-position')) $('ln-offline-position').textContent = fmt(this.value); }); seek.addEventListener('change', function () { dragging = false; if (LM) LM.seek({ ms: Number(this.value) || 0 }); }); }
  }
  function openTab() { if (!scanned && !busy) scan(); poll(); }
  function getPlugin(name) {
    try { if (C && C.Plugins && C.Plugins[name]) return C.Plugins[name]; } catch (e) {}
    try { if (C && typeof C.registerPlugin === 'function') return C.registerPlugin(name); } catch (e) {}
    return null;
  }
  function initNative() {
    LM = getPlugin('LocalMusic');
    BP = getPlugin('BackgroundPlay');
    bind();
    window.lnLocalMusicDiagnostics = { capacitor: !!C, native: native, localMusicPlugin: !!LM, backgroundPlugin: !!BP, platform: (C && C.getPlatform ? C.getPlatform() : 'unknown'), bridgeScriptLoaded: !!C, userAgent: navigator.userAgent || '' };
    if (!LM) { setStatus('Capacitor aktif, tetapi plugin LocalMusic belum terdaftar di APK. Build APK perlu diperiksa.', 'error'); return; }
    try { LM.addListener('state', updatePlayer); } catch (e) {}
    var orig = window.switchTab;
    if (typeof orig === 'function' && !orig.__lnOfflineHook) {
      var wrapped = function (tab) { var out = orig.apply(this, arguments); if (tab === 'offline') openTab(); return out; };
      wrapped.__lnOfflineHook = true; window.switchTab = wrapped;
    }
    if (timer) clearInterval(timer);
    timer = setInterval(poll, 1200);
    if ($('tab-offline') && !$('tab-offline').classList.contains('hidden')) openTab();
    else { LM.getState().then(updatePlayer).catch(function () {}); }
  }
  function initWebFallback() {
    bind();
    window.lnLocalMusicDiagnostics = { capacitor: !!C, native: false, localMusicPlugin: false, platform: (C && C.getPlatform ? C.getPlatform() : 'unavailable'), bridgeScriptLoaded: !!C, bridgeUrl: window.__lnCapacitorBridgeUrl || ((window.location && window.location.origin ? window.location.origin : 'https://localhost') + '/capacitor.js'), userAgent: navigator.userAgent || '' };
    setStatus(/Android/i.test(navigator.userAgent || '')
      ? 'Bridge Capacitor tidak berhasil dimuat dari APK. Kemungkinan APK belum membawa bridge native atau halaman remote tidak dapat mengakses https://localhost/capacitor.js.'
      : 'Mode browser terdeteksi. Pemindaian musik perangkat hanya tersedia di APK Android.', 'error');
    var all = $('ln-offline-playall'); if (all) all.addEventListener('click', function () { if (view.length) playIndex(0); else scan(); });
  }
  function init() {
    C = window.Capacitor || null;
    native = isNativeCapacitor();
    if (native) initNative(); else initWebFallback();
  }
  function startWhenBridgeReady() {
    var ready = window.__lnCapacitorBridgeReady;
    if (ready && typeof ready.then === 'function') {
      ready.then(function () { init(); }).catch(function () { init(); });
    } else {
      init();
    }
  }
  window.lnScanLocalMusic = scan;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startWhenBridgeReady, { once: true }); else startWhenBridgeReady();
})();
