// Vercel Serverless Function: membuat kredensial TURN sementara dari Cloudflare.
// Token rahasia hanya ada di Environment Variables Vercel, tidak pernah sampai ke browser.
module.exports = async function handler(req, res) {
  const id = process.env.TURN_KEY_ID, token = process.env.TURN_KEY_API_TOKEN;
  res.setHeader('Cache-Control', 'no-store');
  if (!id || !token) return res.status(500).json({ error: 'TURN_KEY_ID atau TURN_KEY_API_TOKEN belum diatur di Vercel' });
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 86400 })
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.iceServers) return res.status(502).json({ error: 'Cloudflare menolak (HTTP ' + r.status + '), cek Key ID dan token' });
    const list = (Array.isArray(j.iceServers) ? j.iceServers : [j.iceServers])
      .filter(Boolean)
      // port 53 diblokir browser dan bikin timeout, jadi dibuang
      .map(s => ({ ...s, urls: [].concat(s.urls).filter(u => !/:53(\?|$)/.test(u)) }));
    return res.status(200).json({ iceServers: list });
  } catch (e) {
    return res.status(502).json({ error: 'Tidak bisa menghubungi Cloudflare' });
  }
};
