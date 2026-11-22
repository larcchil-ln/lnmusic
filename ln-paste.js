/* LNMusic paste: tempel screenshot (Ctrl+V / tempel dari keyboard HP / seret file) ke kolom chat, tampil pratinjau, lalu kirim. */
(function () {
  var IDS = ['room-chat-input', 'fs-room-chat-input'];
  var box = null;

  function close() { if (box) { box.remove(); box = null; } }

  function preview(file) {
    close();
    var url = URL.createObjectURL(file), vo = false;
    try { vo = !!chatViewOnceMode; } catch (e) {}
    box = document.createElement('div');
    box.id = 'ln-paste-preview';
    box.style.cssText = 'position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif';
    var card = document.createElement('div');
    card.style.cssText = 'background:#14141c;border:1px solid #ffffff1f;border-radius:18px;padding:14px;max-width:420px;width:100%;color:#fafafa';
    var t = document.createElement('div');
    t.style.cssText = 'font-size:13px;font-weight:700;margin-bottom:10px';
    t.textContent = vo ? '🔥 Kirim gambar sekali lihat?' : '📋 Kirim gambar yang ditempel?';
    var im = document.createElement('img');
    im.src = url;
    im.style.cssText = 'width:100%;max-height:55vh;object-fit:contain;border-radius:12px;background:#0c0c12';
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;margin-top:12px';
    var no = document.createElement('button'), ok = document.createElement('button');
    var base = 'flex:1;padding:11px;border:0;border-radius:12px;font-size:14px;font-weight:700;color:#fff;cursor:pointer';
    no.style.cssText = base + ';background:#27272a'; no.textContent = 'Batal';
    ok.style.cssText = base + ';background:#e11d48'; ok.textContent = 'Kirim';
    no.onclick = function () { URL.revokeObjectURL(url); close(); };
    ok.onclick = function () {
      URL.revokeObjectURL(url); close();
      try { handleChatPhotoPick({ target: { files: [file], value: '' } }); } catch (e) {}
    };
    row.appendChild(no); row.appendChild(ok);
    card.appendChild(t); card.appendChild(im); card.appendChild(row);
    box.appendChild(card);
    box.addEventListener('click', function (e) { if (e.target === box) no.onclick(); });
    document.body.appendChild(box);
    ok.focus();
  }

  function imageFrom(dt) {
    if (!dt) return null;
    var items = dt.items || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].kind === 'file' && /^image\//.test(items[i].type)) return items[i].getAsFile();
    }
    var files = dt.files || [];
    for (var j = 0; j < files.length; j++) if (/^image\//.test(files[j].type)) return files[j];
    return null;
  }

  document.addEventListener('paste', function (e) {
    var tg = e.target;
    if (!tg || IDS.indexOf(tg.id) < 0) return;
    var f = imageFrom(e.clipboardData);
    if (!f) return;
    if (e.clipboardData.getData('text/plain')) return; // ada teks: biarkan tempel teks biasa
    e.preventDefault();
    preview(f);
  }, true);

  document.addEventListener('dragover', function (e) { if (e.target && IDS.indexOf(e.target.id) >= 0) e.preventDefault(); });
  document.addEventListener('drop', function (e) {
    if (!e.target || IDS.indexOf(e.target.id) < 0) return;
    var f = imageFrom(e.dataTransfer);
    if (f) { e.preventDefault(); preview(f); }
  });

  document.addEventListener('keydown', function (e) {
    if (!box) return;
    if (e.key === 'Escape') close();
  });
})();
