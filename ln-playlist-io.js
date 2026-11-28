/* LNMusic: Impor / Ekspor playlist.
   Ekspor : semua playlist -> file cadangan .json (web) atau kode yang disalin (APK). Lagu offline tidak ikut (file-nya ada di perangkat).
   Impor  : cadangan LNMusic (.json), link playlist YouTube / YouTube Music / Spotify / Apple Music,
            file CSV (Exportify, TuneMyMusic, Soundiiz, dll), data ekspor resmi Spotify (.json), atau daftar "Artis - Judul". */
(function () {
  var MAXT = 500;
  var IC = {
    swap: '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/>',
    save: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'
  };
  function svg(n, s) { return '<svg xmlns="http://www.w3.org/2000/svg" width="' + (s || 18) + '" height="' + (s || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0">' + IC[n] + '</svg>'; }
  function el(tag, css, txt) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }
  function api(p) { try { return typeof lnApiUrl === 'function' ? lnApiUrl(p) : p; } catch (e) { return p; } }
  function toast(m) { try { showToast(m); } catch (e) {} }
  function isNative() { try { var C = window.Capacitor; return !!(C && ((C.isNativePlatform && C.isNativePlatform()) || (C.getPlatform && C.getPlatform() !== 'web'))) || document.documentElement.classList.contains('ln-android'); } catch (e) { return false; } }
  function str(x, n) { return String(x == null ? '' : x).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

  // ---------- bentuk lagu ----------
  function lazyTrack(title, artist, thumb) {
    title = str(title, 160); artist = str(artist, 100);
    if (!title) return null;
    var th = /^https?:\/\//i.test(thumb || '') ? String(thumb).trim().slice(0, 300) : '';
    return { id: 'imp:' + hash((artist + '|' + title).toLowerCase()), title: title, artist: artist, thumb: th, type: 'youtube', isVideo: false, lazy: true };
  }
  function normTrack(t) {
    if (!t || (t.type && t.type !== 'youtube')) return null;
    var id = str(t.id, 60), title = str(t.title, 160);
    if (!id || !title) return null;
    var thumb = /^https?:\/\//.test(t.thumb || '') ? String(t.thumb).slice(0, 300) : '';
    if (!thumb && !t.lazy && /^[\w-]{11}$/.test(id)) thumb = 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
    var o = { id: id, title: title, artist: str(t.artist, 100) || 'YouTube', thumb: thumb, type: 'youtube', isVideo: !!t.isVideo };
    if (t.lazy) { o.lazy = true; if (t.appleId) o.appleId = str(t.appleId, 40); }
    return o;
  }

  // ---------- ekspor ----------
  function buildBackup() {
    var skipped = 0, out = [];
    playlists.forEach(function (pl) {
      var tr = [];
      pl.tracks.forEach(function (t) {
        if (t.type && t.type !== 'youtube') { skipped++; return; }
        var th = /^https?:\/\//.test(t.thumb || '') ? t.thumb : '';
        if (th === 'https://i.ytimg.com/vi/' + t.id + '/hqdefault.jpg') th = ''; // bisa disusun ulang saat impor
        var o = { id: t.id, title: t.title, artist: t.artist };
        if (th) o.thumb = th; if (t.isVideo) o.isVideo = true;
        if (t.lazy) { o.lazy = true; if (t.appleId) o.appleId = t.appleId; }
        tr.push(o);
      });
      out.push({ name: pl.name, tracks: tr });
    });
    return { skipped: skipped, text: JSON.stringify({ app: 'lnmusic', kind: 'playlists', version: 1, exportedAt: new Date().toISOString(), playlists: out }) };
  }
  function saveFile(text, name) {
    var blob = new Blob([text], { type: 'application/json' }), u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(u); }, 2000);
  }
  function copyText(text) {
    var fallback = function () {
      try {
        var ta = el('textarea', 'position:fixed;left:-9999px;top:0;opacity:0'); ta.value = text; document.body.appendChild(ta);
        ta.focus(); ta.select(); var ok = document.execCommand('copy'); ta.remove(); return ok;
      } catch (e) { return false; }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
    return Promise.resolve(fallback());
  }

  // ---------- baca masukan ----------
  function parseCSV(text) {
    var first = (text.split(/\r?\n/, 1)[0] || ''), delim = ',';
    var cnt = function (c) { return first.split(c).length - 1; };
    if (cnt('\t') > cnt(delim)) delim = '\t'; else if (cnt(';') > cnt(delim)) delim = ';';
    var rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === delim) { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(function (x) { return x.trim(); })) rows.push(row); row = []; }
      else cur += c;
    }
    row.push(cur); if (row.some(function (x) { return x.trim(); })) rows.push(row);
    return rows;
  }
  var TITLE_H = ['track name', 'track', 'title', 'song', 'song name', 'name', 'judul', 'nama lagu', 'lagu', 'trackname'];
  var ARTIST_H = ['artist name(s)', 'artist name', 'artist names', 'artists', 'artist', 'artistname', 'penyanyi', 'artis'];
  var IMG_H = ['album image url', 'album image', 'image url', 'image', 'cover', 'cover url', 'cover image', 'artwork', 'artwork url', 'thumbnail', 'thumbnail url', 'thumb', 'album art', 'album cover', 'gambar'];
  function fromCSV(text) {
    var rows = parseCSV(text);
    if (rows.length < 2) return null;
    var head = rows[0].map(function (h) { return h.trim().toLowerCase().replace(/^\ufeff/, ''); });
    var ti = -1, ai = -1, ii = -1;
    TITLE_H.some(function (k) { var i = head.indexOf(k); if (i >= 0) { ti = i; return true; } });
    ARTIST_H.some(function (k) { var i = head.indexOf(k); if (i >= 0) { ai = i; return true; } });
    IMG_H.some(function (k) { var i = head.indexOf(k); if (i >= 0) { ii = i; return true; } });
    if (ti < 0) return null;
    var out = [];
    rows.slice(1).forEach(function (r) {
      var a = ai >= 0 ? String(r[ai] || '').replace(/\s*;\s*/g, ', ') : '';
      var t = lazyTrack(r[ti], a, ii >= 0 ? r[ii] : ''); if (t) out.push(t);
    });
    return out;
  }
  function fromLines(text) {
    var out = [];
    text.split(/\r?\n/).forEach(function (line) {
      line = line.replace(/^\s*\d+\s*[.)]\s+/, '').trim();
      if (!line || /^https?:\/\//i.test(line)) return;
      var m = line.match(/^(.+?)\s+[-–—]\s+(.+)$/), t = m ? lazyTrack(m[2], m[1]) : lazyTrack(line, '');
      if (t) out.push(t);
    });
    return out;
  }
  function fromJSON(obj) {
    var lists = [];
    if (obj && obj.app === 'lnmusic' && Array.isArray(obj.playlists)) {            // cadangan LNMusic
      obj.playlists.forEach(function (p) {
        var tr = (p.tracks || []).map(normTrack).filter(Boolean);
        if (p && p.name) lists.push({ name: str(p.name, 60), tracks: tr });
      });
      return { kind: 'backup', lists: lists };
    }
    if (obj && Array.isArray(obj.playlists)) {                                     // data ekspor resmi Spotify (Playlist1.json)
      obj.playlists.forEach(function (p) {
        var tr = [];
        (p.items || []).forEach(function (it) { var k = it && it.track; if (k) { var t = lazyTrack(k.trackName, k.artistName); if (t) tr.push(t); } });
        if (p && p.name && tr.length) lists.push({ name: str(p.name, 60), tracks: tr });
      });
      if (lists.length) return { kind: 'spotify', lists: lists };
    }
    var arr = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.tracks) ? obj.tracks : null);   // YourLibrary.json (lagu yang disukai)
    if (arr) {
      var tr2 = [];
      arr.forEach(function (k) { if (k) { var t = lazyTrack(k.track || k.trackName || k.title, k.artist || k.artistName); if (t) tr2.push(t); } });
      if (tr2.length) return { kind: 'spotify', lists: [{ name: 'Lagu yang Disukai', tracks: tr2 }] };
    }
    return null;
  }

  // ---------- simpan ke playlist ----------
  function commit(lists) {
    var added = 0, firstId = null, made = 0;
    lists.forEach(function (it) {
      var name = str(it.name, 60) || 'Playlist impor';
      var pl = playlists.filter(function (p) { return String(p.name).toLowerCase() === name.toLowerCase(); })[0];
      if (!pl) { pl = { id: 'pl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), name: name, tracks: [] }; playlists.push(pl); made++; }
      var have = {}; pl.tracks.forEach(function (t) { have[t.id] = 1; });
      it.tracks.slice(0, MAXT).forEach(function (t) { if (!have[t.id]) { have[t.id] = 1; pl.tracks.push(t); added++; } });
      if (!firstId) firstId = pl.id;
    });
    savePlaylists();
    if (firstId) { try { selectPlaylist(firstId); } catch (e) {} }
    return { added: added, made: made };
  }

  // Ambil link pertama dari teks yang ditempel (mis. pesan bagikan Spotify: "Dengar playlist ini https://open.spotify.com/...").
  var LINK_HOSTS = /^(?:[\w-]+\.)*(?:youtube\.com|youtu\.be|spotify\.com|spotify\.link|spotify\.app\.link|apple\.com)$/i;
  function findLink(raw) {
    var all = String(raw || '').match(/https?:\/\/[^\s<>"'\u201c\u201d]+/gi) || [];
    var found = [];
    all.forEach(function (u) {
      u = u.replace(/[)\].,;!?]+$/, '');
      try { if (LINK_HOSTS.test(new URL(u).hostname)) found.push(u); } catch (e) {}
    });
    if (found.length !== 1) return '';                                   // 0 atau banyak link: bukan "satu link playlist"
    var lines = String(raw).split(/\r?\n/).filter(function (l) { return l.trim(); });
    return lines.length <= 4 ? found[0] : '';                            // teks panjang = daftar lagu, bukan link
  }
  function fetchJSON(url, ms) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null, tm = ctrl ? setTimeout(function () { ctrl.abort(); }, ms) : 0;
    return fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined }).then(function (res) {
      return res.text().then(function (txt) {
        var j = null; try { j = JSON.parse(txt); } catch (e) {}
        return { res: res, j: j };
      });
    }).then(function (x) { clearTimeout(tm); return x; }, function (e) { clearTimeout(tm); throw e; });
  }
  async function importLink(url) {
    var out = null, lastErr = null;
    for (var attempt = 0; attempt < 2 && !out; attempt++) {
      try { out = await fetchJSON(api('/api/import?url=' + encodeURIComponent(url)), 28000); }
      catch (e) { lastErr = e; if (attempt === 0) await new Promise(function (r) { setTimeout(r, 900); }); }
    }
    if (!out) throw new Error(lastErr && lastErr.name === 'AbortError' ? 'Server terlalu lama menjawab. Coba lagi, atau impor lewat file CSV.' : 'Tidak bisa menghubungi server. Cek koneksi internet, lalu coba lagi.');
    var res = out.res, j = out.j;
    if (!j) {
      if (res.status === 404) throw new Error('Fitur impor link belum aktif di server (api/import.js belum ter-deploy). Sementara pakai file CSV.');
      throw new Error('Server menjawab ' + res.status + ' dengan format tak terduga. Coba lagi sebentar lagi.');
    }
    if (!res.ok || !j.tracks) throw new Error(j.error || j.msg || ('Server menjawab ' + res.status));
    var tracks = j.tracks.map(function (t) { return t.id ? normTrack({ id: t.id, title: t.title, artist: t.artist, thumb: t.thumb }) : lazyTrack(t.title, t.artist, t.thumb); }).filter(Boolean);
    if (!tracks.length) throw new Error('Playlist ini kosong');
    return { name: j.name, tracks: tracks, source: j.source };
  }

  // ---------- jendela ----------
  var ov = null, ta = null, nameIn = null, msg = null, goBtn = null, panelImp = null, panelExp = null, tabImp = null, tabExp = null;

  function setMsg(text, kind) {
    msg.textContent = text || '';
    msg.style.color = kind === 'err' ? '#fda4af' : kind === 'ok' ? '#86efac' : '#a1a1aa';
  }
  function setBusy(b) { goBtn.disabled = b; goBtn.style.opacity = b ? '.6' : '1'; }

  async function run(raw, fileName) {
    raw = String(raw || '').replace(/^\ufeff/, '').trim();
    if (!raw) return setMsg('Tempel link atau isi dulu, atau pilih file.', 'err');
    setBusy(true); setMsg('Memproses…');
    try {
      var lists, note = '';
      var custom = str(nameIn.value, 60), base = fileName ? fileName.replace(/\.[^.]+$/, '') : '';
      if (/^[\[{]/.test(raw)) {
        var obj; try { obj = JSON.parse(raw); } catch (e) { throw new Error('File JSON-nya rusak atau terpotong.'); }
        var r = fromJSON(obj);
        if (!r) throw new Error('Format JSON ini belum dikenali. Pakai cadangan LNMusic, ekspor resmi Spotify, atau CSV.');
        lists = r.lists;
        if (r.kind === 'spotify') note = ' Lagu dari Spotify dicarikan versi YouTube-nya saat diputar.';
      } else if (findLink(raw)) {
        setMsg('Mengambil playlist dari link…');
        var lk = await importLink(findLink(raw));
        lists = [{ name: custom || lk.name, tracks: lk.tracks }];
        if (lk.source !== 'youtube') note = ' Lagu dicarikan versi YouTube-nya saat diputar.';
      } else if (/^https?:\/\/\S+$/i.test(raw)) {
        throw new Error('Link ini belum didukung. Pakai link playlist YouTube, YouTube Music, Spotify, atau Apple Music.');
      } else {
        var tr = fromCSV(raw) || fromLines(raw);
        if (!tr.length) throw new Error('Tidak ada lagu yang terbaca. Pakai format "Artis - Judul" per baris, atau file CSV dengan kolom judul dan artis.');
        lists = [{ name: custom || base || 'Playlist impor', tracks: tr }];
        note = ' Lagu dicarikan versi YouTube-nya saat diputar.';
      }
      lists = lists.filter(function (l) { return l.tracks.length; });
      if (!lists.length) throw new Error('Tidak ada lagu yang bisa diimpor.');
      var total = lists.reduce(function (n, l) { return n + Math.min(l.tracks.length, MAXT); }, 0);
      var res = commit(lists);
      var skipDup = total - res.added;
      setMsg('✓ ' + res.added + ' lagu masuk ke ' + (lists.length > 1 ? lists.length + ' playlist' : '“' + lists[0].name + '”') + (skipDup > 0 ? ' (' + skipDup + ' sudah ada, dilewati)' : '') + '.' + note, 'ok');
      toast('Impor selesai: ' + res.added + ' lagu');
      ta.value = '';
    } catch (e) {
      setMsg(e.message || 'Gagal mengimpor.', 'err');
    }
    setBusy(false);
  }

  function pill(label, icon, primary) {
    var b = el('button', 'display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;padding:0 18px;border-radius:999px;font-size:13.5px;font-weight:800;cursor:pointer;border:1px solid ' + (primary ? '#22d36a' : 'rgba(255,255,255,.14)') + ';background:' + (primary ? '#22d36a' : 'rgba(255,255,255,.06)') + ';color:' + (primary ? '#04210f' : '#e4e4ee'));
    b.type = 'button'; b.innerHTML = svg(icon, 18); b.appendChild(document.createTextNode(label)); return b;
  }

  function switchTab(which) {
    var imp = which === 'imp';
    panelImp.style.display = imp ? 'flex' : 'none'; panelExp.style.display = imp ? 'none' : 'flex';
    [[tabImp, imp], [tabExp, !imp]].forEach(function (p) {
      p[0].style.background = p[1] ? 'rgba(34,211,106,.16)' : 'transparent';
      p[0].style.color = p[1] ? '#86efac' : '#a1a1aa';
    });
    if (!imp) refreshExport();
  }

  var expInfo = null, expCopy = null, expSave = null;
  function refreshExport() {
    var n = 0, lagu = 0; playlists.forEach(function (p) { n++; lagu += p.tracks.length; });
    var b = buildBackup();
    expInfo.textContent = n + ' playlist, ' + lagu + ' lagu.' + (b.skipped ? ' ' + b.skipped + ' lagu offline tidak ikut karena filenya ada di perangkat ini.' : '');
  }

  function build() {
    ov = el('div', 'position:fixed;inset:0;z-index:99992;background:rgba(0,0,0,.75);display:none;align-items:center;justify-content:center;padding:16px;font-family:inherit');
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    var card = el('div', 'background:#14141c;border:1px solid rgba(34,211,106,.25);border-radius:22px;padding:18px;max-width:440px;width:100%;max-height:92vh;overflow-y:auto;color:#fafafa;display:flex;flex-direction:column;gap:12px');
    var head = el('div', 'display:flex;align-items:center;justify-content:space-between');
    head.appendChild(el('div', 'font-weight:800;font-size:17px', 'Impor / Ekspor Playlist'));
    var x = el('button', 'width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;border:0;background:rgba(255,255,255,.08);color:#d4d4d8;cursor:pointer;padding:0');
    x.type = 'button'; x.innerHTML = svg('x', 16); x.setAttribute('aria-label', 'Tutup'); x.onclick = close; head.appendChild(x);

    var tabs = el('div', 'display:flex;gap:6px;padding:4px;border-radius:999px;background:rgba(255,255,255,.05)');
    var mkTab = function (t) { var b = el('button', 'flex:1;height:36px;border:0;border-radius:999px;font-size:13px;font-weight:800;cursor:pointer;background:transparent;color:#a1a1aa', t); b.type = 'button'; return b; };
    tabImp = mkTab('Impor'); tabExp = mkTab('Ekspor');
    tabImp.onclick = function () { switchTab('imp'); }; tabExp.onclick = function () { switchTab('exp'); };
    tabs.appendChild(tabImp); tabs.appendChild(tabExp);

    // --- panel impor
    panelImp = el('div', 'display:flex;flex-direction:column;gap:10px');
    panelImp.appendChild(el('div', 'font-size:12.5px;color:#a1a1aa;line-height:1.5', 'Tempel link playlist YouTube, YouTube Music, Spotify, atau Apple Music (pesan “bagikan” yang ada linknya juga bisa). Bisa juga isi file CSV, atau daftar lagu “Artis - Judul” per baris. Cover lagu dicari otomatis. Cadangan dari LNMusic juga bisa dipulihkan di sini.'));
    ta = el('textarea', 'width:100%;box-sizing:border-box;min-height:104px;resize:vertical;background:#09090b;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:11px 13px;font-size:13px;color:#fff;outline:none;font-family:inherit');
    ta.placeholder = 'https://open.spotify.com/playlist/…\natau tempel isi CSV / daftar lagu di sini';
    nameIn = el('input', 'width:100%;box-sizing:border-box;background:#09090b;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:10px 13px;font-size:13px;color:#fff;outline:none');
    nameIn.type = 'text'; nameIn.maxLength = 60; nameIn.placeholder = 'Nama playlist (opsional)';
    var fileIn = el('input'); fileIn.type = 'file'; fileIn.accept = '.json,.csv,.txt,application/json,text/csv,text/plain'; fileIn.style.display = 'none';
    fileIn.onchange = function () {
      var f = fileIn.files && fileIn.files[0]; if (!f) return;
      if (f.size > 5 * 1048576) { setMsg('File terlalu besar (maksimal 5 MB).', 'err'); fileIn.value = ''; return; }
      var rd = new FileReader();
      rd.onload = function () { run(String(rd.result || ''), f.name); fileIn.value = ''; };
      rd.onerror = function () { setMsg('File tidak bisa dibaca.', 'err'); };
      rd.readAsText(f);
    };
    var row = el('div', 'display:flex;gap:8px;flex-wrap:wrap');
    var pick = pill('Pilih file', 'file', false); pick.onclick = function () { fileIn.click(); };
    goBtn = pill('Impor', 'save', true); goBtn.style.flex = '1'; goBtn.onclick = function () { run(ta.value, ''); };
    row.appendChild(pick); row.appendChild(goBtn);
    msg = el('div', 'font-size:12.5px;line-height:1.5;min-height:18px');
    panelImp.appendChild(ta); panelImp.appendChild(nameIn); panelImp.appendChild(row); panelImp.appendChild(msg); panelImp.appendChild(fileIn);
    panelImp.appendChild(el('div', 'font-size:11.5px;color:#71717a;line-height:1.5', 'Tips: untuk Spotify atau Apple Music, link kadang gagal dibaca. Ekspor playlist-nya ke CSV (misalnya lewat Exportify atau TuneMyMusic), lalu pilih file CSV-nya di sini.'));

    // --- panel ekspor
    panelExp = el('div', 'display:none;flex-direction:column;gap:10px');
    panelExp.appendChild(el('div', 'font-size:12.5px;color:#a1a1aa;line-height:1.5', 'Simpan semua playlist sebagai cadangan. Setelah memasang versi baru atau pindah HP, buka Impor lalu pilih file atau tempel kodenya.'));
    expInfo = el('div', 'font-size:13px;font-weight:700;color:#e4e4ee');
    var native = isNative();
    expSave = pill('Simpan sebagai file', 'save', true);
    expSave.onclick = function () {
      var b = buildBackup(); var d = new Date(), p2 = function (n) { return ('0' + n).slice(-2); };
      saveFile(b.text, 'lnmusic-playlist-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '.json');
      toast('Cadangan disimpan');
    };
    expCopy = pill('Salin kode cadangan', 'copy', native);
    expCopy.onclick = function () {
      var b = buildBackup();
      copyText(b.text).then(function (ok) { toast(ok ? 'Kode cadangan disalin. Simpan di catatan/chat, lalu tempel di Impor.' : 'Gagal menyalin, coba lagi'); });
    };
    panelExp.appendChild(expInfo);
    if (!native) panelExp.appendChild(expSave); // di APK, unduhan file dari WebView tidak andal: pakai salin kode
    panelExp.appendChild(expCopy);
    if (native) panelExp.appendChild(el('div', 'font-size:11.5px;color:#71717a;line-height:1.5', 'Di aplikasi, cadangan disalin sebagai teks. Tempel ke catatan atau kirim ke chat sendiri. Untuk menyimpan sebagai file, ekspor lewat versi web.'));

    [head, tabs, panelImp, panelExp].forEach(function (n) { card.appendChild(n); });
    ov.appendChild(card); document.body.appendChild(ov);
    switchTab('imp');
  }
  function open(tab) { if (!ov) build(); setMsg(''); ov.style.display = 'flex'; switchTab(tab === 'exp' ? 'exp' : 'imp'); }
  function close() { if (ov) ov.style.display = 'none'; }
  window.lnPlaylistIO = { open: open, close: close };

  // tombol di header tab Playlist (di samping "Buat Playlist")
  function mountBtn() {
    var head = document.querySelector('#tab-playlists .pg-head');
    if (!head || head.querySelector('#ln-pl-io')) return !!head;
    var create = head.querySelector('button');
    var wrap = el('div', 'display:flex;align-items:center;gap:8px;flex-wrap:wrap');
    var b = document.createElement('button');
    b.id = 'ln-pl-io'; b.type = 'button'; b.className = 'pg-btn pg-btn-ghost pg-btn-sm';
    b.innerHTML = svg('swap', 16) + '<span>Impor / Ekspor</span>';
    b.onclick = function () { open('imp'); };
    head.insertBefore(wrap, create || null);
    wrap.appendChild(b); if (create) wrap.appendChild(create);
    return true;
  }
  function init() { if (!mountBtn()) setTimeout(init, 800); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.lnPlaylistIO._test = { findLink: findLink, parseCSV: parseCSV, fromCSV: fromCSV, fromLines: fromLines, fromJSON: fromJSON, buildBackup: buildBackup, lazyTrack: lazyTrack, normTrack: normTrack };
})();
