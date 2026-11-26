/* LNMusic desktop: pencarian di top bar + tooltip menu. Hanya berpengaruh di layar >= 768px (top bar disembunyikan di HP). */
(function () {
  var bar = document.getElementById('ln-top');
  if (!bar) return;

  // Desktop navigation: icon-only, while labels remain available to assistive tech and tooltips.
  var navItems = {
    online: { label: 'Beranda', icon: 'house' },
    together: { label: 'Bareng', icon: 'headphones' },
    videocall: { label: 'Video Call', icon: 'video' },
    playlists: { label: 'Playlist', icon: 'list-music' },
  };
  bar.querySelectorAll('nav .nav-btn').forEach(function (b) {
    var m = (b.getAttribute('onclick') || '').match(/switchTab\('(\w+)'\)/);
    var item = m && navItems[m[1]];
    if (!item) return;
    var sp = b.querySelector('span');
    b.title = item.label;
    b.setAttribute('aria-label', item.label);
    if (sp) sp.innerHTML = '<i data-lucide="' + item.icon + '" aria-hidden="true"></i>';
  });

  // Keep the change isolated to the desktop top navigation; mobile navigation is untouched.
  var navStyle = document.createElement('style');
  navStyle.id = 'ln-desktop-icon-nav-style';
  navStyle.textContent = `
    @media (min-width: 768px) {
      #ln-top {
        min-height: 76px !important; height: 76px !important;
        padding: 0 30px !important; gap: 22px !important;
        background: rgba(9,9,14,.84) !important;
        border-bottom: 1px solid rgba(255,255,255,.075) !important;
        box-shadow: 0 10px 34px -24px rgba(0,0,0,.95), 0 1px 0 rgba(244,63,94,.08) !important;
      }
      #ln-top > div:first-child { gap: 24px !important; }
      #ln-top nav {
        gap: 8px !important; padding: 6px !important;
        border-radius: 19px !important;
        background: rgba(255,255,255,.035) !important;
        border: 1px solid rgba(255,255,255,.075) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.025) !important;
      }
      #ln-top nav #nav-offline { display: none !important; }
      #ln-top nav .nav-btn {
        width: 52px !important; min-width: 52px !important; height: 52px !important;
        padding: 0 !important; display: inline-flex !important; align-items: center !important;
        justify-content: center !important; border-radius: 15px !important;
        font-size: 0 !important; line-height: 1 !important;
        border: 1px solid transparent !important;
        background: transparent !important;
        transition: background .2s ease, border-color .2s ease, transform .2s ease, box-shadow .2s ease !important;
      }
      #ln-top nav .nav-btn > span {
        display: grid !important; place-items: center !important;
        width: 100% !important; height: 100% !important; gap: 0 !important;
      }
      #ln-top nav .nav-btn svg {
        display: block !important; width: 26px !important; height: 26px !important;
        padding: 0 !important; border-radius: 0 !important; background: none !important;
        stroke-width: 1.85 !important;
      }
      #ln-top nav .nav-btn:hover {
        transform: translateY(-1px);
        background: rgba(255,255,255,.075) !important;
        border-color: rgba(255,255,255,.09) !important;
      }
      #ln-top nav .nav-btn.text-rose-400 {
        color: #fff !important;
        background: linear-gradient(140deg, rgba(244,63,94,.28), rgba(139,92,246,.28)) !important;
        border-color: rgba(244,63,94,.34) !important;
        box-shadow: 0 7px 20px -12px rgba(244,63,94,.9), inset 0 1px 0 rgba(255,255,255,.07) !important;
      }
      #ln-top-search {
        flex: 1 1 320px !important; max-width: 460px !important; min-width: 180px !important;
        margin: 0 auto !important;
      }
      #ln-top-search svg { left: 16px !important; width: 18px !important; height: 18px !important; }
      #ln-top-q {
        height: 46px !important; border-radius: 15px !important;
        background: rgba(255,255,255,.045) !important;
        border-color: rgba(255,255,255,.075) !important;
        padding-left: 46px !important; font-size: 13px !important;
      }
      #ln-top-q:focus {
        background: rgba(255,255,255,.075) !important;
        border-color: rgba(244,63,94,.48) !important;
        box-shadow: 0 0 0 3px rgba(244,63,94,.11) !important;
      }
      #ln-top > div:last-child { gap: 10px !important; }
      #ln-top > div:last-child > button {
        width: 42px !important; height: 42px !important;
        border-radius: 14px !important;
        background: rgba(255,255,255,.045) !important;
        border: 1px solid rgba(255,255,255,.06) !important;
      }
      #ln-top > div:last-child > button:hover {
        background: rgba(255,255,255,.1) !important;
        border-color: rgba(255,255,255,.12) !important;
      }
      #ln-top > div:last-child > button svg { width: 19px !important; height: 19px !important; }
      #ln-top nav .nav-btn:focus-visible, #ln-top > div:last-child > button:focus-visible {
        outline: 2px solid rgba(251,113,133,.9) !important;
        outline-offset: 3px !important;
      }
    }
    @media (min-width: 768px) and (max-width: 1100px) {
      #ln-top { padding: 0 16px !important; gap: 12px !important; }
      #ln-top > div:first-child { gap: 12px !important; }
      #ln-top nav { gap: 4px !important; }
      #ln-top nav .nav-btn { width: 46px !important; min-width: 46px !important; height: 46px !important; }
      #ln-top nav .nav-btn svg { width: 23px !important; height: 23px !important; }
      #ln-top-search { min-width: 130px !important; }
    }
  `;
  document.head.appendChild(navStyle);
  var right = bar.lastElementChild;
  if (right) right.querySelectorAll('button').forEach(function (b) { if (!b.title) b.title = b.textContent.replace(/\s+/g, ' ').trim(); });

  // Pencarian di top bar -> memakai pencarian yang sudah ada di tab Jelajah
  var wrap = document.createElement('div');
  wrap.id = 'ln-top-search';
  wrap.innerHTML = '<i data-lucide="search"></i><input id="ln-top-q" type="text" placeholder="Cari lagu, film, atau tempel link YouTube…  ( / )" autocomplete="off" spellcheck="false">';
  bar.insertBefore(wrap, right);
  try { lucide.createIcons(); } catch (e) {}

  var q = document.getElementById('ln-top-q'), main = document.getElementById('yt-search-input');
  if (!main) { wrap.style.display = 'none'; return; }
  q.addEventListener('input', function () {
    try { if (curTab !== 'online') switchTab('online'); } catch (e) {}
    main.value = q.value;
    try { handleRealtimeSearch(q.value); } catch (e) {}
  });
  q.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { q.value = ''; main.value = ''; try { clearSearch(); } catch (x) {} q.blur(); }
  });
  main.addEventListener('input', function () { q.value = main.value; });
  var clr = document.getElementById('clear-search-btn');
  if (clr) clr.addEventListener('click', function () { q.value = ''; });

  // Tekan "/" untuk langsung mengetik di pencarian
  document.addEventListener('keydown', function (e) {
    var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && bar.offsetParent !== null) { e.preventDefault(); q.focus(); q.select(); }
  });
})();
