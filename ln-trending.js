/* LNMusic trending: lagu dari tangga lagu Apple Music dicarikan versi YouTube-nya saat diputar (hemat kuota YouTube). */
(function () {
  if (typeof window.playTrack !== 'function') return;
  var cache = {};
  try { cache = JSON.parse(localStorage.getItem('ln_am_map') || '{}'); } catch (e) {}
  var pending = {};

  function save() { try { localStorage.setItem('ln_am_map', JSON.stringify(cache)); } catch (e) {} }
  function toast(m) { try { showToast(m); } catch (e) {} }

  // Lagu tanpa cover (mis. dari impor CSV) memakai gambar video YouTube-nya begitu ID-nya ketemu, supaya mini player tidak kosong
  function ytThumb(t, th) {
    if (t.thumb || !t.id) return;
    t.thumb = /^https?:\/\//.test(th || '') ? th : (/^[\w-]{11}$/.test(t.id) ? 'https://i.ytimg.com/vi/' + t.id + '/hqdefault.jpg' : '');
  }

  // Cari video YouTube untuk lagu "lazy"; hasilnya diingat supaya tidak memakai kuota lagi
  function resolve(t) {
    if (!t || !t.lazy) return Promise.resolve(true);
    var key = t.appleId || t.id;
    if (cache[key]) { t.id = cache[key]; t.lazy = false; ytThumb(t); return Promise.resolve(true); }
    if (pending[key]) return pending[key];
    pending[key] = (async function () {
      try {
        var q = (t.artist + ' ' + t.title).replace(/\s+/g, ' ').trim();
        var rs = await fetchSearchResults(q + ' official audio', 'music');
        if (!rs || !rs.length) rs = await fetchSearchResults(q, 'music');
        if (rs && rs[0] && rs[0].id) { t.id = rs[0].id; t.lazy = false; cache[key] = t.id; ytThumb(t, rs[0].thumb); save(); return true; }
      } catch (e) {}
      return false;
    })().then(function (ok) { delete pending[key]; return ok; });
    return pending[key];
  }

  var origPlay = window.playTrack;
  window.playTrack = function (track) {
    var args = arguments, self = this;
    if (!track || !track.lazy) return origPlay.apply(self, args);
    toast('Mencari "' + track.title + '"…');
    resolve(track).then(function (ok) {
      if (!ok) return toast('Lagu belum ketemu di YouTube, coba lagu lain');
      origPlay.apply(self, args);
      // siapkan lagu berikutnya di antrean agar perpindahan lagu tetap mulus
      try { var nx = queue[currentIndex + 1]; if (nx && nx.lazy) resolve(nx); } catch (e) {}
    });
  };
})();
