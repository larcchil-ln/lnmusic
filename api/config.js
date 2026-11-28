// Endpoint publik & ringan (bukan admin): memberi tahu frontend fitur mana yang sedang dimatikan lewat dashboard admin.
// Sengaja tidak butuh token, cuma data baca, tidak ada yang rahasia di sini.
const { r } = require('./_r');
module.exports = async (q, s) => {
  if (require('./_cors').cors(q, s)) return;
  s.setHeader('Cache-Control', 'no-store');
  let cfg = {};
  try { cfg = JSON.parse((await r('GET', 'lncfg')) || '{}'); } catch (e) {}
  s.json({ anatomyOff: !!cfg.anatomyOff });
};
