/**
 * LNMusic Hub Link / Safe Link Hub  (tab "Hub")
 *
 * - Semua link dikenali di sisi klien (browser). Tidak ada scraping dan tidak ada proxy pihak ketiga.
 * - Hanya domain YouTube, TikTok, Facebook/FB Reels, Instagram, dan Telegram yang diterima.
 * - Link dibersihkan dari parameter pelacak, dan link pengalih (l.facebook.com dst.) ditolak.
 * - YouTube terhubung ke player (playTrack) dan antrean room (queueAdd).
 * - "Kirim ke Chat" memakai live chat room yang sudah ada; link platform di chat otomatis bisa diklik.
 */
(function () {
  'use strict';

  const KEY = 'lnmusic_hub_v1';
  const MAX_ITEMS = 120; // batas riwayat (koleksi bertanda bintang tidak dihitung)

  const PLAT = {
    youtube:   { label: 'YouTube',   tag: 'YT', badge: 'bg-red-500/20 text-red-300 border-red-500/30' },
    tiktok:    { label: 'TikTok',    tag: 'TT', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    fbreels:   { label: 'FB Reels',  tag: 'FB', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    instagram: { label: 'Instagram', tag: 'IG', badge: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30' },
    telegram:  { label: 'Telegram',  tag: 'TG', badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30' }
  };
  const FILTERS = [
    ['all', 'Semua'], ['fav', '⭐ Koleksi'], ['youtube', 'YouTube'], ['tiktok', 'TikTok'],
    ['fbreels', 'FB Reels'], ['instagram', 'Instagram'], ['telegram', 'Telegram']
  ];

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hostIs = (h, d) => h === d || h.endsWith('.' + d);
  const hashId = s => { let x = 5381; for (let i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0; return 'h' + (x >>> 0).toString(36); };
  const toast = m => { try { if (typeof showToast === 'function') return showToast(m); } catch (e) {} alert(m); };

  // ---------------------------------------------------------------------------
  // 1. PENGENALAN LINK (murni di browser)
  // ---------------------------------------------------------------------------
  function parseLink(raw) {
    const text = String(raw || '').trim();
    if (!text) return { ok: false, error: '' };

    let cand = (text.match(/https?:\/\/[^\s<>"']+/i) || [])[0];
    if (!cand) {
      const m = text.match(/(?:^|\s)((?:[a-z0-9-]+\.)+[a-z]{2,}\/\S*)/i) || text.match(/^((?:[a-z0-9-]+\.)+[a-z]{2,})$/i);
      if (!m) return { ok: false, error: 'Itu bukan link. Tempel link YouTube, TikTok, FB Reels, Instagram, atau Telegram.' };
      cand = 'https://' + m[1];
    }
    cand = cand.replace(/[.,;:!?)\]]+$/, '');
    if (cand.length > 600) return { ok: false, error: 'Link terlalu panjang.' };

    let u;
    try { u = new URL(cand); } catch (e) { return { ok: false, error: 'Link tidak valid.' }; }
    if (!/^https?:$/.test(u.protocol) || u.username || u.password) return { ok: false, error: 'Link ini tidak aman.' };

    const h = u.hostname.toLowerCase().replace(/^www\./, '');
    const segs = u.pathname.split('/').filter(Boolean);
    const clean = u.pathname.replace(/\/+$/, '');

    // link pengalih (sering dipakai untuk menyamarkan tujuan) ditolak
    if (/^(l|lm)\./.test(h) || (hostIs(h, 'youtube.com') && segs[0] === 'redirect')) {
      return { ok: false, error: 'Link pengalih tidak diizinkan. Tempel link aslinya.' };
    }

    // YouTube
    if (hostIs(h, 'youtube.com') || h === 'youtu.be') {
      let id = '';
      if (h === 'youtu.be') id = segs[0] || '';
      else if (clean === '/watch') id = u.searchParams.get('v') || '';
      else if (['shorts', 'live', 'embed', 'v'].includes(segs[0])) id = segs[1] || '';
      id = /^[\w-]{11}$/.test(id) ? id : '';
      let url;
      if (id) url = 'https://youtu.be/' + id;
      else if (clean === '/playlist' && /^[\w-]+$/.test(u.searchParams.get('list') || '')) url = 'https://www.youtube.com/playlist?list=' + u.searchParams.get('list');
      else url = 'https://' + h + clean;
      return { ok: true, platform: 'youtube', url, ytId: id, music: h === 'music.youtube.com', title: id ? 'Video YouTube' : 'Link YouTube' };
    }

    // TikTok
    if (hostIs(h, 'tiktok.com')) {
      const user = segs.find(s => s.startsWith('@')) || '';
      return { ok: true, platform: 'tiktok', url: 'https://' + h + clean, ytId: '', title: user ? 'Video TikTok ' + user : 'Video TikTok' };
    }

    // Facebook / FB Reels
    if (hostIs(h, 'facebook.com') || hostIs(h, 'fb.com') || hostIs(h, 'fb.watch')) {
      let url = 'https://' + h + clean;
      if (/^\/watch/.test(clean) && /^\d+$/.test(u.searchParams.get('v') || '')) url = 'https://' + h + '/watch/?v=' + u.searchParams.get('v');
      return { ok: true, platform: 'fbreels', url, ytId: '', title: 'Reels Facebook' };
    }

    // Instagram
    if (hostIs(h, 'instagram.com') || h === 'instagr.am') {
      const t = { reel: 'Reel Instagram', reels: 'Reel Instagram', p: 'Post Instagram', tv: 'IGTV Instagram' }[segs[0]] || 'Link Instagram';
      return { ok: true, platform: 'instagram', url: 'https://' + h + clean, ytId: '', title: t };
    }

    // Telegram
    if (hostIs(h, 't.me') || hostIs(h, 'telegram.me') || hostIs(h, 'telegram.dog')) {
      const first = segs[0] || '';
      const title = !first ? 'Link Telegram' : (first.startsWith('+') || first === 'joinchat') ? 'Undangan Telegram' : 'Telegram: ' + first;
      return { ok: true, platform: 'telegram', url: 'https://' + h + clean, ytId: '', title };
    }

    return { ok: false, error: 'Hanya link YouTube, TikTok, FB Reels, Instagram, dan Telegram yang diterima.' };
  }

  // ---------------------------------------------------------------------------
  // 2. PENYIMPANAN (koleksi + riwayat dalam satu daftar)
  // ---------------------------------------------------------------------------
  let items = loadItems();
  let filter = 'all';
  let cur = null; // link yang sedang tampil di kartu

  function loadItems() {
    try {
      const a = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(a)) return [];
      return a.filter(x => x && typeof x.url === 'string' && PLAT[x.platform] && parseLink(x.url).ok)
        .map(x => ({ id: hashId(x.url), url: x.url, platform: x.platform, ytId: x.ytId || '', music: !!x.music, title: String(x.title || '').slice(0, 120) || PLAT[x.platform].label, known: !!x.known, artist: String(x.artist || '').slice(0, 80), fav: !!x.fav, ts: +x.ts || Date.now(), n: +x.n || 0 }));
    } catch (e) { return []; }
  }
  function saveItems() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} }

  function upsert(c, patch) {
    const id = hashId(c.url);
    let it = items.find(x => x.id === id);
    if (!it) {
      it = { id, url: c.url, platform: c.platform, ytId: c.ytId || '', music: !!c.music, title: c.title, known: !!c.known, artist: c.artist || '', fav: false, ts: Date.now(), n: 0 };
      items.unshift(it);
    } else if (c.edited || c.known) {
      it.title = c.title; it.known = true; if (c.artist) it.artist = c.artist;
    }
    Object.assign(it, patch || {});
    it.ts = Date.now();
    items.sort((a, b) => b.ts - a.ts);
    let nf = 0; items = items.filter(x => x.fav || ++nf <= MAX_ITEMS);
    saveItems();
    return it;
  }

  // ---------------------------------------------------------------------------
  // 3. AKSI
  // ---------------------------------------------------------------------------
  function openUrl(url) {
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    document.body.appendChild(a); a.click(); a.remove();
  }

  function trackOf(c) {
    return {
      id: c.ytId,
      title: c.known ? c.title : 'Video YouTube (' + c.ytId + ')', // judul generik akan diganti otomatis oleh player
      artist: c.artist || 'YouTube',
      thumb: 'https://i.ytimg.com/vi/' + c.ytId + '/hqdefault.jpg',
      type: 'youtube',
      isVideo: !c.music
    };
  }

  function actPlay(c) {
    if (!c.ytId) return toast('Link YouTube ini bukan video.');
    if (typeof playTrack !== 'function') return;
    upsert(c, {});
    playTrack(trackOf(c), true);
    renderList();
  }

  function actQueue(c) {
    if (!c.ytId) return toast('Link YouTube ini bukan video.');
    if (typeof queueAdd !== 'function') return;
    upsert(c, {});
    queueAdd(trackOf(c));
    toast('Masuk antrean room');
    renderList();
  }

  function actSendChat(c) {
    if (typeof isRoomConnected === 'undefined' || !isRoomConnected) return toast('Masuk room dulu untuk kirim ke chat.');
    const it = upsert(c, {});
    const text = '🔗 ' + String(it.title).slice(0, 80) + ' — ' + it.url;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7), ts = Date.now();
    appendUserChat(myDisplayName, text, true, { id, ts });
    connections.forEach(cn => { if (cn.open) cn.send({ type: 'CHAT', name: myDisplayName, text, id, ts }); });
    toast('Terkirim ke chat');
    renderList();
  }

  function actOpen(c) {
    const it = upsert(c, {});
    it.n = (it.n || 0) + 1; saveItems();
    openUrl(it.url);
    renderList(); renderCard();
  }

  function actFav(c) {
    const id = hashId(c.url);
    const ex = items.find(x => x.id === id);
    upsert(c, { fav: ex ? !ex.fav : true });
    renderList(); renderCard();
  }

  // judul YouTube lewat oEmbed resmi (opsional; jika gagal, judul bawaan tetap dipakai)
  async function fetchYtTitle(c) {
    try {
      const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + c.ytId), { signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) return;
      const d = await r.json();
      if (cur === c && !c.edited && d && d.title) {
        c.title = String(d.title).slice(0, 120); c.artist = String(d.author_name || '').slice(0, 80); c.known = true;
        const inp = document.getElementById('hub-title'); if (inp) inp.value = c.title;
      }
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // 4. TAMPILAN
  // ---------------------------------------------------------------------------
  const root = () => document.getElementById('tab-hub');
  const $ = sel => { const r = root(); return r ? r.querySelector(sel) : null; };

  function build() {
    const r = root(); if (!r) return false;
    r.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="tile"><i data-lucide="link-2" class="w-4 h-4 text-rose-200"></i></span>
        <div>
          <h3 class="text-lg font-extrabold leading-tight">Hub Link</h3>
          <p class="text-xs text-zinc-400">Tempel link, dikenali otomatis dan aman dibuka.</p>
        </div>
      </div>

      <div class="glass rounded-3xl p-4 space-y-3 border border-white/10">
        <div class="flex gap-2">
          <input id="hub-input" type="text" inputmode="url" autocapitalize="none" autocorrect="off" spellcheck="false"
            placeholder="Tempel link YouTube, TikTok, FB Reels, Instagram, Telegram"
            class="flex-1 min-w-0 bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-3 text-sm text-white focus:border-rose-500 focus:outline-none" />
          <button data-act="paste" class="px-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white shrink-0">Tempel</button>
        </div>
        <p id="hub-msg" class="hidden text-xs text-rose-300"></p>
        <div id="hub-card"></div>
      </div>

      <div class="space-y-3">
        <div class="flex items-center justify-between gap-2">
          <h4 class="text-sm font-extrabold">Koleksi &amp; Riwayat</h4>
          <button data-act="clear" class="text-[11px] text-zinc-400 hover:text-red-300 underline">Bersihkan riwayat</button>
        </div>
        <div id="hub-filters" class="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1"></div>
        <div id="hub-list" class="space-y-2"></div>
      </div>`;
    return true;
  }

  function setMsg(t) {
    const m = $('#hub-msg'); if (!m) return;
    m.textContent = t || ''; m.classList.toggle('hidden', !t);
  }

  function renderCard() {
    const box = $('#hub-card'); if (!box) return;
    if (!cur) { box.innerHTML = ''; return; }
    const P = PLAT[cur.platform];
    const ex = items.find(x => x.id === hashId(cur.url));
    const thumb = cur.ytId
      ? `<img src="https://i.ytimg.com/vi/${esc(cur.ytId)}/mqdefault.jpg" alt="" loading="lazy" class="w-full h-full object-cover" />`
      : `<div class="w-full h-full grid place-items-center text-2xl font-extrabold">${P.tag}</div>`;
    box.innerHTML = `
      <div class="rounded-2xl border border-white/10 bg-white/[0.04] p-3 space-y-3">
        <div class="flex gap-3">
          <div class="w-24 h-24 shrink-0 rounded-xl overflow-hidden border ${P.badge}">${thumb}</div>
          <div class="min-w-0 flex-1 space-y-1.5">
            <span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${P.badge}">${esc(P.label)}</span>
            <input id="hub-title" maxlength="120" value="${esc(cur.title)}" aria-label="Judul link"
              class="w-full bg-zinc-950 border border-white/10 rounded-lg px-2.5 py-2 text-xs font-semibold text-white focus:border-rose-500 focus:outline-none" />
            <p class="text-[10px] text-zinc-500 truncate">${esc(cur.url.replace(/^https:\/\//, ''))}</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button data-act="open" class="col-span-2 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-violet-600 text-xs font-bold text-white shadow-lg shadow-rose-600/20">Buka di App / Tab Baru</button>
          ${cur.ytId ? `
          <button data-act="play" class="py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white">▶ Putar di Player</button>
          <button data-act="queue" class="py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white">+ Antrean Room</button>` : ''}
          <button data-act="fav" class="py-2.5 rounded-xl ${ex && ex.fav ? 'bg-amber-500/25 text-amber-200' : 'bg-white/10 text-white'} hover:bg-white/15 text-xs font-bold">${ex && ex.fav ? '⭐ Tersimpan' : '☆ Simpan Koleksi'}</button>
          <button data-act="chat" class="py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white">Kirim ke Chat</button>
        </div>
      </div>`;
  }

  function ago(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'baru saja';
    if (s < 3600) return Math.floor(s / 60) + ' mnt lalu';
    if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
    return Math.floor(s / 86400) + ' hari lalu';
  }

  function renderFilters() {
    const box = $('#hub-filters'); if (!box) return;
    box.innerHTML = FILTERS.map(([k, label]) =>
      `<button data-filter="${k}" class="shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold border transition ${filter === k ? 'bg-rose-500/25 text-rose-200 border-rose-500/40' : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10'}">${label}</button>`
    ).join('');
  }

  function renderList() {
    const box = $('#hub-list'); if (!box) return;
    renderFilters();
    const list = items.filter(x => filter === 'all' ? true : filter === 'fav' ? x.fav : x.platform === filter);
    if (!list.length) {
      box.innerHTML = `<p class="text-xs text-zinc-500 text-center py-6">${filter === 'fav' ? 'Belum ada link di koleksi. Ketuk ☆ Simpan Koleksi pada link yang kamu suka.' : 'Belum ada link di daftar ini.'}</p>`;
      return;
    }
    const btn = 'px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-white';
    box.innerHTML = list.map(it => {
      const P = PLAT[it.platform];
      return `
      <div class="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2" data-id="${it.id}">
        <div class="flex items-center gap-2.5">
          <span class="shrink-0 w-10 h-10 rounded-xl border ${P.badge} grid place-items-center text-[11px] font-extrabold">${P.tag}</span>
          <div class="min-w-0 flex-1">
            <div class="text-xs font-semibold text-white truncate">${esc(it.title)}</div>
            <div class="text-[10px] text-zinc-500 truncate">${esc(P.label)} • ${ago(it.ts)}${it.n ? ' • dibuka ' + it.n + 'x' : ''}</div>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button data-item="open" class="${btn} bg-rose-600/30">Buka</button>
          ${it.ytId ? `<button data-item="play" class="${btn}">▶ Putar</button><button data-item="queue" class="${btn}">+ Antre</button>` : ''}
          <button data-item="chat" class="${btn}">Chat</button>
          <button data-item="fav" class="${btn} ${it.fav ? 'bg-amber-500/25 text-amber-200' : ''}">${it.fav ? '⭐' : '☆'}</button>
          <button data-item="rename" class="${btn}">✎</button>
          <button data-item="del" class="${btn} text-red-300">✕</button>
        </div>
      </div>`;
    }).join('');
  }

  // ---------------------------------------------------------------------------
  // 5. INPUT & EVENT
  // ---------------------------------------------------------------------------
  function onInput(value) {
    const v = String(value || '').trim();
    if (!v) { cur = null; setMsg(''); renderCard(); return; }
    const p = parseLink(v);
    if (!p.ok) {
      cur = null; renderCard();
      setMsg(p.error);
      return;
    }
    setMsg('');
    if (cur && cur.url === p.url) return;
    const ex = items.find(x => x.id === hashId(p.url));
    cur = Object.assign({}, p, ex ? { title: ex.title, known: ex.known, artist: ex.artist } : { known: false, artist: '' }, { edited: false });
    renderCard();
    if (cur.ytId && !cur.known) fetchYtTitle(cur);
  }

  function itemAction(act, id) {
    const it = items.find(x => x.id === id); if (!it) return;
    if (act === 'open') { it.n = (it.n || 0) + 1; it.ts = Date.now(); saveItems(); openUrl(it.url); renderList(); }
    else if (act === 'play') actPlay(it);
    else if (act === 'queue') actQueue(it);
    else if (act === 'chat') actSendChat(it);
    else if (act === 'fav') { it.fav = !it.fav; saveItems(); renderList(); renderCard(); }
    else if (act === 'rename') {
      const t = prompt('Ubah judul link:', it.title);
      if (t && t.trim()) { it.title = t.trim().slice(0, 120); it.known = true; saveItems(); renderList(); }
    } else if (act === 'del') {
      if (!confirm('Hapus link ini dari daftar?')) return;
      items = items.filter(x => x.id !== id); saveItems(); renderList(); renderCard();
    }
  }

  function bind() {
    const r = root();
    r.addEventListener('click', async e => {
      const f = e.target.closest('[data-filter]');
      if (f) { filter = f.dataset.filter; renderList(); return; }

      const li = e.target.closest('[data-item]');
      if (li) { const row = li.closest('[data-id]'); if (row) itemAction(li.dataset.item, row.dataset.id); return; }

      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act;
      if (act === 'paste') {
        try {
          const t = await navigator.clipboard.readText();
          $('#hub-input').value = t; onInput(t);
        } catch (err) { toast('Tidak bisa membaca clipboard. Tempel manual di kolom.'); $('#hub-input').focus(); }
      } else if (act === 'clear') {
        if (!confirm('Hapus semua riwayat? Link di Koleksi (⭐) tetap disimpan.')) return;
        items = items.filter(x => x.fav); saveItems(); renderList();
      } else if (cur) {
        if (act === 'open') actOpen(cur);
        else if (act === 'play') actPlay(cur);
        else if (act === 'queue') actQueue(cur);
        else if (act === 'fav') actFav(cur);
        else if (act === 'chat') actSendChat(cur);
      }
    });

    let timer = null;
    r.addEventListener('input', e => {
      if (e.target.id === 'hub-input') { clearTimeout(timer); timer = setTimeout(() => onInput(e.target.value), 150); }
      else if (e.target.id === 'hub-title' && cur) { cur.title = e.target.value.slice(0, 120); cur.edited = true; cur.known = true; }
    });
    r.addEventListener('change', e => {
      if (e.target.id === 'hub-title' && cur) {
        const ex = items.find(x => x.id === hashId(cur.url));
        if (ex) { ex.title = cur.title || ex.title; ex.known = true; saveItems(); renderList(); }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 6. LINK DI LIVE CHAT: bisa diklik + tombol Putar untuk YouTube
  // ---------------------------------------------------------------------------
  function linkifyChat() {
    ['room-chat-messages', 'fs-chat-messages'].forEach(id => {
      const box = document.getElementById(id); if (!box) return;
      const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, {
        acceptNode: n => (n.parentElement && !n.parentElement.closest('a,button,audio,.ln-media-chat-layer') && /https?:\/\//i.test(n.nodeValue))
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
      });
      const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(node => {
        const txt = node.nodeValue, re = /https?:\/\/[^\s<>"']+/gi;
        const frag = document.createDocumentFragment();
        let last = 0, m, changed = false;
        while ((m = re.exec(txt))) {
          const raw = m[0].replace(/[.,;:!?)\]]+$/, '');
          const p = parseLink(raw);
          if (!p.ok) continue;
          changed = true;
          frag.append(txt.slice(last, m.index));
          const a = document.createElement('a');
          a.href = p.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
          a.className = 'underline text-rose-200 break-all'; a.textContent = raw;
          frag.append(a);
          if (p.ytId) {
            const b = document.createElement('button');
            b.type = 'button'; b.dataset.hubYt = p.ytId; b.dataset.hubMusic = p.music ? '1' : '';
            b.className = 'ml-1 px-1.5 rounded-md bg-white/15 text-[10px] font-bold'; b.textContent = '▶ Putar';
            frag.append(b);
          }
          last = m.index + raw.length; re.lastIndex = last;
        }
        if (changed) { frag.append(txt.slice(last)); node.replaceWith(frag); }
      });
    });
  }

  function hookChat() {
    if (typeof window.renderChat === 'function' && !window.renderChat._hubWrapped) {
      const orig = window.renderChat;
      window.renderChat = function () {
        const r = orig.apply(this, arguments);
        try { linkifyChat(); } catch (e) {}
        return r;
      };
      window.renderChat._hubWrapped = true;
    }
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('[data-hub-yt]'); if (!b) return;
      e.preventDefault();
      const c = { ytId: b.dataset.hubYt, music: !!b.dataset.hubMusic, known: false, artist: '' };
      if (typeof playTrack === 'function') playTrack(trackOf(c), true);
    });
    try { linkifyChat(); } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  function init() {
    if (!build()) return;
    bind(); renderCard(); renderList(); hookChat();
    try { window.lucide && lucide.createIcons(); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.LNHub = { parseLink };
})();
