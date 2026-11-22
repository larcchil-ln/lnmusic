/* LNMusic desktop: pencarian di top bar + tooltip menu. Hanya berpengaruh di layar >= 768px (top bar disembunyikan di HP). */
(function () {
  var bar = document.getElementById('ln-top');
  if (!bar) return;

  // Tooltip untuk tombol ikon
  bar.querySelectorAll('nav .nav-btn').forEach(function (b) { b.title = b.textContent.replace(/\s+/g, ' ').trim(); });
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
