/* LNMusic redesign web: menyisipkan ikon, sidebar, pil mobile, dan hero Bareng. Tidak aktif di APK. */
(function () {
  if (document.documentElement.classList.contains('ln-android')) return;
  var P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
    together: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="7" rx="2"/><rect x="16.5" y="14" width="4.5" height="7" rx="2"/>',
    video: '<rect x="3" y="6" width="12.5" height="12" rx="3"/><path d="m15.5 10.5 5.5-3v9l-5.5-3z"/>',
    list: '<path d="M3 6h11M3 11h11M3 16h6"/><circle cx="16.5" cy="17" r="2.5"/><path d="M19 17V8l3 1"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.8M12 18.7v2.8M2.5 12h2.8M18.7 12h2.8M5.3 5.3l2 2M16.7 16.7l2 2M5.3 18.7l2-2M16.7 7.3l2-2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17.5 14.2c2.4.2 3.9 1.7 4.3 4.3"/>'
  };
  var TABS = [['online', 'Beranda', 'home'], ['together', 'Bareng', 'together'], ['videocall', 'Call', 'video'], ['playlists', 'Playlist', 'list'], ['offline', 'Offline', 'music']];
  var svg = function (k) { return '<svg class="lr-ic" viewBox="0 0 24 24" aria-hidden="true">' + P[k] + '</svg>'; };
  var $ = function (id) { return document.getElementById(id); };
  var cur = function () { try { return curTab; } catch (e) { return 'online'; } };

  function topIcons() {
    TABS.forEach(function (t) {
      var b = $('nav-' + t[0]);
      if (!b || b.querySelector('.lr-ic')) return;
      b.insertAdjacentHTML('afterbegin', svg(t[2]));
      b.setAttribute('aria-label', t[1]);
    });
  }

  function sidebar() {
    if ($('lr-side')) return;
    var s = document.createElement('aside');
    s.id = 'lr-side';
    s.setAttribute('aria-label', 'Menu utama');
    s.innerHTML = TABS.map(function (t) {
      return '<button type="button" class="lr-sb" data-t="' + t[0] + '">' + svg(t[2]) + '<span>' + t[1] + '</span></button>';
    }).join('') + '<div class="lr-sb-gap"></div><button type="button" class="lr-sb" data-set="1">' + svg('gear') + '<span>Pengaturan</span></button>';
    s.addEventListener('click', function (e) {
      var b = e.target.closest('.lr-sb'); if (!b) return;
      if (b.dataset.set) { try { openSettingsModal(); } catch (x) {} } else { switchTab(b.dataset.t); }
    });
    document.body.appendChild(s);
  }

  function pills() {
    var bar = $('ln-appbar');
    if (!bar || $('lr-pills')) return;
    var right = bar.lastElementChild;
    if (right) {
      var sb = document.createElement('button');
      sb.type = 'button'; sb.title = 'Cari'; sb.className = 'p-2 rounded-xl bg-white/5 text-zinc-300';
      sb.innerHTML = svg('search');
      sb.onclick = function () {
        switchTab('online');
        setTimeout(function () { var q = $('yt-search-input'); if (q) q.focus(); }, 350);
      };
      right.insertBefore(sb, right.firstChild);
      right.querySelectorAll('button svg').forEach(function (v) { if (!v.classList.contains('lr-ic')) { v.style.width = '18px'; v.style.height = '18px'; } });
      sb.querySelector('svg').style.cssText = 'width:18px;height:18px';
    }
    var p = document.createElement('nav');
    p.id = 'lr-pills'; p.setAttribute('aria-label', 'Menu');
    p.innerHTML = TABS.map(function (t) {
      return '<button type="button" class="lr-pill" data-t="' + t[0] + '" aria-label="' + t[1] + '">' + svg(t[2]) + '</button>';
    }).join('');
    p.addEventListener('click', function (e) { var b = e.target.closest('.lr-pill'); if (b) switchTab(b.dataset.t); });
    bar.appendChild(p);
  }

  function art() {
    return '<svg viewBox="0 0 320 300" fill="none"><defs><linearGradient id="lrg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#c026d3"/></linearGradient>' +
      '<radialGradient id="lrr" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#8b5cf6" stop-opacity=".55"/><stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/></radialGradient></defs>' +
      '<circle cx="160" cy="150" r="140" fill="url(#lrr)"/>' +
      '<ellipse cx="160" cy="170" rx="135" ry="46" stroke="#a78bfa" stroke-opacity=".45" stroke-width="2" transform="rotate(-18 160 170)"/>' +
      '<ellipse cx="160" cy="170" rx="110" ry="32" stroke="#f43f5e" stroke-opacity=".35" stroke-width="1.5" transform="rotate(-18 160 170)"/>' +
      '<path d="M70 190v-28a90 90 0 0 1 180 0v28" stroke="url(#lrg)" stroke-width="16" stroke-linecap="round"/>' +
      '<rect x="52" y="178" width="44" height="78" rx="22" fill="#1a1033" stroke="url(#lrg)" stroke-width="5"/>' +
      '<rect x="224" y="178" width="44" height="78" rx="22" fill="#1a1033" stroke="url(#lrg)" stroke-width="5"/>' +
      '<rect x="62" y="194" width="24" height="46" rx="12" fill="#7c3aed" fill-opacity=".55"/><rect x="234" y="194" width="24" height="46" rx="12" fill="#7c3aed" fill-opacity=".55"/>' +
      '<path d="M270 70v44" stroke="#c4b5fd" stroke-width="5" stroke-linecap="round"/><circle cx="259" cy="116" r="11" fill="#c4b5fd"/>' +
      '<path d="M40 96v30" stroke="#f9a8d4" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="128" r="8" fill="#f9a8d4"/></svg>';
  }

  function hero() {
    var tab = $('tab-together'), glass = tab && tab.firstElementChild;
    if (!glass || $('lr-hero')) return;
    var h = document.createElement('div');
    h.id = 'lr-hero';
    h.innerHTML = '<div class="lr-h-t"><span class="lr-h-ic">' + svg('users') + '</span><h2>Bareng</h2></div>' +
      '<p>Buat room, ajak teman, dan nikmati musik bareng dalam satu ruang!</p>' +
      '<button type="button" class="lr-cta" id="lr-cta">' + svg('users') + 'Buat Room</button><div class="lr-art">' + art() + '</div>';
    glass.insertBefore(h, glass.firstChild);
    $('lr-cta').onclick = function () {
      try { switchCustomRoomTab('create'); } catch (e) {}
      var f = $('croom-host-name');
      if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(function () { f.focus({ preventScroll: true }); }, 400); }
    };
    watchSetup();
  }

  function watchSetup() {
    var h = $('lr-hero'), a = $('room-setup-area');
    if (!h || !a) return;
    var sync = function () { h.classList.toggle('lr-off', a.classList.contains('hidden') || !!a.closest('.hidden')); };
    new MutationObserver(sync).observe(a, { attributes: true, attributeFilter: ['class'] });
    sync();
  }

  function mark() {
    var c = cur();
    document.querySelectorAll('.lr-sb[data-t],.lr-pill[data-t]').forEach(function (b) {
      var on = b.dataset.t === c;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  function init() {
    topIcons(); sidebar(); pills(); hero(); mark();
    if (window.switchTab && !window.switchTab.__lr) {
      var o = window.switchTab;
      window.switchTab = function () {
        var r = o.apply(this, arguments);
        mark();
        // Header mobile lebih tinggi karena ada baris pil: sesuaikan posisi scroll
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            var t = cur(), el = $('tab-' + t), bar = $('ln-appbar');
            if (!el || t === 'videocall' || innerWidth >= 768 || !bar) return;
            window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - bar.offsetHeight - 8), behavior: 'smooth' });
          });
        });
        return r;
      };
      window.switchTab.__lr = true;
    }
    try { if (window.lucide) lucide.createIcons(); } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('load', function () { setTimeout(init, 300); });
})();
