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
      #ln-top nav { gap: 9px !important; padding: 6px !important; }
      #ln-top nav #nav-offline { display: none !important; }
      #ln-top nav .nav-btn {
        width: 52px !important; min-width: 52px !important; height: 52px !important;
        padding: 0 !important; display: inline-flex !important; align-items: center !important;
        justify-content: center !important; border-radius: 14px !important;
        font-size: 0 !important; line-height: 1 !important;
        transition: background .2s ease, border-color .2s ease, transform .2s ease, box-shadow .2s ease !important;
      }
      #ln-top nav .nav-btn > span {
        display: grid !important; place-items: center !important;
        width: 100% !important; height: 100% !important; gap: 0 !important;
      }
      #ln-top nav .nav-btn svg {
        display: block !important; width: 26px !important; height: 26px !important;
        padding: 0 !important; border-radius: 0 !important; background: none !important;
        stroke-width: 1.9 !important;
      }
      #ln-top nav .nav-btn:hover {
        transform: translateY(-1px);
        background: rgba(255,255,255,.09) !important;
        border-color: rgba(255,255,255,.1) !important;
      }
      #ln-top nav .nav-btn.text-rose-400 {
        color: #fff !important;
        background: linear-gradient(135deg, rgba(244,63,94,.3), rgba(139,92,246,.3)) !important;
        border-color: rgba(244,63,94,.42) !important;
        box-shadow: 0 6px 18px -9px rgba(244,63,94,.8), inset 0 0 0 1px rgba(255,255,255,.04) !important;
      }
      #ln-top nav .nav-btn:focus-visible {
        outline: 2px solid rgba(251,113,133,.9) !important;
        outline-offset: 3px !important;
      }
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
