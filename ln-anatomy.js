/* LNMusic Anatomi: cermin anatomi lewat kamera. Deteksi wajah, tangan, dan tubuh (MediaPipe) berjalan di perangkatmu; video tidak diunggah.
   Ini ilustrasi anatomi umum, bukan alat medis dan bukan diagnosis.
   Tambahan: ekspresi/mata/perasaan (blendshape MediaPipe, di perangkat), perkiraan usia (face-api, di perangkat), teks suara (layanan suara browser). */
(function () {
  const root = document.getElementById('tab-anatomy'); if (!root) return;
  const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14', MD = 'https://storage.googleapis.com/mediapipe-models/';
  const S = { lang: (function () { try { return localStorage.getItem('an_lang') || 'id-ID'; } catch (e) { return 'id-ID'; } })(), skull: 1, brain: 1, muscle: 1, eyes: 1, head: 1, hand: 1, body: 1, labels: 1, track: 0, look: 'xray', bright: 0.9, reveal: 'full', size: 1, w: 1, h: 1 };
  let face, hand, pose, stream, run = false, loading = false, v, c, x, W = 0, H = 0, C, lastT = -1, lastTs = 0, n = 0, lastPose = null, lbl = [], info = {}, fpsN = 0, fpsT = 0, uiT = 0, blinks = 0, closed = false, t0 = 0;
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k];
  const unit = (a, b) => { const l = d(a, b) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  const P = l => [(1 - l.x) * W, l.y * H], $ = s => root.querySelector(s);
  const norm = r => r > 90 ? r - 180 : r < -90 ? r + 180 : r;

  // ---------- UI (layar penuh) ----------
  root.classList.remove('space-y-5');
  let vis = { s: 1, x0: 0, x1: 1280, y0: 0, y1: 720 }, active = false, slow = 0;
  const chk = (k, t) => `<label class="an-chk"><input type="checkbox" data-k="${k}"> ${t}</label>`;
  const rng = (k, t, a, b, st2) => `<div class="an-rng"><span>${t}</span><input type="range" data-k="${k}" min="${a}" max="${b}" step="${st2}"><output></output></div>`;
  const XI = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const SI = '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>';
  root.innerHTML = `<video id="an-v" playsinline muted></video><canvas id="an-c"></canvas><div class="an-dim"></div><div class="an-vig"></div><div class="an-scan"></div>
  <div class="an-top"><button class="an-ib" id="an-close" aria-label="Tutup">${XI}</button><div class="an-pill"><i class="an-live"></i>Cermin Anatomi<span id="an-state"></span></div><span style="flex:1"></span><button class="an-ib" id="an-shot" aria-label="Simpan foto"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14"/></svg></button><button class="an-ib" id="an-set" aria-label="Pengaturan">${SI}</button></div>
  <div class="an-stack">
    <div class="an-info" id="an-info"><div class="an-info-h"><span>Cek tubuh</span><small>ketuk untuk lipat</small></div><div id="an-check" class="an-check">Menunggu kamera...</div><p class="an-note">Ilustrasi anatomi umum dari titik pelacakan kamera, bukan alat medis atau diagnosis. Video diproses di perangkatmu.</p></div>
    <div class="an-info an-face" id="an-face"><div class="an-info-h"><span>Wajah &amp; perasaan</span><small id="an-fs"></small></div><div id="an-fcheck" class="an-check">Mencari wajah...</div><p class="an-note">Usia dan perasaan hanya perkiraan dari bentuk dan ekspresi wajah, bisa meleset. Bukan alat medis atau psikologi. Teks suara memakai layanan pengenalan suara milik browser, jadi audio bisa dikirim ke penyedia browser.</p></div>
  </div>
  <div class="an-sub" id="an-sub"></div>
  <div class="an-hud" id="an-hud"></div>
  <div class="an-dock"><div class="an-chips" id="an-q"><button data-q="skull">Tengkorak</button><button data-q="brain">Otak</button><button data-q="muscle">Otot</button><button data-q="all">Semua</button></div>
    <div class="an-chips" id="an-look"><button data-l="xray">X-ray</button><button data-l="solid">Solid</button></div><div class="an-chips"><button id="an-lbl">Label</button><button id="an-mic">Teks suara</button></div></div>
  <aside class="an-drawer"><div class="an-dh"><h3>Pengaturan</h3><button class="an-ib" id="an-set2" aria-label="Tutup">${XI}</button></div>
    <div class="an-sec"><h4>Lapisan</h4><div class="an-grid">${chk('skull', 'Tengkorak')}${chk('brain', 'Otak')}${chk('muscle', 'Otot')}${chk('eyes', 'Mata')}${chk('head', 'Garis kepala')}${chk('hand', 'Tulang tangan')}${chk('body', 'Tulang tubuh')}${chk('labels', 'Label')}</div></div>
    <div class="an-sec"><h4>Tampilan</h4>${rng('bright', 'Kecerahan', 0.3, 1, 0.05)}<div class="an-rng"><span>Reveal</span><select data-k="reveal"><option value="full">Penuh</option><option value="half">Setengah wajah</option><option value="lens">Lensa (ikut tangan)</option></select><output></output></div></div>
    <div class="an-sec"><h4>Sesuaikan ke kepalamu</h4>${rng('size', 'Ukuran', 0.7, 1.4, 0.01)}${rng('w', 'Lebar', 0.7, 1.4, 0.01)}${rng('h', 'Tinggi', 0.7, 1.4, 0.01)}<button class="an-mini" id="an-reset" style="margin-top:6px">Reset</button></div>
    <div class="an-sec"><h4>Teks suara</h4><div class="an-rng"><span>Bahasa</span><select data-k="lang"><option value="id-ID">Indonesia</option><option value="en-US">English</option><option value="ms-MY">Melayu</option><option value="ko-KR">한국어</option><option value="ja-JP">日本語</option></select></div></div>
    <div class="an-sec"><h4>Performa</h4>${chk('lite', 'Mode hemat (lebih ringan)')}${chk('track', 'Tampilkan data tracking')}</div>
  </aside>
  <div class="an-ov" id="an-ov"><div><div class="an-spin"></div><h3 id="an-ttl">Menyalakan kamera</h3><p id="an-msg">Izinkan akses kamera saat diminta browser.</p><button class="an-btn" id="an-go" style="display:none">Coba lagi</button></div></div>`;
  const st = document.createElement('style');
  st.textContent = `#tab-anatomy:not(.hidden){display:block;position:fixed;inset:0;z-index:70;background:#000;margin:0!important;overflow:hidden}
  #tab-anatomy video,#tab-anatomy canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}#an-v{transform:scaleX(-1)}
  .an-xr #an-c{mix-blend-mode:screen}.an-dim{position:absolute;inset:0;background:rgba(0,8,26,.4);opacity:0;pointer-events:none;transition:opacity .3s}.an-xr .an-dim{opacity:1}
  .an-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.6))}
  .an-scan{position:absolute;left:0;right:0;top:0;height:2px;pointer-events:none;opacity:.45;background:linear-gradient(90deg,transparent,rgba(120,180,255,.6),transparent);animation:anScan 5s linear infinite}@keyframes anScan{to{transform:translateY(100vh)}}
  .an-top{position:absolute;top:max(12px,env(safe-area-inset-top));left:12px;right:12px;display:flex;align-items:center;gap:10px;z-index:3}
  .an-pill{display:flex;align-items:center;gap:9px;padding:.6rem 1.05rem;border-radius:999px;background:rgba(10,10,16,.72);border:1px solid rgba(255,255,255,.12);color:#fff;font-weight:800;font-size:15.5px}.an-pill span{font-weight:600;font-size:13px;color:#a1a1aa}
  .an-live{width:9px;height:9px;border-radius:50%;background:#f43f5e;box-shadow:0 0 10px #f43f5e;animation:anPulse 1.4s infinite}@keyframes anPulse{50%{opacity:.3}}
  .an-ib{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:rgba(10,10,16,.72);border:1px solid rgba(255,255,255,.12);color:#fff;flex:none}.an-ib:hover{background:rgba(40,40,52,.9)}
  .an-info{position:absolute;left:12px;top:calc(max(12px,env(safe-area-inset-top)) + 58px);width:min(310px,calc(100% - 24px));padding:14px 16px;border-radius:18px;background:rgba(10,10,16,.72);border:1px solid rgba(255,255,255,.12);z-index:3}
  .an-info-h{font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;color:#a1a1aa;font-weight:800;cursor:pointer;display:flex;justify-content:space-between;margin-bottom:6px}.an-info-h small{font-size:11px;text-transform:none;letter-spacing:0;font-weight:500;color:#71717a}
  .an-info.min .an-check,.an-info.min .an-note{display:none}
  .an-hud{position:absolute;left:12px;bottom:96px;display:none;font:600 12.5px/1.55 ui-monospace,monospace;color:#d1fae5;background:rgba(0,0,0,.6);padding:8px 11px;border-radius:10px;white-space:pre;z-index:3}
  .an-dock{position:absolute;left:50%;transform:translateX(-50%);bottom:max(14px,env(safe-area-inset-bottom));display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:center;max-width:calc(100% - 24px);padding:8px 12px;border-radius:22px;background:rgba(10,10,16,.78);border:1px solid rgba(255,255,255,.12);z-index:3}
  .an-dock .an-chips{margin:0}.an-chips{display:flex;gap:6px}.an-chips button{padding:.6rem 1.05rem;border-radius:999px;font-size:15px;font-weight:700;color:#d4d4d8;background:rgba(255,255,255,.08);white-space:nowrap}.an-chips button.on{background:#fff;color:#09090b}
  .an-drawer{position:absolute;top:0;right:0;bottom:0;width:min(380px,100%);background:rgba(12,12,18,.97);border-left:1px solid rgba(255,255,255,.1);transform:translateX(105%);transition:transform .35s cubic-bezier(.22,1,.36,1);z-index:5;overflow-y:auto;padding:max(18px,env(safe-area-inset-top)) 18px 26px;display:flex;flex-direction:column;gap:22px}
  #tab-anatomy.an-open .an-drawer{transform:none}.an-dh{display:flex;justify-content:space-between;align-items:center}.an-dh h3{font-size:1.5rem;font-weight:800;color:#fff}
  @media(max-width:767px){.an-drawer{top:auto;left:0;width:100%;max-height:74vh;border-left:0;border-top:1px solid rgba(255,255,255,.1);border-radius:22px 22px 0 0;transform:translateY(105%)}.an-dock{gap:6px 8px;padding:8px}.an-chips button{padding:.5rem .8rem;font-size:14px}}
  .an-ov{position:absolute;inset:0;z-index:6;display:grid;place-items:center;text-align:center;padding:24px;background:radial-gradient(circle at 50% 40%,rgba(244,63,94,.18),rgba(0,0,0,.93) 70%)}
  .an-ov h3{font-size:clamp(1.5rem,3vw,2.2rem);font-weight:800;color:#fff}.an-ov p{font-size:16px;color:#a1a1aa;max-width:460px;margin:10px auto 20px;line-height:1.5}
  .an-spin{width:44px;height:44px;margin:0 auto 18px;border-radius:50%;border:3px solid rgba(255,255,255,.15);border-top-color:#f43f5e;animation:anSp .9s linear infinite}@keyframes anSp{to{transform:rotate(360deg)}}
  .an-btn{padding:.95rem 2rem;border-radius:14px;font-weight:700;font-size:16px;color:#fff;background:linear-gradient(135deg,#f43f5e,#8b5cf6)}
  .an-mini{padding:.55rem 1rem;border-radius:12px;background:rgba(255,255,255,.12);color:#fff;font-weight:700;font-size:14px}
  .an-sec h4{font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;color:#a1a1aa;font-weight:800;margin-bottom:10px}
  .an-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 14px}.an-chk{display:flex;align-items:center;gap:10px;font-size:15.5px;font-weight:600;color:#fff;padding:6px 0;cursor:pointer}.an-chk input{width:18px;height:18px;accent-color:#f43f5e}
  .an-rng{display:grid;grid-template-columns:92px 1fr 46px;align-items:center;gap:10px;font-size:14.5px;font-weight:600;color:#e4e4e7;padding:5px 0}.an-rng input{accent-color:#f43f5e;width:100%}.an-rng output{font-size:13px;color:#a1a1aa;text-align:right}
  .an-rng select{grid-column:2/4;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:#fff;padding:.5rem .6rem;font-size:14.5px}
  .an-check{font-size:14.5px;line-height:1.7;color:#d4d4d8}.an-check b{color:#fff}.an-check .ok{color:#34d399}.an-check .warn{color:#fbbf24}.an-note{font-size:12px;line-height:1.5;color:#71717a;margin-top:6px}`;
  document.head.appendChild(st);
  const st2 = document.createElement('style');
  st2.textContent = `.an-stack{position:absolute;z-index:3;left:12px;top:calc(max(12px,env(safe-area-inset-top)) + 58px);width:min(330px,calc(100% - 24px));display:flex;flex-direction:column;gap:10px;pointer-events:none}
  .an-stack .an-info{position:static;width:100%;pointer-events:auto}
  @media(min-width:768px){.an-stack{right:12px;width:auto;flex-direction:row;justify-content:space-between;align-items:flex-start}.an-stack .an-info{width:350px}.an-stack .an-face{width:380px}}
  .an-info{padding:14px 16px 13px;border-radius:22px;background:rgba(6,14,32,.2)!important;border:1px solid rgba(150,205,255,.3)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;box-shadow:0 10px 44px -14px rgba(0,0,0,.75),inset 0 1px 0 rgba(255,255,255,.14),0 0 30px -8px rgba(90,170,255,.38)}
  .an-info-h{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#8fd3ff;text-shadow:0 0 14px rgba(80,170,255,.7),0 1px 4px rgba(0,0,0,.9);margin-bottom:8px;cursor:pointer}
  .an-info-h small{font-size:12.5px;letter-spacing:0;text-transform:none;font-weight:700;color:#fff}
  .an-check{font-size:16px;line-height:1.5;color:#f5faff;text-shadow:0 0 3px rgba(0,0,0,.95),0 1px 6px rgba(0,0,0,.95),0 0 12px rgba(0,0,0,.8)}
  .an-row{display:flex;align-items:baseline;gap:8px;padding:3px 0;flex-wrap:wrap}.an-row>span{color:#7fe4ff;min-width:68px;font-weight:800}.an-row b{color:#fff;font-weight:800}
  .an-check .ok{color:#5df2b0;font-weight:700}.an-check .warn{color:#ffd24d;font-weight:700}.an-check .bad{color:#ff7a8e;font-weight:700}.an-check .inf{color:#7fd6ff;font-weight:700}
  .an-bar{position:relative;flex:1;min-width:60px;height:7px;border-radius:99px;background:rgba(255,255,255,.2);overflow:hidden;align-self:center}.an-bar s{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:linear-gradient(90deg,#38bdf8,#a78bfa);box-shadow:0 0 10px rgba(120,190,255,.85);transition:width .25s}
  .an-mood{margin:0 0 8px;font-size:21px;font-weight:800;line-height:1.25;color:#fff;text-shadow:0 0 18px rgba(130,190,255,.6),0 2px 8px rgba(0,0,0,.95)}.an-mood small{display:block;font-size:14px;font-weight:600;color:#d8e9ff;margin-top:2px}
  .an-note{margin-top:8px;font-size:12.5px;line-height:1.5;color:#d9e6f8;text-shadow:0 1px 5px rgba(0,0,0,.95)}
  .an-info.min{padding-bottom:10px}.an-info.min .an-info-h{margin-bottom:0}
  .an-sub{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(max(14px,env(safe-area-inset-bottom)) + 96px);z-index:4;max-width:min(900px,calc(100% - 28px));text-align:center;font-size:clamp(19px,2.6vw,30px);font-weight:800;line-height:1.35;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.95),0 0 3px rgba(0,0,0,.95);padding:.5rem 1.1rem;border-radius:18px;background:rgba(0,0,0,.34);-webkit-backdrop-filter:none;backdrop-filter:none;opacity:0;transition:opacity .25s;pointer-events:none}
  .an-sub.on{opacity:1}.an-sub i{font-style:normal;opacity:.72;font-weight:700}.an-sub em{display:block;font-style:normal;font-size:.55em;font-weight:600;color:#fcd34d}
  .an-chips button#an-mic.on{background:#34d399;color:#04201a}
  @media(max-width:767px){.an-sub{bottom:calc(max(14px,env(safe-area-inset-bottom)) + 132px)}}`;
  document.head.appendChild(st2);
  v = $('#an-v'); c = $('#an-c'); x = c.getContext('2d', { desynchronized: true });
  function sync() {
    root.querySelectorAll('[data-k]').forEach(e => { const k = e.dataset.k; if (e.type === 'checkbox') e.checked = !!S[k]; else e.value = S[k]; const o = e.nextElementSibling; if (e.type === 'range' && o) o.textContent = (+S[k]).toFixed(2); });
    root.querySelectorAll('#an-look button').forEach(b => b.classList.toggle('on', b.dataset.l === S.look));
    root.classList.toggle('an-xr', S.look === 'xray'); $('#an-lbl').classList.toggle('on', !!S.labels);
  }
  root.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.k; if (!k) return; S[k] = e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.type === 'range' ? +e.target.value : e.target.value; sync(); if (k === 'lang') { try { localStorage.setItem('an_lang', S.lang); } catch (x) {} subStop(); setTimeout(subStart, 250); } });
  root.addEventListener('click', e => {
    const hh = e.target.closest('.an-info-h'); if (hh) hh.parentElement.classList.toggle('min');
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.l) { S.look = b.dataset.l; sync(); }
    if (b.dataset.q) { const q = b.dataset.q; S.skull = +(q === 'skull' || q === 'all'); S.brain = +(q === 'brain' || q === 'all'); S.muscle = +(q === 'muscle' || q === 'all'); S.eyes = 1; sync(); }
    if (b.id === 'an-reset') { S.size = S.w = S.h = 1; sync(); }
    if (b.id === 'an-lbl') { S.labels = S.labels ? 0 : 1; sync(); }
    if (b.id === 'an-set' || b.id === 'an-set2') root.classList.toggle('an-open');
    if (b.id === 'an-close') window.switchTab('online');
    if (b.id === 'an-go') start();
    if (b.id === 'an-shot') shot();
    if (b.id === 'an-mic') micToggle();
  });
  function shot() {
    const o = document.createElement('canvas'); o.width = W; o.height = H; const g = o.getContext('2d');
    g.translate(W, 0); g.scale(-1, 1); g.drawImage(v, 0, 0, W, H); g.setTransform(1, 0, 0, 1, 0, 0);
    if (S.look === 'xray') { g.fillStyle = 'rgba(0,8,26,.4)'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'screen'; } g.drawImage(c, 0, 0);
    o.toBlob(bl => { const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = 'anatomi.png'; a.click(); });
  }
  function view() { const bw = root.clientWidth || innerWidth, bh = root.clientHeight || innerHeight, w = c.width || 1280, h = c.height || 720, k = Math.max(bw / w, bh / h); vis = { s: k, x0: (w - bw / k) / 2, x1: (w + bw / k) / 2, y0: (h - bh / k) / 2, y1: (h + bh / k) / 2 }; }
  window.addEventListener('resize', view);
  sync();

  // ---------- Model ----------
  async function load() {
    const m = await import(CDN + '/+esm'), fs = await m.FilesetResolver.forVisionTasks(CDN + '/wasm');
    const mk = async (K, p, ex) => { for (const dl of ['GPU', 'CPU']) { try { return await K.createFromOptions(fs, Object.assign({ baseOptions: { modelAssetPath: MD + p, delegate: dl }, runningMode: 'VIDEO' }, ex)); } catch (e) {} } throw new Error('model'); };
    face = await mk(m.FaceLandmarker, 'face_landmarker/face_landmarker/float16/1/face_landmarker.task', { numFaces: 1, outputFaceBlendshapes: true });
    hand = await mk(m.HandLandmarker, 'hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', { numHands: 2 });
    pose = await mk(m.PoseLandmarker, 'pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', {});
  }
  const ov = (show, ttl, txt, btn) => { $('#an-ov').style.display = show ? 'grid' : 'none'; if (!show) return; $('#an-ttl').textContent = ttl; $('#an-msg').textContent = txt; $('#an-go').style.display = btn ? '' : 'none'; $('.an-spin').style.display = btn ? 'none' : ''; };

  // ---------- Ekspresi, mata, perasaan (dari blendshape wajah) ----------
  const EM = { laugh: ['😂', 'Tertawa'], smile: ['😊', 'Tersenyum'], surprise: ['😮', 'Terkejut'], angry: ['😠', 'Kesal'], sad: ['😢', 'Sedih'], sleepy: ['😴', 'Mengantuk'], neutral: ['😐', 'Netral'] };
  const MOOD = { laugh: 'Lagi senang banget', smile: 'Suasana hatimu terlihat positif', surprise: 'Terlihat kaget atau penasaran', angry: 'Terlihat kesal atau serius', sad: 'Terlihat sedih atau murung', sleepy: 'Terlihat mengantuk atau lelah', neutral: 'Terlihat tenang dan santai' };
  const BK = ['eyeBlinkLeft', 'eyeBlinkRight', 'eyeWideLeft', 'eyeWideRight', 'eyeSquintLeft', 'eyeSquintRight', 'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight', 'jawOpen', 'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight', 'mouthPressLeft', 'mouthPressRight', 'cheekSquintLeft', 'cheekSquintRight'];
  let bsv = null, expr = 'neutral', eyeSt = 'terbuka', wasClosed = false, closedSince = 0, lastBlinkAt = 0, hold = { k: 'neutral', t: 0 };
  function analyze(cats, ts) {
    if (!cats) { bsv = null; wasClosed = false; return; }
    const raw = {}; cats.forEach(c => { raw[c.categoryName] = c.score; });
    bsv = bsv || {}; BK.forEach(k => { const r = raw[k] || 0; bsv[k] = bsv[k] === undefined ? r : bsv[k] + (r - bsv[k]) * .45; });
    const g = k => bsv[k] || 0, av = (p, q) => (g(p) + g(q)) / 2, blinkRaw = ((raw.eyeBlinkLeft || 0) + (raw.eyeBlinkRight || 0)) / 2;
    // kedip dihitung dari nilai mentah supaya kedipan cepat tetap tertangkap; menutup mata lama bukan kedip
    if (blinkRaw > .5 && !wasClosed) { wasClosed = true; closedSince = ts; }
    if (blinkRaw < .3 && wasClosed) { wasClosed = false; if (ts - closedSince < 700) { blinks++; lastBlinkAt = ts; } }
    const blink = av('eyeBlinkLeft', 'eyeBlinkRight'), wide = av('eyeWideLeft', 'eyeWideRight'), squint = av('eyeSquintLeft', 'eyeSquintRight');
    eyeSt = wasClosed && ts - closedSince > 600 ? 'memejam' : (wasClosed || ts - lastBlinkAt < 350) ? 'berkedip' : (wide > .4 && blink < .25) ? 'melotot' : (squint > .5 && blink < .45) ? 'menyipit' : 'terbuka';
    const smile = av('mouthSmileLeft', 'mouthSmileRight'), frown = av('mouthFrownLeft', 'mouthFrownRight'), jaw = g('jawOpen'), bd = av('browDownLeft', 'browDownRight'),
      bu = g('browInnerUp'), bo = av('browOuterUpLeft', 'browOuterUpRight'), press = av('mouthPressLeft', 'mouthPressRight');
    let k = 'neutral';
    if (smile > .45 && jaw > .25) k = 'laugh';
    else if (smile > .3) k = 'smile';
    else if (jaw > .35 && wide > .3 && (bu > .25 || bo > .25)) k = 'surprise';
    else if (bd > .4 && (press > .2 || frown > .15 || squint > .3)) k = 'angry';
    else if (frown > .3 || (frown > .18 && bu > .2)) k = 'sad';
    else if (wasClosed && ts - closedSince > 1500) k = 'sleepy';
    if (k !== hold.k) hold = { k, t: ts };
    if (ts - hold.t > 250) expr = k; // tahan 0,25 dtk supaya tidak berkedip-kedip
  }

  // ---------- Perkiraan usia (face-api, jalan di perangkat; hanya tebakan) ----------
  const FA = 'https://cdn.jsdelivr.net/gh/vladmandic/face-api@1.7.12/';
  let ageNet = null, ageState = 'idle', ageBusy = false, nextAge = 0, ages = [], ageCv = null;
  function loadAge() {
    return new Promise((res, rej) => {
      const go = async () => { try { await window.faceapi.nets.ageGenderNet.loadFromUri(FA + 'model/'); ageNet = window.faceapi.nets.ageGenderNet; res(); } catch (e) { rej(e); } };
      if (window.faceapi) return go();
      const sc = document.createElement('script'); sc.src = FA + 'dist/face-api.js'; sc.onload = go; sc.onerror = () => rej(new Error('face-api')); document.head.appendChild(sc);
    });
  }
  function ageSample(F, ts) {
    if (ageState === 'err' || ageBusy || ts < nextAge || !F) return;
    nextAge = ts + 1400; ageBusy = true;
    (async () => {
      try {
        if (!ageNet) { ageState = 'load'; await loadAge(); }
        let x0 = 1, y0 = 1, x1 = 0, y1 = 0; for (const q of F) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
        const cx = (x0 + x1) / 2 * W, cy = (y0 + y1) / 2 * H, sz = Math.max((x1 - x0) * W, (y1 - y0) * H) * 1.2;
        ageCv = ageCv || document.createElement('canvas'); ageCv.width = ageCv.height = 112;
        ageCv.getContext('2d').drawImage(v, cx - sz / 2, cy - sz / 2, sz, sz, 0, 0, 112, 112);
        let r = await ageNet.predictAgeAndGender(ageCv); r = Array.isArray(r) ? r[0] : r;
        if (r && isFinite(r.age)) { ages.push(r.age); if (ages.length > 20) ages.shift(); if (ages.length >= 4) ageState = 'ok'; }
      } catch (e) { ageState = 'err'; }
      ageBusy = false;
    })();
  }
  const medAge = () => { const a = ages.slice().sort((p, q) => p - q); return Math.round(a[a.length >> 1]); };

  // ---------- Teks suara otomatis (SpeechRecognition bawaan browser) ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, subOn = (() => { try { return localStorage.getItem('an_sub') !== '0'; } catch (e) { return true; } })(), subFatal = '', subFin = '', subLast = 0, subHide = 0;
  function showSub(fin, it, note) {
    const box = $('#an-sub'); if (!box) return; const now = Date.now();
    if (now - subLast > 4000) subFin = ''; subLast = now;
    if (fin) subFin = (subFin + ' ' + fin).trim().slice(-140);
    box.textContent = subFin;
    if (it) { const i = document.createElement('i'); i.textContent = (subFin ? ' ' : '') + it; box.appendChild(i); }
    if (note) { const em = document.createElement('em'); em.textContent = note; box.appendChild(em); }
    box.classList.toggle('on', !!(subFin || it || note));
    clearTimeout(subHide); subHide = setTimeout(() => { box.classList.remove('on'); subFin = ''; }, note ? 7000 : 4500);
  }
  const micUI = () => { const b = $('#an-mic'); if (b) b.classList.toggle('on', !!(SR && subOn && !subFatal)); };
  function subStart() {
    micUI(); if (!SR || !subOn || !active || rec || subFatal) return;
    const r = rec = new SR(); r.lang = S.lang || 'id-ID'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = e => { let fin = '', it = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t; else it += t; } showSub(fin, it); };
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') subFatal = 'Izin mikrofon ditolak. Izinkan mikrofon untuk situs ini, lalu ketuk Teks suara.';
      else if (e.error === 'network') subFatal = 'Layanan suara browser tidak bisa dihubungi (Brave memblokirnya). Coba Chrome, Edge, atau Safari.';
      else if (e.error === 'audio-capture') subFatal = 'Mikrofon tidak ditemukan.';
      if (subFatal) { showSub('', '', subFatal); micUI(); }
    };
    r.onend = () => { rec = null; if (active && run && subOn && !subFatal) setTimeout(subStart, 350); else micUI(); };
    try { r.start(); } catch (e) { rec = null; }
  }
  function subStop() { const r = rec; rec = null; if (r) { r.onend = null; try { r.abort(); } catch (e) {} } micUI(); }
  function micToggle() {
    if (!SR) return showSub('', '', 'Browser ini belum mendukung teks suara.');
    subFatal = ''; subOn = !subOn; try { localStorage.setItem('an_sub', subOn ? '1' : '0'); } catch (e) {}
    if (subOn) subStart(); else { subStop(); $('#an-sub').classList.remove('on'); }
  }
  async function start() {
    if (run || loading) return; loading = true; ov(1, 'Menyalakan kamera', 'Izinkan kamera (dan mikrofon untuk teks suara) saat diminta browser. Video hanya diproses di perangkatmu.', 0);
    try {
      const big = innerWidth >= 768;
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: big ? 960 : 640 }, height: { ideal: big ? 540 : 480 }, frameRate: { ideal: 30 } }, audio: false });
      ov(1, 'Memuat model deteksi', 'Hanya sekali, sebentar saja...', 0);
      if (!face) await load();
      v.srcObject = stream; await v.play(); run = true; ov(0); lastT = -1; blinks = 0; t0 = performance.now(); nextF(); subStart();
    } catch (e) {
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      ov(1, 'Belum bisa memulai', e && e.name === 'NotAllowedError' ? 'Izin kamera ditolak. Izinkan kamera di pengaturan browser untuk situs ini, lalu coba lagi.' : 'Pastikan internet aktif (model dimuat sekali) dan situs dibuka lewat https.', 1);
    }
    loading = false;
  }
  function stop() { run = false; subStop(); if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; v.srcObject = null; }

  // ---------- Gambar ----------
  const colors = () => { const X = S.look === 'xray', a = +S.bright; return X ? { X, bone: `rgba(228,242,255,${.92 * a})`, glow: `rgba(110,160,255,${.3 * a})`, fill: `rgba(120,170,255,${.1 * a})`, hole: 'rgba(0,8,30,.55)', brain: `rgba(255,110,190,${.5 * a})`, mus: `rgba(255,70,80,${.38 * a})`, eye: `rgba(170,225,255,${.9 * a})`, head: 'rgba(70,130,255,.95)' } : { X, bone: '#ece5d2', glow: '#7d725a', fill: '#d9d0b8', hole: '#2a2420', brain: '#d98aa0', mus: '#b3262e', eye: '#f5f5f5', head: '#3b82f6' }; };
  const line = (pts, w) => { x.lineCap = x.lineJoin = 'round'; x.beginPath(); pts.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); if (!S.lite) { x.strokeStyle = C.glow; x.lineWidth = w * 1.7; x.stroke(); } x.strokeStyle = C.bone; x.lineWidth = C.X ? w * .5 : w; x.stroke(); };
  const shape = (fn, w, hole) => { x.lineCap = x.lineJoin = 'round'; x.beginPath(); fn(); x.fillStyle = hole ? C.hole : C.fill; x.fill(); if (!S.lite) { x.strokeStyle = C.glow; x.lineWidth = w * 1.7; x.stroke(); } x.strokeStyle = C.bone; x.lineWidth = C.X ? w * .5 : w; x.stroke(); };
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
      x.save(); x.beginPath(); ell(bc, rx, ry, ang); const bg = x.createRadialGradient(bc[0], bc[1], 0, bc[0], bc[1], Math.max(rx, ry)); bg.addColorStop(0, C.brain); bg.addColorStop(1, C.X ? 'rgba(170,60,200,.45)' : '#b8607f'); x.fillStyle = bg; x.fill(); x.clip();
      x.strokeStyle = C.X ? 'rgba(255,200,230,.7)' : '#a35c75'; x.lineWidth = fw * .012;
      for (let k = -4; k <= 4 && !S.lite; k++) { x.beginPath(); for (let t = -1; t <= 1.01; t += .08) { const o = [t * rx, k * ry * .22 + Math.sin(t * 9 + k) * ry * .07]; const q = [bc[0] + o[0] * Math.cos(ang) - o[1] * Math.sin(ang), bc[1] + o[0] * Math.sin(ang) + o[1] * Math.cos(ang)]; t <= -.99 ? x.moveTo(q[0], q[1]) : x.lineTo(q[0], q[1]); } x.stroke(); }
      x.strokeStyle = 'rgba(255,230,245,.8)'; x.lineWidth = fw * .015; x.beginPath(); x.moveTo(...add(bc, u, ry)); x.lineTo(...add(bc, u, -ry)); x.stroke();
      x.restore(); lab('Otak (serebrum)', bc, 1);
    }
    if (S.skull) {
      const c1 = sd(up(A, .95), -.06), c2 = sd(up(B, .95), .06);
      shape(() => { x.moveTo(...A); x.bezierCurveTo(...c1, ...c2, ...B);[300, 293, 334, 296, 336, 107, 66, 105, 63, 70].forEach(i => x.lineTo(...p(i))); x.closePath(); }, lw);
      { const cg = x.createRadialGradient(...up(M, .6), 0, ...up(M, .5), fh * .75); cg.addColorStop(0, C.X ? 'rgba(190,220,255,.34)' : 'rgba(255,250,235,.5)'); cg.addColorStop(1, 'rgba(0,0,0,0)'); x.beginPath(); x.moveTo(...A); x.bezierCurveTo(...c1, ...c2, ...B); x.closePath(); x.fillStyle = cg; x.fill(); }
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
    const fs = Math.round(15 / vis.s), pad = Math.round(14 / vis.s), top = vis.y0 + 110 / vis.s, bot = vis.y1 - 100 / vis.s, mx = (vis.x0 + vis.x1) / 2, L = [], R = [];
    x.font = `800 ${fs}px system-ui,sans-serif`; x.textBaseline = 'middle';
    lbl.filter(l => l[1][0] > vis.x0 && l[1][0] < vis.x1 && l[1][1] > vis.y0 && l[1][1] < vis.y1).sort((a, b) => a[1][1] - b[1][1]).forEach(l => (l[1][0] < mx ? L : R).push(l));
    [[L, 0], [R, 1]].forEach(([arr, r]) => {
      let y0 = -1e9;
      arr.forEach(([t, q]) => {
        const y = Math.min(Math.max(q[1], top, y0 + fs * 1.7), bot); y0 = y; const tx = r ? vis.x1 - pad : vis.x0 + pad, w2 = x.measureText(t).width, ex = r ? tx - w2 - 10 : tx + w2 + 10;
        x.strokeStyle = 'rgba(120,235,255,.9)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(q[0], q[1]); x.lineTo(ex, y); x.stroke(); dot(q, 3, '#7fe9ff');
        x.fillStyle = 'rgba(8,10,18,.8)'; x.fillRect(r ? tx - w2 - 8 : tx - 6, y - fs * .75, w2 + 14, fs * 1.5);
        x.fillStyle = '#8af0ff'; x.textAlign = r ? 'right' : 'left'; x.fillText(t, tx, y);
      });
    });
  }

  let lastFace = null, cur = { f: null, h: [], p: null }, sm = { f: null, h: [], p: null };
  const nextF = () => v.requestVideoFrameCallback ? v.requestVideoFrameCallback(frame) : requestAnimationFrame(frame);
  const smooth = (a, b, k) => !b ? null : (!a || a.length !== b.length) ? b : b.map((q, i) => ({ x: a[i].x + (q.x - a[i].x) * k, y: a[i].y + (q.y - a[i].y) * k, z: q.z, visibility: q.visibility }));
  function frame() {
    if (!run) return; nextF();
    if (v.readyState < 2 || (!v.requestVideoFrameCallback && v.currentTime === lastT)) return; lastT = v.currentTime;
    if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight; view(); }
    W = c.width; H = c.height; const t1 = performance.now(), ts = Math.max(t1, lastTs + 1); lastTs = ts; n++;
    try { // model dijalankan bergantian supaya tiap frame tetap ringan
      const fr = face.detectForVideo(v, ts); cur.f = fr.faceLandmarks[0] || null; cur.bs = fr.faceBlendshapes && fr.faceBlendshapes[0] ? fr.faceBlendshapes[0].categories : null;
      if (S.hand) { if (n % (S.lite ? 3 : 2) === 0) cur.h = hand.detectForVideo(v, ts).landmarks || []; } else cur.h = [];
      if (n % (S.body ? (S.lite ? 5 : 3) : 8) === 0) cur.p = pose.detectForVideo(v, ts).landmarks[0] || null;
    } catch (e) {}
    const F = sm.f = smooth(sm.f, cur.f, .6), Po = sm.p = smooth(sm.p, cur.p, .5); sm.h = cur.h.map((hh, i) => smooth(sm.h[i], hh, .6)); const Hs = sm.h;
    lastFace = F; C = colors(); x.clearRect(0, 0, W, H); lbl = []; let lens = null;
    x.save();
    if (S.reveal === 'half' && F) { const cn = mid(P(F[10]), P(F[152])); x.beginPath(); x.rect(0, 0, cn[0], H); x.clip(); }
    if (S.reveal === 'lens') { x.beginPath(); if (Hs[0]) { const q = Hs[0].map(P); lens = [lerp(mid(q[0], q[5]), q[17], .33), d(q[0], q[9]) * 2.4]; x.arc(lens[0][0], lens[0][1], lens[1], 0, 7); } else x.rect(0, 0, 0, 0); x.clip(); }
    if (S.body && Po) drawBody(Po); if (F) drawFace(F); if (S.hand) Hs.forEach(drawHand);
    x.restore();
    if (lens) { x.beginPath(); x.arc(lens[0][0], lens[0][1], lens[1], 0, 7); x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 2; x.stroke(); }
    drawLabels();
    fpsN++; if (ts - fpsT > 1000) { info.fps = fpsN; fpsN = 0; fpsT = ts; }
    if (F) {
      const r = k => P(F[k]), A = r(234), B = r(454), s = unit(A, B), ev = (a, b, e, f2) => d(r(a), r(b)) / d(r(e), r(f2));
      info.roll = norm(Math.atan2(s[1], s[0]) * 180 / Math.PI); info.yaw = ((P(F[1])[0] - mid(A, B)[0]) / (d(A, B) || 1)) * -120; info.pitch = ((d(r(1), mid(r(33), r(263))) / (d(r(10), r(152)) || 1)) - .3) * 220; info.fw = d(A, B) / W;
      if (!cur.bs) { const ear = (ev(159, 145, 33, 133) + ev(386, 374, 362, 263)) / 2; if (ear < .17 && !closed) { blinks++; closed = true; } if (ear > .21) closed = false; }
    }
    if (Po && Po[11] && Po[12]) { const a = P(Po[11]), b = P(Po[12]); info.tilt = norm(Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI); } else info.tilt = null;
    if (Hs[0]) { const q = Hs[0].map(P); info.open = [8, 12, 16, 20].reduce((s2, i) => s2 + d(q[i], q[0]), 0) / 4 / (d(q[0], q[9]) || 1); } else info.open = null;
    info.face = !!F; info.hands = Hs.length; info.body = !!Po;
    analyze(F ? cur.bs : null, ts); if (F) ageSample(cur.f, ts);
    slow = slow * .92 + (performance.now() - t1) * .08; if (!S.lite && n > 45 && slow > 42) { S.lite = 1; sync(); } // otomatis hemat kalau berat
    if (ts - uiT > 400) { uiT = ts; ui(ts); }
  }
  const cls = (ok, t) => `<span class="${ok ? 'ok' : 'warn'}">${t}</span>`;
  const tag = (k, t) => `<span class="${k}">${t}</span>`;
  const row = (l, v) => `<div class="an-row"><span>${l}</span>${v}</div>`;
  const bar = p => `<i class="an-bar"><s style="width:${Math.round(Math.min(1, Math.max(0, p)) * 100)}%"></s></i>`;
  function ui(ts) {
    const ck = $('#an-check'), min = (ts - t0) / 60000, rows = [];
    rows.push(row('Bahu', info.tilt == null ? '<b>belum terlihat</b>' : `<b>${Math.abs(info.tilt).toFixed(1)}°</b> ${cls(Math.abs(info.tilt) < 4, Math.abs(info.tilt) < 4 ? 'sejajar' : 'miring')}`));
    rows.push(row('Kepala', info.face ? `<b>${Math.abs(info.roll).toFixed(1)}°</b> ${cls(Math.abs(info.roll) < 6, Math.abs(info.roll) < 6 ? 'tegak' : 'miring')}` : '<b>belum terlihat</b>'));
    if (info.face) rows.push(row('Jarak', info.fw > .55 ? cls(0, 'terlalu dekat') : info.fw < .16 ? cls(0, 'terlalu jauh') : cls(1, 'pas')));
    if (info.face && min > .15) rows.push(row('Kedip', `<b>${Math.round(blinks / min)}</b>/menit ${cls(blinks / min >= 8, blinks / min >= 8 ? 'wajar' : 'jarang, istirahatkan mata')}`));
    rows.push(row('Tangan', info.open == null ? '<b>belum terlihat</b>' : `<b>${info.open > 1.7 ? 'terbuka' : 'mengepal'}</b>`));
    ck.innerHTML = rows.join(''); $('#an-state').textContent = (S.lite ? 'hemat · ' : '') + (info.fps || 0) + ' fps';

    // wajah & perasaan
    const fc = $('#an-fcheck'), fs = $('#an-fs');
    if (!info.face || !bsv) { fc.innerHTML = 'Wajah belum terlihat. Hadapkan wajahmu ke kamera.'; fs.textContent = ''; }
    else {
      const g = k => bsv[k] || 0, av = (p, q) => (g(p) + g(q)) / 2, smile = av('mouthSmileLeft', 'mouthSmileRight'), frown = av('mouthFrownLeft', 'mouthFrownRight'),
        jaw = g('jawOpen'), bd = av('browDownLeft', 'browDownRight'), bu = Math.max(g('browInnerUp'), av('browOuterUpLeft', 'browOuterUpRight')), open = 1 - av('eyeBlinkLeft', 'eyeBlinkRight');
      const [em, nm] = EM[expr], fr = [];
      fr.push(`<div class="an-mood">${em} ${MOOD[expr]}<small>Ekspresi: ${nm}</small></div>`);
      const age = ages.length ? medAge() : 0;
      fr.push(row('Usia', ageState === 'ok' ? `<b>≈ ${age} th</b> ${tag('inf', 'kisaran ' + Math.max(1, age - 5) + '–' + (age + 5))}` : ageState === 'err' ? tag('warn', 'belum tersedia') : tag('inf', 'mengukur…')));
      fr.push(row('Mata', `<b>${eyeSt}</b> ${bar(open)}`));
      fr.push(row('Senyum', `${bar(smile / .7)} <b>${Math.round(Math.min(1, smile / .7) * 100)}%</b>`));
      fr.push(row('Alis', bd > .4 ? tag('warn', 'mengerut') : bu > .35 ? tag('inf', 'terangkat') : '<b>normal</b>'));
      fr.push(row('Mulut', jaw > .5 ? '<b>terbuka lebar</b>' : jaw > .2 ? '<b>terbuka</b>' : smile > .3 ? '<b>tersenyum</b>' : frown > .3 ? '<b>cemberut</b>' : '<b>rapat</b>'));
      fr.push(row('Suara', !SR ? tag('warn', 'tidak didukung browser ini') : subFatal ? tag('bad', 'tidak aktif') : subOn ? tag('ok', 'teks suara aktif · ' + (S.lang || 'id-ID')) : tag('inf', 'mati')));
      fc.innerHTML = fr.join(''); fs.textContent = em + ' ' + nm;
    }
    const hud = $('#an-hud'); hud.style.display = S.track ? 'block' : 'none';
    if (S.track) hud.textContent = `FPS ${info.fps || 0}\nWajah ${info.face ? 'ya' : '-'}  Tangan ${info.hands}  Tubuh ${info.body ? 'ya' : '-'}` + (info.face ? `\nYaw ≈${(info.yaw || 0).toFixed(0)}°  Pitch ≈${(info.pitch || 0).toFixed(0)}°  Roll ${(info.roll || 0).toFixed(0)}°` : '');
  }

  // masuk tab = layar penuh + langsung minta izin kamera; keluar tab = kamera mati
  function enter() {
    active = true; document.documentElement.style.overflow = 'hidden'; root.classList.remove('an-open'); $('#an-info').classList.remove('min'); $('#an-face').classList.remove('min'); ages = []; ageState = ageNet ? 'load' : 'idle'; subFatal = '';
    if (innerWidth >= 768 && root.requestFullscreen && !document.fullscreenElement) root.requestFullscreen().catch(() => {});
    view(); start();
  }
  function leave() { active = false; document.documentElement.style.overflow = ''; stop(); if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); }
  const o = window.switchTab;
  if (typeof o === 'function') window.switchTab = function (t) { const r = o.apply(this, arguments); if (t === 'anatomy') { if (!active) enter(); } else if (active) leave(); return r; };
  document.addEventListener('fullscreenchange', () => { if (active && !document.fullscreenElement && innerWidth >= 768) window.switchTab('online'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && run) stop(); else if (!document.hidden && active && !run) start(); });
  window.LNAnatomy = { _t: { analyze, state: () => ({ expr, eyeSt, blinks }) }, S, drawFace, drawHand, drawBody, setup(ctx, w, h) { x = ctx; W = w; H = h; C = colors(); } };
})();
