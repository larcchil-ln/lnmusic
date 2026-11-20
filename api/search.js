// Vercel Serverless Function: /api/search
// Key YouTube disimpan di Environment Variable Vercel: YOUTUBE_API_KEY
//
// Pemakaian:
//   /api/search?q=tulus&mode=music            -> cari lagu (kategori Music)
//   /api/search?q=film&mode=video&short=1     -> cari video (short=1: durasi pendek)
//   /api/search?chart=1&region=ID             -> lagu terpopuler per negara
//
// Kuota gratis YouTube = 10.000 unit/hari. search.list = 100 unit (jadi ~100 pencarian/hari),
// videos.list (chart) = 1 unit. Karena itu hasil di-cache di edge Vercel supaya hemat kuota.

const YT = 'https://www.googleapis.com/youtube/v3';

const decode = (s) => String(s || '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");

const toTrack = (id, sn, isVideo) => ({
  id,
  title: decode(sn.title),
  artist: decode(String(sn.channelTitle || 'YouTube').replace(/ - Topic$/, '')),
  thumb: (sn.thumbnails && ((sn.thumbnails.high && sn.thumbnails.high.url) ||
          (sn.thumbnails.medium && sn.thumbnails.medium.url) ||
          (sn.thumbnails.default && sn.thumbnails.default.url))) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  type: 'youtube',
  isVideo: !!isVideo
});

module.exports = async (req, res) => {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(500).json({ error: 'YOUTUBE_API_KEY belum diatur di Vercel' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metode tidak didukung' });

  const { q = '', mode = 'music', short = '', chart = '', region = 'ID' } = req.query || {};
  const isVideo = mode === 'video';

  try {
    let url, items;

    if (chart) {
      const rc = /^[A-Za-z]{2}$/.test(region) ? region.toUpperCase() : 'ID';
      url = `${YT}/videos?part=snippet&chart=mostPopular&videoCategoryId=10&regionCode=${rc}&maxResults=50&key=${key}`;
      const r = await fetch(url);
      const d = await r.json();
      if (!r.ok) throw Object.assign(new Error((d.error && d.error.message) || 'YouTube error'), { status: r.status });
      items = (d.items || []).map(i => toTrack(i.id, i.snippet, false));
      res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=43200'); // 6 jam
      return res.status(200).json({ items });
    }

    const query = String(q).trim().slice(0, 120);
    if (!query) return res.status(400).json({ error: 'Parameter q kosong' });

    const p = new URLSearchParams({
      part: 'snippet', type: 'video', maxResults: '12', q: query, key,
      safeSearch: 'none'
    });
    if (!isVideo) p.set('videoCategoryId', '10');
    if (short) p.set('videoDuration', 'short');

    const r = await fetch(`${YT}/search?${p.toString()}`);
    const d = await r.json();
    if (!r.ok) throw Object.assign(new Error((d.error && d.error.message) || 'YouTube error'), { status: r.status });

    items = (d.items || [])
      .filter(i => i.id && i.id.videoId)
      .map(i => toTrack(i.id.videoId, i.snippet, isVideo));

    // cache 1 jam di edge; pencarian yang sama tidak memakai kuota lagi
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json({ items });
  } catch (e) {
    // jangan di-cache; client otomatis pindah ke Piped/Invidious
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: e.message || 'Gagal menghubungi YouTube', status: e.status || 0 });
  }
};
