/* LNMusic Anatomi: cermin anatomi lewat kamera. Deteksi wajah, tangan, dan tubuh (MediaPipe) berjalan di perangkatmu; video tidak diunggah.
   Ini ilustrasi anatomi umum, bukan alat medis dan bukan diagnosis. */
(function () {
  const root = document.getElementById('tab-anatomy'); if (!root) return;
  const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14', MD = 'https://storage.googleapis.com/mediapipe-models/';
  const S = { skull: 1, brain: 1, muscle: 1, eyes: 1, head: 1, hand: 1, body: 1, labels: 1, track: 0, look: 'xray', bright: 0.9, reveal: 'full', size: 1, w: 1, h: 1 };
  let face, hand, pose, stream, run = false, loading = false, v, c, x, W = 0, H = 0, C, lastT = -1, lastTs = 0, n = 0, lastPose = null, lbl = [], info = {}, fpsN = 0, fpsT = 0, uiT = 0, blinks = 0, closed = false, t0 = 0;
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k];
  const unit = (a, b) => { const l = d(a, b) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  const P = l => [(1 - l.x) * W, l.y * H], $ = s => root.querySelector(s);
  const norm = r => r > 90 ? r - 180 : r < -90 ? r + 180 : r;

  // ---------- UI ----------
  const chk = (k, t) => `<label class="an-chk"><input type="checkbox" data-k="${k}"> ${t}</label>`;
  const rng = (k, t, a, b, s) => `<div class="an-rng"><span>${t}</span><input type="range" data-k="${k}" min="${a}" max="${b}" step="${s}"><output></output></div>`;
  root.innerHTML = `<div><h3 class="text-2xl md:text-3xl font-extrabold text-white" style="letter-spacing:-.02em">Cermin Anatomi</h3>
  <p class="text-zinc-400 text-sm md:text-base mt-1">Nyalakan kamera, lalu lihat tengkorak, otak, otot, dan tulang tangan menempel di wajah dan tubuhmu secara real-time.</p></div>
  <div class="an-wrap"><div class="an-stage" id="an-st"><video id="an-v" playsinline muted style="display:none"></video><canvas id="an-c"></canvas>
    <div class="an-hud" id="an-hud"></div>
    <div class="an-ov" id="an-ov"><div><h3>Mulai cermin anatomi</h3><p id="an-msg">Arahkan kamera ke wajah, tangan, atau seluruh badan. Video diproses di perangkatmu dan tidak diunggah ke mana pun.</p><button class="an-btn" id="an-go">Mulai kamera</button></div></div>
    <div class="an-bar" id="an-bar"><button class="an-mini" id="an-shot">Simpan foto</button><button class="an-mini" id="an-stop">Hentikan</button></div></div>
  <aside class="an-panel">
    <div class="an-sec"><h4>Lapisan</h4><div class="an-chips" id="an-q"><button data-q="skull">Tengkorak</button><button data-q="brain">Otak</button><button data-q="muscle">Otot</button><button data-q="all">Semua</button></div>
      <div class="an-grid">${chk('skull', 'Tengkorak')}${chk('brain', 'Otak')}${chk('muscle', 'Otot')}${chk('eyes', 'Mata')}${chk('head', 'Garis kepala')}${chk('hand', 'Tulang tangan')}${chk('body', 'Tulang tubuh')}${chk('labels', 'Label')}</div></div>
    <div class="an-sec"><h4>Tampilan</h4><div class="an-chips" id="an-look"><button data-l="xray">X-ray</button><button data-l="solid">Solid</button></div>${rng('bright', 'Kecerahan', 0.3, 1, 0.05)}
      <div class="an-rng"><span>Reveal</span><select data-k="reveal"><option value="full">Penuh</option><option value="half">Setengah wajah</option><option value="lens">Lensa (ikut tangan)</option></select><output></output></div></div>
    <div class="an-sec"><h4>Sesuaikan ke kepalamu</h4>${rng('size', 'Ukuran', 0.7, 1.4, 0.01)}${rng('w', 'Lebar', 0.7, 1.4, 0.01)}${rng('h', 'Tinggi', 0.7, 1.4, 0.01)}<button class="an-mini" id="an-reset" style="margin-top:6px">Reset</button></div>
    <div class="an-sec"><h4>Cek tubuh</h4><div id="an-check" class="an-check">Nyalakan kamera untuk memulai pengecekan.</div>${chk('track', 'Tampilkan data tracking')}</div>
    <p class="an-note">Ilustrasi anatomi umum dari titik pelacakan kamera. Bukan alat medis dan bukan diagnosis. Hasil cek tubuh hanya perkiraan kasar.</p>
  </aside></div>`;
  const st = document.createElement('style');
  st.textContent = `.an-wrap{display:grid;gap:20px;grid-template-columns:minmax(0,1fr)}@media(min-width:1024px){.an-wrap{grid-template-columns:minmax(0,1.7fr) minmax(340px,1fr);align-items:start}}
  .an-stage{position:relative;border-radius:22px;overflow:hidden;background:#000;border:1px solid rgba(255,255,255,.1);aspect-ratio:16/10;display:grid;place-items:center}.an-stage canvas{width:100%;height:100%;object-fit:contain;display:block}
  .an-ov{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px;background:radial-gradient(circle at 50% 40%,rgba(244,63,94,.16),rgba(0,0,0,.9) 70%)}
  .an-ov h3{font-size:clamp(1.5rem,3vw,2.2rem);font-weight:800;color:#fff}.an-ov p{font-size:16px;color:#a1a1aa;max-width:460px;margin:10px auto 20px;line-height:1.5}
  .an-btn{padding:.95rem 2rem;border-radius:14px;font-weight:700;font-size:16px;color:#fff;background:linear-gradient(135deg,#f43f5e,#8b5cf6);box-shadow:0 10px 30px -10px rgba(244,63,94,.7)}.an-btn:disabled{opacity:.6}
  .an-bar{position:absolute;right:12px;bottom:12px;display:none;gap:8px}.an-mini{padding:.55rem 1rem;border-radius:12px;background:rgba(255,255,255,.12);color:#fff;font-weight:700;font-size:14px}.an-mini:hover{background:rgba(255,255,255,.22)}
  .an-hud{position:absolute;left:12px;top:12px;display:none;font:600 12.5px/1.55 ui-monospace,monospace;color:#d1fae5;background:rgba(0,0,0,.6);padding:8px 11px;border-radius:10px;white-space:pre}
  .an-panel{border-radius:22px;padding:20px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);display:flex;flex-direction:column;gap:22px}
  .an-sec h4{font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;color:#a1a1aa;font-weight:800;margin-bottom:10px}
  .an-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}.an-chips button{padding:.5rem 1rem;border-radius:999px;font-size:14.5px;font-weight:700;color:#d4d4d8;background:rgba(255,255,255,.08)}.an-chips button.on{background:#fff;color:#09090b}
  .an-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 14px}.an-chk{display:flex;align-items:center;gap:10px;font-size:15.5px;font-weight:600;color:#fff;padding:6px 0;cursor:pointer}.an-chk input{width:18px;height:18px;accent-color:#f43f5e}
  .an-rng{display:grid;grid-template-columns:92px 1fr 46px;align-items:center;gap:10px;font-size:14.5px;font-weight:600;color:#e4e4e7;padding:5px 0}.an-rng input{accent-color:#f43f5e;width:100%}.an-rng output{font-size:13px;color:#a1a1aa;text-align:right}
  .an-rng select{grid-column:2/4;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:#fff;padding:.5rem .6rem;font-size:14.5px}
  .an-check{font-size:15px;line-height:1.7;color:#d4d4d8;margin-bottom:6px}.an-check b{color:#fff}.an-check .ok{color:#34d399}.an-check .warn{color:#fbbf24}
  .an-note{font-size:13px;line-height:1.5;color:#71717a}`;
  document.head.appendChild(st);
  v = $('#an-v'); c = $('#an-c'); x = c.getContext('2d');
  function sync() {
    root.querySelectorAll('[data-k]').forEach(e => { const k = e.dataset.k; if (e.type === 'checkbox') e.checked = !!S[k]; else e.value = S[k]; const o = e.nextElementSibling; if (e.type === 'range' && o) o.textContent = (+S[k]).toFixed(2); });
    root.querySelectorAll('#an-look button').forEach(b => b.classList.toggle('on', b.dataset.l === S.look));
  }
  root.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.k; if (!k) return; S[k] = e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.type === 'range' ? +e.target.value : e.target.value; sync(); });
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.l) { S.look = b.dataset.l; sync(); }
    if (b.dataset.q) { const q = b.dataset.q; S.skull = +(q === 'skull' || q === 'all'); S.brain = +(q === 'brain' || q === 'all'); S.muscle = +(q === 'muscle' || q === 'all'); S.eyes = 1; sync(); }
    if (b.id === 'an-reset') { S.size = S.w = S.h = 1; sync(); }
    if (b.id === 'an-go') start(); if (b.id === 'an-stop') stop();
    if (b.id === 'an-shot') c.toBlob(bl => { const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = 'anatomi.png'; a.click(); });
  });
  sync();

  // ---------- Model ----------
  async function load() {
    const m = await import(CDN + '/+esm'), fs = await m.FilesetResolver.forVisionTasks(CDN + '/wasm');
    const mk = async (K, p, ex) => { for (const dl of ['GPU', 'CPU']) { try { return await K.createFromOptions(fs, Object.assign({ baseOptions: { modelAssetPath: MD + p, delegate: dl }, runningMode: 'VIDEO' }, ex)); } catch (e) {} } throw new Error('model'); };
    face = await mk(m.FaceLandmarker, 'face_landmarker/face_landmarker/float16/1/face_landmarker.task', { numFaces: 1 });
    hand = await mk(m.HandLandmarker, 'hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', { numHands: 2 });
    pose = await mk(m.PoseLandmarker, 'pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', {});
  }
  const msg = t => { $('#an-msg').textContent = t; };
  async function start() {
    if (run || loading) return; loading = true; $('#an-go').disabled = true; msg('Memuat model deteksi (sekali saja)...');
    try {
      if (!face) await load();
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      v.srcObject = stream; await v.play(); run = true; $('#an-ov').style.display = 'none'; $('#an-bar').style.display = 'flex'; lastT = -1; blinks = 0; t0 = performance.now(); frame();
    } catch (e) { msg(e && e.name === 'NotAllowedError' ? 'Izin kamera ditolak. Izinkan kamera di pengaturan browser lalu coba lagi.' : 'Gagal memulai. Pastikan internet aktif (untuk memuat model) dan situs dibuka lewat https.'); }
    loading = false; $('#an-go').disabled = false;
  }
  function stop() {
    run = false; if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; v.srcObject = null;
    $('#an-ov').style.display = 'grid'; $('#an-bar').style.display = 'none'; $('#an-hud').style.display = 'none'; msg('Kamera dimatikan. Tekan mulai untuk menyalakan lagi.');
  }

  // ---------- Gambar ----------
  const colors = () => { const X = S.look === 'xray', a = +S.bright; return X ? { X, bone: `rgba(228,242,255,${.92 * a})`, glow: `rgba(110,160,255,${.3 * a})`, fill: `rgba(120,170,255,${.1 * a})`, hole: 'rgba(0,8,30,.55)', brain: `rgba(255,110,190,${.5 * a})`, mus: `rgba(255,70,80,${.38 * a})`, eye: `rgba(170,225,255,${.9 * a})`, head: 'rgba(70,130,255,.95)' } : { X, bone: '#ece5d2', glow: '#7d725a', fill: '#d9d0b8', hole: '#2a2420', brain: '#d98aa0', mus: '#b3262e', eye: '#f5f5f5', head: '#3b82f6' }; };
  const line = (pts, w) => { x.lineCap = x.lineJoin = 'round'; x.beginPath(); pts.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.strokeStyle = C.glow; x.lineWidth = w * 1.7; x.stroke(); x.strokeStyle = C.bone; x.lineWidth = C.X ? w * .5 : w; x.stroke(); };
  const shape = (fn, w, hole) => { x.lineCap = x.lineJoin = 'round'; x.beginPath(); fn(); x.fillStyle = hole ? C.hole : C.fill; x.fill(); x.strokeStyle = C.glow; x.lineWidth = w * 1.7; x.stroke(); x.strokeStyle = C.bone; x.lineWidth = C.X ? w * .5 : w; x.stroke(); };
  const ell = (q, rx, ry, a) => x.ellipse(q[0], q[1], Math.max(rx, .1), Math.max(ry, .1), a, 0, 7);
  const dot = (q, r, col) => { x.beginPath(); x.arc(q[0], q[1], Math.max(r, .1), 0, 7); x.fillStyle = col; x.fill(); };
  const lab = (t, q, on) => { if (S.labels && on) lbl.push([t, q]); };
  const quad = (a, b, cp, k, n2) => { const t = k / n2; return [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * cp[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * cp[1] + t * t * b[1]]; };

  function drawFace(f) {
    const raw = i => P(f[i]), cen = mid(raw(10), raw(152));
    const p = i => { const q = raw(i); return [cen[0] + (q[0] - cen[0]) * S.size * S.w, cen[1] + (q[1] - cen[1]) * S.size * S.h]; };
    const A = p(234), B = p(454), Tp = p(10), Ch = p(152), fw = d(A, B), fh = d(Tp, Ch), u = unit(Ch, Tp), s = unit(A, B), ang = Math.atan2(s[1], s[0]);
    const up = (q, k) => add(q, u, k * fh), sd = (q, k) => add(q, s, k * fw), M = mid(A, B), lw = fw * .026;
    x.globalAlpha = 1;
    if (S.muscle) {
      x.lineCap = 'round'; x.strokeStyle = C.mus;
      [[123, 172, 234, 116], [352, 397, 454, 345]].forEach(([a, b, t, z]) => {
        x.lineWidth = fw * .08; x.beginPath(); x.moveTo(...p(a)); x.lineTo(...p(b)); x.stroke();
        const base = up(p(t), .24); x.lineWidth = fw * .03;
        for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(...base); x.lineTo(...lerp(p(z), p(b), .1 + k * .12)); x.stroke(); }
      });
      [70, 63, 105, 66, 107, 336, 296, 334, 293, 300].forEach(i => { x.lineWidth = fw * .03; x.beginPath(); x.moveTo(...p(i)); x.lineTo(...up(p(i), .2)); x.stroke(); });
      x.lineWidth = fw * .045; x.beginPath(); ell(mid(p(61), p(291)), d(p(61), p(291)) * .66, d(p(61), p(291)) * .4, ang); x.stroke();
      lab('Otot masseter', mid(p(123), p(172)), 1);
    }
    if (S.brain) {
      const bc = add(p(168), u, .6 * fh), rx = fw * .42, ry = fh * .3;
      x.save(); x.beginPath(); ell(bc, rx, ry, ang); x.fillStyle = C.brain; x.fill(); x.clip();
      x.strokeStyle = C.X ? 'rgba(255,200,230,.7)' : '#a35c75'; x.lineWidth = fw * .012;
      for (let k = -4; k <= 4; k++) { x.beginPath(); for (let t = -1; t <= 1.01; t += .08) { const o = [t * rx, k * ry * .22 + Math.sin(t * 9 + k) * ry * .07]; const q = [bc[0] + o[0] * Math.cos(ang) - o[1] * Math.sin(ang), bc[1] + o[0] * Math.sin(ang) + o[1] * Math.cos(ang)]; t <= -.99 ? x.moveTo(q[0], q[1]) : x.lineTo(q[0], q[1]); } x.stroke(); }
      x.restore(); lab('Otak (serebrum)', bc, 1);
    }
    if (S.skull) {
      const c1 = sd(up(A, .95), -.06), c2 = sd(up(B, .95), .06);
      shape(() => { x.moveTo(...A); x.bezierCurveTo(...c1, ...c2, ...B);[300, 293, 334, 296, 336, 107, 66, 105, 63, 70].forEach(i => x.lineTo(...p(i))); x.closePath(); }, lw);
      line([up(A, .6), up(M, .8), up(B, .6)], lw * .6); line([up(M, .97), up(M, .12)], lw * .5);
      [[33, 133], [362, 263]].forEach(([a, b]) => { const ec = mid(p(a), p(b)), ew = d(p(a), p(b)); shape(() => ell(ec, ew * .72, ew * .58, ang), lw * 1.3, 1); });
      shape(() => { x.moveTo(...lerp(p(168), p(1), .3)); x.lineTo(...p(129)); x.lineTo(...p(2)); x.lineTo(...p(358)); x.closePath(); }, lw, 1);
      for (let k = 0; k <= 8; k++) { const q = quad(p(78), p(308), p(13), k, 8); line([q, add(q, u, -fh * .05)], fw * .03); const q2 = quad(p(78), p(308), p(14), k, 8); line([q2, add(q2, u, fh * .04)], fw * .028); }
      const jl = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152].map(p), jr = [454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152].map(p);
      line(jl, lw * 1.4); line(jr, lw * 1.4); line([p(172), up(A, .1)], lw * 1.2); line([p(397), up(B, .1)], lw * 1.2); line([p(116), p(234)], lw); line([p(345), p(454)], lw);
      lab('Tulang frontal', up(M, .1), 1); lab('Tulang parietal', sd(up(A, .75), .05), 1); lab('Rongga mata (orbit)', p(33), 1); lab('Tulang hidung', p(168), 1);
      lab('Rahang atas (maksila)', p(13), 1); lab('Rahang bawah (mandibula)', p(176), 1); lab('Tulang pipi (zigoma)', p(116), 1);
    }
    if (S.eyes) [[33, 133, 468], [362, 263, 473]].forEach(([a, b, ir]) => {
      const ec = mid(p(a), p(b)), ew = d(p(a), p(b)), ic = f.length > ir ? p(ir) : ec;
      x.beginPath(); ell(ec, ew * .36, ew * .36, 0); x.fillStyle = C.X ? 'rgba(170,225,255,.25)' : '#f5f5f5'; x.fill(); x.lineWidth = ew * .03; x.strokeStyle = C.eye; x.stroke();
      dot(ic, ew * .17, C.eye); dot(ic, ew * .08, '#06101f');
    });
    if (S.head) {
      x.beginPath();[10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109].forEach((i, k) => k ? x.lineTo(...p(i)) : x.moveTo(...p(i))); x.closePath();
      x.lineJoin = 'round'; x.strokeStyle = C.head; x.lineWidth = fw * .018; x.stroke();
    }
  }

  function drawHand(h) {
    const q = h.map(P), span = d(q[0], q[9]) || 40, pr = unit(q[0], q[9]), pp = [-pr[1], pr[0]];
    for (let k = 0; k < 6; k++) { const t = add(lerp(q[0], q[9], .1 + .05 * (k % 2)), pp, (k - 2.5) * span * .12); shape(() => ell(t, span * .09, span * .08, 0), span * .03); }
    [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]].forEach(ch => {
      line([q[0], q[ch[0]]], span * .2);
      for (let i = 0; i < 3; i++) line([q[ch[i]], q[ch[i + 1]]], span * (.16 - .025 * i));
      ch.forEach((j, i) => dot(q[j], span * (.095 - .012 * i), C.bone));
    });
    lab('Falang (tulang jari)', q[8], 1); lab('Metakarpal (telapak)', lerp(q[0], q[9], .55), 1); lab('Karpal (pergelangan)', q[0], 1);
  }

  function drawBody(po) {
    const vis = i => po[i] && (po[i].visibility === undefined || po[i].visibility > .45), g = i => P(po[i]);
    if (!vis(11) || !vis(12)) return;
    const Ls = g(11), Rs = g(12), N = mid(Ls, Rs), sw = d(Ls, Rs), sv = unit(Ls, Rs); let nor = [-sv[1], sv[0]]; if (nor[1] < 0) nor = [-nor[0], -nor[1]];
    const Hm = vis(23) && vis(24) ? mid(g(23), g(24)) : add(N, nor, 1.35 * sw), Lt = d(N, Hm), dn = unit(N, Hm), w = sw * .075;
    if (S.muscle) {
      x.lineCap = 'round'; x.strokeStyle = C.mus;
      [[11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [24, 26], [26, 28]].forEach(([a, b], k) => { if (vis(a) && vis(b)) { x.lineWidth = sw * (k % 2 ? .13 : .2); x.beginPath(); x.moveTo(...g(a)); x.lineTo(...g(b)); x.stroke(); } });
      [Ls, Rs].forEach(s2 => { x.beginPath(); ell(add(s2, nor, sw * .05), sw * .17, sw * .15, 0); x.fillStyle = C.mus; x.fill(); });
      [-1, 1].forEach(sg => { x.beginPath(); ell(add(add(N, nor, Lt * .2), sv, sg * sw * .2), sw * .22, Lt * .13, 0); x.fillStyle = C.mus; x.fill(); });
    }
    line([add(N, nor, -w), Ls], w * .9); line([add(N, nor, -w), Rs], w * .9); lab('Klavikula (tulang selangka)', lerp(N, Ls, .5), 1);
    line([N, lerp(N, Hm, .38)], w * 1.4); lab('Sternum', lerp(N, Hm, .2), 1);
    for (let k = 0; k < 8; k++) { const S0 = lerp(N, Hm, .08 + k * .06), hf = sw * (.34 - Math.abs(k - 3) * .012); [-1, 1].forEach(sg => line([S0, add(add(S0, sv, sg * hf), dn, -Lt * .02), add(add(S0, sv, sg * hf * .85), dn, Lt * .07)], w * .5)); }
    lab('Tulang rusuk', add(add(lerp(N, Hm, .2), sv, sw * .3), dn, Lt * .04), 1);
    for (let k = 0; k <= 16; k++) { const q = lerp(N, Hm, k / 16); shape(() => ell(q, w * (.7 + .4 * k / 16), w * .45, Math.atan2(sv[1], sv[0])), w * .3); }
    lab('Tulang belakang', lerp(N, Hm, .75), 1);
    if (vis(23) && vis(24)) { const a = g(23), b = g(24); shape(() => { x.moveTo(...add(add(a, sv, -sw * .1), dn, -Lt * .08)); x.lineTo(...add(add(b, sv, sw * .1), dn, -Lt * .08)); x.lineTo(...add(b, dn, Lt * .1)); x.lineTo(...add(Hm, dn, Lt * .2)); x.lineTo(...add(a, dn, Lt * .1)); x.closePath(); }, w * .8); lab('Panggul', Hm, 1); }
    [[11, 13, 'Humerus'], [12, 14, 'Humerus'], [23, 25, 'Femur (tulang paha)'], [24, 26, 'Femur (tulang paha)']].forEach(([a, b, t]) => { if (vis(a) && vis(b)) { line([g(a), g(b)], w * 1.3); lab(t, mid(g(a), g(b)), 1); } });
    [[13, 15], [14, 16], [25, 27], [26, 28]].forEach(([a, b]) => { if (vis(a) && vis(b)) { const u2 = unit(g(a), g(b)), pe = [-u2[1], u2[0]]; line([add(g(a), pe, w * .5), add(g(b), pe, w * .3)], w * .75); line([add(g(a), pe, -w * .5), add(g(b), pe, -w * .3)], w * .6); } });
    [11, 12, 13, 14, 25, 26].forEach(i => { if (vis(i)) dot(g(i), w * .95, C.bone); });
    if (!lastFace && vis(0)) { shape(() => ell(add(g(0), nor, -sw * .08), sw * .3, sw * .36, 0), w * .8); lab('Tengkorak', add(g(0), nor, -sw * .3), 1); }
  }

  function drawLabels() {
    if (!S.labels || !lbl.length) return;
    const fs = Math.max(12, Math.round(W / 62)), pad = 14, L = [], R = []; x.font = `600 ${fs}px sans-serif`; x.textBaseline = 'middle';
    lbl.sort((a, b) => a[1][1] - b[1][1]).forEach(l => (l[1][0] < W / 2 ? L : R).push(l));
    [[L, 0], [R, 1]].forEach(([arr, r]) => {
      let y0 = -1e9;
      arr.forEach(([t, q]) => {
        const y = Math.max(q[1], y0 + fs * 1.5); y0 = y; const tx = r ? W - pad : pad, w2 = x.measureText(t).width, ex = r ? tx - w2 - 8 : tx + w2 + 8;
        x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1; x.beginPath(); x.moveTo(q[0], q[1]); x.lineTo(ex, y); x.stroke(); dot(q, 2.5, '#fff');
        x.fillStyle = '#fff'; x.textAlign = r ? 'right' : 'left'; x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 4; x.fillText(t, tx, y); x.shadowBlur = 0;
      });
    });
  }

  let lastFace = null;
  function frame() {
    if (!run) return; requestAnimationFrame(frame);
    if (v.readyState < 2 || v.currentTime === lastT) return; lastT = v.currentTime;
    if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight; $('#an-st').style.aspectRatio = c.width + '/' + c.height; }
    W = c.width; H = c.height; const ts = Math.max(performance.now(), lastTs + 1); lastTs = ts;
    let F = null, Hs = [], Po = lastPose;
    try { const fr = face.detectForVideo(v, ts); F = fr.faceLandmarks[0] || null; Hs = hand.detectForVideo(v, ts).landmarks || []; if (n++ % 2 === 0) lastPose = Po = pose.detectForVideo(v, ts).landmarks[0] || null; } catch (e) {}
    lastFace = F; C = colors();
    x.globalCompositeOperation = 'source-over'; x.save(); x.translate(W, 0); x.scale(-1, 1); x.drawImage(v, 0, 0, W, H); x.restore();
    if (C.X) { x.fillStyle = 'rgba(0,6,20,.35)'; x.fillRect(0, 0, W, H); }
    lbl = []; let lens = null;
    x.save();
    if (S.reveal === 'half' && F) { const cn = mid(P(F[10]), P(F[152])); x.beginPath(); x.rect(0, 0, cn[0], H); x.clip(); }
    if (S.reveal === 'lens') { x.beginPath(); if (Hs[0]) { const q = Hs[0].map(P); lens = [lerp(mid(q[0], q[5]), q[17], .33), d(q[0], q[9]) * 2.4]; x.arc(lens[0][0], lens[0][1], lens[1], 0, 7); } else x.rect(0, 0, 0, 0); x.clip(); }
    x.globalCompositeOperation = C.X ? 'lighter' : 'source-over';
    if (S.body && Po) drawBody(Po); if (F) drawFace(F); if (S.hand) Hs.forEach(drawHand);
    x.restore(); x.globalCompositeOperation = 'source-over';
    if (lens) { x.beginPath(); x.arc(lens[0][0], lens[0][1], lens[1], 0, 7); x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 2; x.stroke(); }
    drawLabels();
    // data tracking & cek tubuh
    fpsN++; if (ts - fpsT > 1000) { info.fps = fpsN; fpsN = 0; fpsT = ts; }
    if (F) {
      const r = k => P(F[k]), A = r(234), B = r(454), s = unit(A, B), ev = (a, b, e, f2) => d(r(a), r(b)) / d(r(e), r(f2));
      info.roll = norm(Math.atan2(s[1], s[0]) * 180 / Math.PI); info.yaw = ((P(F[1])[0] - mid(A, B)[0]) / (d(A, B) || 1)) * -120; info.pitch = ((d(r(1), mid(r(33), r(263))) / (d(r(10), r(152)) || 1)) - .3) * 220; info.fw = d(A, B) / W;
      const ear = (ev(159, 145, 33, 133) + ev(386, 374, 362, 263)) / 2; if (ear < .17 && !closed) { blinks++; closed = true; } if (ear > .21) closed = false;
    }
    if (Po && Po[11] && Po[12]) { const a = P(Po[11]), b = P(Po[12]); info.tilt = norm(Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI); info.sw = d(a, b) / W; } else info.tilt = null;
    if (Hs[0]) { const q = Hs[0].map(P), o = [8, 12, 16, 20].reduce((s2, i) => s2 + d(q[i], q[0]), 0) / 4 / (d(q[0], q[9]) || 1); info.open = o; } else info.open = null;
    info.face = !!F; info.hands = Hs.length; info.body = !!Po;
    if (ts - uiT > 400) { uiT = ts; ui(ts); }
  }
  const cls = (ok, t) => `<span class="${ok ? 'ok' : 'warn'}">${t}</span>`;
  function ui(ts) {
    const ck = $('#an-check'), min = (ts - t0) / 60000;
    const rows = [];
    rows.push(info.tilt == null ? 'Bahu: <b>belum terlihat</b>' : `Bahu: <b>${Math.abs(info.tilt).toFixed(1)}°</b> ${cls(Math.abs(info.tilt) < 4, Math.abs(info.tilt) < 4 ? 'sejajar' : 'miring')}`);
    rows.push(info.face ? `Kepala: <b>${Math.abs(info.roll).toFixed(1)}°</b> ${cls(Math.abs(info.roll) < 6, Math.abs(info.roll) < 6 ? 'tegak' : 'miring')}` : 'Kepala: <b>belum terlihat</b>');
    if (info.face) rows.push(`Jarak: ${info.fw > .55 ? cls(0, 'terlalu dekat') : info.fw < .16 ? cls(0, 'terlalu jauh') : cls(1, 'pas')}`);
    if (info.face && min > .15) rows.push(`Kedip: <b>${Math.round(blinks / min)}</b>/menit ${cls(blinks / min >= 8, blinks / min >= 8 ? 'wajar' : 'jarang, istirahatkan mata')}`);
    rows.push(info.open == null ? 'Tangan: <b>belum terlihat</b>' : `Tangan: <b>${info.open > 1.7 ? 'terbuka' : 'mengepal'}</b>`);
    ck.innerHTML = rows.join('<br>');
    const hud = $('#an-hud'); hud.style.display = S.track ? 'block' : 'none';
    if (S.track) hud.textContent = `FPS ${info.fps || 0}\nWajah ${info.face ? 'ya' : '-'}  Tangan ${info.hands}  Tubuh ${info.body ? 'ya' : '-'}` + (info.face ? `\nYaw ≈${(info.yaw || 0).toFixed(0)}°  Pitch ≈${(info.pitch || 0).toFixed(0)}°  Roll ${(info.roll || 0).toFixed(0)}°` : '');
  }

  // matikan kamera saat pindah tab atau halaman disembunyikan
  const o = window.switchTab; if (typeof o === 'function') window.switchTab = function (t) { if (t !== 'anatomy' && run) stop(); return o.apply(this, arguments); };
  document.addEventListener('visibilitychange', () => { if (document.hidden && run) stop(); });
  window.LNAnatomy = { S, drawFace, drawHand, drawBody, setup(ctx, w, h) { x = ctx; W = w; H = h; C = colors(); } };
})();
