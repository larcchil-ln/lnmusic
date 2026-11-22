/* LNMusic rooms: tombol "Daftar room pribadi" + login akun room pribadi + chat selalu mulai kosong. */
(function () {
  var $ = function (id) { return document.getElementById(id); };

  // Chat lama tidak otomatis tampil lagi saat masuk room (semua room mulai dengan chat kosong)
  window.mergeChat = function () {};

  async function post(b) {
    var r = await fetch('/api/room', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    var j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error(j.error === 'locked' ? (j.msg || 'Website sedang ditutup sementara.') : (j.error || 'Server tidak bisa dihubungi'));
    return j;
  }

  var box = null;
  function close() { if (box) { box.remove(); box = null; } }
  function enter(a) {
    customRoom = { role: 'host', code: a.code, peerId: 'lnmusic-croom-' + a.code.toLowerCase(), title: a.title };
    try {
      localStorage.setItem(SESSION_KEY, 'custom');
      localStorage.setItem('lnmusic_custom_room', JSON.stringify(Object.assign({}, customRoom, { name: a.name })));
    } catch (e) {}
    close(); enterRoom('custom', a.name);
  }

  // Login akun room pribadi (username selain Nuki/Nana)
  if (typeof window.doLogin === 'function') {
    var origLogin = window.doLogin;
    window.doLogin = async function (e) {
      var u = ($('login-user').value || '').trim().toLowerCase(), known = false;
      try { known = !!USERS[u]; } catch (x) {}
      if (known) return origLogin.apply(this, arguments);
      if (e && e.preventDefault) e.preventDefault();
      var pw = $('login-pass').value;
      if (!u || !pw) return loginError('Isi username dan password');
      try { var a = await post({ action: 'login', user: u, pass: pw }); $('login-pass').value = ''; loginError(''); enter(a); }
      catch (err) { loginError(err.message); }
    };
  }

  function field(ph, type, max) {
    var i = document.createElement('input');
    i.type = type || 'text'; i.placeholder = ph; if (max) i.maxLength = max;
    i.autocapitalize = 'none'; i.autocomplete = 'off';
    i.style.cssText = 'width:100%;box-sizing:border-box;background:#09090b;border:1px solid #ffffff1a;border-radius:12px;padding:11px 13px;font-size:13px;color:#fff;margin-bottom:8px;outline:none';
    return i;
  }
  function openReg() {
    close();
    box = document.createElement('div'); box.id = 'ln-reg-modal';
    box.style.cssText = 'position:fixed;inset:0;z-index:99991;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif';
    var card = document.createElement('div');
    card.style.cssText = 'background:#14141c;border:1px solid #ffffff1f;border-radius:18px;padding:16px;max-width:380px;width:100%;color:#fafafa';
    var h = document.createElement('div'); h.style.cssText = 'font-weight:800;font-size:16px;margin-bottom:2px'; h.textContent = '✨ Daftar Room Pribadi';
    var p = document.createElement('div'); p.style.cssText = 'font-size:12px;color:#a1a1aa;margin-bottom:12px'; p.textContent = 'Buat akun, dapat 1 room tetap dengan kode sendiri. Teman bisa gabung lewat kode itu.';
    var fu = field('Username (huruf kecil/angka)', 'text', 20), fp = field('Password (min. 6 karakter)', 'password', 72);
    var fn = field('Nama tampilan', 'text', 20), ft = field('Judul room (opsional)', 'text', 30);
    var err = document.createElement('div'); err.style.cssText = 'color:#fda4af;font-size:12px;min-height:16px;margin-bottom:6px';
    var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px';
    var no = document.createElement('button'), ok = document.createElement('button');
    var base = 'flex:1;padding:11px;border:0;border-radius:12px;font-size:13px;font-weight:700;color:#fff;cursor:pointer';
    no.style.cssText = base + ';background:#27272a'; no.textContent = 'Batal'; no.type = 'button';
    ok.style.cssText = base + ';background:#e11d48'; ok.textContent = 'Daftar & Masuk'; ok.type = 'button';
    no.onclick = close;
    ok.onclick = async function () {
      err.textContent = ''; ok.disabled = true; ok.textContent = 'Mendaftar…';
      try { enter(await post({ action: 'register', user: fu.value.trim().toLowerCase(), pass: fp.value, name: fn.value, title: ft.value })); }
      catch (e) { err.textContent = e.message; ok.disabled = false; ok.textContent = 'Daftar & Masuk'; }
    };
    row.appendChild(no); row.appendChild(ok);
    [h, p, fu, fp, fn, ft, err, row].forEach(function (x) { card.appendChild(x); });
    box.appendChild(card); document.body.appendChild(box); fu.focus();
  }
  window.lnOpenRegister = openReg;

  var lf = $('login-user') && $('login-user').closest('form');
  if (lf && !$('ln-reg-btn')) {
    var b = document.createElement('button');
    b.id = 'ln-reg-btn'; b.type = 'button'; b.textContent = '✨ Daftar room pribadi baru';
    b.style.cssText = 'width:100%;margin-top:8px;padding:10px;border-radius:12px;border:1px solid #ffffff1f;background:transparent;color:#d4d4d8;font-size:12px;font-weight:700;cursor:pointer';
    b.onclick = openReg;
    lf.insertAdjacentElement('afterend', b);
  }
})();
