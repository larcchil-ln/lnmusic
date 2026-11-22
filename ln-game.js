/* LNMusic Game: balapan 2D berdua lewat koneksi room (PeerJS). Semua grafis & lintasan orisinal. */
(function () {
  const root = document.getElementById('lg-root');
  if (!root) return;
  const W = 800, H = 500, CX = 400, CY = 250, LAPS = 3;
  const OX = 360, OY = 215, IX = 200, IY = 85;           // elips luar & dalam lintasan
  const COLORS = ['#f43f5e', '#38bdf8'];
  const $ = id => document.getElementById(id);

  // ---------- UI ----------
  root.innerHTML =
    '<div class="glass rounded-3xl p-3 border border-white/10 space-y-3">' +
    '<div class="flex items-center justify-between px-1"><div class="font-extrabold text-sm">🏎️ Balapan Berdua</div><div id="lg-st" class="text-[11px] text-zinc-400"></div></div>' +
    '<div style="position:relative"><canvas id="lg-cv" width="800" height="500" style="width:100%;border-radius:16px;background:#166534;display:block;touch-action:none"></canvas>' +
    '<div id="lg-ov" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:16px;background:rgba(6,6,9,.72);border-radius:16px">' +
    '<div id="lg-msg" style="font-size:14px;font-weight:700"></div><button id="lg-btn" style="padding:11px 22px;border:0;border-radius:12px;background:#e11d48;color:#fff;font-weight:800;font-size:14px;cursor:pointer"></button></div></div>' +
    '<div style="display:flex;gap:10px;align-items:center;justify-content:space-between;user-select:none;-webkit-user-select:none">' +
    '<div style="display:flex;gap:10px"><button id="lg-l" class="lgk">◀</button><button id="lg-r" class="lgk">▶</button></div>' +
    '<button id="lg-i" class="lgk" style="width:84px">🎁 Item</button><button id="lg-b" class="lgk">⏹</button></div>' +
    '<div class="text-[10px] text-zinc-500 px-1">Gas otomatis. PC: ← → atau A D, spasi = item, S = rem. Ambil kotak 🎁 di lintasan untuk boost atau kulit pisang.</div></div>' +
    '<style>.lgk{width:68px;height:60px;border-radius:16px;border:1px solid #ffffff22;background:#27272a;color:#fff;font-size:20px;font-weight:800;touch-action:none;-webkit-tap-highlight-color:transparent}.lgk.on{background:#e11d48}</style>';
  const cv = $('lg-cv'), g = cv.getContext('2d');

  // ---------- state ----------
  let waiting = 0, st = 'idle', countEnd = 0, raceT0 = 0, oppId = '', oppName = '', invite = null, winner = '', lane = 0, lastOppMsg = 0;
  const key = { l: 0, r: 0, b: 0 };
  const me = { x: 0, y: 0, a: 0, v: 0, ang: 0, prog: -0.03, item: '', boost: 0, spin: 0, fin: false };
  const op = { x: 0, y: 0, a: 0, tx: 0, ty: 0, ta: 0, v: 0, prog: -0.03, boost: 0, spin: 0 };
  let bananas = [], boxes = [0.3, 1.6, 3.0, 4.6].map(t => ({ t, x: CX + 280 * Math.cos(t), y: CY + 150 * Math.sin(t), back: 0 }));
  const peerOpen = () => { try { return connections.filter(c => c.open); } catch (e) { return []; } };
  const myId = () => { try { return peer.id; } catch (e) { return ''; } };
  const myName = () => { try { return myDisplayName || 'Pemain'; } catch (e) { return 'Pemain'; } };
  const send = m => { m.type = 'GAME'; m.from = myId(); peerOpen().forEach(c => { try { c.send(m); } catch (e) {} }); };
  const toast = t => { try { showToast(t); } catch (e) {} };

  const onTrack = (x, y) => { const o = ((x - CX) / OX) ** 2 + ((y - CY) / OY) ** 2, i = ((x - CX) / IX) ** 2 + ((y - CY) / IY) ** 2; return o <= 1 && i >= 1; };
  const wrap = d => { while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

  function reset() {
    lane = myId() < oppId ? 0 : 1;
    const ys = [75, 125];
    me.x = 370; me.y = ys[lane]; me.a = 0; me.v = 0; me.item = ''; me.boost = 0; me.spin = 0; me.fin = false;
    me.ang = Math.atan2(me.y - CY, me.x - CX); me._th = me.ang; me.prog = (me.ang + Math.PI / 2) / (2 * Math.PI);
    const oy = ys[1 - lane]; Object.assign(op, { x: 370, y: oy, tx: 370, ty: oy, a: 0, ta: 0, v: 0, prog: me.prog, boost: 0, spin: 0 });
    bananas = []; boxes.forEach(b => b.back = 0); winner = '';
  }
  function begin(id, name) {
    oppId = id; oppName = name || 'Lawan'; reset(); invite = null; waiting = 0;
    st = 'count'; countEnd = performance.now() + 3500; lastOppMsg = performance.now();
  }

  // ---------- jaringan ----------
  window.lnGameRecv = function (d) {
    if (!d || d.from === myId()) return;
    const now = performance.now();
    if (d.k === 'inv') { if (st === 'idle' || st === 'done') { invite = { id: d.from, name: d.n }; st = 'idle'; toast('🏎️ ' + (d.n || 'Teman') + ' mengajak balapan! Buka tab Game'); } return; }
    if (d.k === 'acc') { if (st === 'idle' && waiting > performance.now()) begin(d.from, d.n); return; }
    if (d.from !== oppId) return;
    lastOppMsg = now;
    if (d.k === 'st') { op.tx = d.x; op.ty = d.y; op.ta = d.a; op.v = d.v; op.prog = d.p; op.boost = d.b; op.spin = d.s; }
    else if (d.k === 'ban') { bananas.push({ id: d.id, x: d.x, y: d.y, t: now, mine: false }); }
    else if (d.k === 'bx') { bananas = bananas.filter(b => b.id !== d.id); }
    else if (d.k === 'fin') { if (st === 'race') { st = 'done'; winner = 'op'; } }
    else if (d.k === 'bye') { if (st === 'race' || st === 'count') { st = 'done'; winner = 'me'; toast('Lawan keluar dari balapan'); } }
  };
  setInterval(() => { if (st === 'race') send({ k: 'st', x: Math.round(me.x), y: Math.round(me.y), a: +me.a.toFixed(2), v: Math.round(me.v), p: +me.prog.toFixed(3), b: me.boost > 0 ? 1 : 0, s: me.spin > 0 ? 1 : 0 }); }, 50);

  // ---------- kontrol ----------
  function hold(id, k) {
    const el = $(id), on = v => { key[k] = v; el.classList.toggle('on', !!v); };
    el.addEventListener('pointerdown', e => { e.preventDefault(); on(1); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => el.addEventListener(ev, () => on(0)));
  }
  hold('lg-l', 'l'); hold('lg-r', 'r'); hold('lg-b', 'b');
  $('lg-i').addEventListener('pointerdown', e => { e.preventDefault(); useItem(); });
  window.addEventListener('keydown', e => {
    if (st !== 'race' && st !== 'count') return;
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') key.l = 1; else if (k === 'arrowright' || k === 'd') key.r = 1; else if (k === 's' || k === 'arrowdown') key.b = 1;
    else if (k === ' ') { useItem(); } else return;
    e.preventDefault();
  });
  window.addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (k === 'arrowleft' || k === 'a') key.l = 0; else if (k === 'arrowright' || k === 'd') key.r = 0; else if (k === 's' || k === 'arrowdown') key.b = 0; });

  function useItem() {
    if (st !== 'race' || !me.item) return;
    if (me.item === 'boost') me.boost = 1.6;
    else { const id = myId() + Date.now(), b = { id, x: me.x - Math.cos(me.a) * 30, y: me.y - Math.sin(me.a) * 30, t: performance.now(), mine: true }; bananas.push(b); send({ k: 'ban', id, x: Math.round(b.x), y: Math.round(b.y) }); }
    me.item = '';
  }

  // ---------- fisika ----------
  function step(dt) {
    if (st !== 'race') return;
    const on = onTrack(me.x, me.y);
    let vmax = on ? 230 : 85; if (me.boost > 0) { vmax *= 1.55; me.boost -= dt; }
    if (me.spin > 0) { me.spin -= dt; me.a += 12 * dt; me.v *= 0.96; }
    else {
      const steer = (key.r - key.l), spd = Math.min(1, Math.abs(me.v) / 110);
      me.a += steer * 2.7 * spd * dt;
      if (key.b) me.v -= 320 * dt; else if (me.v < vmax) me.v += (me.boost > 0 ? 420 : 170) * dt;
    }
    if (me.v > vmax) me.v += (vmax - me.v) * Math.min(1, 3 * dt);
    if (me.v < 0) me.v = 0;
    me.x += Math.cos(me.a) * me.v * dt; me.y += Math.sin(me.a) * me.v * dt;
    // dinding luar
    for (let i = 0; i < 12 && ((me.x - CX) / (OX - 6)) ** 2 + ((me.y - CY) / (OY - 6)) ** 2 > 1; i++) { me.x += (CX - me.x) * 0.04; me.y += (CY - me.y) * 0.04; me.v *= 0.9; }
    // tabrakan antar mobil
    const dx = me.x - op.x, dy = me.y - op.y, dist = Math.hypot(dx, dy);
    if (dist < 28 && dist > 0.1) { const push = (28 - dist) / 2; me.x += dx / dist * push; me.y += dy / dist * push; me.v *= 0.93; }
    // putaran
    const th = Math.atan2(me.y - CY, me.x - CX); me.ang += wrap(th - me._th); me._th = th;
    me.prog = (me.ang + Math.PI / 2) / (2 * Math.PI);
    // kotak item
    const now = performance.now();
    boxes.forEach(b => { if (b.back > now) return; if (!me.item && Math.hypot(me.x - b.x, me.y - b.y) < 24) { me.item = Math.random() < 0.6 ? 'boost' : 'banana'; b.back = now + 5000; } });
    // kulit pisang
    bananas = bananas.filter(b => {
      if (Math.hypot(me.x - b.x, me.y - b.y) < 20 && (!b.mine || now - b.t > 900) && me.spin <= 0) { me.spin = 1; me.v *= 0.3; send({ k: 'bx', id: b.id }); return false; }
      return now - b.t < 30000;
    });
    if (me.prog >= LAPS && !me.fin) { me.fin = true; if (st === 'race') { st = 'done'; winner = 'me'; send({ k: 'fin' }); } }
  }

  // ---------- gambar ----------
  function ell(cx, cy, rx, ry) { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); }
  function car(x, y, a, col, label, boost, spin) {
    g.save(); g.translate(x, y); g.rotate(a);
    if (boost) { g.fillStyle = '#fbbf24'; g.beginPath(); g.moveTo(-14, -5); g.lineTo(-30, 0); g.lineTo(-14, 5); g.fill(); }
    g.fillStyle = col; g.beginPath(); g.roundRect(-15, -9, 30, 18, 6); g.fill();
    g.fillStyle = '#0b0b10'; g.fillRect(2, -6, 7, 12); g.fillStyle = '#ffffffcc'; g.fillRect(12, -7, 3, 4); g.fillRect(12, 3, 3, 4);
    g.restore();
    g.fillStyle = '#fff'; g.font = 'bold 12px system-ui'; g.textAlign = 'center'; g.fillText(label + (spin ? ' 💫' : ''), x, y - 20);
  }
  function draw() {
    g.clearRect(0, 0, W, H); g.fillStyle = '#166534'; g.fillRect(0, 0, W, H);
    ell(CX, CY, OX, OY); g.fillStyle = '#3f3f46'; g.fill();
    ell(CX, CY, IX, IY); g.fillStyle = '#15803d'; g.fill();
    g.lineWidth = 6; g.setLineDash([16, 16]);
    [[OX, OY], [IX, IY]].forEach(([rx, ry]) => { ell(CX, CY, rx, ry); g.strokeStyle = '#ef4444'; g.lineDashOffset = 0; g.stroke(); ell(CX, CY, rx, ry); g.strokeStyle = '#fff'; g.lineDashOffset = 16; g.stroke(); });
    g.setLineDash([]);
    for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#fff' : '#111'; g.fillRect(396, 36 + i * 14.4, 8, 14.4); }
    const now = performance.now();
    boxes.forEach(b => { if (b.back > now) return; g.fillStyle = '#fbbf24'; g.beginPath(); g.roundRect(b.x - 12, b.y - 12, 24, 24, 6); g.fill(); g.font = '15px system-ui'; g.textAlign = 'center'; g.fillText('🎁', b.x, b.y + 5); });
    bananas.forEach(b => { g.font = '20px system-ui'; g.textAlign = 'center'; g.fillText('🍌', b.x, b.y + 7); });
    if (oppId) car(op.x, op.y, op.a, COLORS[1 - lane], oppName, op.boost, op.spin);
    car(me.x || 370, me.y || 100, me.a, COLORS[lane], 'Kamu', me.boost > 0, me.spin > 0);
    // HUD
    g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = 'bold 18px system-ui';
    if (st === 'race' || st === 'done') {
      const lap = Math.min(LAPS, Math.max(1, Math.floor(me.prog) + 1)), first = me.prog >= op.prog;
      g.fillText('Putaran ' + lap + '/' + LAPS, 14, 28); g.fillText(first ? '🥇 Posisi 1' : '🥈 Posisi 2', 14, 52);
      g.fillText(((now - raceT0) / 1000).toFixed(1) + ' dtk', 14, 76);
      g.textAlign = 'right'; g.fillText(me.item === 'boost' ? '⚡ Boost siap' : me.item === 'banana' ? '🍌 Pisang siap' : '', W - 14, 28);
    }
    if (st === 'count') { const n = Math.ceil((countEnd - now) / 1000); g.textAlign = 'center'; g.font = 'bold 120px system-ui'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 8; const t = n > 0 ? String(n) : 'GO!'; g.strokeText(t, CX, CY + 40); g.fillText(t, CX, CY + 40); }
  }

  // ---------- overlay & loop ----------
  function ui() {
    const n = peerOpen().length, ov = $('lg-ov'), msg = $('lg-msg'), btn = $('lg-btn');
    $('lg-st').textContent = n ? '👥 ' + (n + 1) + ' orang di room' : 'Belum ada lawan';
    const show = st === 'idle' || st === 'done';
    ov.style.display = show ? 'flex' : 'none'; if (!show) return;
    btn.style.display = 'inline-block'; btn.disabled = false;
    if (waiting > performance.now() && st === 'idle' && !invite) {
      msg.textContent = 'Menunggu teman menerima ajakan…'; btn.style.display = 'none';
    } else if (st === 'done') {
      msg.textContent = winner === 'me' ? '🏆 Kamu menang!' : '😅 ' + oppName + ' menang!';
      btn.textContent = 'Main lagi'; btn.onclick = () => { send({ k: 'inv', n: myName() }); waiting = performance.now() + 20000; st = 'idle'; invite = null; };
    } else if (invite) {
      msg.textContent = '🏎️ ' + (invite.name || 'Teman') + ' mengajak balapan!';
      btn.textContent = 'Terima & mulai'; btn.onclick = () => { const i = invite; send({ k: 'acc', n: myName() }); begin(i.id, i.name); };
    } else if (!n) {
      msg.textContent = 'Belum ada lawan. Masuk room di tab Bareng, lalu ajak temanmu.'; btn.style.display = 'none';
    } else {
      msg.textContent = 'Balapan 3 putaran. Siapa duluan sampai finis menang!';
      btn.textContent = 'Ajak balapan'; btn.onclick = () => { send({ k: 'inv', n: myName() }); waiting = performance.now() + 20000; };
    }
  }
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (st === 'count' && now >= countEnd) { st = 'race'; raceT0 = now; }
    if (st === 'race' && !peerOpen().length) { st = 'done'; winner = 'me'; toast('Koneksi lawan terputus'); }
    if (st === 'race' && now - lastOppMsg > 6000) { st = 'done'; winner = 'me'; toast('Lawan tidak merespons'); }
    step(dt);
    op.x += (op.tx - op.x) * Math.min(1, dt * 12); op.y += (op.ty - op.y) * Math.min(1, dt * 12); op.a += wrap(op.ta - op.a) * Math.min(1, dt * 12);
    if (root.offsetParent !== null) { draw(); ui(); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  window.addEventListener('pagehide', () => { if (st === 'race') send({ k: 'bye' }); });
})();
