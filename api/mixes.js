// /api/mixes?region=ID  -> "Mix" per genre (Pop, Rock, Jazz, Metal) dari tangga lagu Apple Music yang diperbarui harian.
// Sumber 1: feed RSS iTunes per genre (tanpa kunci). Kalau storefront negara sedikit isinya, ditambah dari storefront US.
// Sumber 2 (cadangan): iTunes Search API untuk daftar artis, diurutkan dari rilis terbaru.
// Lagu ditandai lazy:true -> dicarikan versi YouTube-nya saat diputar (lihat ln-trending.js).

const GENRES = [
  { key: 'pop',   title: 'Pop Mix',   genre: 14,   color: '#ec4899', match: /pop/i,
    artists: ['Dua Lipa', 'Sabrina Carpenter', 'Taylor Swift', 'Ed Sheeran', 'Bruno Mars', 'Billie Eilish', 'Olivia Rodrigo', 'Raisa', 'Tulus', 'Rossa'] },
  { key: 'rock',  title: 'Rock Mix',  genre: 21,   color: '#f97316', match: /rock|alternative|indie/i,
    artists: ['Imagine Dragons', 'Foo Fighters', 'Arctic Monkeys', 'Green Day', 'Coldplay', 'Weird Genius', 'Sheila On 7', 'Dewa 19', 'Noah', 'Kunto Aji'] },
  { key: 'jazz',  title: 'Jazz Mix',  genre: 11,   color: '#eab308', match: /jazz|vocal|soul/i,
    artists: ['Norah Jones', 'Michael Buble', 'Jacob Collier', 'Laufey', 'Diana Krall', 'Kenny G', 'Maliq & D\'Essentials', 'Andien', 'Rendy Pandugo', 'Fourplay'] },
  { key: 'metal', title: 'Metal Mix', genre: 1153, color: '#94a3b8', match: /metal|rock/i,
    artists: ['Metallica', 'Bring Me The Horizon', 'Avenged Sevenfold', 'Slipknot', 'Bullet For My Valentine', 'Lamb of God', 'Sepultura', 'Burgerkill', 'Seringai', 'Tool'] }
];

const PER_MIX = 25;
const big = (u) => String(u || '').replace(/\/\d+x\d+(bb)?\.(jpg|png|webp)$/i, '/500x500bb.$2');
const toTrack = (id, title, artist, thumb) => ({
  id: 'am:' + id, appleId: String(id), lazy: true, title, artist: artist || 'Apple Music',
  thumb: big(thumb), type: 'youtube', isVideo: false
});

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}

async function chart(cc, genre, limit) {
  const d = await getJson(`https://itunes.apple.com/${cc}/rss/topsongs/limit=${limit}/genre=${genre}/json`);
  let en = d && d.feed && d.feed.entry; if (!en) return [];
  if (!Array.isArray(en)) en = [en];
  const out = [];
  for (const e of en) {
    const id = e.id && e.id.attributes && e.id.attributes['im:id'];
    const title = e['im:name'] && e['im:name'].label;
    const artist = e['im:artist'] && e['im:artist'].label;
    const imgs = e['im:image'] || [];
    const thumb = imgs.length ? imgs[imgs.length - 1].label : '';
    if (id && title && thumb) out.push(toTrack(id, title, artist, thumb));
  }
  return out;
}

async function bySearch(cc, g) {
  const rows = await Promise.all(g.artists.map(a =>
    getJson(`https://itunes.apple.com/search?term=${encodeURIComponent(a)}&entity=song&limit=6&country=${cc}`)
      .then(d => d.results || []).catch(() => [])));
  const seen = new Set(), all = [];
  for (const r of rows.flat()) {
    if (!r || !r.trackId || !r.trackName || !r.artworkUrl100 || seen.has(r.trackId)) continue;
    if (!g.match.test(String(r.primaryGenreName || ''))) continue;
    seen.add(r.trackId); all.push(r);
  }
  all.sort((a, b) => String(b.releaseDate || '').localeCompare(String(a.releaseDate || ''))); // terbaru dulu
  return all.map(r => toTrack(r.trackId, r.trackName, r.artistName, r.artworkUrl100));
}

async function buildMix(g, region) {
  const cc = region.toLowerCase();
  let items = [];
  try { items = await chart(cc, g.genre, 50); } catch (e) {}
  if (items.length < PER_MIX && cc !== 'us') {
    try {
      const have = new Set(items.map(t => t.id));
      items = items.concat((await chart('us', g.genre, 50)).filter(t => !have.has(t.id)));
    } catch (e) {}
  }
  if (items.length < 12) { try { items = await bySearch(cc, g); } catch (e) {} }
  // variasi artis: maksimal 2 lagu per artis supaya mix tidak monoton
  const per = {}, out = [];
  for (const t of items) { per[t.artist] = (per[t.artist] || 0) + 1; if (per[t.artist] <= 2) out.push(t); if (out.length >= PER_MIX) break; }
  return { key: g.key, title: g.title, color: g.color, tracks: out };
}

module.exports = async function handler(req, res) {
  const q = String((req.query && req.query.region) || 'ID').toUpperCase();
  const region = /^[A-Z]{2}$/.test(q) ? q : 'ID';
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
  try {
    const mixes = (await Promise.all(GENRES.map(g => buildMix(g, region)))).filter(m => m.tracks.length >= 4);
    if (!mixes.length) return res.status(502).json({ mixes: [] });
    res.status(200).json({ region, updated: new Date().toISOString(), mixes });
  } catch (e) { res.status(502).json({ mixes: [] }); }
};
module.exports._test = { chart, bySearch, buildMix, GENRES };
