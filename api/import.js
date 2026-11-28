// GET /api/import?url=<link playlist>  ->  { source, name, total, tracks: [...] }
//  - YouTube / YouTube Music : resmi lewat YouTube Data API (playlistItems, 1 unit kuota per 50 lagu). Lagu langsung punya ID video.
//  - Spotify                 : membaca halaman embed publik (tanpa login). Hanya sampai ~100 lagu pertama; lagu dicarikan versi YouTube-nya saat diputar.
//  - Apple Music             : membaca data di halaman publik playlist/album. Lagu dicarikan versi YouTube-nya saat diputar.
// Spotify & Apple Music bukan API resmi (format halaman bisa berubah), jadi kalau gagal klien menyarankan impor lewat file CSV.
// YouTube: kalau YouTube Data API gagal (key belum diatur / kuota habis), otomatis dicoba lewat halaman publik playlist (tanpa kuota).
// POST /api/import  {items:[{t:judul,a:artis},...]} (maks 30) -> { covers:[url|''...] }  : cover album untuk lagu hasil impor CSV/Spotify/Apple
//   (Deezer, lalu iTunes; tanpa API key). Ada di file ini supaya jumlah fungsi Vercel tidak bertambah.
// Keamanan: yang di-fetch hanya URL yang kita susun sendiri dari ID hasil validasi di host tetap, bukan URL mentah dari pengguna.
const { r, ip, body } = require('./_r');
const { guard } = require('./_guard');
const { cors } = require('./_cors');

const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const MAX = 500;
const decode = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'");
const clip = (s, n) => decode(s).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

async function get(url, accept, extra, ms, manual) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), ms || 9000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: manual ? 'manual' : 'follow', headers: Object.assign({ 'user-agent': UA, 'accept': accept || '*/*', 'accept-language': 'en-US,en;q=0.8' }, extra || {}) });
    return res;
  } finally { clearTimeout(t); }
}

// ---------- YouTube / YouTube Music ----------
async function youtube(listId) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw Object.assign(new Error('YOUTUBE_API_KEY belum diatur di server'), { code: 500 });
  const base = 'https://www.googleapis.com/youtube/v3';
  let name = '';
  try {
    const pr = await get(`${base}/playlists?part=snippet&id=${listId}&key=${key}`, 'application/json');
    const pj = await pr.json();
    name = clip(pj.items && pj.items[0] && pj.items[0].snippet && pj.items[0].snippet.title, 60);
  } catch (e) {}
  const tracks = [];
  let token = '';
  for (let page = 0; page < 10 && tracks.length < MAX; page++) {
    const res = await get(`${base}/playlistItems?part=snippet&maxResults=50&playlistId=${listId}${token ? '&pageToken=' + token : ''}&key=${key}`, 'application/json');
    const j = await res.json();
    if (!res.ok) {
      const reason = j && j.error && j.error.errors && j.error.errors[0] && j.error.errors[0].reason;
      if (res.status === 404 || reason === 'playlistNotFound') throw Object.assign(new Error('Playlist tidak ditemukan atau bersifat privat'), { code: 404 });
      if (reason === 'quotaExceeded') throw Object.assign(new Error('Kuota YouTube hari ini habis, coba lagi besok'), { code: 429 });
      throw Object.assign(new Error('YouTube menolak permintaan'), { code: 502 });
    }
    for (const it of j.items || []) {
      const sn = it.snippet || {}, id = sn.resourceId && sn.resourceId.videoId;
      const title = clip(sn.title, 160);
      if (!id || !title || /^(Private video|Deleted video)$/i.test(title)) continue;
      const th = sn.thumbnails || {};
      tracks.push({
        id, title,
        artist: clip(String(sn.videoOwnerChannelTitle || sn.channelTitle || 'YouTube').replace(/ - Topic$/, ''), 80),
        thumb: (th.high && th.high.url) || (th.medium && th.medium.url) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
      });
    }
    token = j.nextPageToken || '';
    if (!token) break;
  }
  return { name: name || 'Playlist YouTube', tracks };
}

// ---------- util: telusuri JSON bersarang ----------
function walk(o, fn, depth = 0, max = 14) {
  if (!o || typeof o !== 'object' || depth > max) return;
  fn(o);
  if (Array.isArray(o)) { for (const x of o) walk(x, fn, depth + 1, max); }
  else { for (const k of Object.keys(o)) walk(o[k], fn, depth + 1, max); }
}
const scriptJson = (html, re) => { const m = html.match(re); if (!m) return null; try { return JSON.parse(m[1]); } catch (e) { return null; } };

// Cadangan tanpa kuota: baca halaman publik playlist (maks ~100 lagu pertama)
async function youtubeScrape(listId) {
  const res = await get(`https://www.youtube.com/playlist?list=${listId}&hl=en`, 'text/html', { cookie: 'CONSENT=YES+1; SOCS=CAI' });
  if (!res.ok) throw Object.assign(new Error('Playlist tidak ditemukan atau bersifat privat'), { code: 404 });
  const html = await res.text();
  const data = scriptJson(html, /var ytInitialData = (\{[\s\S]*?\});\s*<\/script>/);
  if (!data) throw Object.assign(new Error('Halaman playlist YouTube tidak bisa dibaca'), { code: 502 });
  const txt = (x) => (x && (x.simpleText || (x.runs && x.runs.map(a => a.text).join('')))) || '';
  let name = '';
  try { name = clip(data.metadata.playlistMetadataRenderer.title, 60); } catch (e) {}
  const tracks = [], seen = new Set();
  walk(data, (o) => {
    const v = o.playlistVideoRenderer;
    if (!v || !v.videoId || seen.has(v.videoId) || tracks.length >= MAX) return;
    const title = clip(txt(v.title), 160);
    if (!title || /^\[?(Private video|Deleted video)\]?$/i.test(title) || v.isPlayable === false) return;
    seen.add(v.videoId);
    const th = v.thumbnail && v.thumbnail.thumbnails;
    tracks.push({
      id: v.videoId, title,
      artist: clip(txt(v.shortBylineText).replace(/ - Topic$/, '') || 'YouTube', 80),
      thumb: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`
    });
  }, 0, 30);
  if (!tracks.length) throw Object.assign(new Error('Daftar lagu playlist tidak ditemukan (mungkin privat)'), { code: 404 });
  return { name: name || 'Playlist YouTube', tracks };
}

async function youtubeAny(listId) {
  if (/^(RD|UL|RDMM)/.test(listId)) throw Object.assign(new Error('Mix / Radio YouTube dibuat otomatis dan tidak bisa diimpor. Pakai link playlist biasa (list=PL…).'), { code: 400 });
  try { return await youtube(listId); }
  catch (e) {
    if (e.code === 404 || e.code === 400) throw e;
    try { return await youtubeScrape(listId); } catch (e2) { throw e.code === 429 || e.code === 500 ? e : e2; }
  }
}

// ---------- Spotify ----------
async function spotify(kind, id) {
  const res = await get(`https://open.spotify.com/embed/${kind}/${id}`, 'text/html');
  if (!res.ok) throw Object.assign(new Error('Spotify tidak bisa dibuka (playlist privat atau diblokir)'), { code: 404 });
  const html = await res.text();
  const data = scriptJson(html, /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!data) throw Object.assign(new Error('Format halaman Spotify tidak dikenali'), { code: 502 });
  let name = '', tracks = [];
  walk(data, (o) => {
    if (!name && typeof o.name === 'string' && (o.type === 'playlist' || o.type === 'album' || o.uri === `spotify:${kind}:${id}`)) name = clip(o.name, 60);
    if (!tracks.length && Array.isArray(o.trackList) && o.trackList.length) {
      tracks = o.trackList.filter(t => t && typeof t.title === 'string').map(t => ({ title: clip(t.title, 160), artist: clip(t.subtitle || t.artists, 80) }));
    }
  });
  if (!tracks.length) throw Object.assign(new Error('Daftar lagu Spotify tidak ditemukan di halaman'), { code: 502 });
  return { name: name || 'Playlist Spotify', tracks };
}


// Link pendek Spotify (spotify.link / spotify.app.link): ikuti pengalihan, tapi hanya ke host Spotify
async function spotifyExpand(raw) {
  const okHost = (h) => h === 'spotify.link' || h === 'spotify.app.link' || h === 'open.spotify.com' || h.endsWith('.spotify.com');
  const pick = (u) => { const m = String(u).match(/open\.spotify\.com\/(?:intl-[a-z]{2,3}(?:-[A-Za-z]{2,4})?\/)?(playlist|album)\/([A-Za-z0-9]{10,30})/); return m ? { kind: m[1], id: m[2] } : null; };
  let cur = raw;
  for (let i = 0; i < 5; i++) {
    let u; try { u = new URL(cur); } catch (e) { return null; }
    if (u.protocol !== 'https:' || !okHost(u.hostname.toLowerCase())) return null;
    const hit = pick(cur); if (hit) return hit;
    const res = await get(cur, 'text/html', null, 7000, true);
    const loc = res.headers.get('location');
    if (loc) { cur = new URL(loc, cur).toString(); continue; }
    const html = await res.text();
    return pick(html.replace(/\\u002F/g, '/').replace(/\\\//g, '/'));
  }
  return null;
}

// ---------- Apple Music ----------
async function apple(cc, kind, slug, id) {
  const res = await get(`https://music.apple.com/${cc}/${kind}/${slug}/${id}`, 'text/html');
  if (!res.ok) throw Object.assign(new Error('Apple Music tidak bisa dibuka (playlist privat atau diblokir)'), { code: 404 });
  const html = await res.text();
  const tracks = [], seen = new Set();
  const push = (title, artist) => {
    title = clip(title, 160); artist = clip(artist, 80);
    if (!title) return;
    const k = (artist + '|' + title).toLowerCase();
    if (seen.has(k)) return; seen.add(k); tracks.push({ title, artist });
  };
  let name = '';
  const ld = scriptJson(html, /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  if (ld) {
    walk(ld, (o) => {
      if (!name && typeof o.name === 'string' && /Music(Playlist|Album)/.test(String(o['@type']))) name = clip(o.name, 60);
      if (o['@type'] === 'MusicRecording' && o.name) {
        const by = Array.isArray(o.byArtist) ? o.byArtist.map(a => a && a.name).filter(Boolean).join(', ') : (o.byArtist && o.byArtist.name) || '';
        push(o.name, by);
      }
    });
  }
  const noArtist = tracks.length && tracks.every(t => !t.artist);
  if (!tracks.length || noArtist) {
    const sd = scriptJson(html, /<script[^>]*id="serialized-server-data"[^>]*>([\s\S]*?)<\/script>/);
    if (sd) {
      const alt = [];
      walk(sd, (o) => { if (typeof o.title === 'string' && typeof o.artistName === 'string' && o.title) alt.push([o.title, o.artistName]); });
      if (alt.length >= tracks.length) { tracks.length = 0; seen.clear(); alt.forEach(a => push(a[0], a[1])); }
    }
  }
  if (!name) { const m = html.match(/<meta property="og:title" content="([^"]+)"/); if (m) name = clip(m[1].replace(/\s+on Apple Music.*$/i, ''), 60); }
  if (!tracks.length) throw Object.assign(new Error('Daftar lagu Apple Music tidak ditemukan di halaman'), { code: 502 });
  return { name: name || 'Playlist Apple Music', tracks };
}

function detect(raw) {
  let u; try { u = new URL(String(raw || '').trim()); } catch (e) { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.toLowerCase().replace(/^www\./, '');
  if (h === 'youtube.com' || h === 'm.youtube.com' || h === 'music.youtube.com' || h === 'youtu.be') {
    const l = u.searchParams.get('list');
    return l && /^[\w-]{10,60}$/.test(l) ? { src: 'youtube', list: l } : { src: 'youtube', list: '' };
  }
  if (h === 'open.spotify.com' || h === 'play.spotify.com' || h === 'embed.spotify.com') {
    const m = u.pathname.match(/\/(playlist|album)\/([A-Za-z0-9]{10,30})/);
    return m ? { src: 'spotify', kind: m[1], id: m[2] } : { src: 'spotify', id: '' };
  }
  if (h === 'spotify.link' || h === 'spotify.app.link') return { src: 'spotify', short: u.toString(), id: '' };
  if (h === 'music.apple.com') {
    const m = u.pathname.match(/^\/([a-z]{2})\/(playlist|album)\/([^/]+)\/([\w.-]+)/i);
    if (m && /^[\w%.\-]+$/.test(m[3]) && /^(pl\.[\w-]+|\d+)$/.test(m[4])) return { src: 'apple', cc: m[1].toLowerCase(), kind: m[2].toLowerCase(), slug: m[3], id: m[4] };
    return { src: 'apple', id: '' };
  }
  return { src: '' };
}


// ---------- Cover lagu (Deezer -> iTunes), tanpa API key ----------
const COVERS = new Map();
const nz = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const baseTitle = (x) => clip(x, 160).replace(/\s*[\(\[][^)\]]*[\)\]]/g, '').replace(/\s+-\s+(remaster|remastered|live|version|radio|single|mono|stereo|from|original|acoustic)\b.*$/i, '').replace(/\s+(feat|ft)\.?\s.*$/i, '').trim();
const baseArtist = (x) => clip(x, 100).split(/\s*(?:,|;|&|\sfeat\.?\s|\sft\.?\s|\sx\s)\s*/i)[0].trim();
const related = (a, b) => { a = nz(a); b = nz(b); return !!a && !!b && (a.includes(b) || b.includes(a) || a.split(' ').some(w => w.length > 3 && b.split(' ').includes(w))); };

async function deezerCover(t, a) {
  const tries = a ? [`artist:"${a}" track:"${t}"`, `${a} ${t}`] : [t];
  for (const q of tries) {
    const res = await get('https://api.deezer.com/search?limit=4&q=' + encodeURIComponent(q), 'application/json', null, 4500);
    if (!res.ok) continue;
    const j = await res.json().catch(() => null);
    for (const it of (j && j.data) || []) {
      const img = it && it.album && (it.album.cover_big || it.album.cover_medium);
      if (!img || !/^https:\/\/[\w.-]*dzcdn\.net\//.test(img) || /\/images\/cover\/\/|\/cover\/0{20,}/.test(img)) continue;
      if (!related(it.title, t) || (a && !related(it.artist && it.artist.name, a))) continue;
      return img;
    }
  }
  return '';
}
async function itunesCover(t, a) {
  const res = await get('https://itunes.apple.com/search?media=music&entity=song&limit=4&term=' + encodeURIComponent((a + ' ' + t).trim()), 'application/json', null, 4500);
  if (!res.ok) return '';
  const j = await res.json().catch(() => null);
  for (const it of (j && j.results) || []) {
    const img = it && it.artworkUrl100;
    if (!img || !/^https:\/\/[\w.-]*mzstatic\.com\//.test(img)) continue;
    if (!related(it.trackName, t) || (a && !related(it.artistName, a))) continue;
    return img.replace(/\/\d+x\d+(bb)?\.(jpg|png|webp)$/i, '/500x500bb.jpg');
  }
  return '';
}
async function coverFor(title, artist) {
  const t = baseTitle(title) || clip(title, 100), a = baseArtist(artist);
  if (!t) return '';
  const key = nz(a + ' ' + t);
  if (COVERS.has(key)) return COVERS.get(key);
  let url = '';
  try { url = await deezerCover(t, a); } catch (e) {}
  if (!url) { try { url = await itunesCover(t, a); } catch (e) {} }
  if (url) { if (COVERS.size > 4000) COVERS.clear(); COVERS.set(key, url); }
  return url;
}
async function covers(q, s) {
  if (await guard(q, s)) return;
  try {
    const rk = 'lncov:' + ip(q), n = await r('INCR', rk); if (n === 1) await r('EXPIRE', rk, 60);
    if (n > 40) return s.status(429).json({ error: 'Terlalu sering, coba lagi sebentar' });
  } catch (e) {}
  const items = Array.isArray(body(q).items) ? body(q).items.slice(0, 30) : [];
  if (!items.length) return s.status(400).json({ error: 'items kosong' });
  const out = new Array(items.length).fill(''), deadline = Date.now() + 8000;
  let next = 0;
  const worker = async () => {
    while (next < items.length && Date.now() < deadline) {
      const i = next++, it = items[i] || {};
      try { out[i] = await coverFor(it.t, it.a); } catch (e) {}
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return s.status(200).json({ covers: out });
}

module.exports = async (q, s) => {
  // Batas paket Hobby Vercel = 12 fungsi. /api/config dan /api/resolve digabung ke sini lewat rewrite di vercel.json
  // (file aslinya jadi api/_config.js dan api/_resolve.js; awalan _ = bukan fungsi). Alamat lama tetap berfungsi.
  const fn = q.query && q.query._fn;
  if (fn === 'config') return require('./_config')(q, s);
  if (fn === 'resolve') return require('./_resolve')(q, s);
  if (cors(q, s)) return;
  s.setHeader('Cache-Control', 'no-store');
  if (q.method === 'POST') return covers(q, s);
  if (q.method !== 'GET') return s.status(405).json({ error: 'Metode tidak didukung' });
  if (await guard(q, s)) return;
  const fail = (c, m) => s.status(c).json({ error: m });
  try {
    const rk = 'lnimp:' + ip(q), n = await r('INCR', rk); if (n === 1) await r('EXPIRE', rk, 60);
    if (n > 12) return fail(429, 'Terlalu sering, coba lagi sebentar');
  } catch (e) {}
  const d = detect((q.query && q.query.url) || '');
  if (!d || !d.src) return fail(400, 'Link tidak dikenali. Gunakan link playlist YouTube, YouTube Music, Spotify, atau Apple Music');
  try {
    let out;
    if (d.src === 'youtube') {
      if (!d.list) return fail(400, 'Ini link video, bukan playlist (harus ada bagian list=…)');
      out = await youtubeAny(d.list);
    } else if (d.src === 'spotify') {
      if (d.short) { const x = await spotifyExpand(d.short); if (x) { d.kind = x.kind; d.id = x.id; } }
      if (!d.id) return fail(400, 'Link Spotify harus berupa playlist atau album (bukan lagu / artis)');
      out = await spotify(d.kind, d.id);
    } else {
      if (!d.id) return fail(400, 'Link Apple Music harus berupa playlist atau album');
      out = await apple(d.cc, d.kind, d.slug, d.id);
    }
    const tracks = out.tracks.slice(0, MAX);
    return s.status(200).json({ source: d.src, name: out.name, total: tracks.length, tracks });
  } catch (e) {
    return fail(e.code || 502, e.name === 'AbortError' ? 'Server tujuan tidak merespons' : (e.message || 'Gagal mengambil playlist'));
  }
};
module.exports._test = { detect, baseTitle, baseArtist, related };
