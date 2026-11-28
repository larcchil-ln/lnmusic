// GET /api/import?url=<link playlist>  ->  { source, name, total, tracks: [...] }
//  - YouTube / YouTube Music : resmi lewat YouTube Data API (playlistItems, 1 unit kuota per 50 lagu). Lagu langsung punya ID video.
//  - Spotify                 : membaca halaman embed publik (tanpa login). Hanya sampai ~100 lagu pertama; lagu dicarikan versi YouTube-nya saat diputar.
//  - Apple Music             : membaca data di halaman publik playlist/album. Lagu dicarikan versi YouTube-nya saat diputar.
// Spotify & Apple Music bukan API resmi (format halaman bisa berubah), jadi kalau gagal klien menyarankan impor lewat file CSV.
// Keamanan: yang di-fetch hanya URL yang kita susun sendiri dari ID hasil validasi di host tetap, bukan URL mentah dari pengguna.
const { r, ip } = require('./_r');
const { guard } = require('./_guard');
const { cors } = require('./_cors');

const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const MAX = 500;
const decode = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'");
const clip = (s, n) => decode(s).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

async function get(url, accept) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': UA, 'accept': accept || '*/*', 'accept-language': 'en-US,en;q=0.8' } });
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
function walk(o, fn, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 14) return;
  fn(o);
  if (Array.isArray(o)) { for (const x of o) walk(x, fn, depth + 1); }
  else { for (const k of Object.keys(o)) walk(o[k], fn, depth + 1); }
}
const scriptJson = (html, re) => { const m = html.match(re); if (!m) return null; try { return JSON.parse(m[1]); } catch (e) { return null; } };

// ---------- Spotify ----------
async function spotify(kind, id) {
  const res = await get(`https://open.spotify.com/embed/${kind}/${id}`, 'text/html');
  if (!res.ok) throw Object.assign(new Error('Spotify tidak bisa dibuka (playlist privat atau diblokir)'), { code: 404 });
  const html = await res.text();
  const data = scriptJson(html, /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
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
  if (h === 'open.spotify.com' || h === 'spotify.link') {
    const m = u.pathname.match(/\/(playlist|album)\/([A-Za-z0-9]{10,30})/);
    return m ? { src: 'spotify', kind: m[1], id: m[2] } : { src: 'spotify', id: '' };
  }
  if (h === 'music.apple.com') {
    const m = u.pathname.match(/^\/([a-z]{2})\/(playlist|album)\/([^/]+)\/([\w.-]+)/i);
    if (m && /^[\w%.\-]+$/.test(m[3]) && /^(pl\.[\w-]+|\d+)$/.test(m[4])) return { src: 'apple', cc: m[1].toLowerCase(), kind: m[2].toLowerCase(), slug: m[3], id: m[4] };
    return { src: 'apple', id: '' };
  }
  return { src: '' };
}

module.exports = async (q, s) => {
  if (cors(q, s)) return;
  s.setHeader('Cache-Control', 'no-store');
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
      out = await youtube(d.list);
    } else if (d.src === 'spotify') {
      if (!d.id) return fail(400, 'Link Spotify harus berupa playlist atau album');
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
module.exports._test = { detect };
