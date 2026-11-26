/* LNMusic: lirik berjalan di mini player.
   HP (<768px): di tengah mini player, antara judul dan tombol. Desktop: di bawah judul & artis. */
(function () {
  var mini = document.getElementById('ln-mini');
  var art = document.getElementById('player-artist');
  if (!mini || !art) return;

  var st = document.createElement('style');
  st.textContent =
    '.lr-lyr{display:none;color:#4ade80;font-weight:600;line-height:1.3;overflow:hidden;pointer-events:none}' +
    '.lr-lyr.lr-in{animation:lrLyrIn .35s ease-out}' +
    '@keyframes lrLyrIn{from{opacity:.15}to{opacity:1}}' +
    '@media (prefers-reduced-motion:reduce){.lr-lyr.lr-in{animation:none}}' +
    '#lr-lyr-d{font-size:12.5px;margin-top:2px;white-space:nowrap;text-overflow:ellipsis}' +
    '#lr-lyr-m{font-size:12.5px;text-align:center;padding:0 4px}' +
    '@media (min-width:768px){#ln-mini.lr-has-lyr #lr-lyr-d{display:block}}' +
    '@media (max-width:767.98px){#ln-mini.lr-has-lyr #lr-lyr-m{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;flex:1 1 0;min-width:0}' +
    '#ln-mini.lr-has-lyr>div>div:first-child{flex:0 1 36%!important}}';
  document.head.appendChild(st);

  var d = document.createElement('p'); d.id = 'lr-lyr-d'; d.className = 'lr-lyr'; d.setAttribute('aria-live', 'off');
  art.insertAdjacentElement('afterend', d);
  var m = document.createElement('div'); m.id = 'lr-lyr-m'; m.className = 'lr-lyr';
  var info = art.closest('#ln-mini > div > div');
  if (info) info.insertAdjacentElement('afterend', m);

  var shown = null, lastKey = '';

  // Lirik dimuat untuk setiap lagu, bukan hanya saat tampilan lirik layar penuh dibuka
  function ensure() {
    try {
      if (!currentTrack) return;
      var key = currentTrack.id + '|' + currentTrack.title;
      if (lyricTrackId !== currentTrack.id) { lastKey = key; loadLyrics(currentTrack); }
      else if (key !== lastKey) { if (!lyricLines.length) loadLyrics(currentTrack); lastKey = key; }
    } catch (e) {}
  }

  function tick() {
    var text = null;
    try {
      if (currentTrack && lyricTrackId === currentTrack.id && lyricLines.length) {
        var t = curTime() + 0.3 + lyricOffset, n = lyricLines.findIndex(function (l) { return l.t > t; });
        var i = n === -1 ? lyricLines.length - 1 : n - 1;
        if (i >= 0) text = lyricLines[i].text || '♪';
      }
    } catch (e) {}
    if (text === shown) return;
    shown = text;
    mini.classList.toggle('lr-has-lyr', !!text);
    [d, m].forEach(function (el) {
      el.textContent = text || '';
      el.classList.remove('lr-in'); void el.offsetWidth; if (text) el.classList.add('lr-in');
    });
  }

  setInterval(ensure, 700);
  setInterval(tick, 250);
})();
