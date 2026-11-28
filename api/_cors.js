// CORS untuk aplikasi Android (Capacitor, origin https://localhost) dan web. Panggil di baris pertama handler:
//   if (cors(q, s)) return;   // true = permintaan preflight (OPTIONS) sudah dijawab
const ALLOWED = new Set(['https://lnmusic.web.id', 'https://lnmusic.vercel.app', 'https://localhost', 'http://localhost', 'capacitor://localhost', 'ionic://localhost']);
function cors(q, s) {
  const o = q.headers && q.headers.origin;
  if (o && ALLOWED.has(o)) {
    s.setHeader('Access-Control-Allow-Origin', o);
    s.setHeader('Vary', 'Origin');
    s.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    s.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token, Cache-Control');
    s.setHeader('Access-Control-Max-Age', '86400');
  }
  if (q.method === 'OPTIONS') { s.status(204).end(); return true; }
  return false;
}
module.exports = { cors };
