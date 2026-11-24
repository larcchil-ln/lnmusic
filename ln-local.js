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
  var PAGE = 60, rendered = 0, timer = null, category = 'all', groupSelection = '', letterFilter = '', queue = [], queueIndex = 0, artworkCache = {}, favorites = JSON.parse(localStorage.getItem('lnOfflineFavorites') || '[]'), lyricCache = JSON.parse(localStorage.getItem('lnOfflineLyrics') || '{}'), lyricLines = [];
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
    el.innerHTML = '<span class="ln-song-art" data-art-for="'+esc(song.id)+'">♫</span><span class="ln-song-info"><b>' + esc(song.title || 'Tanpa judul') + '</b><small>' + esc(song.artist || 'Artis tidak dikenal') + (song.album ? ' · ' + esc(song.album) : '') + '</small></span><button type="button" class="ln-song-queue" aria-label="Tambah ke antrean">＋</button><button type="button" class="ln-song-fav" aria-label="Favorit">' + (isFav(song) ? '♥' : '♡') + '</button><span class="ln-song-duration">' + fmt(song.dur) + '</span><span class="ln-song-play">' + (active && state.playing ? 'Ⅱ' : '▶') + '</span>';
    el.querySelector('.ln-song-queue').addEventListener('click',function(ev){ev.stopPropagation();enqueue(song);});
    el.querySelector('.ln-song-fav').addEventListener('click', function (ev) { ev.stopPropagation(); var id=String(song.id), at=favorites.indexOf(id); if(at<0) favorites.push(id); else favorites.splice(at,1); localStorage.setItem('lnOfflineFavorites',JSON.stringify(favorites)); filter(); });
    el.addEventListener('click', function () { playIndex(index); });
    return el;
  }
  function renderMore() {
    var list = $('ln-offline-list'); if (!list) return;
    var end = Math.min(view.length, rendered + PAGE);
    for (var i = rendered; i < end; i++) {
      var item=view[i];
      if(item && item.__group){
        var g=document.createElement('button');g.type='button';g.className='ln-song ln-group-row';
        g.innerHTML='<span class="ln-song-art">♫</span><span class="ln-song-info"><b>'+esc(item.name)+'</b><small>'+item.count+' lagu · Buka koleksi</small></span><span class="ln-song-play">›</span>';
        g.addEventListener('click',function(name){return function(){groupSelection=name;var heading=$('ln-offline-subcount');if(heading)heading.textContent=name;renderList();};}(item.name));
        list.appendChild(g);
      } else list.appendChild(row(item, i));
    }
    rendered = end;
  }
  function renderList() {
    var list = $('ln-offline-list'); if (!list) return;
    list.innerHTML = ''; rendered = 0; paintCount();
    if(groupSelection && (category==='artists'||category==='albums')){
      var back=document.createElement('button');back.type='button';back.className='ln-group-back';back.textContent='‹  Kembali ke '+(category==='artists'?'Artis':(category==='albums'?'Album':'Folder'));
      back.addEventListener('click',function(){groupSelection='';filter();});list.appendChild(back);
    }
    if (!view.length) {
      renderEmpty(scanned ? (lib.length ? 'Tidak ada lagu yang cocok dengan pencarian.' : 'Belum ada musik yang ditemukan.') : 'Tekan Pindai Musik untuk mulai mencari lagu.');
      return;
    }
    renderMore();
  }
  function renderAlphabet(){var box=$('ln-alphabet');if(!box)return;var letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');box.innerHTML=letters.map(function(ch){return '<button type="button" data-ln-letter="'+ch+'" class="'+(letterFilter===ch?'active':'')+'">'+ch+'</button>';}).join('');Array.prototype.forEach.call(box.querySelectorAll('[data-ln-letter]'),function(b){b.addEventListener('click',function(){letterFilter=letterFilter===b.getAttribute('data-ln-letter')?'':b.getAttribute('data-ln-letter');filter();});});}
  function filter() {
    var q = (($('ln-offline-search') && $('ln-offline-search').value) || '').trim().toLowerCase();
    var source = lib.filter(function(s){var hay=[s.title,s.artist,s.album,s.storage].join(' ').toLowerCase();return (!q || hay.indexOf(q)!==-1) && (!letterFilter || String(s.title||'').toUpperCase().charAt(0)===letterFilter);});
    renderAlphabet();
    if(category==='artists' || category==='albums' || category==='folders'){
      var field=category==='artists'?'artist':(category==='albums'?'album':'storage');
      if(!groupSelection){
        var names=[]; source.forEach(function(s){var n=String(s[field]||'').trim();if(n&&names.indexOf(n)===-1)names.push(n);});
        view=names.sort(function(a,b){return a.localeCompare(b);}).map(function(n){return {__group:true,name:n,count:source.filter(function(s){return String(s[field]||'').trim()===n;}).length};});
      }else view=source.filter(function(s){return String(s[field]||'').trim()===groupSelection;});
    }else{
      groupSelection='';
      view=source.filter(function(s){if(category==='favorites')return isFav(s);return true;});
    }
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
  var remoteLocalSync = false, lastLocalRoomSync = 0, sleepTimer = null, sleepTimerIndex = 0;
  function sendLocalRoomMessage(type, extra) {
    try {
      if (typeof isRoomConnected === 'undefined' || !isRoomConnected || typeof connections === 'undefined' || typeof isHost === 'undefined' || !isHost) return;
      var msg = Object.assign({ type: type, title: state.title || '', artist: state.artist || '', pos: Number(state.pos) || 0, playing: !!state.playing, sentAt: Date.now() }, extra || {});
      connections.forEach(function (c) { if (c && c.open) c.send(msg); });
    } catch (e) {}
  }
  function playIndex(index) {
    if (!LM || !view.length) return;
    queue = view.slice(); queueIndex = Math.max(0,Math.min(index,queue.length-1));
    playQueueIndex(queueIndex);
  }
  function playQueueIndex(index) {
    if(!LM || !queue.length)return;
    queueIndex=(index+queue.length)%queue.length;
    pauseWebPlayers();
    LM.play({ids:queue.map(function(s){return s.id;}),index:queueIndex}).then(function(){
      var s=queue[queueIndex];
      state = Object.assign({}, state, { active: true, playing: true, id: s.id, title: s.title, artist: s.artist, dur: s.dur, pos: 0 });
      updatePlayer(state); renderList();
      if (!remoteLocalSync) sendLocalRoomMessage('SYNC_LOCAL_TRACK', { title: s.title, artist: s.artist, pos: 0, playing: true });
    }).catch(function (err) { setStatus('Gagal memutar lagu: ' + ((err && err.message) || err), 'error'); });
  }
  function enqueue(song){if(!song)return;queue.push(song);renderQueue();setStatus('Ditambahkan ke antrean · '+song.title,'success');}
  function renderQueue(){var box=$('ln-np-queue');if(!box)return;box.innerHTML=queue.length?queue.map(function(s,i){return '<button type="button" class="ln-queue-item" data-queue-index="'+i+'"><span>'+(i===queueIndex?'▶':'♪')+'</span><span><b>'+esc(s.title)+'</b><small>'+esc(s.artist||'Artis tidak dikenal')+'</small></span><span>'+(i===queueIndex?'Diputar':'')+'</span></button>';}).join(''):'<p class="ln-queue-empty">Belum ada lagu dalam antrean</p>';Array.prototype.forEach.call(box.querySelectorAll('[data-queue-index]'),function(b){b.addEventListener('click',function(){playQueueIndex(Number(b.getAttribute('data-queue-index')));});});if($('ln-np-queue-count'))$('ln-np-queue-count').textContent=queue.length+' lagu';}
  function loadArtwork(title,artist,album){var key=[title,artist,album].join('|').toLowerCase();if(artworkCache[key])return Promise.resolve(artworkCache[key]);return fetch('https://itunes.apple.com/search?term='+encodeURIComponent([artist,title,album].filter(Boolean).join(' '))+'&entity=song&limit=8').then(function(r){return r.json();}).then(function(d){var rows=d.results||[];var norm=function(x){return String(x||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();};var target=norm(title);rows.sort(function(a,b){return (norm(b.trackName)===target?3:0)+(norm(b.artistName)===norm(artist)?2:0)-(norm(a.trackName)===target?3:0)-(norm(a.artistName)===norm(artist)?2:0);});var art=rows[0]&&rows[0].artworkUrl100?rows[0].artworkUrl100.replace('100x100bb','600x600bb'):'';artworkCache[key]=art;return art;}).catch(function(){return '';});}
  function paintArtwork(song){if(!song)return;loadArtwork(song.title,song.artist,song.album).then(function(url){if(!url)return;var selectors=['.ln-player-art','#ln-np-cover'];selectors.forEach(function(sel){var el=document.querySelector(sel);if(el){el.style.backgroundImage='url("'+url+'")';el.style.backgroundSize='cover';el.style.backgroundPosition='center';el.textContent='';}});var rows=document.querySelectorAll('.ln-song-art[data-art-for="'+CSS.escape(String(song.id))+'"]');Array.prototype.forEach.call(rows,function(el){el.style.backgroundImage='url("'+url+'")';el.style.backgroundSize='cover';el.style.backgroundPosition='center';el.textContent='';});});}
  function updatePlayer(s) {
    state = s || {};
    if($('ln-np-title'))$('ln-np-title').textContent=state.active?state.title:'Belum ada lagu diputar';
    if(state.active&&state.title)paintArtwork({id:state.id,title:state.title,artist:state.artist,album:state.album});
    if($('ln-np-lyrics'))$('ln-np-lyrics').innerHTML=$('ln-offline-lyrics')?$('ln-offline-lyrics').innerHTML:'';
    renderQueue();
    if($('ln-np-artist'))$('ln-np-artist').textContent=state.active?(state.artist||'Artis tidak dikenal'):'Pilih lagu dari koleksi';
    if($('ln-np-toggle'))$('ln-np-toggle').textContent=state.playing?'Ⅱ':'▶';
    if($('ln-np-repeat'))$('ln-np-repeat').classList.toggle('active',!!state.repeat);
    if($('ln-np-shuffle'))$('ln-np-shuffle').classList.toggle('active',!!state.shuffle);
    if($('ln-np-pos'))$('ln-np-pos').textContent=fmt(state.pos);
    if($('ln-np-dur'))$('ln-np-dur').textContent=fmt(state.dur);
    if($('ln-np-seek')){$('ln-np-seek').max=Math.max(1,Number(state.dur)||1);if(!dragging)$('ln-np-seek').value=Math.min(Number(state.pos)||0,Number($('ln-np-seek').max));}
    if ($('ln-offline-now')) $('ln-offline-now').textContent = state.active && state.title ? state.title : 'Belum ada lagu diputar';
    if ($('ln-offline-artist')) $('ln-offline-artist').textContent = state.active ? (state.artist || 'Artis tidak dikenal') : 'Pilih lagu dari daftar';
    if (state.active && state.title) showLyrics(state.title, state.artist || '');
    var mini=$('ln-offline-player');if(mini)mini.classList.toggle('active',!!state.active);
    if ($('ln-offline-toggle')) $('ln-offline-toggle').textContent = state.playing ? 'Ⅱ' : '▶';
    if ($('ln-offline-position') && !dragging) $('ln-offline-position').textContent = fmt(state.pos);
    if ($('ln-offline-duration')) $('ln-offline-duration').textContent = fmt(state.dur);
    var seek = $('ln-offline-seek');
    if (seek && !dragging) { seek.max = Math.max(1, Number(state.dur) || 1); seek.value = Math.min(Number(state.pos) || 0, Number(seek.max)); }
    if ($('ln-offline-shuffle')) $('ln-offline-shuffle').classList.toggle('active', !!state.shuffle);
    if ($('ln-offline-repeat')) { $('ln-offline-repeat').classList.toggle('active', !!state.repeat); $('ln-offline-repeat').textContent = state.repeat === 2 ? '↻²' : '↻'; }
    if(lyricLines.length && $('ln-offline-lyrics')){var activeLine=-1;for(var li=0;li<lyricLines.length;li++){if(Number(state.pos||0)>=lyricLines[li].time)activeLine=li;else break;}var lyricEls=$('ln-offline-lyrics').querySelectorAll('[data-lyric-index]');Array.prototype.forEach.call(lyricEls,function(el,i){el.classList.toggle('is-current',i===activeLine);});var full=$('ln-np-lyrics');if(full){var fullEls=full.querySelectorAll('[data-lyric-index]');Array.prototype.forEach.call(fullEls,function(el,i){el.classList.toggle('is-current',i===activeLine);if(i===activeLine)el.scrollIntoView({block:'center',behavior:'smooth'});});}}
    var rows = $('ln-offline-list') ? $('ln-offline-list').querySelectorAll('.ln-song') : [];
    Array.prototype.forEach.call(rows, function (el) {
      var on = String(el.getAttribute('data-id')) === String(state.id) && !!state.active;
      el.classList.toggle('is-active', on);
      var mark = el.querySelector('.ln-song-play'); if (mark) mark.textContent = el.classList.contains('is-active') && state.playing ? 'Ⅱ' : '▶';
    });
  }
  function lyricKey(title,artist){return (String(title||'').toLowerCase().trim()+'|'+String(artist||'').toLowerCase().trim()).replace(/\s+/g,' ');}
  function parseLrc(raw){var out=[],re=/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]([^\r\n]*)/g,m;while((m=re.exec(raw))){var frac=String(m[3]||'0');out.push({time:(Number(m[1])*60+Number(m[2]))*1000+Number((frac+'00').slice(0,3)),text:(m[4]||'').trim()});}return out.sort(function(a,b){return a.time-b.time;});}
  function renderLyrics(lines){var box=$('ln-offline-lyrics');if(!box)return;lines=lines||[];var sig=JSON.stringify(lines);if(box.getAttribute('data-lyrics-signature')===sig)return;lyricLines=lines;box.setAttribute('data-lyrics-signature',sig);box.innerHTML=lyricLines.length?lyricLines.map(function(l,i){return '<p data-lyric-index="'+i+'">'+esc(l.text||'♪')+'</p>';}).join(''):'<p class="ln-lyrics-empty">Lirik belum tersedia. Impor file .LRC atau coba cari online.</p>';}
  function showLyrics(title,artist){var key=lyricKey(title,artist);if(lyricCache[key]){renderLyrics(lyricCache[key]);return;}if(showLyrics.last===key)return;showLyrics.last=key;fetch('https://lrclib.net/api/get?'+new URLSearchParams({track_name:title,artist_name:artist||''}).toString()).then(function(r){if(!r.ok)throw new Error('exact miss');return r.json();}).catch(function(){return fetch('https://lrclib.net/api/search?q='+encodeURIComponent([title,artist].filter(Boolean).join(' '))).then(function(r){if(!r.ok)throw new Error('search miss');return r.json();}).then(function(rows){if(!Array.isArray(rows)||!rows.length)throw new Error('not found');rows.sort(function(a,b){return (b.syncedLyrics?1:0)-(a.syncedLyrics?1:0);});return rows[0];});}).then(function(data){var lines=parseLrc(data.syncedLyrics||'');if(!lines.length&&data.plainLyrics)lines=String(data.plainLyrics).split(/\r?\n/).map(function(t){return {time:0,text:t};});if(lines.length){lyricCache[key]=lines;localStorage.setItem('lnOfflineLyrics',JSON.stringify(lyricCache));renderLyrics(lines);if($('ln-np-lyrics'))$('ln-np-lyrics').innerHTML=$('ln-offline-lyrics').innerHTML;}else renderLyrics([]);}).catch(function(){renderLyrics([]);});}
  function poll() {
    if (!LM) return;
    LM.getState().then(function (next) {
      updatePlayer(next);
      if (!remoteLocalSync && next && next.active && typeof isRoomConnected !== 'undefined' && isRoomConnected && typeof isHost !== 'undefined' && isHost && Date.now() - lastLocalRoomSync > 2500) {
        lastLocalRoomSync = Date.now();
        sendLocalRoomMessage('SYNC_LOCAL_STATE', { title: next.title || '', artist: next.artist || '', pos: Number(next.pos) || 0, playing: !!next.playing });
      }
    }).catch(function () {});
  }
  function matchLocalSong(title, artist) {
    function norm(v) { return String(v || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
    var t = norm(title), a = norm(artist);
    var exact = lib.filter(function (x) { return norm(x.title) === t && norm(x.artist) === a; });
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) return exact[0];
    var byTitle = lib.filter(function (x) { return norm(x.title) === t; });
    return byTitle.length === 1 ? byTitle[0] : null;
  }
  function applyRemoteLocal(data) {
    if (!LM || !data || typeof data.title !== 'string' || data.title.length > 200) return;
    var song = matchLocalSong(data.title, data.artist);
    if (!song) {
      setStatus('Lagu pasangan tidak ditemukan di perangkat ini. Kedua HP perlu memiliki file lagu yang sama.', 'error');
      return;
    }
    remoteLocalSync = true;
    var currentMatches = state.active && String(state.id) === String(song.id);
    var action = currentMatches ? Promise.resolve() : LM.play({ ids: [song.id], index: 0 });
    action.then(function () {
      return new Promise(function (resolve) { setTimeout(resolve, currentMatches ? 80 : 450); });
    }).then(function () {
      if (Number.isFinite(Number(data.pos)) && Number(data.pos) >= 0) return LM.seek({ ms: Math.round(Number(data.pos)) });
    }).then(function () {
      if (data.playing === false) return LM.pause();
      if (data.playing === true) return LM.resume();
    }).then(function () {
      setStatus('Listening Together aktif · menyamakan lagu lokal', 'success');
    }).catch(function (err) {
      setStatus('Gagal menyinkronkan lagu: ' + ((err && err.message) || err), 'error');
    }).finally(function () {
      setTimeout(function () { remoteLocalSync = false; }, 900);
    });
  }
  function hookRoomSync() {
    var original = window.handleIncomingSyncData;
    if (typeof original !== 'function' || original.__lnLocalSync) return false;
    var wrapped = function (data, senderConn) {
      if (data && (data.type === 'SYNC_LOCAL_TRACK' || data.type === 'SYNC_LOCAL_STATE')) {
        applyRemoteLocal(data);
        return;
      }
      return original.apply(this, arguments);
    };
    wrapped.__lnLocalSync = true;
    window.handleIncomingSyncData = wrapped;
    return true;
  }
  function bind() {
    var scanBtn = $('ln-offline-scan'); if (scanBtn) scanBtn.addEventListener('click', scan);
    var allBtn = $('ln-offline-playall'); if (allBtn) allBtn.addEventListener('click', function () { if (view.length) playIndex(0); else scan(); });
    var search = $('ln-offline-search'); if (search) search.addEventListener('input', filter);
    var cats = document.querySelectorAll('[data-ln-category]'); Array.prototype.forEach.call(cats,function(btn){btn.addEventListener('click',function(){category=btn.getAttribute('data-ln-category');groupSelection='';letterFilter='';Array.prototype.forEach.call(cats,function(b){b.classList.toggle('is-active',b===btn);});var titles={all:'Lagu',artists:'Artis',albums:'Album',folders:'Folder',favorites:'Favorit',playlists:'Daftar Putar'};if($('ln-library-title'))$('ln-library-title').textContent=titles[category]||'Lagu';if($('ln-list-heading'))$('ln-list-heading').textContent=category==='all'?'Semua lagu':titles[category];var side=$('ln-library-sidebar');if(side)side.classList.remove('open');filter();});});
    var menu=$('ln-mobile-menu');if(menu)menu.addEventListener('click',function(){$('ln-library-sidebar').classList.toggle('open');});
    var scanSide=$('ln-sidebar-scan');if(scanSide)scanSide.addEventListener('click',scan);var libSide=$('ln-sidebar-library');if(libSide)libSide.addEventListener('click',function(){category='all';groupSelection='';filter();});
    var sort=$('ln-sort-az');if(sort)sort.addEventListener('click',function(){letterFilter='';view.sort(function(a,b){return String(a.name||a.title||'').localeCompare(String(b.name||b.title||''));});renderList();renderAlphabet();});
    var lrc = $('ln-offline-lrc-file'); if(lrc) lrc.addEventListener('change',function(ev){var file=ev.target.files&&ev.target.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(){var key=lyricKey(state.title||file.name.replace(/\.lrc$/i,''),state.artist||'');lyricCache[key]=parseLrc(String(reader.result||''));localStorage.setItem('lnOfflineLyrics',JSON.stringify(lyricCache));renderLyrics(lyricCache[key]);if($('ln-np-lyrics'))$('ln-np-lyrics').innerHTML=$('ln-offline-lyrics').innerHTML;setStatus('Lirik LRC berhasil disimpan di perangkat.','success');};reader.readAsText(file);});
    var list = $('ln-offline-list'); if (list) list.addEventListener('scroll', function () { if (this.scrollTop + this.clientHeight >= this.scrollHeight - 180) renderMore(); });
    var npNext=$('ln-np-next');if(npNext)npNext.addEventListener('click',function(){if(queue.length)playQueueIndex(queueIndex+1);});var npPrev=$('ln-np-prev');if(npPrev)npPrev.addEventListener('click',function(){if(queue.length)playQueueIndex(queueIndex-1);});
    var toggle = $('ln-offline-toggle'); if (toggle) toggle.addEventListener('click', function () { if (!LM) return; if (state.active) { var nextPlaying = !state.playing; LM.toggle().then(function(){ if(!remoteLocalSync) sendLocalRoomMessage('SYNC_LOCAL_STATE',{playing:nextPlaying}); }); } else if (view.length) playIndex(0); });
    var prev = $('ln-offline-prev'); if (prev) prev.addEventListener('click', function () { if(queue.length)playQueueIndex(queueIndex-1);else if(LM)LM.prev(); });
    var next = $('ln-offline-next'); if (next) next.addEventListener('click', function () { if(queue.length)playQueueIndex(queueIndex+1);else if(LM)LM.next(); });
    var shuffle = $('ln-offline-shuffle'); if (shuffle) shuffle.addEventListener('click', function () { if (LM) LM.setMode({ shuffle: !state.shuffle, repeat: state.repeat || 0 }); });
    var repeat = $('ln-offline-repeat'); if (repeat) repeat.addEventListener('click', function () { if (LM) LM.setMode({ shuffle: !!state.shuffle, repeat: ((state.repeat || 0) + 1) % 3 }); });
    var seek = $('ln-offline-seek'); if (seek) { seek.addEventListener('input', function () { dragging = true; if ($('ln-offline-position')) $('ln-offline-position').textContent = fmt(this.value); }); seek.addEventListener('change', function () { dragging = false; if (LM) LM.seek({ ms: Number(this.value) || 0 }).then(function(){if(!remoteLocalSync)sendLocalRoomMessage('SYNC_LOCAL_STATE',{pos:Number(seek.value)||0});}); }); }
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
    setupNowPlaying();
    hookRoomSync();
    var roomSyncHookTimer = setInterval(function(){ if (hookRoomSync()) clearInterval(roomSyncHookTimer); }, 500);
    setTimeout(function(){ clearInterval(roomSyncHookTimer); }, 15000);
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
  function setupNowPlaying(){if($('ln-now-playing'))return;var p=document.createElement('div');p.id='ln-now-playing';p.innerHTML='<button type="button" class="ln-np-close" id="ln-np-close" aria-label="Tutup">×</button><div class="ln-np-cover" id="ln-np-cover">♫</div><div class="ln-np-title" id="ln-np-title">Belum ada lagu diputar</div><div class="ln-np-artist" id="ln-np-artist">Pilih lagu dari koleksi</div><div class="ln-np-lyrics" id="ln-np-lyrics"><p>Lirik akan tampil di sini</p></div><button type="button" id="ln-np-show-queue" class="ln-np-queue-toggle">☷ Antrean berikutnya <span id="ln-np-queue-count">0 lagu</span></button><div id="ln-np-queue" class="ln-np-queue"></div><div class="ln-player-progress"><span id="ln-np-pos">0:00</span><input id="ln-np-seek" type="range" min="0" max="1" value="0"><span id="ln-np-dur">0:00</span></div><div class="ln-np-controls"><button id="ln-np-repeat" title="Ulangi">↻</button><button id="ln-np-timer" title="Timer tidur">◷</button><button id="ln-np-prev" title="Sebelumnya">|◀</button><button id="ln-np-toggle">▶</button><button id="ln-np-next" title="Berikutnya">▶|</button><button id="ln-np-shuffle" title="Acak">⤨</button></div><div class="ln-np-footnote" id="ln-np-timer-status"></div>';document.body.appendChild(p);$('ln-player-expand').addEventListener('click',function(){p.classList.add('open');});$('ln-np-close').addEventListener('click',function(){p.classList.remove('open');});$('ln-np-show-queue').addEventListener('click',function(){$('ln-np-queue').classList.toggle('visible');});$('ln-np-toggle').addEventListener('click',function(){if(LM)LM.toggle();});$('ln-np-prev').addEventListener('click',function(){if(queue.length)playQueueIndex(queueIndex-1);});$('ln-np-next').addEventListener('click',function(){if(queue.length)playQueueIndex(queueIndex+1);});$('ln-np-seek').addEventListener('change',function(){if(LM)LM.seek({ms:Number(this.value)||0});});$('ln-np-repeat').addEventListener('click',function(){if(LM)LM.setMode({shuffle:!!state.shuffle,repeat:((state.repeat||0)+1)%3});});$('ln-np-shuffle').addEventListener('click',function(){if(LM)LM.setMode({shuffle:!state.shuffle,repeat:state.repeat||0});});$('ln-np-timer').addEventListener('click',function(){var mins=[15,30,45,60];sleepTimerIndex=(sleepTimerIndex+1)%5;if(sleepTimer)clearTimeout(sleepTimer);if(!sleepTimerIndex){sleepTimer=null;$('ln-np-timer-status').textContent='Timer tidur dimatikan';return;}var m=mins[sleepTimerIndex-1];$('ln-np-timer-status').textContent='Musik berhenti dalam '+m+' menit';sleepTimer=setTimeout(function(){if(LM)LM.pause();$('ln-np-timer-status').textContent='Timer selesai · musik dijeda';sleepTimer=null;sleepTimerIndex=0;},m*60000);});}
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
