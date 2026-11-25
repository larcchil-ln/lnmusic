/**
 * LNMusic - REVISION PATCH (Leo & Nana Edition)
 * Otomatis menerapkan perubahan UI & API saat app dibuka.
 */
window.addEventListener('DOMContentLoaded', () => {
    // 1. FONT MODERN (INTER)
    const font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(font);

    const style = document.createElement('style');
    style.innerHTML = `
        * { font-family: 'Inter', sans-serif !important; }
        /* HAPUS TAB YANG GAK KEPAKE */
        button[onclick*="openShorts"], 
        button[onclick*="switchTab('converter')"], 
        #mob-nav-converter, 
        #nav-converter { display: none !important; }
        
        /* HAPUS KOLOM 'PUTAR BARENG' DI LAYAR PENUH */
        #fs-context-label { display: none !important; }

        /* TAMPILAN VIDEO CALL FULLSCREEN (ALA WHATSAPP) */
        #ln-video-call-overlay {
            position: fixed; inset: 0; z-index: 9999; background: #0f0c29;
            display: none; flex-direction: column; align-items: center; justify-content: center;
        }
    `;
    document.head.appendChild(style);

    // 2. TAMBAH UI VIDEO CALL
    const callUI = document.createElement('div');
    callUI.id = 'ln-video-call-overlay';
    callUI.innerHTML = `
        <div class="text-center" style="color: white;">
            <div style="width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 40px; border: 3px solid #ec4899; margin-bottom: 20px;">📹</div>
            <h2 style="font-size: 28px; font-weight: bold; margin: 0;">Nana</h2>
            <p style="font-size: 14px; opacity: 0.6; margin: 5px 0 30px;">Menghubungkan... 🔒</p>
            <div style="display: flex; gap: 20px;">
                <button onclick="document.getElementById('ln-video-call-overlay').style.display='none'" style="width: 60px; height: 60px; background: #dc2626; border-radius: 50%; border: none; cursor: pointer;"><span style="color:white; font-size: 24px;">📞</span></button>
                <button style="width: 60px; height: 60px; background: rgba(255,255,255,0.1); border-radius: 50%; border: none; cursor: pointer;"><span style="color:white; font-size: 24px;">🎤</span></button>
            </div>
        </div>
    `;
    document.body.appendChild(callUI);

    // 3. GANTI NAVIGASI BAWAH (MOBILE)
    const mobileNav = document.querySelector('nav');
    if (mobileNav) {
        const newCallBtn = document.createElement('button');
        newCallBtn.id = 'mob-nav-video-call';
        newCallBtn.className = 'flex flex-col items-center gap-1 text-emerald-400 text-[10px] font-bold';
        newCallBtn.onclick = () => document.getElementById('ln-video-call-overlay').style.display = 'flex';
        newCallBtn.innerHTML = `<i data-lucide="video" class="w-5 h-5"></i><span>Call</span>`;
        
        const convBtn = document.getElementById('mob-nav-converter');
        if (convBtn) convBtn.replaceWith(newCallBtn);
    }

    // 4. ISI API KEY OTOMATIS (AMAN)
    const apiKeyInput = document.getElementById('yt-api-key-input');
    if (apiKeyInput) {
        apiKeyInput.value = 'AIzaSyDPX4U_fgD3OnVfU1qCHBr1f1oWEcmJ_p4';
        // Sembunyikan input API key agar lebih rapi
        if (apiKeyInput.parentElement) apiKeyInput.parentElement.style.display = 'none'; 
    }

    // Update Ikon Lucide
    if (window.lucide) lucide.createIcons();
});
