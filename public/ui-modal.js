(function(){
    var e=window, f=document;

    // --- TOAST GLOBAL PERSIS 100% DENGAN WEATHER.HTML ---
    var toastEl=f.createElement("div");
    toastEl.className="toast";
    toastEl.id="toast";
    f.body.appendChild(toastEl);

    e.showToast = function(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add("show");
        setTimeout(function() {
            toastEl.classList.remove("show");
        }, 2300);
    };

    function g(){
        try{
            var a=typeof getData=="function"?getData():{},
                b=a.theme||"system",
                c=matchMedia("(prefers-color-scheme: dark)").matches,
                d=b==="dark"||b==="system"&&c;
            
            d?(f.body.classList.add("dark"),f.documentElement.classList.add("dark")):(f.body.classList.remove("dark"),f.documentElement.classList.remove("dark"));
            
            var h=f.getElementById("theme_status_label");
            if(h){
                var k=typeof getData=="function"&&getData().lang=="en"?"en":"id",
                    l={en:{light:"Light",dark:"Dark",system:"System"},id:{light:"Terang",dark:"Gelap",system:"Sistem"}};
                h.textContent=l[k][b]||l[k].system;
            }
            f.querySelectorAll(".theme-option-btn").forEach(function(m){
                m.getAttribute("data-theme")===b?m.classList.add("active"):m.classList.remove("active");
            });
        }catch(n){}
    }
    e.applyTheme=g;
    e.setTheme=function(a){
        typeof updateSetting=="function"?updateSetting("theme",a):f.cookie="theme="+a+"; path=/; max-age=31536000; SameSite=Lax";
        g();
    };

    if(f.readyState==="loading"){
        f.addEventListener("DOMContentLoaded",g);
    } else {
        g();
    }

    var p=f.createElement("style");
    p.textContent=`
        /* --- STYLE SIDEBAR & BACKDROP --- */
        .popup-menu {
            position: fixed; top: 0; left: -280px; width: 250px; height: 100%;
            background: var(--surface, #ffffff); box-shadow: 4px 0 24px rgba(0, 0, 0, 0.12);
            border-right: 1px solid var(--border-color, rgba(0,0,0,0.08));
            display: flex; flex-direction: column; padding: 16px 12px; z-index: 2000;
            overflow-y: auto; transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .popup-menu.active { left: 0; }
        .sidebar-backdrop {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.4); opacity: 0; pointer-events: none;
            transition: opacity 0.25s ease; z-index: 1999;
        }
        .popup-menu.active ~ .sidebar-backdrop,
        body:has(.popup-menu.active) .sidebar-backdrop { opacity: 1; pointer-events: auto; }
        .popup-section-title {
            font-size: 10px; font-weight: 500; letter-spacing: 0.4px; text-transform: uppercase;
            color: var(--text-muted, #5f6368); padding: 6px 12px 2px; margin-top: 4px;
        }
        .popup-group { display: flex; flex-direction: column; gap: 1px; padding: 2px 0; }
        .popup-divider { height: 1px; background: var(--border-color, rgba(0,0,0,0.08)); margin: 8px 4px; }
        .popup-menu a, .popup-menu button {
            display: flex; align-items: center; justify-content: space-between; width: 100%;
            padding: 8px 12px; text-decoration: none; color: var(--text-main, #1f1f1f);
            font-size: 13px; font-weight: 500; background: none; border: none; border-radius: 10px;
            cursor: pointer; text-align: left; transition: background 0.2s ease;
        }
        .popup-menu a:hover, .popup-menu button:hover { background: rgba(0, 0, 0, 0.04); }
        body.dark .popup-menu a:hover, body.dark .popup-menu button:hover { background: rgba(255, 255, 255, 0.06); }
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
            gap: 16px; max-height: 85vh; overflow-y: auto; position: relative;
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
        .fb-btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
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

        /* --- STYLE TOAST PERSIS WEATHER.HTML --- */
        .toast {
            position: fixed;
            left: 50%; bottom: 32px;
            transform: translate(-50%, 10px);
            opacity: 0; pointer-events: none;
            background: #1e2124; color: white;
            padding: 12px 20px; border-radius: 16px;
            font-size: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            transition: opacity .2s, transform .2s;
            z-index: 40000; text-align: center;
            white-space: nowrap;
        }
        .toast.show { opacity: 1; transform: translate(-50%,0); }

        @keyframes fb-spin { to { transform: rotate(360deg); } }
    `;
    f.head.appendChild(p);

    var q={
        en:{
            catSearch:"Search",catApps:"Apps",catLearnMore:"Learn more",homepage:"Homepage",settings:"Preferences",displayTheme:"Display theme",light:"Light",dark:"Dark",system:"System",weather:"Weather",translate:"Translate",maps:"Maps",about:"About",privacy:"Privacy",feedback:"Feedback",
            fbTitle:"Send Feedback",fbDesc:"Help us improve Deevv Search by selecting a category and sharing your thoughts.",
            fbTopicLabel:"What can be improved?",
            fbTopics:[
                {label:"UI", value:"Ui"},
                {label:"Features", value:"Fitur"},
                {label:"Speed", value:"Kecepatan"},
                {label:"Other", value:"Lainnya"}
            ],
            fbRatingLabel:"Overall experience",
            fbRatings:[
                {label:"Very satisfied", value:"Sangat puas"},
                {label:"Quite satisfied", value:"Cukup puas"},
                {label:"Needs improvement", value:"Perlu peningkatan"}
            ],
            fbPlaceholder:"Write your feedback details here...",fbCancel:"Cancel",fbSubmit:"Send",
            fbSuccess:"Feedback sent"
        },
        id:{
            catSearch:"Pencarian",catApps:"Aplikasi",catLearnMore:"Lebih banyak",homepage:"Beranda",settings:"Preferensi",displayTheme:"Tema tampilan",light:"Terang",dark:"Gelap",system:"Sistem",weather:"Cuaca",translate:"Terjemahan",maps:"Peta",about:"Tentang",privacy:"Privasi",feedback:"Masukan",
            fbTitle:"Kirim Masukan",fbDesc:"Bantu kami meningkatkan Deevv Search dengan memilih kategori dan memberikan ulasan.",
            fbTopicLabel:"Apa yang bisa ditingkatkan?",
            fbTopics:[
                {label:"UI", value:"Ui"},
                {label:"Fitur", value:"Fitur"},
                {label:"Kecepatan", value:"Kecepatan"},
                {label:"Lainnya", value:"Lainnya"}
            ],
            fbRatingLabel:"Bagaimana pengalaman Anda secara keseluruhan?",
            fbRatings:[
                {label:"Sangat puas", value:"Sangat puas"},
                {label:"Cukup puas", value:"Cukup puas"},
                {label:"Perlu peningkatan", value:"Perlu peningkatan"}
            ],
            fbPlaceholder:"Tulis detail masukan Anda di sini...",fbCancel:"Batal",fbSubmit:"Kirim",
            fbSuccess:"Feedback terkirim"
        }
    };

    function r(){
        try{
            var a=typeof getData=="function"?getData():{};
            return a.lang=="en"?"en":"id";
        }catch(b){return"id";}
    }

    var s=f.createElement("div");s.className="sidebar-backdrop";s.id="sidebar_backdrop";
    var t=f.createElement("div");t.className="popup-menu";t.id="popup_menu";

    function u(){
        var a=q[r()],
            b=typeof getData=="function"?getData().theme||"system":"system",
            c={en:{light:"Light",dark:"Dark",system:"System"},id:{light:"Terang",dark:"Gelap",system:"Sistem"}},
            d=c[r()][b]||c[r()].system;
        t.innerHTML=`
            <div class="popup-section-title">${a.catSearch}</div>
            <div class="popup-group">
                <a href="/"><span>${a.homepage}</span></a>
                <div class="theme-dropdown-container" id="theme_dropdown_container">
                    <button type="button" id="theme_dropdown_toggle">
                        <span>${a.displayTheme}</span>
                        <span class="theme-status-text">
                            <span id="theme_status_label">${d}</span>
                            <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
                        </span>
                    </button>
                    <div class="theme-options-list">
                        <div class="theme-options-inner">
                            <button type="button" class="theme-option-btn ${b==="light"?"active":""}" data-theme="light">${a.light}</button>
                            <button type="button" class="theme-option-btn ${b==="dark"?"active":""}" data-theme="dark">${a.dark}</button>
                            <button type="button" class="theme-option-btn ${b==="system"?"active":""}" data-theme="system">${a.system}</button>
                        </div>
                    </div>
                </div>
                <a href="settings"><span>${a.settings}</span></a>
            </div>
            <div class="popup-divider"></div>
            <div class="popup-section-title">${a.catApps}</div>
            <div class="popup-group">
                <a href="/weather"><span>${a.weather}</span></a>
                <a href="/translate"><span>${a.translate}</span></a>
                <a href="/maps"><span>${a.maps}</span></a>
            </div>
            <div class="popup-divider"></div>
            <div class="popup-section-title">${a.catLearnMore}</div>
            <div class="popup-group">
                <a href="about.html"><span>${a.about}</span></a>
                <a href="privacy.html"><span>${a.privacy}</span></a>
                <button type="button" onclick="openFeedbackModal()"><span>${a.feedback}</span></button>
            </div>
        <div class="sidebar-footer">&copy; 2026 Deevv Search.</div>`;
    }
    u();

    var v=f.createElement("div");v.className="fb-overlay";
    function w(){
        var a=q[r()];
        v.innerHTML=`
            <div class="fb-card" role="dialog" aria-modal="true">
                <div class="fb-loading-wrap" id="fb-loading"><div class="fb-spinner"></div></div>
                <div class="fb-header">
                    <span class="fb-title">${a.fbTitle}</span>
                    <button type="button" class="fb-close" aria-label="${a.fbCancel}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <p class="fb-desc">${a.fbDesc}</p>
                <div class="fb-section">
                    <div class="fb-label-group">${a.fbTopicLabel}</div>
                    <div class="fb-chips" id="fb-topic-chips">
                        ${a.fbTopics.map(function(b,c){return`<button type="button" class="fb-chip ${c===0?"active":""}" data-topic="${b.value}">${b.label}</button>`}).join("")}
                    </div>
                </div>
                <div class="fb-section">
                    <div class="fb-label-group">${a.fbRatingLabel}</div>
                    <div class="fb-chips" id="fb-rating-chips">
                        ${a.fbRatings.map(function(b,c){return`<button type="button" class="fb-chip ${c===0?"active":""}" data-rating="${b.value}">${b.label}</button>`}).join("")}
                    </div>
                </div>
                <div class="fb-section">
                    <div class="fb-label-group">${r()==="en"?"Additional Notes":"Catatan atau Saran Tambahan"}</div>
                    <textarea class="fb-textarea" placeholder="${a.fbPlaceholder}"></textarea>
                </div>
                <div class="fb-footer">
                    <button type="button" class="fb-btn fb-btn-cancel">${a.fbCancel}</button>
                    <button type="button" class="fb-btn fb-btn-submit">${a.fbSubmit}</button>
                </div>
            </div>
        `;
    }
    w();

    function x(){
        if(!e.__uiModalReady){
            e.__uiModalReady=!0;
            var a=f.querySelector("header");
            a?(a.appendChild(t),a.appendChild(s)):(f.body.appendChild(t),f.body.appendChild(s));
            f.body.appendChild(v);
            var b=f.getElementById("menu_btn");
            b&&b.addEventListener("click",function(d){d.stopPropagation();t.classList.toggle("active")});
            s.addEventListener("click",function(){t.classList.remove("active");f.getElementById("theme_dropdown_container")?.classList.remove("open")});
            f.addEventListener("click",function(d){if(!t.contains(d.target)&&!b?.contains(d.target)){t.classList.remove("active");f.getElementById("theme_dropdown_container")?.classList.remove("open")}});
            var c=f.getElementById("theme_dropdown_container"),d=f.getElementById("theme_dropdown_toggle");
            d&&c&&(d.addEventListener("click",function(h){h.stopPropagation();c.classList.toggle("open")}),t.querySelectorAll(".theme-option-btn").forEach(function(h){h.addEventListener("click",function(k){k.stopPropagation();var l=h.getAttribute("data-theme");typeof e.setTheme=="function"&&e.setTheme(l);c.classList.remove("open")})}));
        }
    }
    if(f.readyState==="loading"){
        f.addEventListener("DOMContentLoaded",x);
    } else {
        x();
    }

    function y(a){
        var b=v.querySelector("#"+a);
        b&&b.querySelectorAll(".fb-chip").forEach(function(c){
            c.addEventListener("click",function(){
                b.querySelectorAll(".fb-chip").forEach(function(d){d.classList.remove("active")});
                c.classList.add("active");
            });
        });
    }

    function z(){
        var a=v.querySelector(".fb-close"),
            b=v.querySelector(".fb-btn-cancel"),
            c=v.querySelector(".fb-btn-submit"),
            d=v.querySelector(".fb-textarea");
        
        y("fb-topic-chips");
        y("fb-rating-chips");
        
        var h=function(){v.classList.remove("show")};
        a.addEventListener("click",h);
        b.addEventListener("click",h);
        v.addEventListener("click",function(k){if(k.target===v)h();});
        
        c.addEventListener("click",function(){
            var k=v.querySelector("#fb-topic-chips .fb-chip.active")?.dataset.topic||"",
                l=v.querySelector("#fb-rating-chips .fb-chip.active")?.dataset.rating||"",
                m=d.value.trim();
            
            c.disabled=!0;

            // Membuat Hidden Iframe untuk mengirim data form secara background tanpa redirect & bypass CORS
            var iframeName = "hidden_iframe_" + Date.now();
            var iframe = f.createElement("iframe");
            iframe.name = iframeName;
            iframe.style.display = "none";
            f.body.appendChild(iframe);

            var form = f.createElement("form");
            form.action = "https://docs.google.com/forms/u/0/d/e/1FAIpQLSc1uScj1D4ELT_3ptqSG87GXaThMS9p0f-v8_AYW1KtmmvYPQ/formResponse";
            form.method = "POST";
            form.target = iframeName;
            form.style.display = "none";

            var fields = {
                "entry.85101616": k,
                "entry.367332078": l,
                "entry.370803403": m
            };

            for (var key in fields) {
                var input = f.createElement("input");
                input.type = "hidden";
                input.name = key;
                input.value = fields[key];
                form.appendChild(input);
            }

            f.body.appendChild(form);
            form.submit();

            // Beri jeda singkat untuk memastikan form terkirim ke iframe, lalu bersihkan dan tampilkan toast
            setTimeout(function(){
                try {
                    f.body.removeChild(form);
                    f.body.removeChild(iframe);
                } catch(_){}
                
                var az = q[r()].fbSuccess;
                e.showToast(az);
                c.disabled = !1;
                h();
            }, 800);
        });
    }
    z();

    var A=!1;
    e.openFeedbackModal=function(){
        t.classList.remove("active");
        w();
        z();
        var a=v.querySelector(".fb-textarea"),b=v.querySelector("#fb-loading");
        a.value="";
        v.classList.add("show");
        if(!A){
            b.classList.add("show");
            setTimeout(function(){b.classList.remove("show");A=!0},650);
        }
    };
})();
