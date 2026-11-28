/* LNMusic — Tebak Gambar (gaya Gartic) di dalam room Bareng.
   Satu pemain menggambar clue, yang lain menjawab. Bisa berdua atau lebih. Suara/video call tetap jalan.
   Memakai koneksi room (PeerJS) yang sudah ada: pesan type "DRAW" otomatis diteruskan host ke semua peserta. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const peerOpen = () => { try { return connections.filter(c => c.open); } catch (e) { return []; } };
  const myId = () => { try { return peer.id || ''; } catch (e) { return ''; } };
  const myName = () => { try { return myDisplayName || 'Pemain'; } catch (e) { return 'Pemain'; } };
  const toast = t => { try { showToast(t); } catch (e) {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const send = m => { m.type = 'DRAW'; m.from = myId(); peerOpen().forEach(c => { try { c.send(m); } catch (e) {} }); };
  const emit = m => { send(m); onMsg(Object.assign({}, m, { type: 'DRAW', from: myId() })); };   // kirim + proses di sisi sendiri

  const DUR = 90, PICK_SECS = 20, REVEAL_MS = 6500, ALIVE_MS = 20000;
  const COLORS = ['#111827', '#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#92400e'];
  const SIZES = [5, 12, 26];
  const WORDS = ['kucing', 'anjing', 'ikan', 'ayam', 'sapi', 'kelinci', 'gajah', 'jerapah', 'kupu-kupu', 'burung hantu', 'rumah', 'pohon', 'bunga mawar', 'matahari', 'bulan', 'bintang', 'pelangi', 'hujan', 'petir', 'gunung', 'pantai', 'jembatan', 'sepeda', 'motor', 'mobil', 'pesawat', 'kapal', 'kereta api', 'helikopter', 'roket', 'laptop', 'handphone', 'headphone', 'kamera', 'gitar', 'piano', 'mikrofon', 'jam tangan', 'kacamata', 'payung', 'topi', 'sepatu', 'tas', 'kunci', 'lampu', 'kursi', 'pintu', 'buku', 'nasi goreng', 'bakso', 'sate', 'pizza', 'burger', 'es krim', 'kopi', 'pisang', 'apel', 'semangka', 'durian', 'mie instan', 'kue ulang tahun', 'balon', 'kado', 'cincin', 'cokelat', 'pelukan', 'jantung', 'senyum', 'menangis', 'tidur', 'berenang', 'menari', 'memancing', 'selfie', 'video call', 'nonton film', 'dengar musik', 'hantu', 'naga', 'robot', 'astronot', 'dokter', 'polisi', 'pemadam kebakaran', 'raja', 'putri', 'superhero', 'api unggun', 'salju', 'tenda', 'kembang api', 'lumba-lumba', 'hiu', 'kepiting', 'monyet', 'pinguin'];

  // ---------- util ----------
  function cyrb53(s) { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return 4294967296 * (2097151 & h2) + (h1 >>> 0); }
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const hashOf = (w, r) => cyrb53(norm(w) + '|' + r + '|ld');
  const lensOf = w => String(w).trim().split(/\s+/).map(x => x.replace(/[^\p{L}\p{N}]/gu, '').length).filter(Boolean);
  function maskOf(word, rev) {   // rev: Set indeks huruf yang dibuka
    let k = 0; return String(word).trim().split(/\s+/).map(w => Array.from(w).filter(ch => /[\p{L}\p{N}]/u.test(ch)).map(ch => { const s = rev && rev.has(k) ? ch.toUpperCase() : '_'; k++; return s; }).join(' ')).filter(Boolean).join('   ');
  }
  const maskFromLens = sp => sp.map(n => Array(n).fill('_').join(' ')).join('   ');

  // ---------- state ----------
  const S = {
    phase: 'off', players: {}, joinT: 0, ord: [], R: 0, r: 0, drawer: '', scores: {}, strokes: [], hash: 0, sp: [], mask: '', word: '', t0: 0, dur: DUR,
    got: {}, choices: [], pickEnd: 0, revealEnd: 0, revealWord: '', hintAt: [], hintN: 0, revSet: new Set(), color: COLORS[0], size: 1, eraser: false,
    log: [], si: 0, cur: null, used: new Set(), open: false, invite: null, over: ''
  };
  const alive = () => Object.keys(S.players).filter(id => id === myId() || Date.now() - S.players[id].seen < ALIVE_MS);
  const master = () => { const a = alive().sort((x, y) => (S.players[x].t - S.players[y].t) || (x < y ? -1 : 1)); return a[0] || ''; };
  const imMaster = () => master() === myId();
  const nameOf = id => id === myId() ? 'Kamu' : ((S.players[id] && S.players[id].n) || 'Pemain');
  const inGame = () => S.phase !== 'off';
  const canDraw = () => S.phase === 'draw' && S.drawer === myId();
  function addLog(t, cls) { S.log.push({ t, cls: cls || '' }); if (S.log.length > 60) S.log.shift(); }

  // ---------- UI ----------
  const css = document.createElement('style');
  css.textContent = `
  #ld-card{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:20px;background:linear-gradient(110deg,rgba(34,211,106,.16),rgba(34,211,106,.05));border:1px solid rgba(34,211,106,.28)}
  #ld-card.pulse{animation:ldp 1.1s ease-in-out infinite}@keyframes ldp{50%{box-shadow:0 0 0 6px rgba(34,211,106,.18)}}
  #ld-card .ic{flex:none;width:46px;height:46px;border-radius:14px;display:grid;place-items:center;font-size:24px;background:linear-gradient(100deg,#16a34a,#22d36a)}
  #ld-card .tx{flex:1;min-width:0}#ld-card .tx b{display:block;font-size:.95rem;color:#fff}#ld-card .tx small{display:block;margin-top:2px;font-size:.74rem;color:#a1a1ab;line-height:1.4}
  #ld-card button{flex:none;height:40px;padding:0 18px;border-radius:999px;border:0;font-weight:800;font-size:.84rem;color:#04210f;background:linear-gradient(100deg,#16a34a,#22d36a);cursor:pointer}
  #ld{position:fixed;inset:0;z-index:2147482000;display:none;flex-direction:column;background:#07070a;color:#fff;height:100dvh;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);font-family:inherit}
  #ld.on{display:flex}
  .ld-top{flex:none;display:flex;align-items:center;gap:10px;padding:10px 12px}
  .ld-top .t{flex:1;min-width:0;font-weight:800;font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ld-top .tm{min-width:52px;text-align:center;font-weight:800;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.08);font-variant-numeric:tabular-nums}
  .ld-b{height:38px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#e4e4ee;font-weight:700;font-size:.8rem;cursor:pointer}
  .ld-b.p{border:0;color:#04210f;background:linear-gradient(100deg,#16a34a,#22d36a)}.ld-b.d{color:#fda4af}
  .ld-sc{flex:none;display:flex;gap:8px;overflow-x:auto;padding:0 12px 8px;scrollbar-width:none}.ld-sc::-webkit-scrollbar{display:none}
  .ld-sc i{flex:none;font-style:normal;font-size:.76rem;font-weight:700;padding:6px 11px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.08)}
  .ld-sc i.dr{border-color:rgba(34,211,106,.6);background:rgba(34,211,106,.14)}.ld-sc i.ok{color:#4ade80}
  .ld-main{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;padding:0 12px 10px}
  .ld-stage{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;gap:8px}
  .ld-word{flex:none;font-size:1.25rem;font-weight:800;letter-spacing:.08em;text-align:center;min-height:1.6em;color:#86efac;white-space:pre}
  .ld-cvw{position:relative;flex:1;min-height:0;width:100%;display:flex;align-items:center;justify-content:center}
  .ld-box{position:relative;max-width:100%;max-height:100%;aspect-ratio:4/3;height:100%;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 10px 36px -14px rgba(0,0,0,.8)}
  .ld-box canvas{display:block;width:100%;height:100%;touch-action:none}
  .ld-ovl{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;text-align:center;background:rgba(7,7,10,.9);overflow-y:auto}
  .ld-ovl.on{display:flex}.ld-ovl h3{font-size:1.15rem;font-weight:800}.ld-ovl p{font-size:.82rem;color:#b4b4c0;line-height:1.5}
  .ld-ovl .ls{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}.ld-ovl .ls span{padding:5px 11px;border-radius:999px;background:rgba(255,255,255,.08);font-size:.78rem;font-weight:700}
  .ld-ovl .ch{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}.ld-ovl .ch button{padding:10px 16px;font-size:.9rem}
  .ld-ovl .cu{display:flex;gap:6px;width:100%;max-width:340px}.ld-ovl input{flex:1;min-width:0;height:42px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);color:#fff;padding:0 12px;font-size:.9rem;outline:none}
  .ld-ovl .pd{width:100%;max-width:320px;display:flex;flex-direction:column;gap:6px;text-align:left}.ld-ovl .pd div{display:flex;justify-content:space-between;padding:8px 12px;border-radius:12px;background:rgba(255,255,255,.06);font-size:.85rem;font-weight:700}
  .ld-tools{flex:none;display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap}
  .ld-tools .cl{width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,.25);cursor:pointer;padding:0}.ld-tools .cl.on{border-color:#fff;transform:scale(1.15)}
  .ld-tools .sz{width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);display:grid;place-items:center;cursor:pointer;padding:0}.ld-tools .sz.on{border-color:#22d36a}.ld-tools .sz s{display:block;border-radius:50%;background:#fff}
  .ld-tools .tb{height:34px;padding:0 11px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#e4e4ee;font-size:.78rem;font-weight:700;cursor:pointer}.ld-tools .tb.on{border-color:#22d36a;color:#86efac}
  .ld-side{flex:none;display:flex;flex-direction:column;gap:8px}
  .ld-log{height:84px;overflow-y:auto;border-radius:14px;background:rgba(255,255,255,.05);padding:8px 10px;font-size:.78rem;line-height:1.5;display:flex;flex-direction:column;gap:2px}
  .ld-log .ok{color:#4ade80;font-weight:700}.ld-log .sy{color:#a1a1ab}.ld-log b{color:#fff}
  .ld-gr{display:flex;gap:8px}.ld-gr input{flex:1;min-width:0;height:46px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);color:#fff;padding:0 16px;font-size:.95rem;outline:none}
  .ld-gr input:focus{border-color:#22d36a}.ld-gr button{height:46px;padding:0 20px;border-radius:999px;border:0;font-weight:800;color:#04210f;background:linear-gradient(100deg,#16a34a,#22d36a);cursor:pointer}
  .ld-gr input:disabled,.ld-gr button:disabled{opacity:.45}
  @supports (width:1cqw){.ld-stage{container-type:size;justify-content:center}.ld-cvw{flex:none;min-height:0}.ld-box{height:auto;max-height:none;width:min(100cqw,calc((100cqh - 150px) * 1.3333))}}
  @media (orientation:landscape) and (max-height:520px){
    .ld-main{flex-direction:row;gap:12px}.ld-stage{flex:1.6}.ld-box{width:min(100cqw,calc((100cqh - 92px) * 1.3333))}.ld-tools{flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;scrollbar-width:none}.ld-tools .cl{width:22px;height:22px;flex:none}.ld-tools .sz{width:28px;height:28px;flex:none}.ld-tools .tb{height:28px;padding:0 9px;font-size:.7rem;flex:none}.ld-side{flex:1;min-width:0;min-height:0}.ld-log{flex:1;height:auto}
    .ld-top{padding:6px 12px}.ld-word{font-size:1rem}
  }`;
  document.head.appendChild(css);

  const ui = document.createElement('div');
  ui.id = 'ld';
  ui.innerHTML =
    '<div class="ld-top"><button class="ld-b" id="ld-min" aria-label="Kecilkan" title="Kecilkan (game tetap jalan)" style="width:42px;padding:0;font-size:1.1rem">⌄</button><div class="t">🎨 Tebak Gambar</div><div class="tm" id="ld-tm">--</div><button class="ld-b d" id="ld-leave">Keluar</button></div>' +
    '<div class="ld-sc" id="ld-sc"></div>' +
    '<div class="ld-main"><div class="ld-stage"><div class="ld-word" id="ld-word"></div>' +
    '<div class="ld-cvw"><div class="ld-box"><canvas id="ld-cv" width="800" height="600"></canvas><div class="ld-ovl" id="ld-ovl"></div></div></div>' +
    '<div class="ld-tools" id="ld-tools"></div></div>' +
    '<div class="ld-side"><div class="ld-log" id="ld-log"></div><div class="ld-gr"><input id="ld-in" maxlength="40" placeholder="Ketik jawabanmu..." autocomplete="off" /><button id="ld-send">Kirim</button></div></div></div>';
  document.body.appendChild(ui);
  const cv = $('ld-cv'), g = cv.getContext('2d');
  g.lineCap = 'round'; g.lineJoin = 'round';

  // ---------- kanvas ----------
  const X = v => v * cv.width / 1000, Y = v => v * cv.height / 1000;
  function clearCv() { g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); }
  function seg(c, w, p, from) {      // gambar titik dari indeks `from` (pasangan x,y)
    g.strokeStyle = c; g.fillStyle = c; g.lineWidth = w;
    if (p.length === 2) { g.beginPath(); g.arc(X(p[0]), Y(p[1]), w / 2, 0, 7); g.fill(); return; }
    g.beginPath();
    const s = Math.max(0, from - 2);
    g.moveTo(X(p[s]), Y(p[s + 1]));
    for (let i = s + 2; i < p.length; i += 2) g.lineTo(X(p[i]), Y(p[i + 1]));
    g.stroke();
  }
  function redraw() { clearCv(); S.strokes.forEach(s => seg(s.c, s.w, s.p, 0)); }
  function ptr(e) { const b = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1000, Math.round((e.clientX - b.left) / b.width * 1000))), Math.max(0, Math.min(1000, Math.round((e.clientY - b.top) / b.height * 1000)))]; }
  let flushT = 0;
  function flush(final) {
    const s = S.cur; if (!s) return;
    if (s.p.length > s.sent) { send({ k: 'd', r: S.r, i: s.i, c: s.c, w: s.w, p: s.p.slice(s.sent), a: s.sent }); s.sent = s.p.length; }
    if (final) { clearInterval(flushT); flushT = 0; S.cur = null; }
  }
  cv.addEventListener('pointerdown', e => {
    if (!canDraw()) return; e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    const [x, y] = ptr(e), w = SIZES[S.size] * (S.eraser ? 1.8 : 1), c = S.eraser ? '#ffffff' : S.color;
    const s = { i: ++S.si, c, w, p: [x, y], sent: 0 }; S.cur = s; S.strokes.push(s); seg(c, w, s.p, 0);
    flush(); flushT = setInterval(() => flush(), 70);
  });
  cv.addEventListener('pointermove', e => {
    const s = S.cur; if (!s || !canDraw()) return; e.preventDefault();
    const [x, y] = ptr(e); const n = s.p.length;
    if (Math.abs(x - s.p[n - 2]) + Math.abs(y - s.p[n - 1]) < 2) return;
    s.p.push(x, y); seg(s.c, s.w, s.p, n);
  });
  const endStroke = () => { if (S.cur) flush(true); };
  cv.addEventListener('pointerup', endStroke); cv.addEventListener('pointercancel', endStroke); cv.addEventListener('lostpointercapture', endStroke);

  // ---------- jaringan ----------
  function onMsg(d) {
    if (!d || d.type !== 'DRAW') return;
    const from = d.from, me = myId(); if (!from) return;
    if (from !== me) {   // catat kehadiran pemain lain
      const pl = S.players[from]; if (!pl) S.players[from] = { n: d.n || 'Pemain', t: d.t || Date.now(), seen: Date.now() };
      else { pl.seen = Date.now(); if (d.n) pl.n = d.n; if (d.t && (d.k === 'hb' || d.k === 'join')) pl.t = d.t; }
    }
    switch (d.k) {
      case 'inv':
        if (from !== me && !inGame()) { S.invite = { id: from, n: d.n || 'Teman' }; toast('🎨 ' + S.invite.n + ' mengajak main Tebak Gambar! Buka tab Bareng'); refreshCard(); }
        break;
      case 'join':
        if (from !== me && S.phase !== 'off' && S.phase !== 'lobby' && S.phase !== 'over' && imMaster()) sendSnap(from);
        break;
      case 'hb': refreshCard(); break;
      case 'bye': delete S.players[from]; if (inGame()) { addLog(nameOf(from) + ' keluar dari game', 'sy'); checkAlone(); } refreshCard(); break;
      case 'start':
        if (!(S.phase === 'lobby' || S.phase === 'over')) break;
        S.ord = d.ord || []; S.R = d.R || 4; S.r = 0; S.scores = {}; S.strokes = []; S.log = []; S.over = ''; S.used = new Set();
        S.ord.forEach(id => { S.scores[id] = 0; }); addLog('Game dimulai! ' + S.R + ' ronde.', 'sy');
        S.phase = 'wait'; S.revealEnd = Date.now() + 1200; break;
      case 'pick': {
        if (d.r !== S.r + 1 || !(S.phase === 'wait' || S.phase === 'reveal')) break;
        S.r = d.r; S.drawer = d.d; S.phase = 'pick'; S.pickEnd = Date.now() + PICK_SECS * 1000; S.strokes = []; S.got = {}; S.word = ''; S.hash = 0; S.mask = ''; S.sp = []; S.cur = null; S.revSet = new Set(); S.hintN = 0;
        redraw();
        if (S.drawer === me) { S.choices = randomWords(3); }
        addLog('Ronde ' + S.r + '/' + S.R + ': ' + nameOf(S.drawer) + ' yang menggambar.', 'sy'); break;
      }
      case 'go':
        if (d.r !== S.r || S.phase !== 'pick') break;
        S.hash = d.h; S.sp = d.sp || []; S.mask = maskFromLens(S.sp); S.dur = d.dur || DUR; S.t0 = Date.now(); S.phase = 'draw'; S.got = {}; S.hintAt = [S.dur * 0.45, S.dur * 0.7];
        addLog(S.drawer === me ? 'Mulai gambar! Clue-nya jangan pakai tulisan ya.' : 'Tebak gambarnya! ' + S.sp.reduce((a, b) => a + b, 0) + ' huruf.', 'sy'); break;
      case 'hint': if (d.r === S.r && S.phase === 'draw') S.mask = d.m || S.mask; break;
      case 'd': {
        if (d.r !== S.r || from === me) break;
        let s = S.strokes.find(x => x.i === d.i && x.from === from);
        if (!s) { s = { i: d.i, from, c: d.c, w: d.w, p: [] }; S.strokes.push(s); }
        const a = d.a || 0, start = s.p.length, add = a <= start ? (d.p || []).slice(start - a) : (d.p || []);
        if (!add.length) break;
        add.forEach(v => s.p.push(v));
        if (start === 0 && s.p.length === 2) seg(s.c, s.w, s.p, 0); else seg(s.c, s.w, s.p, start);
        break;
      }
      case 'u': if (d.r === S.r && from !== me) { S.strokes.pop(); redraw(); } break;
      case 'c': if (d.r === S.r && from !== me) { S.strokes = []; redraw(); } break;
      case 'g': if (d.r === S.r && from !== me) addLog('<b>' + esc(d.n || nameOf(from)) + ':</b> ' + esc(d.t)); break;
      case 'ok':
        if (d.r !== S.r || S.phase !== 'draw' || S.got[from] != null || from === S.drawer) break;
        S.got[from] = d.pts || 0; S.scores[from] = (S.scores[from] || 0) + (d.pts || 0); S.scores[S.drawer] = (S.scores[S.drawer] || 0) + 40;
        addLog('✅ ' + esc(nameOf(from)) + ' menebak benar! +' + (d.pts || 0), 'ok'); break;
      case 'end':
        if (d.r !== S.r || (S.phase !== 'draw' && S.phase !== 'pick')) break;
        endCur(); S.phase = 'reveal'; S.revealWord = d.w || ''; S.revealEnd = Date.now() + REVEAL_MS;
        addLog(d.w ? 'Jawabannya: ' + esc(String(d.w).toUpperCase()) : 'Ronde dilewati.', 'sy'); break;
      case 'fin': endCur(); S.phase = 'over'; S.over = d.why || ''; break;
      case 'snap': if (d.to === me && !inGame()) applySnap(d); break;
    }
    render();
  }
  window.lnDrawRecv = onMsg;

  function endCur() { if (S.cur) { clearInterval(flushT); flushT = 0; S.cur = null; } }
  function randomWords(n) {
    const pool = WORDS.filter(w => !S.used.has(w)); const src = pool.length >= n ? pool : WORDS, out = [];
    while (out.length < n) { const w = src[Math.floor(Math.random() * src.length)]; if (!out.includes(w)) out.push(w); }
    return out;
  }
  function sendSnap(to) {
    send({ k: 'snap', to, ord: S.ord, R: S.R, r: S.r, d: S.drawer, ph: S.phase, h: S.hash, sp: S.sp, m: S.mask, rem: Math.max(0, S.dur - (Date.now() - S.t0) / 1000), dur: S.dur, sc: S.scores, got: S.got, st: S.strokes.slice(-120).map(s => [s.c, s.w, s.p]), rw: S.revealWord });
  }
  function applySnap(d) {
    S.ord = d.ord || []; S.R = d.R; S.r = d.r; S.drawer = d.d; S.phase = d.ph === 'pick' ? 'pick' : (d.ph === 'draw' ? 'draw' : 'reveal'); S.hash = d.h; S.sp = d.sp || []; S.mask = d.m || maskFromLens(S.sp);
    S.dur = d.dur || DUR; S.t0 = Date.now() - (S.dur - (d.rem || 0)) * 1000; S.scores = d.sc || {}; S.got = d.got || {}; S.revealWord = d.rw || '';
    S.pickEnd = Date.now() + 8000; S.revealEnd = Date.now() + 4000; S.hintAt = [];
    S.strokes = (d.st || []).map((x, i) => ({ i: i + 1, from: 'snap', c: x[0], w: x[1], p: x[2] })); redraw(); addLog('Kamu bergabung di tengah game.', 'sy');
  }
  function checkAlone() { if (inGame() && S.phase !== 'lobby' && S.phase !== 'over' && alive().length < 2) { S.phase = 'over'; S.over = 'Pemain lain keluar.'; } }

  // ---------- aksi ----------
  function openGame() {
    S.open = true; ui.classList.add('on');
    if (S.phase === 'off') { S.phase = 'lobby'; S.joinT = Date.now(); S.players[myId()] = { n: myName(), t: S.joinT, seen: Date.now() }; send({ k: 'join', n: myName(), t: S.joinT }); S.invite = null; }
    render(); refreshCard();
  }
  function minimize() { S.open = false; ui.classList.remove('on'); refreshCard(); }
  function leave() {
    send({ k: 'bye', n: myName() }); endCur();
    S.phase = 'off'; S.players = {}; S.open = false; S.strokes = []; S.log = []; ui.classList.remove('on'); S.invite = null; refreshCard();
  }
  function startGame() {
    const a = alive().sort((x, y) => (S.players[x].t - S.players[y].t) || (x < y ? -1 : 1));
    if (a.length < 2) return toast('Butuh minimal 2 pemain');
    const per = a.length <= 2 ? 2 : 1;
    emit({ k: 'start', ord: a, R: Math.min(10, a.length * per), n: myName() });
  }
  function nextRound() {
    const r = S.r + 1; if (r > S.R) return emit({ k: 'fin' });
    let d = '', al = alive();
    for (let i = 0; i < S.ord.length; i++) { const id = S.ord[(r - 1 + i) % S.ord.length]; if (al.includes(id)) { d = id; break; } }
    if (!d) return emit({ k: 'fin', why: 'Pemain lain keluar.' });
    emit({ k: 'pick', r, d });
  }
  function chooseWord(w) {
    w = String(w || '').trim().slice(0, 40); if (norm(w).length < 2) return toast('Jawaban terlalu pendek');
    S.word = w; S.used.add(w); S.revSet = new Set(); S.hintN = 0;
    emit({ k: 'go', r: S.r, h: hashOf(w, S.r), sp: lensOf(w), dur: DUR });
  }
  function guess(txt) {
    txt = String(txt || '').trim(); if (!txt || S.phase !== 'draw' || S.drawer === myId() || S.got[myId()] != null) return;
    if (hashOf(txt, S.r) === S.hash) {
      const remain = Math.max(0, S.dur - (Date.now() - S.t0) / 1000), pts = 100 + Math.round(100 * remain / S.dur);
      emit({ k: 'ok', r: S.r, pts, n: myName() });
    } else {
      addLog('<b>Kamu:</b> ' + esc(txt)); send({ k: 'g', r: S.r, n: myName(), t: txt.slice(0, 40) }); render();
    }
  }
  function sendInvite() { send({ k: 'inv', n: myName() }); toast('Ajakan terkirim ke teman di room'); }

  // ---------- tick ----------
  setInterval(() => {
    const now = Date.now();
    if (inGame()) {
      if (!window.__ldHb || now - window.__ldHb > 3000) { window.__ldHb = now; send({ k: 'hb', n: myName(), t: S.joinT }); }
      if (S.players[myId()]) S.players[myId()].seen = now;
      const m = imMaster(), me = myId();
      if (S.phase === 'wait' && now > S.revealEnd && m) nextRound();
      if (S.phase === 'reveal' && now > S.revealEnd && m) nextRound();
      if (S.phase === 'pick') {
        if (S.drawer === me && now > S.pickEnd) chooseWord(S.choices[0] || randomWords(1)[0]);
        else if (m && (now > S.pickEnd + 6000 || !alive().includes(S.drawer))) emit({ k: 'end', r: S.r, w: '' });
      }
      if (S.phase === 'draw') {
        const el = (now - S.t0) / 1000;
        if (S.drawer === me) {
          while (S.hintN < S.hintAt.length && el > S.hintAt[S.hintN]) {   // buka 1 huruf tiap petunjuk
            const n = lensOf(S.word).reduce((a, b) => a + b, 0); const cand = []; for (let i = 0; i < n; i++) if (!S.revSet.has(i)) cand.push(i);
            if (n >= 4 && cand.length > 1) { S.revSet.add(cand[Math.floor(Math.random() * cand.length)]); send({ k: 'hint', r: S.r, m: maskOf(S.word, S.revSet) }); S.mask = maskOf(S.word, S.revSet); }
            S.hintN++;
          }
          const guessers = alive().filter(id => id !== me && S.ord.includes(id));
          if (el >= S.dur || (guessers.length && guessers.every(id => S.got[id] != null))) emit({ k: 'end', r: S.r, w: S.word });
        } else if (m && !alive().includes(S.drawer)) emit({ k: 'end', r: S.r, w: '' });
      }
      checkAlone();
    }
    render();
  }, 500);
  window.addEventListener('pagehide', () => { if (inGame()) send({ k: 'bye' }); });

  // ---------- render ----------
  const ovl = $('ld-ovl');
  function ovlHtml() {
    const me = myId(), n = peerOpen().length;
    if (S.phase === 'lobby') {
      const names = alive().map(id => '<span>' + esc(nameOf(id)) + '</span>').join('');
      return '<h3>Siap main?</h3><div class="ls">' + names + '</div>' +
        (n === 0 ? '<p>Belum ada teman yang tersambung di room. Gabung room dulu, lalu ajak temanmu.</p>' :
          (alive().length < 2 ? '<p>Menunggu teman bergabung...</p>' : '<p>' + (imMaster() ? 'Semua siap? Tekan Mulai.' : 'Menunggu ' + esc(nameOf(master())) + ' memulai...') + '</p>')) +
        '<div class="ch">' + (imMaster() && alive().length >= 2 ? '<button class="ld-b p" data-a="start">Mulai</button>' : '') + '<button class="ld-b" data-a="inv">Ajak teman</button></div>' +
        '<p style="font-size:.72rem">Satu orang menggambar clue, yang lain menjawab. Boleh tulis tebak-tebakan sendiri!</p>';
    }
    if (S.phase === 'wait') return '<h3>Bersiap...</h3>';
    if (S.phase === 'pick') {
      if (S.drawer === me) {
        return '<h3>Pilih jawaban untuk digambar</h3><div class="ch">' + S.choices.map(w => '<button class="ld-b p" data-a="w" data-w="' + esc(w) + '">' + esc(w) + '</button>').join('') + '</div>' +
          '<p>Atau tulis tebak-tebakanmu sendiri (jawabannya):</p><div class="cu"><input id="ld-cw" maxlength="40" placeholder="mis. nasi goreng" /><button class="ld-b p" data-a="cw">Pakai</button></div>';
      }
      return '<h3>' + esc(nameOf(S.drawer)) + ' sedang memilih kata...</h3><p>Bersiap menebak gambarnya!</p>';
    }
    if (S.phase === 'reveal') {
      const sc = Object.keys(S.scores).sort((a, b) => S.scores[b] - S.scores[a]).map(id => '<div><span>' + esc(nameOf(id)) + '</span><span>' + S.scores[id] + '</span></div>').join('');
      return '<h3>' + (S.revealWord ? 'Jawabannya: <span style="color:#86efac">' + esc(String(S.revealWord).toUpperCase()) + '</span>' : 'Ronde dilewati') + '</h3><div class="pd">' + sc + '</div><p>Ronde berikutnya sebentar lagi...</p>';
    }
    if (S.phase === 'over') {
      const ids = Object.keys(S.scores).sort((a, b) => S.scores[b] - S.scores[a]);
      const sc = ids.map((id, i) => '<div><span>' + ['🥇', '🥈', '🥉'][i] + ' ' + esc(nameOf(id)) + '</span><span>' + S.scores[id] + '</span></div>').join('');
      return '<h3>' + (ids.length ? 'Game selesai!' : 'Game berakhir') + '</h3>' + (S.over ? '<p>' + esc(S.over) + '</p>' : '') + '<div class="pd">' + sc + '</div><div class="ch">' +
        (imMaster() ? '<button class="ld-b p" data-a="again">Main lagi</button>' : '<p>Menunggu ' + esc(nameOf(master())) + '...</p>') + '</div>';
    }
    return '';
  }
  let lastOvl = '', lastTools = '', lastSc = '', lastLog = -1;
  function render() {
    if (!S.open && !inGame()) return;
    const me = myId(), draw = S.phase === 'draw';
    // timer
    let tm = '--';
    if (draw) tm = Math.max(0, Math.ceil(S.dur - (Date.now() - S.t0) / 1000)) + 's';
    else if (S.phase === 'pick') tm = Math.max(0, Math.ceil((S.pickEnd - Date.now()) / 1000)) + 's';
    else if (S.r) tm = S.r + '/' + S.R;
    $('ld-tm').textContent = tm;
    // kata
    const wEl = $('ld-word');
    wEl.textContent = draw ? (S.drawer === me ? '✏️ ' + String(S.word).toUpperCase() : S.mask) : (S.phase === 'pick' || S.phase === 'reveal' ? '' : '');
    // skor
    const sc = Object.keys(S.players).concat(Object.keys(S.scores).filter(id => !S.players[id])).filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => (S.scores[b] || 0) - (S.scores[a] || 0)).map(id => '<i class="' + (S.drawer === id && (draw || S.phase === 'pick') ? 'dr' : '') + (S.got[id] != null ? ' ok' : '') + '">' + (S.drawer === id && (draw || S.phase === 'pick') ? '🎨 ' : '') + (S.got[id] != null ? '✅ ' : '') + esc(nameOf(id)) + ' · ' + (S.scores[id] || 0) + '</i>').join('');
    if (sc !== lastSc) { $('ld-sc').innerHTML = sc; lastSc = sc; }
    // overlay
    const oh = ovlHtml(); const showO = !!oh;
    if (oh !== lastOvl) { const keep = document.activeElement && document.activeElement.id === 'ld-cw' ? $('ld-cw').value : null; ovl.innerHTML = oh; lastOvl = oh; if (keep != null && $('ld-cw')) { $('ld-cw').value = keep; $('ld-cw').focus(); } }
    ovl.classList.toggle('on', showO);
    // alat gambar
    const tl = canDraw() ? 'tools' + S.color + S.size + S.eraser : 'none';
    if (tl !== lastTools) {
      lastTools = tl; const t = $('ld-tools');
      t.innerHTML = canDraw() ? COLORS.map(c => '<button class="cl' + (!S.eraser && S.color === c ? ' on' : '') + '" style="background:' + c + '" data-a="col" data-c="' + c + '" aria-label="Warna"></button>').join('') +
        SIZES.map((z, i) => '<button class="sz' + (S.size === i ? ' on' : '') + '" data-a="sz" data-i="' + i + '" aria-label="Ukuran"><s style="width:' + (4 + i * 5) + 'px;height:' + (4 + i * 5) + 'px"></s></button>').join('') +
        '<button class="tb' + (S.eraser ? ' on' : '') + '" data-a="er">Hapus</button><button class="tb" data-a="un">↩ Undo</button><button class="tb" data-a="cl">Bersihkan</button>' : '';
    }
    // log
    if (S.log.length !== lastLog) { const l = $('ld-log'); l.innerHTML = S.log.map(x => '<div class="' + (x.cls || '') + '">' + x.t + '</div>').join(''); l.scrollTop = l.scrollHeight; lastLog = S.log.length; }
    const gi = $('ld-in'), can = draw && S.drawer !== me && S.got[me] == null;
    gi.disabled = !can; $('ld-send').disabled = !can;
    gi.placeholder = S.drawer === me && draw ? 'Kamu yang menggambar' : (S.got[me] != null ? 'Kamu sudah benar ✅' : 'Ketik jawabanmu...');
  }

  // ---------- event UI ----------
  ui.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.getAttribute('data-a');
    if (a === 'start') startGame();
    else if (a === 'inv') sendInvite();
    else if (a === 'w') chooseWord(b.getAttribute('data-w'));
    else if (a === 'cw') chooseWord(($('ld-cw') || {}).value);
    else if (a === 'again') startGame();
    else if (a === 'col') { S.color = b.getAttribute('data-c'); S.eraser = false; lastTools = ''; }
    else if (a === 'sz') { S.size = +b.getAttribute('data-i'); lastTools = ''; }
    else if (a === 'er') { S.eraser = !S.eraser; lastTools = ''; }
    else if (a === 'un') { if (canDraw()) { endStroke(); S.strokes.pop(); redraw(); send({ k: 'u', r: S.r }); } }
    else if (a === 'cl') { if (canDraw()) { endStroke(); S.strokes = []; redraw(); send({ k: 'c', r: S.r }); } }
    render();
  });
  $('ld-min').addEventListener('click', minimize);
  $('ld-leave').addEventListener('click', () => { if (confirm('Keluar dari game?')) leave(); });
  $('ld-send').addEventListener('click', () => { const i = $('ld-in'); guess(i.value); i.value = ''; i.focus(); });
  $('ld-in').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); guess(e.target.value); e.target.value = ''; } });
  window.lnDrawBack = () => { if (S.open) { minimize(); return true; } return false; };
  clearCv();

  // ---------- kartu masuk di dalam room ----------
  function refreshCard() {
    const c = $('ld-card'); if (!c) return;
    const others = Object.keys(S.players).filter(id => id !== myId() && Date.now() - S.players[id].seen < ALIVE_MS).length;
    const tx = c.querySelector('small'), bt = c.querySelector('button');
    if (inGame()) { tx.textContent = S.phase === 'lobby' ? 'Menunggu pemain di lobi.' : 'Game sedang berjalan' + (S.r ? ' (ronde ' + S.r + '/' + S.R + ')' : '') + '.'; bt.textContent = 'Lanjut'; }
    else if (S.invite) { tx.textContent = S.invite.n + ' mengajak main Tebak Gambar!'; bt.textContent = 'Gabung'; }
    else if (others) { tx.textContent = 'Temanmu sedang main. Ayo gabung!'; bt.textContent = 'Gabung'; }
    else { tx.textContent = 'Gambar clue-nya, temanmu yang jawab. Suara tetap nyala.'; bt.textContent = 'Main'; }
    c.classList.toggle('pulse', !inGame() && (!!S.invite || others > 0));
  }
  function ensureCard() {
    if ($('ld-card')) return;
    const ra = $('room-active-area'); if (!ra || !ra.firstElementChild) return;
    const c = document.createElement('div'); c.id = 'ld-card';
    c.innerHTML = '<span class="ic">🎨</span><span class="tx"><b>Tebak Gambar</b><small></small></span><button type="button">Main</button>';
    ra.firstElementChild.insertAdjacentElement('afterend', c);
    c.querySelector('button').addEventListener('click', openGame);
    refreshCard();
  }
  setInterval(ensureCard, 1500); ensureCard();
})();
