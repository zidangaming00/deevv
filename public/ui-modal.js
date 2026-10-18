// ui-modal.js — Modul Terpadu: Sidebar Dinamis, Tema, & Popup Masukan
(function() {
    // --- 1. FUNGSI MANAJEMEN TEMA GLOBAL ---
    window.applyTheme = function() {
        try {
            var config = typeof getData === 'function' ? getData() : {};
            var themePref = config.theme || 'system';
            var prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
            var isDark = themePref === "dark" || (themePref === "system" && prefersDark);
            
            if (isDark) {
                document.body.classList.add("dark");
                document.documentElement.classList.add("dark");
            } else {
                document.body.classList.remove("dark");
                document.documentElement.classList.remove("dark");
            }
            
            // Perbarui teks status tema di sidebar jika ada
            var labelEl = document.getElementById('theme_status_label');
            if (labelEl) {
                const lang = (typeof getData === 'function' && getData().lang === 'en') ? 'en' : 'id';
                const themeNames = {
                    en: { light: "Light", dark: "Dark", system: "System" },
                    id: { light: "Terang", dark: "Gelap", system: "Sistem" }
                };
                labelEl.textContent = themeNames[lang][themePref] || themeNames[lang]['system'];
            }

            document.querySelectorAll('.theme-option-btn').forEach(btn => {
                if (btn.getAttribute('data-theme') === themePref) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        } catch(e) {}
    };

    window.setTheme = function(newTheme) {
        if (typeof updateSetting === "function") {
            updateSetting("theme", newTheme);
        } else {
            document.cookie = "theme=" + newTheme + "; path=/; max-age=31536000; SameSite=Lax";
        }
        window.applyTheme();
    };

    // Jalankan applyTheme saat pertama kali dimuat
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.applyTheme);
    } else {
        window.applyTheme();
    }

    const style = document.createElement('style');
    style.textContent = `
        /* --- STYLE SIDEBAR & BACKDROP --- */
        .popup-menu {
            position: fixed;
            top: 0;
            left: -280px;
            width: 250px;
            height: 100%;
            background: var(--surface, #ffffff);
            box-shadow: 4px 0 24px rgba(0, 0, 0, 0.12);
            border-right: 1px solid var(--border-color, rgba(0,0,0,0.08));
            display: flex;
            flex-direction: column;
            padding: 16px 12px;
            z-index: 2000;
            overflow-y: auto;
            transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .popup-menu.active { left: 0; }
        .sidebar-backdrop {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.4);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.25s ease;
            z-index: 1999;
        }
        .popup-menu.active ~ .sidebar-backdrop,
        body:has(.popup-menu.active) .sidebar-backdrop {
            opacity: 1;
            pointer-events: auto;
        }
        .popup-section-title {
            font-size: 10px;
            font-weight: 500;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            color: var(--text-muted, #5f6368);
            padding: 6px 12px 2px;
            margin-top: 4px;
        }
        .popup-group { display: flex; flex-direction: column; gap: 1px; padding: 2px 0; }
        .popup-divider { height: 1px; background: var(--border-color, rgba(0,0,0,0.08)); margin: 8px 4px; }
        .popup-menu a, .popup-menu button {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            padding: 8px 12px;
            text-decoration: none;
            color: var(--text-main, #1f1f1f);
            font-size: 13px;
            font-weight: 500;
            background: none;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            text-align: left;
            transition: background 0.2s ease;
        }
        .popup-menu a:hover, .popup-menu button:hover { background: rgba(0, 0, 0, 0.04); }
        body.dark .popup-menu a:hover, body.dark .popup-menu button:hover { background: rgba(255, 255, 255, 0.06); }
        .popup-menu a.active-menu { background: rgba(26, 115, 232, 0.08); font-weight: 600; color: var(--primary, #1a73e8); }
        
        .theme-status-text {
            font-size: 11.5px; font-weight: 500; color: var(--text-muted, #5f6368);
            display: flex; align-items: center; gap: 4px;
        }
        .theme-status-text svg {
            width: 14px; height: 14px; fill: currentColor;
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .theme-dropdown-container { display: flex; flex-direction: column; width: 100%; }
        .theme-options-list {
            display: grid; grid-template-rows: 0fr;
            transition: grid-template-rows 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease, margin 0.3s ease;
            opacity: 0; margin: 0; overflow: hidden;
        }
        .theme-options-inner { min-height: 0; display: flex; flex-direction: column; gap: 1px; padding: 0 0 0 12px; }
        .theme-dropdown-container.open .theme-options-list { grid-template-rows: 1fr; opacity: 1; margin: 2px 0; }
        .theme-dropdown-container.open .theme-status-text svg { transform: rotate(180deg); }
        .theme-option-btn {
            padding: 7px 10px; font-size: 12.5px; font-weight: 400; border-radius: 8px;
            background: none; border: none; cursor: pointer; text-align: left; color: var(--text-main, #1f1f1f); width: 100%;
        }
        .theme-option-btn:hover { background: rgba(0, 0, 0, 0.05); }
        body.dark .theme-option-btn:hover { background: rgba(255, 255, 255, 0.08); }
        .theme-option-btn.active { font-weight: 600; color: var(--primary, #1a73e8); }
        .sidebar-footer {
            margin-top: auto; padding: 16px 12px 8px; font-size: 11.5px;
            color: var(--text-muted, #5f6368); border-top: 1px solid var(--border-color, rgba(0,0,0,0.08));
        }

        /* --- STYLE FEEDBACK MODAL --- */
        .fb-overlay {
            position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center;
            padding: 16px; background: rgba(0, 0, 0, 0.5); opacity: 0; visibility: hidden;
            transition: opacity 0.2s ease, visibility 0.2s ease;
        }
        .fb-overlay.show { opacity: 1; visibility: visible; }
        .fb-card {
            width: 100%; max-width: 420px; background: var(--surface, #ffffff); color: var(--text-main, #1f1f1f);
            border-radius: 24px; padding: 24px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
            transform: translateY(12px); transition: transform 0.2s ease; display: flex; flex-direction: column;
            gap: 16px; max-height: 85vh; overflow-y: auto;
        }
        .fb-overlay.show .fb-card { transform: translateY(0); }
        .fb-header { display: flex; align-items: center; justify-content: space-between; }
        .fb-title { font-size: 18px; font-weight: 600; }
        .fb-close {
            width: 34px; height: 34px; border: none; border-radius: 50%; background: transparent;
            color: var(--text-muted, #5f6368); cursor: pointer; display: flex; align-items: center; justify-content: center;
            transition: background 0.15s ease, color 0.15s ease;
        }
        .fb-close:hover { background: var(--press, rgba(128,128,128,0.14)); color: var(--text-main, #1f1f1f); }
        .fb-desc { font-size: 13.5px; color: var(--text-muted, #5f6368); line-height: 1.45; margin-top: -6px; }
        .fb-section { display: flex; flex-direction: column; gap: 8px; }
        .fb-label-group { font-size: 13px; font-weight: 600; color: var(--text-main, #1f1f1f); }
        .fb-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .fb-chip {
            padding: 6px 14px; border-radius: 16px; font-size: 13px; font-weight: 500;
            border: 1px solid var(--border-color, rgba(0,0,0,0.15)); background: transparent;
            color: var(--text-main, #1f1f1f); cursor: pointer; transition: all 0.15s ease;
        }
        .fb-chip:hover { background: var(--press, rgba(128,128,128,0.14)); }
        .fb-chip.active { background: var(--primary, #1a73e8); color: #fff; border-color: var(--primary, #1a73e8); }
        .fb-textarea {
            width: 100%; height: 90px; padding: 12px 14px; resize: none;
            border: 1px solid var(--border-color, rgba(0,0,0,0.15)); border-radius: 12px;
            background: var(--bg, #f0f4f9); color: var(--text-main, #1f1f1f);
            font-family: inherit; font-size: 14px; outline: none; transition: border-color 0.15s ease;
        }
        .fb-textarea:focus { border-color: var(--primary, #1a73e8); }
        .fb-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
        .fb-btn { height: 36px; padding: 0 18px; border-radius: 18px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; }
        .fb-btn-cancel { background: transparent; color: var(--text-main, #1f1f1f); }
        .fb-btn-cancel:hover { background: var(--press, rgba(128,128,128,0.14)); }
        .fb-btn-submit { background: var(--primary, #1a73e8); color: #fff; }
        .fb-btn-submit:hover { opacity: 0.9; }
        
        .fb-loading-wrap {
            position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
            background: var(--surface, #ffffff); border-radius: 24px; z-index: 10; opacity: 0; visibility: hidden;
            transition: opacity 0.15s ease, visibility 0.15s ease;
        }
        .fb-loading-wrap.show { opacity: 1; visibility: visible; }
        .fb-spinner {
            width: 34px; height: 34px; border: 3px solid var(--border-color, rgba(0,0,0,0.15));
            border-top-color: var(--primary, #1a73e8); border-radius: 50%; animation: fb-spin 0.7s linear infinite;
        }
        @keyframes fb-spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);

    const I18N_DATA = {
        en: {
            catSearch: "Search", catApps: "Apps", catLearnMore: "Learn more", catTranslateGroup: "Translation",
            homepage: "Homepage", settings: "Preferences", displayTheme: "Display theme",
            light: "Light", dark: "Dark", system: "System",
            weather: "Weather", translate: "Translate", history: "History", saved: "Saved",
            about: "About", privacy: "Privacy", feedback: "Feedback",
            fbTitle: "Send Feedback",
            fbDesc: "Help us improve Deevv Search by selecting a category and sharing your thoughts.",
            fbTopicLabel: "What can be improved?",
            fbTopics: ["UI / Design", "Search Features", "Speed", "Other"],
            fbRatingLabel: "Overall experience",
            fbRatings: ["Very Satisfied", "Fairly Good", "Needs Improvement"],
            fbPlaceholder: "Write your feedback details here...",
            fbCancel: "Cancel", fbSubmit: "Send",
            fbSuccess: "Successfully sent. Thank you!"
        },
        id: {
            catSearch: "Pencarian", catApps: "Aplikasi", catLearnMore: "Informasi", catTranslateGroup: "Terjemahan",
            homepage: "Beranda", settings: "Preferensi", displayTheme: "Tema tampilan",
            light: "Terang", dark: "Gelap", system: "Sistem",
            weather: "Cuaca", translate: "Terjemahan", history: "Riwayat", saved: "Tersimpan",
            about: "Tentang", privacy: "Privasi", feedback: "Masukan",
            fbTitle: "Kirim Masukan",
            fbDesc: "Bantu kami meningkatkan Deevv Search dengan memilih kategori dan memberikan ulasan.",
            fbTopicLabel: "Apa yang bisa ditingkatkan?",
            fbTopics: ["Tampilan / UI", "Fitur Pencarian", "Kecepatan", "Lainnya"],
            fbRatingLabel: "Bagaimana pengalaman Anda secara keseluruhan?",
            fbRatings: ["Sangat Puas", "Cukup Baik", "Perlu Perbaikan"],
            fbPlaceholder: "Tulis detail masukan Anda di sini...",
            fbCancel: "Batal", fbSubmit: "Kirim",
            fbSuccess: "Masukan berhasil dikirim. Terima kasih!"
        }
    };

    function getLang() {
        try {
            const settings = typeof getData === 'function' ? getData() : {};
            return settings.lang === 'en' ? 'en' : 'id';
        } catch(e) { return 'id'; }
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    backdrop.id = 'sidebar_backdrop';

    const sidebar = document.createElement('div');
    sidebar.className = 'popup-menu';
    sidebar.id = 'popup_menu';

    function buildSidebar() {
        const t = I18N_DATA[getLang()];
        const currentPath = window.location.pathname;
        const isTranslatePage = currentPath.includes('translate');
        const currentTheme = (typeof getData === 'function' ? getData().theme : 'system') || 'system';
        
        const themeNames = {
            en: { light: "Light", dark: "Dark", system: "System" },
            id: { light: "Terang", dark: "Gelap", system: "Sistem" }
        };
        const themeLabel = themeNames[getLang()][currentTheme] || themeNames[getLang()]['system'];

        let sidebarContent = '';

        if (isTranslatePage) {
            sidebarContent = `
                <div class="popup-section-title">${t.catSearch}</div>
                <div class="popup-group">
                    <a href="index.html"><span>${t.homepage}</span></a>
                    <div class="theme-dropdown-container" id="theme_dropdown_container">
                        <button type="button" id="theme_dropdown_toggle">
                            <span>${t.displayTheme}</span>
                            <span class="theme-status-text">
                                <span id="theme_status_label">${themeLabel}</span>
                                <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
                            </span>
                        </button>
                        <div class="theme-options-list">
                            <div class="theme-options-inner">
                                <button type="button" class="theme-option-btn ${currentTheme === 'light' ? 'active' : ''}" data-theme="light">${t.light}</button>
                                <button type="button" class="theme-option-btn ${currentTheme === 'dark' ? 'active' : ''}" data-theme="dark">${t.dark}</button>
                                <button type="button" class="theme-option-btn ${currentTheme === 'system' ? 'active' : ''}" data-theme="system">${t.system}</button>
                            </div>
                        </div>
                    </div>
                    <a href="settings"><span>${t.settings}</span></a>
                </div>

                <div class="popup-divider"></div>

                <div class="popup-section-title">${t.catTranslateGroup}</div>
                <div class="popup-group">
                    <a href="/translate" class="${currentPath === '/translate' || currentPath === '/translate/' ? 'active-menu' : ''}"><span>${t.translate}</span></a>
                    <a href="/translate/history" class="${currentPath.includes('history') ? 'active-menu' : ''}"><span>${t.history}</span></a>
                    <a href="/translate/saved" class="${currentPath.includes('saved') ? 'active-menu' : ''}"><span>${t.saved}</span></a>
                </div>
            `;
        } else {
            sidebarContent = `
                <div class="popup-section-title">${t.catSearch}</div>
                <div class="popup-group">
                    <a href="index.html" class="${currentPath.endsWith('index.html') || currentPath === '/' ? 'active-menu' : ''}"><span>${t.homepage}</span></a>
                    <div class="theme-dropdown-container" id="theme_dropdown_container">
                        <button type="button" id="theme_dropdown_toggle">
                            <span>${t.displayTheme}</span>
                            <span class="theme-status-text">
                                <span id="theme_status_label">${themeLabel}</span>
                                <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
                            </span>
                        </button>
                        <div class="theme-options-list">
                            <div class="theme-options-inner">
                                <button type="button" class="theme-option-btn ${currentTheme === 'light' ? 'active' : ''}" data-theme="light">${t.light}</button>
                                <button type="button" class="theme-option-btn ${currentTheme === 'dark' ? 'active' : ''}" data-theme="dark">${t.dark}</button>
                                <button type="button" class="theme-option-btn ${currentTheme === 'system' ? 'active' : ''}" data-theme="system">${t.system}</button>
                            </div>
                        </div>
                    </div>
                    <a href="settings"><span>${t.settings}</span></a>
                </div>
                <div class="popup-divider"></div>
                <div class="popup-section-title">${t.catApps}</div>
                <div class="popup-group">
                    <a href="/search?q=weather"><span>${t.weather}</span></a>
                    <a href="/translate"><span>${t.translate}</span></a>
                </div>
                <div class="popup-divider"></div>
                <div class="popup-section-title">${t.catLearnMore}</div>
                <div class="popup-group">
                    <a href="about.html"><span>${t.about}</span></a>
                    <a href="privacy.html"><span>${t.privacy}</span></a>
                    <button type="button" onclick="openFeedbackModal()"><span>${t.feedback}</span></button>
                </div>
            `;
        }

        sidebar.innerHTML = sidebarContent + `<div class="sidebar-footer">&copy; 2026 Deevv Search.</div>`;
    }

    buildSidebar();

    const overlay = document.createElement('div');
    overlay.className = 'fb-overlay';

    function buildModal() {
        const t = I18N_DATA[getLang()];
        overlay.innerHTML = `
            <div class="fb-card" style="position: relative;" role="dialog" aria-modal="true">
                <div class="fb-loading-wrap" id="fb-loading"><div class="fb-spinner"></div></div>
                <div class="fb-header">
                    <span class="fb-title">${t.fbTitle}</span>
                    <button type="button" class="fb-close" aria-label="${t.fbCancel}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <p class="fb-desc">${t.fbDesc}</p>
                <div class="fb-section">
                    <div class="fb-label-group">${t.fbTopicLabel}</div>
                    <div class="fb-chips" id="fb-topic-chips">
                        ${t.fbTopics.map((tp, idx) => `<button type="button" class="fb-chip ${idx === 0 ? 'active' : ''}" data-topic="${tp}">${tp}</button>`).join('')}
                    </div>
                </div>
                <div class="fb-section">
                    <div class="fb-label-group">${t.fbRatingLabel}</div>
                    <div class="fb-chips" id="fb-rating-chips">
                        ${t.fbRatings.map((rt, idx) => `<button type="button" class="fb-chip ${idx === 0 ? 'active' : ''}" data-rating="${rt}">${rt}</button>`).join('')}
                    </div>
                </div>
                <div class="fb-section">
                    <div class="fb-label-group">${getLang() === 'en' ? 'Additional Notes' : 'Catatan atau Saran Tambahan'}</div>
                    <textarea class="fb-textarea" placeholder="${t.fbPlaceholder}"></textarea>
                </div>
                <div class="fb-footer">
                    <button type="button" class="fb-btn fb-btn-cancel">${t.fbCancel}</button>
                    <button type="button" class="fb-btn fb-btn-submit">${t.fbSubmit}</button>
                </div>
            </div>
        `;
    }

    buildModal();

    document.addEventListener('DOMContentLoaded', () => {
        const header = document.querySelector('header');
        if (header) {
            header.appendChild(sidebar);
            header.appendChild(backdrop);
        } else {
            document.body.appendChild(sidebar);
            document.body.appendChild(backdrop);
        }
        document.body.appendChild(overlay);

        const menuBtn = document.getElementById('menu_btn');
        if (menuBtn) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                sidebar.classList.toggle('active');
            });
        }

        backdrop.addEventListener('click', () => {
            sidebar.classList.remove('active');
            document.getElementById('theme_dropdown_container')?.classList.remove('open');
        });

        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target) && !menuBtn?.contains(e.target)) {
                sidebar.classList.remove('active');
                document.getElementById('theme_dropdown_container')?.classList.remove('open');
            }
        });

        const themeContainer = document.getElementById('theme_dropdown_container');
        const themeToggleBtn = document.getElementById('theme_dropdown_toggle');
        if (themeToggleBtn && themeContainer) {
            themeToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                themeContainer.classList.toggle('open');
            });

            sidebar.querySelectorAll('.theme-option-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const selectedTheme = btn.getAttribute('data-theme');
                    // Menggunakan fungsi setTheme yang aman secara global
                    if (typeof window.setTheme === 'function') {
                        window.setTheme(selectedTheme);
                    }
                    themeContainer.classList.remove('open');
                });
            });
        }
    });

    function setupChips(containerId) {
        const container = overlay.querySelector('#' + containerId);
        if (!container) return;
        container.querySelectorAll('.fb-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                container.querySelectorAll('.fb-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            });
        });
    }

    function bindModalEvents() {
        const closeBtn = overlay.querySelector('.fb-close');
        const cancelBtn = overlay.querySelector('.fb-btn-cancel');
        const submitBtn = overlay.querySelector('.fb-btn-submit');
        const currentTextarea = overlay.querySelector('.fb-textarea');

        setupChips('fb-topic-chips');
        setupChips('fb-rating-chips');

        const closeModal = () => overlay.classList.remove('show');

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        submitBtn.addEventListener('click', () => {
            const selectedTopic = overlay.querySelector('#fb-topic-chips .fb-chip.active')?.dataset.topic || '';
            const selectedRating = overlay.querySelector('#fb-rating-chips .fb-chip.active')?.dataset.rating || '';
            const detailText = currentTextarea.value.trim();
            
            const msg = I18N_DATA[getLang()].fbSuccess;

            if (typeof showToast === 'function') {
                showToast(msg);
            } else {
                alert(msg);
            }
            closeModal();
        });
    }

    bindModalEvents();

    let hasLoadedBefore = false;
    window.openFeedbackModal = function() {
        sidebar.classList.remove('active');
        buildModal();
        bindModalEvents();
        
        const currentTextarea = overlay.querySelector('.fb-textarea');
        const loadingEl = overlay.querySelector('#fb-loading');
        
        currentTextarea.value = '';
        overlay.classList.add('show');

        if (!hasLoadedBefore) {
            loadingEl.classList.add('show');
            setTimeout(() => {
                loadingEl.classList.remove('show');
                hasLoadedBefore = true;
            }, 650);
        }
    };
})();
