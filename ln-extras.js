/**
 * LNMusic Extras Module (Leo & Nana Edition)
 * Terintegrasi langsung dengan playTrack, setVolume, connections, dan renderChat di index.html
 */
(function () {
  const JADIAN_DATE = new Date('2026-11-15T00:00:00+07:00');
  const STORAGE_KEY = 'lnmusic_extras_v2';

  const defaultState = {
    bdayLeo: '2004-05-12',
    bdayNana: '2005-08-20',
    currentUser: localStorage.getItem('ln_user') || 'Leo',
    upstashUrl: '',
    upstashToken: '',
    sharedFavorites: [
      { id: 'vGJTaP6anOU', title: 'Sempurna', artist: 'Andra & The Backbone', addedBy: 'Leo', time: '15 Nov 2026' },
      { id: '2Vv-BfVoq4g', title: 'Perfect', artist: 'Ed Sheeran', addedBy: 'Nana', time: '16 Nov 2026' }
    ],
    playHistory: [],
    cloudMediaChats: [],
    moods: {
      Leo: { emoji: '🥰', text: 'Kangen Nana terus' },
      Nana: { emoji: '🎧', text: 'Lagi santai dengerin lagu' }
    },
    gameScore: { Leo: 0, Nana: 0 },
    activeQuiz: null
  };

  let state = Object.assign({}, defaultState, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;
  let currentOurTab = 'fav';

  function saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Penyimpanan lokal penuh:', e);
    }
  }

  const escx = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const okMedia = m => m && ((m.kind === 'image' && /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(m.data || '')) ||
    (m.kind === 'audio' && /^data:audio\/[a-z0-9.+-]+(;codecs=[a-z0-9.,-]+)?;base64,[A-Za-z0-9+\/=]+$/i.test(m.data || '')));

  function getActiveUser() {
    if (typeof myDisplayName !== 'undefined' && myDisplayName) return myDisplayName === 'Nuki' ? 'Leo' : myDisplayName;
    return state.currentUser || 'Leo';
  }

  // 1. CLOUD SYNC (UPSTASH REDIS / VERCEL KV REST API)
  async function kvCommand(cmdArray) {
    if (!state.upstashUrl || !state.upstashToken) return null;
    try {
      const res = await fetch(state.upstashUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${state.upstashToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cmdArray)
      });
      const data = await res.json();
      return data.result;
    } catch (e) {
      return null;
    }
  }

  async function syncToCloud() {
    if (!state.upstashUrl || !state.upstashToken) return;
    const payload = JSON.stringify({
      sharedFavorites: state.sharedFavorites,
      playHistory: state.playHistory.slice(0, 50),
      cloudMediaChats: state.cloudMediaChats.slice(-60),
      moods: state.moods,
      gameScore: state.gameScore,
      bdayLeo: state.bdayLeo,
      bdayNana: state.bdayNana,
      textChatBackup: typeof chatLog !== 'undefined' ? chatLog.slice(-80) : []
    });
    await kvCommand(['SET', 'lnmusic_room_data', payload]);
    updateCloudBadge(true);
  }

  async function pullFromCloud() {
    if (!state.upstashUrl || !state.upstashToken) return;
    const raw = await kvCommand(['GET', 'lnmusic_room_data']);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      state.sharedFavorites = parsed.sharedFavorites || state.sharedFavorites;
      state.playHistory = parsed.playHistory || state.playHistory;
      state.cloudMediaChats = parsed.cloudMediaChats || state.cloudMediaChats;
      state.moods = parsed.moods || state.moods;
      state.gameScore = parsed.gameScore || state.gameScore;
      if (parsed.bdayLeo) state.bdayLeo = parsed.bdayLeo;
      if (parsed.bdayNana) state.bdayNana = parsed.bdayNana;

      if (Array.isArray(parsed.textChatBackup) && typeof chatLog !== 'undefined') {
        let added = false;
        parsed.textChatBackup.forEach(msg => {
          if (msg.id && !chatLog.some(x => x.id === msg.id)) {
            chatLog.push(Object.assign({}, msg, { isMe: msg.sender === getActiveUser() }));
            added = true;
          }
        });
        if (added && typeof renderChat === 'function') {
          chatLog.sort((a, b) => (a.ts || 0) - (b.ts || 0));
          renderChat();
        }
      }

      saveLocal();
      renderAllExtras();
      updateCloudBadge(true);
    } catch (e) {}
  }

  function updateCloudBadge(connected) {
    const el = document.getElementById('ln-cloud-status');
    if (!el) return;
    if (connected) {
      el.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Cloud KV Aktif`;
      el.className = 'inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
    } else {
      el.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> Mode Lokal`;
      el.className = 'inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30';
    }
  }

  // 2. HARI SPESIAL
  function getSpecialDayStats() {
    const now = new Date();
    const diffMs = now - JADIAN_DATE;
    const daysTogether = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    let nextAnniv = new Date(now.getFullYear(), 10, 15);
    if (now > nextAnniv && now.toDateString() !== nextAnniv.toDateString()) {
      nextAnniv.setFullYear(now.getFullYear() + 1);
    }
    const daysToAnniv = Math.ceil((nextAnniv - now) / (1000 * 60 * 60 * 24));

    function nextBirthday(dateStr, name) {
      if (!dateStr) return null;
      const [, m, d] = dateStr.split('-').map(Number);
      let target = new Date(now.getFullYear(), m - 1, d);
      if (now > target && now.toDateString() !== target.toDateString()) {
        target.setFullYear(now.getFullYear() + 1);
      }
      const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
      return { name, days: diff, isToday: now.getMonth() === m - 1 && now.getDate() === d };
    }

    const bLeo = nextBirthday(state.bdayLeo, 'Leo');
    const bNana = nextBirthday(state.bdayNana, 'Nana');
    const nearestBday = !bLeo ? bNana : !bNana ? bLeo : bLeo.days <= bNana.days ? bLeo : bNana;

    let autoGreeting = null;
    if (now.getMonth() === 10 && now.getDate() === 15 && daysTogether >= 365) {
      const yrs = Math.floor(daysTogether / 365);
      autoGreeting = `🎉 Happy ${yrs}st Anniversary Leo & Nana! Terima kasih sudah bertahan & tumbuh bareng sejauh ini ❤️`;
    } else if (now.getDate() === 15 && daysTogether > 0) {
      const months = Math.max(1, Math.round(daysTogether / 30));
      autoGreeting = `💖 Happy ${months} Month Mensiversary Leo & Nana! Semoga makin sayang tiap harinya ✨`;
    } else if (bNana && bNana.isToday) {
      autoGreeting = `🎂 Selamat Ulang Tahun Sayangku Nana! Semoga selalu bahagia, sehat, dan lagu-lagu di sini selalu nemenin kamu ❤️`;
    } else if (bLeo && bLeo.isToday) {
      autoGreeting = `🎂 Selamat Ulang Tahun Leo! Makasih sudah bikin ruang spesial ini buat kita berdua ❤️`;
    }

    return { daysTogether, daysToAnniv, nearestBday, autoGreeting };
  }

  // 3. HOOK KE FUNGSI BAWAAN INDEX.HTML
  function hookCoreFunctions() {
    if (typeof window.renderChat === 'function' && !window.renderChat._lnWrapped) {
      const origRenderChat = window.renderChat;
      window.renderChat = function () {
        origRenderChat.apply(this, arguments);
        renderMediaChatsIntoContainers();
      };
      window.renderChat._lnWrapped = true;
    }

    if (typeof window.appendUserChat === 'function' && !window.appendUserChat._lnWrapped) {
      const origAppendUserChat = window.appendUserChat;
      window.appendUserChat = function (sender, text, isMe, meta) {
        origAppendUserChat.apply(this, arguments);
        syncToCloud();
      };
      window.appendUserChat._lnWrapped = true;
    }

    if (typeof window.handleIncomingSyncData === 'function' && !window.handleIncomingSyncData._lnWrapped) {
      const origHandleSync = window.handleIncomingSyncData;
      window.handleIncomingSyncData = function (data, conn) {
        if (data && data.type === 'LN_MEDIA_CHAT' && data.payload) {
          if (!state.cloudMediaChats.some(m => m.id === data.payload.id)) {
            state.cloudMediaChats.push(data.payload);
            saveLocal();
            renderMediaChatsIntoContainers();
          }
          return;
        }
        origHandleSync.apply(this, arguments);
      };
      window.handleIncomingSyncData._lnWrapped = true;
    }

    if (typeof window.playTrack === 'function' && !window.playTrack._lnWrapped) {
      const origPlayTrack = window.playTrack;
      window.playTrack = function (track, autoOpenFull) {
        origPlayTrack.apply(this, arguments);
        if (track && track.title) {
          state.playHistory.unshift({
            id: track.id || '',
            title: track.title,
            artist: track.artist || 'LNMusic',
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          });
          state.playHistory = state.playHistory.slice(0, 50);
          saveLocal();
          renderAllExtras();
        }
      };
      window.playTrack._lnWrapped = true;
    }
  }

  function renderMediaChatsIntoContainers() {
    if (!state.cloudMediaChats.length) return;
    const me = getActiveUser();
    const html = state.cloudMediaChats.filter(okMedia).slice(-40).map(msg => {
      const isMe = msg.sender === me;
      const body = msg.kind === 'image'
        ? `<img src="${msg.data}" class="max-w-[180px] rounded-xl border border-white/15 mt-1 cursor-pointer" onclick="window.open(this.src)" />`
        : `<audio controls src="${msg.data}" class="h-8 max-w-[205px] mt-1"></audio>`;
      return `
        <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} mt-1.5">
          <span class="text-[10px] text-zinc-400 mb-0.5">${escx(msg.sender)} • ${escx(msg.time)}</span>
          <div class="px-2.5 py-2 rounded-2xl max-w-[82%] ${isMe ? 'bg-rose-600/35 border border-rose-500/30' : 'bg-white/10 border border-white/10'}">
            ${body}
          </div>
        </div>
      `;
    }).join('');

    ['room-chat-messages', 'fs-chat-messages'].forEach(id => {
      const box = document.getElementById(id);
      if (!box) return;
      let mediaWrapper = box.querySelector('.ln-media-chat-layer');
      if (!mediaWrapper) {
        mediaWrapper = document.createElement('div');
        mediaWrapper.className = 'ln-media-chat-layer space-y-1.5 pt-2 border-t border-white/5 mt-2';
        box.appendChild(mediaWrapper);
      }
      mediaWrapper.innerHTML = html;
      box.scrollTop = box.scrollHeight;
    });
  }

  // 4. UI INJECTION
  function injectUI() {
    const mainContainer = document.querySelector('.max-w-5xl');
    if (!mainContainer || document.getElementById('ln-lagu-kita')) return;

    const hub = document.createElement('div');
    hub.id = 'ln-special-hub';
    hub.className = 'space-y-4';
    hub.innerHTML = `
      <div id="ln-auto-greeting" class="hidden rounded-2xl p-4 bg-gradient-to-r from-rose-600/30 via-pink-600/25 to-violet-600/30 border border-rose-400/40 text-center shadow-lg">
        <p id="ln-auto-greeting-text" class="text-xs md:text-sm font-bold text-white"></p>
      </div>

      <div id="ln-lagu-kita" hidden aria-hidden="true" style="display:none" class="hidden glass rounded-2xl p-4 md:p-5 border border-white/10 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 class="text-sm font-extrabold text-white"><i data-lucide="heart" class="w-4 h-4 text-rose-400 inline -mt-0.5"></i> Lagu Kita</h4>
              <p class="text-[11px] text-zinc-400">Koleksi lagu spesial Leo &amp; Nana.</p>
            </div>
            <div class="flex gap-1.5">
              <button onclick="LNExtras.addCurrentToOurSongs()" class="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-[11px] font-bold text-white">+ Lagu Aktif</button>
              <button onclick="LNExtras.promptAddOurSong()" class="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-white">+ Manual</button>
            </div>
          </div>

          <div class="flex gap-2 border-b border-white/10 pb-2">
            <button onclick="LNExtras.switchOurSongTab('fav')" id="ln-tab-fav" class="px-3 py-1 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300"><i data-lucide="heart" class="w-3.5 h-3.5 inline -mt-0.5"></i> Favorit (<span id="ln-fav-count">0</span>)</button>
            <button onclick="LNExtras.switchOurSongTab('hist')" id="ln-tab-hist" class="px-3 py-1 rounded-lg text-xs font-medium text-zinc-400 hover:text-white"><i data-lucide="history" class="w-3.5 h-3.5 inline -mt-0.5"></i> Riwayat Bareng (<span id="ln-hist-count">0</span>)</button>
          </div>

          <div id="ln-our-songs-list" class="space-y-2 max-h-96 overflow-y-auto pr-1"></div>
        </div>
    `;

    const heroBanner = mainContainer.children[0];
    const plTab = document.getElementById('tab-playlists');
    const greet = hub.querySelector('#ln-auto-greeting'), lagu = hub.querySelector('#ln-lagu-kita');
    // sapaan spesial tetap muncul di beranda, Lagu Kita masuk tab Playlist
    if (heroBanner) heroBanner.insertAdjacentElement('afterend', greet); else mainContainer.prepend(greet);
    if (plTab) plTab.insertBefore(lagu, plTab.children[1] || null); else mainContainer.appendChild(lagu);
    try { window.lucide && lucide.createIcons(); } catch (e) {}

    ['room-chat-input', 'fs-room-chat-input'].forEach(inputId => {
      const chatInput = document.getElementById(inputId);
      if (chatInput && chatInput.parentElement && !chatInput.parentElement.querySelector('.ln-media-btns')) {
        const mediaBtns = document.createElement('div');
        mediaBtns.className = 'ln-media-btns flex items-center gap-1 shrink-0';
        mediaBtns.innerHTML = `
          <label class="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 cursor-pointer transition" title="Kirim Foto">
            📷
            <input type="file" accept="image/*" class="hidden" onchange="LNExtras.sendPhotoChat(event)" />
          </label>
          <button type="button" onclick="LNExtras.toggleVoiceNote(this)" class="ln-vn-btn p-2 rounded-xl bg-white/10 hover:bg-rose-500/25 text-zinc-200 transition" title="Rekam Voice Note">
            🎤
          </button>
        `;
        chatInput.parentElement.insertBefore(mediaBtns, chatInput);
      }
    });

    const modal = document.createElement('div');
    modal.id = 'ln-config-modal';
    modal.className = 'hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="glass rounded-3xl max-w-md w-full p-6 space-y-4 border border-white/15">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-extrabold text-white">⚙️ Pengaturan Spesial &amp; Cloud KV</h3>
          <button onclick="LNExtras.closeConfigModal()" class="text-zinc-400 hover:text-white text-sm">✕</button>
        </div>
        <div class="space-y-3 text-xs">
          <div>
            <label class="text-zinc-400 block mb-1">Kamu Login Sebagai:</label>
            <select id="cfg-who" class="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white">
              <option value="Leo">Leo</option>
              <option value="Nana">Nana</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-zinc-400 block mb-1">Ultah Leo:</label>
              <input id="cfg-bday-leo" type="date" class="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white" />
            </div>
            <div>
              <label class="text-zinc-400 block mb-1">Ultah Nana:</label>
              <input id="cfg-bday-nana" type="date" class="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white" />
            </div>
          </div>
          <div class="pt-2 border-t border-white/10 space-y-2">
            <label class="font-bold text-emerald-300 block">Database Permanen (Upstash Redis / Vercel KV)</label>
            <p class="text-[11px] text-zinc-400">Tempel REST URL &amp; REST TOKEN dari Upstash / Vercel KV agar chat, foto, voice note, dan lagu kita tersimpan permanen.</p>
            <input id="cfg-kv-url" type="url" placeholder="https://xxxx.upstash.io" class="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white" />
            <input id="cfg-kv-token" type="password" placeholder="AXxx... (Upstash REST Token)" class="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white" />
          </div>
        </div>
        <div class="flex gap-2 pt-2">
          <button onclick="LNExtras.saveConfig()" class="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white">Simpan &amp; Sinkronkan</button>
          <button onclick="LNExtras.closeConfigModal()" class="px-4 py-2.5 rounded-xl bg-white/10 text-xs font-semibold text-white">Tutup</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function renderAllExtras() {
    const stats = getSpecialDayStats();
    const elGreet = document.getElementById('ln-auto-greeting');
    const elGreetTxt = document.getElementById('ln-auto-greeting-text');

    if (elGreet && elGreetTxt) {
      if (stats.autoGreeting) {
        elGreet.classList.remove('hidden');
        elGreetTxt.textContent = stats.autoGreeting;
      } else {
        elGreet.classList.add('hidden');
      }
    }

    const favCnt = document.getElementById('ln-fav-count');
    const histCnt = document.getElementById('ln-hist-count');
    if (favCnt) favCnt.textContent = state.sharedFavorites.length;
    if (histCnt) histCnt.textContent = state.playHistory.length;

    const listBox = document.getElementById('ln-our-songs-list');
    if (listBox) {
      const items = currentOurTab === 'fav' ? state.sharedFavorites : state.playHistory;
      if (!items.length) {
        listBox.innerHTML = `<p class="text-xs text-zinc-500 text-center py-4">Belum ada lagu di daftar ini.</p>`;
      } else {
        listBox.innerHTML = items.map((item, idx) => `
          <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition">
            <div class="min-w-0 flex-1">
              <div class="text-xs font-semibold text-white truncate">${escx(item.title)} ${item.artist ? `- ${escx(item.artist)}` : ''}</div>
              <div class="text-[10px] text-zinc-400">
                ${currentOurTab === 'fav'
                  ? `Ditambahkan oleh <span class="text-rose-300 font-bold">${escx(item.addedBy)}</span> • ${item.time || ''}`
                  : `Diputar bareng • ${item.time || ''}`}
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button onclick="LNExtras.playSongAt(${idx})" class="px-2.5 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-[11px] font-bold text-white">Putar</button>
              ${currentOurTab === 'fav' ? `<button onclick="LNExtras.removeFav(${idx})" class="p-1 text-zinc-500 hover:text-red-400 text-xs">✕</button>` : ''}
            </div>
          </div>
        `).join('');
      }
    }

    renderMediaChatsIntoContainers();

    updateCloudBadge(Boolean(state.upstashUrl && state.upstashToken));
  }

  // 5. FOTO & VOICE NOTE
  function broadcastMediaChat(msgObj) {
    state.cloudMediaChats.push(msgObj);
    saveLocal();
    renderMediaChatsIntoContainers();
    if (typeof connections !== 'undefined' && Array.isArray(connections)) {
      connections.forEach(c => {
        if (c && c.open) c.send({ type: 'LN_MEDIA_CHAT', payload: msgObj });
      });
    }
    syncToCloud();
  }

  function sendPhotoChat(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement('canvas');
        const maxW = 640;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        broadcastMediaChat({
          id: Date.now().toString(36),
          sender: getActiveUser(),
          kind: 'image',
          data: canvas.toDataURL('image/jpeg', 0.72),
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  async function toggleVoiceNote() {
    const btns = document.querySelectorAll('.ln-vn-btn');
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
          const blob = new Blob(audioChunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            broadcastMediaChat({
              id: Date.now().toString(36),
              sender: getActiveUser(),
              kind: 'audio',
              data: reader.result,
              time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            });
          };
          reader.readAsDataURL(blob);
          stream.getTracks().forEach(t => t.stop());
        };
        mediaRecorder.start();
        isRecording = true;
        btns.forEach(b => { b.textContent = '⏹️'; b.classList.add('bg-rose-600', 'animate-pulse'); });
      } catch (err) {
        alert('Izin mikrofon ditolak atau tidak tersedia.');
      }
    } else {
      mediaRecorder.stop();
      isRecording = false;
      btns.forEach(b => { b.textContent = '🎤'; b.classList.remove('bg-rose-600', 'animate-pulse'); });
    }
  }

  window.LNExtras = {
    switchOurSongTab(tab) {
      currentOurTab = tab;
      document.getElementById('ln-tab-fav').className = tab === 'fav'
        ? 'px-3 py-1 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300'
        : 'px-3 py-1 rounded-lg text-xs font-medium text-zinc-400 hover:text-white';
      document.getElementById('ln-tab-hist').className = tab === 'hist'
        ? 'px-3 py-1 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300'
        : 'px-3 py-1 rounded-lg text-xs font-medium text-zinc-400 hover:text-white';
      renderAllExtras();
    },
    addCurrentToOurSongs() {
      if (typeof currentTrack === 'undefined' || !currentTrack) {
        return alert('Putar satu lagu dulu untuk ditambahkan ke Lagu Kita!');
      }
      state.sharedFavorites.unshift({
        id: currentTrack.id || '',
        title: currentTrack.title || 'Lagu Favorit',
        artist: currentTrack.artist || 'LNMusic',
        addedBy: getActiveUser(),
        time: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      });
      saveLocal();
      syncToCloud();
      renderAllExtras();
    },
    promptAddOurSong() {
      const title = prompt('Masukkan judul lagu:');
      if (!title) return;
      const artist = prompt('Nama penyanyi:') || 'LNMusic';
      const id = prompt('ID YouTube (opsional, contoh: dQw4w9WgXcQ):') || '';
      state.sharedFavorites.unshift({
        id: id.trim(),
        title: title.trim(),
        artist: artist.trim(),
        addedBy: getActiveUser(),
        time: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      });
      saveLocal();
      syncToCloud();
      renderAllExtras();
    },
    removeFav(idx) {
      state.sharedFavorites.splice(idx, 1);
      saveLocal();
      syncToCloud();
      renderAllExtras();
    },
    playSongAt(idx) {
      const it = (currentOurTab === 'fav' ? state.sharedFavorites : state.playHistory)[idx];
      if (it) this.playSongItem(it.id || '', it.title || '', it.artist || 'LNMusic');
    },
    playSongItem(id, title, artist) {
      if (typeof window.playTrack === 'function' && id) {
        window.playTrack({ id, title, artist, type: 'youtube' }, true);
      } else if (typeof window.quickSearch === 'function') {
        window.quickSearch(`${title} ${artist}`, 'music');
      }
    },
    sendPhotoChat,
    toggleVoiceNote,
    openConfigModal() {
      document.getElementById('cfg-who').value = getActiveUser() === 'Nana' ? 'Nana' : 'Leo';
      document.getElementById('cfg-bday-leo').value = state.bdayLeo;
      document.getElementById('cfg-bday-nana').value = state.bdayNana;
      document.getElementById('cfg-kv-url').value = state.upstashUrl;
      document.getElementById('cfg-kv-token').value = state.upstashToken;
      document.getElementById('ln-config-modal').classList.remove('hidden');
    },
    closeConfigModal() {
      document.getElementById('ln-config-modal').classList.add('hidden');
    },
    async saveConfig() {
      state.currentUser = document.getElementById('cfg-who').value;
      localStorage.setItem('ln_user', state.currentUser);
      state.bdayLeo = document.getElementById('cfg-bday-leo').value;
      state.bdayNana = document.getElementById('cfg-bday-nana').value;
      state.upstashUrl = document.getElementById('cfg-kv-url').value.trim();
      state.upstashToken = document.getElementById('cfg-kv-token').value.trim();
      saveLocal();
      await syncToCloud();
      renderAllExtras();
      this.closeConfigModal();
    }
  };

  window.addEventListener('DOMContentLoaded', () => {
    hookCoreFunctions();
    injectUI();
    renderAllExtras();
    pullFromCloud();
    setInterval(pullFromCloud, 12000);
  });
})();
