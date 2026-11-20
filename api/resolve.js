// Vercel Serverless Function: /api/resolve
// Hanya untuk link pendek TikTok (vt.tiktok.com, vm.tiktok.com, tiktok.com/t/...).
// Mengikuti pengalihan (redirect) untuk mendapatkan ID video, supaya video bisa diputar lewat embed resmi TikTok.
// Tidak mengambil isi halaman. Tujuan pengalihan harus tetap di domain tiktok.com.

const isTikTok = (h) => h === 'tiktok.com' || h.endsWith('.tiktok.com');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metode tidak didukung' });

  let u;
  try { u = new URL(String((req.query || {}).u || '')); } catch (e) { return res.status(400).json({ error: 'Link tidak valid' }); }
  const h = u.hostname.toLowerCase();
  const allowed = u.protocol === 'https:' && !u.username && !u.password &&
    (h === 'vt.tiktok.com' || h === 'vm.tiktok.com' || ((h === 'www.tiktok.com' || h === 'tiktok.com') && u.pathname.startsWith('/t/')));
  if (!allowed) return res.status(400).json({ error: 'Hanya link pendek TikTok yang didukung' });

  try {
    let cur = u.toString();
    for (let i = 0; i < 4; i++) {
      const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(cur, { redirect: 'manual', signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' } });
      clearTimeout(t);
      const loc = r.headers.get('location');
      if (!loc) break;
      const next = new URL(loc, cur);
      if (next.protocol !== 'https:' || !isTikTok(next.hostname.toLowerCase())) {
        return res.status(502).json({ error: 'Tujuan pengalihan tidak diizinkan' });
      }
      const m = next.pathname.match(/\/video\/(\d{8,25})/);
      if (m) {
        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
        return res.status(200).json({ id: m[1], user: (next.pathname.match(/\/(@[\w.]+)\//) || [])[1] || '' });
      }
      cur = next.toString();
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).json({ error: 'ID video tidak ditemukan' });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'Gagal mengikuti link' });
  }
};
