// /api/trending?region=ID  -> lagu trending dari YouTube Music (chart), tanpa memakai akun YouTube pribadi.
// Sumber 1: tangga lagu YT Music (FEmusic_charts). Sumber 2 (cadangan): YouTube Data API, chart=mostPopular kategori Musik.
const walk = (o, out) => {
  if (!o || typeof o !== 'object') return;
  if (o.musicResponsiveListItemRenderer) out.push(o.musicResponsiveListItemRenderer);
  for (const k in o) walk(o[k], out);
};

function parseYTM(json) {
  const rs = []; walk(json, rs);
  const seen = new Set(), items = [];
  for (const r of rs) {
    const id = r.playlistItemData?.videoId ||
      r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
    if (!id || seen.has(id)) continue;
    const cols = r.flexColumns || [];
    const txt = i => (cols[i]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []).map(x => x.text).join('');
    const title = txt(0); if (!title) continue;
    const th = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
    seen.add(id);
    items.push({ id, title, artist: txt(1) || 'YouTube Music', thumb: th.length ? th[th.length - 1].url : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, type: 'youtube', isVideo: false });
    if (items.length >= 50) break;
  }
  return items;
}

async function fromYTMusic(region) {
  const r = await fetch('https://music.youtube.com/youtubei/v1/browse?prettyPrint=false', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://music.youtube.com', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20250101.01.00', hl: 'id', gl: region } },
      browseId: 'FEmusic_charts', formData: { selectedValues: [region] }
    })
  });
  if (!r.ok) throw new Error('ytmusic ' + r.status);
  const items = parseYTM(await r.json());
  if (!items.length) throw new Error('ytmusic kosong');
  return items;
}

const fmt = n => { n = +n || 0; return (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',').replace(/,0$/, '') + ' jt' : n >= 1e3 ? Math.round(n / 1e3) + ' rb' : String(n)) + ' x ditonton'; };

async function fromDataApi(region) {
  const key = process.env.YOUTUBE_API_KEY; if (!key) throw new Error('tanpa YOUTUBE_API_KEY');
  const u = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&videoCategoryId=10&regionCode=${region}&maxResults=50&key=${key}`;
  const r = await fetch(u); if (!r.ok) throw new Error('dataapi ' + r.status);
  const d = await r.json();
  const items = (d.items || []).map(v => ({
    id: v.id, title: v.snippet.title, artist: String(v.snippet.channelTitle || '').replace(/ - Topic$/, ''),
    thumb: v.snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
    views: fmt(v.statistics?.viewCount), type: 'youtube', isVideo: false
  }));
  if (!items.length) throw new Error('dataapi kosong');
  return items;
}

module.exports = async function handler(req, res) {
  const q = String((req.query && req.query.region) || 'ID').toUpperCase();
  const region = /^[A-Z]{2}$/.test(q) ? q : 'ID';
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
  for (const [source, fn] of [['ytmusic', fromYTMusic], ['youtube-music-category', fromDataApi]]) {
    try { return res.status(200).json({ source, region, items: await fn(region) }); } catch (e) {}
  }
  res.status(502).json({ items: [] });
};
