import nlp from "https://esm.sh/compromise";
/**
 * SEARCH ENGINE CORE - Serverless Edition
 *
 * Semua data (web, gambar, video, berita, saran, jawaban instan, terjemahan, AI)
 * diambil lewat endpoint milik sendiri: /api/* (Cloudflare Pages Functions).
 * Alamat sumber data dan API key hanya ada di server.
 */

// ==========================================
// 1. STATE & CONFIGURATION
// ==========================================
const urlParams = new URLSearchParams(window.location.search);
const Config = {
    q: (urlParams.get("q") || "").trim(),
    p: urlParams.get("p"),
    hl: urlParams.get("hl"),
    uf: urlParams.get("uf"),
    fv: urlParams.get("fv"),
    sf: urlParams.get("sf"),
    th: urlParams.get("th"),
    tbm: urlParams.get("tbm"),
    rested: false,
    isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
    windowWidth: window.innerWidth > 0 ? window.innerWidth : screen.width,
    startIndex: urlParams.get("p") > 1 ? parseInt(urlParams.get("p"), 10) : 1,
    maxIndex: 30,
    sitelinksData: []
};

// Mengambil pengaturan dari Cookies
const settings = typeof getData === 'function' ? getData() : {};
const isIdLang = settings.lang === "id" || Config.hl === "id";

const searchLangParam = isIdLang ? "&hl=id" : "";
const localLang = isIdLang ? "id-ID" : "en-US";

const isFaviconDisabled = Config.fv == 0 || settings.fv === 0 || settings.fv === false || settings.favicon === false || Config.fv === "0";

let searchParam = "";
searchParam += Config.uf == 1 ? "&uf=1" : "";
searchParam += isFaviconDisabled ? "&fv=0" : "";
searchParam += Config.sf == 1 ? "&sf=1" : "";
searchParam += Config.th == 1 ? "&th=1" : "";


// ==========================================
// 2. DICTIONARY & LANGUAGE
// ==========================================
const LANG_DICT = {
    en: {
        news: "News result", more: "More search results", vidTitle: "Videos",
        related: "People also search for", placeholder: "Type to search...",
        correct: "Did you mean:", noresult: "No matching results",
        noSiteInfo: "There is no information on this page.", suggtext: "Search suggestion:", adlabel: "Ad",
        noresultsug: ["Try different keywords.", "Try more general keywords.", "Try fewer keywords."],
        tab: ["All", "Images", "Videos", "News", "Maps"],
        aiHeader: "AI Overview (Beta)", aiMore: "Show more", aiLess: "Show less",
        aiThinking: "Thinking", justNow: "Just now"
    },
    id: {
        news: "Hasil berita <pre>Beta</pre>", more: "Hasil penelusuran lainnya", vidTitle: "Video",
        related: "Orang lain juga menelusuri", placeholder: "Ketik untuk mencari...",
        correct: "Apakah maksudmu:", noresult: "Tidak ditemukan hasil",
        noSiteInfo: "Tidak ada informasi mengenai halaman ini.", suggtext: "Saran pencarian:", adlabel: "Iklan",
        noresultsug: ["Coba kata kunci yang berbeda.", "Coba kata kunci yang lebih umum.", "Coba lebih sedikit kata kunci."],
        tab: ["Semua", "Gambar", "Video", "Berita", "Peta"],
        aiHeader: "Ringkasan AI (Beta)", aiMore: "Tampilkan lainnya", aiLess: "Tampilkan lebih sedikit",
        aiThinking: "Berpikir", justNow: "Baru saja"
    }
};

const getText = (key, index = null) => {
    const lang = isIdLang ? 'id' : 'en';
    return index !== null ? LANG_DICT[lang][key][index] : LANG_DICT[lang][key];
};


// ==========================================
// 3. UTILITIES
// ==========================================
const Utils = {
    capitalize: (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : "",
    escapeHTML: (str) => str ? String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : "",
    insertAfter: (referenceNode, newNode) => referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling),
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    stripTags: (str) => str ? String(str).replace(/<[^>]*>/g, "") : "",

    // Hanya loloskan URL http(s). Mengembalikan "" kalau tidak valid (mis. javascript:).
    safeUrl: (url) => {
        if (!url || typeof url !== "string") return "";
        try {
            const parsed = new URL(url.trim(), window.location.origin);
            return /^https?:$/.test(parsed.protocol) ? parsed.href : "";
        } catch (e) {
            return "";
        }
    },
    // safeUrl + escape, siap dipakai di dalam atribut HTML
    attrUrl: (url) => Utils.escapeHTML(Utils.safeUrl(url)),

    timeAgo: (input) => {
        const date = input instanceof Date ? input : new Date(input);
        if (isNaN(date)) return "";
        const formatter = new Intl.RelativeTimeFormat(localLang);
        const ranges = { years: 31536000, months: 2592000, weeks: 604800, days: 86400, hours: 3600, minutes: 60, seconds: 1 };
        const secondsElapsed = (date.getTime() - Date.now()) / 1000;

        for (let key in ranges) {
            if (ranges[key] < Math.abs(secondsElapsed)) {
                return formatter.format(Math.round(secondsElapsed / ranges[key]), key);
            }
        }
        return getText("justNow");
    },

    formatDuration: (duration) => {
        if (!duration) return "";
        // Mengubah ISO 8601 duration (misal PT1H2M30S / PT4M15S) ke format mm:ss / hh:mm:ss
        const match = String(duration).match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
        if (match) {
            const hours = parseInt(match[1] || 0, 10);
            const minutes = parseInt(match[2] || 0, 10);
            const seconds = parseInt(match[3] || 0, 10);

            const hStr = hours > 0 ? `${hours}:` : '';
            const mStr = hours > 0 ? String(minutes).padStart(2, '0') : minutes;
            const sStr = String(seconds).padStart(2, '0');

            return `${hStr}${mStr}:${sStr}`;
        }
        return String(duration); // Jika API sudah mengirim format teks seperti "04:15"
    },

    dateConversion: (val, shortMonth = false, skip = false) => {
        if (!val) return "";
        const str = String(val);
        let parsedDate = new Date(str);
        if (isNaN(parsedDate)) {
            parsedDate = new Date(str.replace(/(\d{2}:\d{2}.*)/, "").trim());
            if (isNaN(parsedDate)) return "";
        }
        let year = parsedDate.getFullYear();
        let currentYear = new Date().getFullYear();
        let day = parsedDate.getDate();
        let month = parsedDate.toLocaleString(localLang, { month: shortMonth ? 'short' : 'long' });

        return (year === currentYear && !skip) ? Utils.timeAgo(parsedDate) : `${day} ${month} ${year}`;
    },

    faviconFor: (link) => `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(link)}&size=64`,

    loaderHtml: `<div class="loader"><svg class="circular" viewBox="25 25 50 50"><circle class="path" cx="50" cy="50" r="20" fill="none" stroke-width="4" stroke-miterlimit="10"/></svg></div>`
};


// ==========================================
// 4. API (semua lewat serverless /api/*)
// ==========================================
const API = {
    base: "/api",

    get: async (route, params = {}) => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") qs.set(key, value);
        });
        const res = await fetch(`${API.base}/${route}?${qs.toString()}`, {
            credentials: "same-origin",
            headers: { "Accept": "application/json" }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    },

    post: async (route, body) => {
        const res = await fetch(`${API.base}/${route}`, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    },

    // Tab "Semua" dan tombol "Hasil penelusuran lainnya" (page = 1, 11, 21)
    fetchWeb: (query, page) => API.get("web", { q: query, page, hl: isIdLang ? "id" : "" }),

    fetchVideo: (query, limit = 50) => API.get("videos", { q: query, limit }),

    fetchNews: (query) => API.get("news", { q: query, hl: isIdLang ? "id" : "" }),

    fetchImages: (query, page = 1) => API.get("images", { q: query, page, hl: isIdLang ? "id" : "" }),

    fetchInstantAnswer: (query) => API.get("instant", { q: query }),

    fetchSuggestions: (query) => API.get("suggest", { q: query }),

    fetchPlayStoreApp: (query) => API.get("playstore", { q: query, hl: isIdLang ? "id" : "en" }),

    translate: async (text, from, to) => {
        const data = await API.post("translate", { text, sl: from, tl: to });
        return data.text || "";
    },

    fetchAI: async (promptUser, context = "") => {
        const data = await API.post("ai", { q: promptUser, context });
        return String(data.text || "").trim();
    }
};


// ==========================================
// 5. WIDGETS & INSTANT ANSWERS
// ==========================================

// Evaluator kalkulator yang aman (menggantikan eval)
const SafeMath = {
    evaluate: (expression) => {
        const s = String(expression).replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/");
        if (!/^[0-9.+\-*/%]+$/.test(s)) throw new Error("bad");
        let i = 0;
        const peek = () => s[i];

        const number = () => {
            const start = i;
            while (i < s.length && /[0-9.]/.test(s[i])) i++;
            const token = s.slice(start, i);
            if (!token || token === "." || (token.match(/\./g) || []).length > 1) throw new Error("bad");
            return parseFloat(token);
        };
        const unary = () => {
            if (peek() === "-") { i++; return -unary(); }
            if (peek() === "+") { i++; return unary(); }
            let value = number();
            while (peek() === "%") { i++; value = value / 100; }
            return value;
        };
        const term = () => {
            let value = unary();
            while (peek() === "*" || peek() === "/") {
                const op = s[i++];
                const right = unary();
                if (op === "/" && right === 0) throw new Error("div0");
                value = op === "*" ? value * right : value / right;
            }
            return value;
        };
        const expr = () => {
            let value = term();
            while (peek() === "+" || peek() === "-") {
                const op = s[i++];
                const right = term();
                value = op === "+" ? value + right : value - right;
            }
            return value;
        };

        const result = expr();
        if (i !== s.length || !Number.isFinite(result)) throw new Error("bad");
        return result;
    }
};

const Widgets = {
    renderInstantCard: (res) => {
        const snippetText = Utils.stripTags(res.snippet || "");
        if (!snippetText || snippetText.length <= 100) return;
        const container = document.createElement("div");
        container.className = "instant-answer";

        let subtitle = "";
        if (res.infobox && Array.isArray(res.infobox)) {
            const descItem = res.infobox.find(item => item.label === "Wikidata description" || item.data_type === "wd_description");
            if (descItem) subtitle = Utils.escapeHTML(Utils.stripTags(descItem.value));
        }

        const title = Utils.escapeHTML(Utils.stripTags(res.title || ""));
        const imageSrc = Utils.attrUrl(res.image);
        let imageHtml = imageSrc ? `<img src="${imageSrc}" class="logo" alt="${title}" ${res.type ? 'style="border:1px solid #999"' : ''}>` : '';

        let infoboxHtml = '';
        if (res.infobox && res.infobox.length > 0) {
            const items = res.infobox.slice(0, 2).map(info => {
                const value = Utils.stripTags(info.value || "").trim();
                if (!value) return '';
                return `
                    <div class="infobox-item">
                        <div class="infobox-item__label">${Utils.escapeHTML(Utils.stripTags(info.label || ""))}</div>
                        <div class="infobox-item__value">${Utils.escapeHTML(value)}</div>
                    </div>
                `;
            }).join("");
            if (items) infoboxHtml = `<div class="infobox">${items}</div>`;
        }

    hitungTriggerApiPlayStore: (query) => {
        const queryClean = query.trim().toLowerCase();
        if (!queryClean) return false;

        let doc = nlp(queryClean);

        // Jalur 1: Negative Intent (Blokir kata kunci tutorial/masalah)
        const kataKunciBlokir = ['cara', 'tutorial', 'tips', 'trik', 'bagaimana', 'why', 'how', 'uninstall', 'hapus', 'error', 'rusak', 'bug', 'berita', 'artikel'];
        if (kataKunciBlokir.some(kata => doc.has(kata))) return false;

        // Jalur 2: Explicit Intent (Langsung lolos jika ada kata kunci aplikasi/game)
        const kataKunciAplikasi = ['download', 'unduh', 'install', 'pasang', 'dapatkan', 'apk', 'app', 'aplikasi', 'game', 'gim', 'mod'];
        if (kataKunciAplikasi.some(kata => doc.has(kata))) return true;

        // Jalur 3: Filtering NLP Entitas
        if (doc.people().found) return false;
        if (doc.verbs().found && !doc.has('(download|install|unduh|pasang)')) return false;
        if (doc.nouns().found) return true;

        return false;
    },

    checkPlayStoreWidget: async () => {
        const query = Config.q.trim();
        const mainResult = document.querySelector(".main-result .results-list");
        if (!mainResult || !query) return;

        // Cek algoritma NLP
        const butuhPlayStore = Widgets.hitungTriggerApiPlayStore(query);
        if (!butuhPlayStore) return;

        try {
            const app = await API.fetchPlayStoreApp(query);
            if (!app || !app.title) return;

            const icon = Utils.attrUrl(app.icon || app.thumbnail);
            const title = Utils.escapeHTML(app.title);
            const developer = Utils.escapeHTML(app.developer || app.author || "Google Play");
            const score = app.score ? parseFloat(app.score).toFixed(1) : null;
            const url = Utils.attrUrl(app.url || `https://play.google.com/store/apps/details?id=${app.appId}`);

            const card = document.createElement("div");
            card.className = "result-card result-card--flat playstore-widget";
            card.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px; padding: 4px 0;">
                    ${icon ? `<img src="${icon}" alt="${title}" style="width:48px; height:48px; border-radius:10px; object-fit:cover;">` : ''}
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:600; font-size:15px; color:var(--text-color, #1a0dab); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${title}</div>
                        <div style="font-size:13px; color:#5f6368;">${developer} ${score ? `• ⭐ ${score}` : ''}</div>
                    </div>
                    <a href="${url}" target="_blank" rel="noopener" style="background:#01875f; color:#fff; padding:6px 16px; border-radius:18px; text-decoration:none; font-size:13px; font-weight:500; white-space:nowrap;">
                        ${isIdLang ? 'Install' : 'Get'}
                    </a>
                </div>
            `;

            // Sisipkan di paling atas hasil pencarian web
            mainResult.insertAdjacentElement('afterbegin', card);
        } catch (err) {
            console.log("Widget Play Store tidak dimuat:", err);
        }
    },

        const sourceHref = Utils.attrUrl(res.sourceUrl) || "#";
        const sourceName = Utils.escapeHTML(Utils.stripTags(res.source || ""));

        container.innerHTML = `
            <div class="title">${title}</div>
            ${subtitle ? `<div class="instant-answer__subtitle">${subtitle}</div>` : ''}
            ${imageHtml}
            <div class="summary-box">
                <div class="instant-answer__section-title">Ringkasan</div>
                <div class="summary-text">
                    ${Utils.escapeHTML(snippetText.slice(0, 140))}... 
                    <a href="${sourceHref}" class="wikipedia">${sourceName} ›</a>
                </div>
            </div>
            ${infoboxHtml}
        `;

        if (Config.windowWidth > 780) {
            const wrapper = document.querySelector(".sidebar-panel") || (() => {
                const side = document.createElement("div"); side.className = "sidebar-panel";
                const host = document.querySelector(".result-wrapper");
                if (host) host.appendChild(side);
                return side;
            })();
            wrapper.appendChild(container);
        } else {
            const anchor = document.querySelectorAll(".result-card")[2];
            if (anchor) Utils.insertAfter(anchor, container);
            else {
                const main = document.querySelector(".main-result");
                if (main) main.appendChild(container);
            }
        }
    },

    renderWidgets: (res) => {
        const query = Config.q.toLowerCase();
        const mainResult = document.querySelector(".main-result .results-list");
        if (!mainResult) return;

        // Panggil Widget AI Overview (menggunakan Regex internal di checkAIOverview)
        Widgets.checkAIOverview(res);

        const isTime = /jam|waktu|time|clock/.test(query) && query.length < 15 && query.split(" ").length < 4;
        const isDate = /tanggal|date/.test(query) && query.length < 15 && query.split(" ").length < 4;
        const isCalc = (/kalkulator|calculator/.test(query) && query.split(" ").length <= 2) || (/calculator\s+online|kalkulator\s+online/.test(query) && query.split(" ").length <= 3);
        const isTranslate = /translate|terjemah|terjemahan/.test(query);
        const d = new Date();

        if (isTime) {
            const timeStr = `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
            let tzName = "";
            try {
                tzName = new Intl.DateTimeFormat(localLang, { timeZoneName: 'short' }).formatToParts(d).find(part => part.type === 'timeZoneName')?.value || "";
            } catch (e) {}
            const dateStr = `${d.toLocaleDateString(localLang, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}${tzName ? `, ${tzName}` : ""}`;
            mainResult.insertAdjacentHTML('beforeend', `<div class="result-card result-card--flat result-card--empty"><div class="big-title">${timeStr}</div><div class="snippet-info">${dateStr}</div></div>`);
        }
        else if (isDate) {
            mainResult.insertAdjacentHTML('beforeend', `<div class="result-card result-card--flat result-card--empty"><div class="big-title">${d.toLocaleDateString(localLang, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div></div>`);
        }
        else if (isCalc) {
            mainResult.insertAdjacentHTML('beforeend', `
                <div class="calculator">
                    <input type="text" inputmode="none" class="display" />
                    <div class="buttons">
                        <button class="operator" data-value="AC">AC</button><button class="operator" data-value="DEL">DEL</button>
                        <button class="operator" data-value="%">%</button><button class="operator" data-value=" ÷ ">÷</button>
                        <button data-value="7">7</button><button data-value="8">8</button><button data-value="9">9</button><button class="operator" data-value=" × ">×</button>
                        <button data-value="4">4</button><button data-value="5">5</button><button data-value="6">6</button><button class="operator" data-value=" - ">-</button>
                        <button data-value="1">1</button><button data-value="2">2</button><button data-value="3">3</button><button class="operator" data-value=" + ">+</button>
                        <button data-value="0">0</button><button data-value="00">00</button><button data-value=".">.</button><button class="operator" data-value="=" th="true">=</button>
                    </div>
                </div>`);
            Widgets.initCalculator();
        }
        else if (isTranslate) {
            mainResult.insertAdjacentHTML('beforeend', `
                <div class="trnsl"><div class="wrpl"><ul class="controls">
                    <li class="row from"><div class="icons"><i class="fas fa-volume-up"></i><i class="fas fa-copy"></i></div><select></select></li>
                    <li class="exchange"><i class="fas fa-exchange-alt"></i></li>
                    <li class="row to"><select></select><div class="icons"><i class="fas fa-volume-up"></i><i class="fas fa-copy"></i></div></li>
                </ul>
                <div class="text-input"><textarea spellcheck="false" class="from-text" placeholder="Enter text"></textarea><textarea spellcheck="false" readonly disabled class="to-text" placeholder="Translation"></textarea></div></div></div>
            `);
            Widgets.initTranslator();
        }
    },

    // --- WIDGET AI OVERVIEW ---
    checkAIOverview: async (res) => {
        if (res?.spelling) return;
        const query = Config.q.trim();
        const mainResult = document.querySelector(".main-result .results-list");
        if (!mainResult || !query || query.length < 4) return;

        // Regex untuk memastikan kata pencarian berupa pertanyaan
        const isQuestion = /(\?|\b(apa|siapa|mengapa|kenapa|bagaimana|kapan|di\s*mana|dimana|jelaskan|sebutkan|resep|cara)\b)/i.test(query);
        if (!isQuestion) return;

        // Gunakan class .result-card .result-card--flat yang sudah ada
        const card = document.createElement("div");
        card.className = "result-card result-card--flat ai-overview-card";

        const thinkingTitle = getText("aiThinking");
        const headerTitle = getText("aiHeader");

        // Skeleton loading
        card.innerHTML = `
            <div class="ai-header">
                <svg viewBox="0 0 24 24"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>
                <span>${thinkingTitle}</span>
            </div>
            <div class="bone-container">
                <div class="bone-line"></div>
                <div class="bone-line medium"></div>
                <div class="bone-line short"></div>
            </div>
        `;

        mainResult.insertAdjacentElement('afterbegin', card);

        const contextSnippets = res?.items
            ? res.items.slice(0, 4).map(item => `- ${item.title}: ${item.snippet}`).join("\n")
            : "";

        try {
            // Server yang memanggil model AI; browser tidak pernah memegang API key
            const rawText = await API.fetchAI(query, contextSnippets);

            // Validasi Pesan: Jika AI menolak atau tidak menyertakan delimiter '---', hapus card
            const isRefusal = /i('m| am) sorry|can'?t provide|cannot provide|maaf,?\s*(saya|kami)?|tidak dapat|tidak bisa/i.test(rawText);
            if (isRefusal || !rawText.includes('---')) {
                card.remove();
                return;
            }

            card.classList.add("is-updating");

            // Tunggu 200ms saat elemen transparan, baru ganti HTML & fade-in lagi
            setTimeout(() => {
                card.innerHTML = Widgets.parseAIOverviewContent(rawText, headerTitle);
                card.classList.remove("is-updating");
            }, 200);

        } catch (err) {
            card.remove(); // Hapus widget jika fetch error
        }
    },

    parseAIOverviewContent: (teks, headerTitle) => {
        // Escape dulu supaya output model tidak bisa menyisipkan HTML, baru ubah **tebal**
        const safeText = Utils.escapeHTML(teks).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        const parts = safeText.split('---').map(p => p.trim());

        let summary = parts[0] || safeText;
        let subTitle = parts[1] ? parts[1].replace(/<\/?strong>/g, '') : "";
        let listContent = parts[2] || "";
        let conclusion = parts[3] ? parts[3].replace(/<\/?strong>/g, '') : "";

        let listItems = listContent.split('\n')
            .filter(line => line.trim().match(/^[-*]/))
            .map(line => line.replace(/^[-*]\s*/, '').trim());

        const hasMoreContent = subTitle || listItems.length > 0 || conclusion;

        // Bungkus seluruh isi teks di dalam .ai-content-wrapper
        let html = `
            <div class="ai-header">
                <svg viewBox="0 0 24 24"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>
                <span>${headerTitle}</span>
            </div>
            <div class="ai-content-wrapper">
                <div class="ai-summary-text">${summary}</div>
        `;

        if (hasMoreContent) {
            html += `<div class="ai-collapsible-body">`;
            if (subTitle) html += `<div class="ai-sub-title">${subTitle}</div>`;
            if (listItems.length > 0) {
                html += `<ul class="dynamic-list">`;
                listItems.forEach(item => { html += `<li>${item}</li>`; });
                html += `</ul>`;
            }
            if (conclusion) {
                html += `<div class="ai-summary-text" style="margin-top: 12px;">${conclusion}</div>`;
            }
            html += `</div>`;
        }

        html += `</div>`; // Tutup .ai-content-wrapper

        if (hasMoreContent) {
            html += `
                <button class="btn-show-more" onclick="Widgets.toggleAIList(this)">
                    <span>${getText("aiMore")}</span>
                    <svg viewBox="0 0 16 16"><path fill="currentColor" d="M3.5 5.5l4.5 4.5 4.5-4.5L14 7l-6 6-6-6z"/></svg>
                </button>
            `;
        }

        return html;
    },

    toggleAIList: (btn) => {
        const parent = btn.closest('.ai-overview-card');
        if (!parent) return;

        // Control class expanded langsung pada wrapper utama
        const wrapper = parent.querySelector('.ai-content-wrapper');
        const isExpanded = btn.classList.toggle('expanded');

        if (wrapper) {
            wrapper.classList.toggle('expanded', isExpanded);
        }

        btn.querySelector('span').textContent = isExpanded ? getText("aiLess") : getText("aiMore");
    },

    checkVideoWidget: async () => {
        const slot = document.getElementById("dynamic-video-widget-slot");
        if (!slot) return;
        try {
            const data = await API.fetchVideo(Config.q, 4);
            if (!data.items || !data.items.length) {
                slot.remove();
                return;
            }

            let videonya = "";
            const limit = Math.min(data.items.length, 4);
            for (let i = 0; i < limit; i++) {
                const item = data.items[i];
                const snippet = item?.snippet;
                if (!snippet) continue;

                const videoId = encodeURIComponent(item.id?.videoId || item.id || "");
                const title = Utils.escapeHTML(snippet.title);
                const thumb = Utils.attrUrl(snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url);
                const channel = Utils.escapeHTML(snippet.channelTitle);
                const dateStr = Utils.dateConversion(snippet.publishTime);

                videonya += `
                    <div class="video-widget-item">
                        <a href="https://youtube.com/watch?v=${videoId}">
                            <div class="video-widget-item__row">
                                <div class="thumbnail">
                                    ${thumb ? `<img src="${thumb}" alt="">` : ""}
                                    <div class="video-widget-item__play">
                                        <span class="play-icon">
                                            <svg focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                                <circle fill="#fff" cx="12" cy="12" r="6.2"/>
                                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5"></path>
                                            </svg>
                                        </span>
                                    </div>
                                </div>
                                <div class="video-widget-item__text">
                                    <div class="video-widget-item__title">${title}</div>
                                    <div class="video-widget-item__meta">YouTube<span class="dot"></span><div class="video-widget-item__channel">${channel}</div></div>
                                    ${dateStr ? `<div class="video-widget-item__date">${dateStr}</div>` : ""}
                                </div>
                            </div>
                        </a>
                    </div>`;
            }

            if (!videonya) {
                slot.remove();
                return;
            }

            slot.className = "result-card video-widget result-card--flat";
            slot.innerHTML = `<div class="title video-widget__title">${getText("vidTitle")}</div><div class="video-widget__list">${videonya}</div>`;
        } catch (err) {
            slot.remove();
            console.log("Gagal memuat widget video:", err);
        }
    },

    initCalculator: () => {
        const calculatorBox = document.querySelector(".calculator");
        if (!calculatorBox) return;
        const display = calculatorBox.querySelector(".display");
        let output = "";
        let justEvaluated = false;

        calculatorBox.querySelectorAll("button").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const val = e.currentTarget.dataset.value;
                const isOperatorKey = ["%", " ÷ ", " × ", " - ", " + ", "="].includes(val);

                if (output === "Error" && val !== "AC") {
                    output = "";
                }

                if (val === "=" && output !== "") {
                    try {
                        const result = SafeMath.evaluate(output);
                        output = String(parseFloat(result.toPrecision(12)));
                        justEvaluated = true;
                    } catch (err) {
                        output = "Error";
                        justEvaluated = false;
                    }
                } else if (val === "AC") {
                    output = "";
                    justEvaluated = false;
                } else if (val === "DEL") {
                    output = output.toString().slice(0, -1).trimEnd();
                    justEvaluated = false;
                } else if (val !== "=") {
                    if (output === "" && isOperatorKey) return;
                    // Mengetik angka setelah hasil "=" memulai perhitungan baru
                    if (justEvaluated && !isOperatorKey) output = "";
                    justEvaluated = false;
                    output += val;
                }
                display.value = output;
                display.blur();
            });
        });
    },

    initTranslator: () => {
        const countries = { en: "English", id: "Indonesian", es: "Spanish", fr: "French", de: "German", ja: "Japanese", ko: "Korean", zh: "Chinese" };
        const container = document.querySelector(".trnsl");
        if (!container) return;

        const fromText = container.querySelector(".from-text"), toText = container.querySelector(".to-text");
        const exchangeIcon = container.querySelector(".exchange"), selects = container.querySelectorAll("select");
        let timer;
        let requestId = 0;

        selects.forEach((sel, i) => {
            for (let code in countries) {
                let selected = (i === 0 && code === (isIdLang ? "id" : "en")) || (i === 1 && code === (isIdLang ? "en" : "id")) ? "selected" : "";
                sel.insertAdjacentHTML("beforeend", `<option value="${code}" ${selected}>${countries[code]}</option>`);
            }
            sel.addEventListener("change", translate);
        });

        exchangeIcon.addEventListener("click", () => {
            let tempVal = fromText.value; fromText.value = toText.value; toText.value = tempVal;
            let tempLang = selects[0].value; selects[0].value = selects[1].value; selects[1].value = tempLang;
            translate();
        });

        fromText.addEventListener("input", () => {
            clearTimeout(timer);
            if (!fromText.value) { requestId++; toText.value = ""; }
            else timer = setTimeout(translate, 500);
        });

        // Tombol suara & salin
        container.querySelectorAll(".row").forEach(row => {
            const isFrom = row.classList.contains("from");
            const area = isFrom ? fromText : toText;
            const select = isFrom ? selects[0] : selects[1];

            row.querySelectorAll(".icons i").forEach(icon => {
                icon.addEventListener("click", () => {
                    if (!area.value) return;
                    if (icon.classList.contains("fa-copy")) {
                        if (navigator.clipboard) navigator.clipboard.writeText(area.value).catch(() => {});
                    } else if (icon.classList.contains("fa-volume-up") && "speechSynthesis" in window) {
                        const utterance = new SpeechSynthesisUtterance(area.value);
                        utterance.lang = select.value;
                        window.speechSynthesis.speak(utterance);
                    }
                });
            });
        });

        async function translate() {
            const text = fromText.value.trim();
            if (!text) return;
            const currentId = ++requestId;
            toText.setAttribute("placeholder", "Translating...");
            try {
                // Terjemahan diproses lewat /api/translate (bukan langsung dari browser)
                const output = await API.translate(text, selects[0].value, selects[1].value);
                if (currentId !== requestId) return; // abaikan respons usang
                toText.value = output;
            } catch (err) {
                if (currentId !== requestId) return;
                toText.value = "Translation error";
            }
        }
    }
};


// ==========================================
// 6. UI BUILDER & LOGIC
// ==========================================
const UI = {
  _clickBound: false,

  renderBase: (opts = {}) => {
    const preserveResults = !!opts.preserveResults;
    const existingMainResult = preserveResults ? document.querySelector(".main-result")?.outerHTML : null;
    document.title = isIdLang ? `${Config.q} - Penelusuran` : `${Config.q} - Search`;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (settings.theme === "dark" || (settings.theme === "system" && prefersDark) || Config.th == 1) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
    const svgIcons = {
        all: `<svg width="16" height="16" viewBox="0 0 16 16" fill="#6e7780" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M6 1C2.68629 1 0 3.68629 0 7C0 10.3137 2.68629 13 6 13C7.64669 13 9.13845 12.3366 10.2226 11.2626L14.7873 14.8403C15.1133 15.0959 15.5848 15.0387 15.8403 14.7127C16.0958 14.3867 16.0387 13.9153 15.7126 13.6597L11.1487 10.0826C11.6892 9.18164 12 8.12711 12 7C12 3.68629 9.31371 1 6 1ZM1.5 7C1.5 4.51472 3.51472 2.5 6 2.5C8.48528 2.5 10.5 4.51472 10.5 7C10.5 9.48528 8.48528 11.5 6 11.5C3.51472 11.5 1.5 9.48528 1.5 7Z"></path></svg>`,
        images: `<svg width="16" height="16" viewBox="0 0 16 16" fill="#6e7780"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.25 1C1.455 1 0 2.455 0 4.25V11.75C0 13.545 1.455 15 3.25 15H12.75C14.545 15 16 13.545 16 11.75V10.259C16 10.253 16 10.247 16 10.241V4.25C16 2.455 14.545 1 12.75 1H3.25ZM14.5 8.439V4.25C14.5 3.284 13.716 2.5 12.75 2.5H3.25C2.284 2.5 1.5 3.284 1.5 4.25V11.75C1.5 11.956 1.536 12.154 1.601 12.338L5.97 7.97C6.263 7.677 6.737 7.677 7.03 7.97L8 8.939L10.97 5.97C11.263 5.677 11.737 5.677 12.03 5.97L14.5 8.439ZM9.061 10L10.03 10.97C10.323 11.263 10.323 11.737 10.03 12.03C9.737 12.323 9.263 12.323 8.97 12.03L6.5 9.561L2.662 13.399C2.846 13.464 3.044 13.5 3.25 13.5H12.75C13.716 13.5 14.5 12.716 14.5 11.75V10.561L11.5 7.561L9.061 10Z"></path></svg>`,
        videos: `<svg width="16" height="16" viewBox="0 0 16 16" fill="#6e7780"><path fill-rule="evenodd" clip-rule="evenodd" d="M13.489 5.55C15.38 6.636 15.38 9.364 13.489 10.45L6.231 14.616C4.348 15.698 2 14.338 2 12.166L2 3.834C2 1.662 4.348 0.303 6.231 1.384L13.489 5.55ZM12.742 9.149C13.629 8.64 13.629 7.36 12.742 6.851L5.485 2.685C4.601 2.178 3.5 2.816 3.5 3.834L3.5 12.166C3.5 13.185 4.601 13.823 5.485 13.316L12.742 9.149Z"></path></svg>`,
        news: `<svg width="16" height="16" viewBox="0 0 22 22" fill="#6e7780"><path d="M12 11h6v2h-6v-2zm-6 6h12v-2H6v2zm0-4h4V7H6v6zm16-7.22v12.44c0 1.54-1.34 2.78-3 2.78H5c-1.64 0-3-1.25-3-2.78V5.78C2 4.26 3.36 3 5 3h14c1.64 0 3 1.25 3 2.78zM19.99 12V5.78c0-.42-.46-.78-1-.78H5c-.54 0-1 .36-1 .78v12.44c0 .42.46.78 1 .78h14c.54 0 1-.36 1-.78V12zM12 9h6V7h-6v2"></path></svg>`,
        maps: `<svg width="16" height="16" viewBox="0 0 16 16" fill="#6e7780" xmlns="http://www.w3.org/2000/svg"><path d="M8 8C9.10457 8 10 7.10457 10 6C10 4.89543 9.10457 4 8 4C6.89543 4 6 4.89543 6 6C6 7.10457 6.89543 8 8 8Z"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M8 0C6.81332 0 5.65328 0.351894 4.66658 1.01118C3.67989 1.67047 2.91085 2.60754 2.45673 3.7039C2.0026 4.80026 1.88378 6.00666 2.11529 7.17054C2.35179 8.35952 2.99591 9.39906 3.73051 10.2144C5.0603 11.6902 5.95884 13.0319 6.52237 13.9981C6.80408 14.4812 7.00183 14.87 7.1277 15.1343C7.19062 15.2665 7.23554 15.3675 7.26398 15.4334C7.27819 15.4664 7.28829 15.4907 7.29444 15.5057L7.30075 15.5212L7.30129 15.5226L7.30168 15.5236C7.41829 15.8212 7.71074 16.0123 8.03018 15.9994C8.34937 15.9865 8.62531 15.7729 8.71783 15.4673L8.71818 15.4662L8.72264 15.4522C8.72711 15.4384 8.73473 15.4154 8.74578 15.3837C8.76791 15.3202 8.80379 15.2219 8.85585 15.0927C8.95997 14.8342 9.12867 14.452 9.38109 13.9769C9.88586 13.0267 10.7253 11.7051 12.0529 10.2568C12.7338 9.51391 13.6375 8.41354 13.8847 7.17054C14.1162 6.00666 13.9974 4.80026 13.5433 3.7039C13.0892 2.60754 12.3201 1.67047 11.3334 1.01118C10.3467 0.351894 9.18669 0 8 0ZM8.05642 13.2731C8.01989 13.3419 7.98488 13.409 7.95134 13.4745C7.90893 13.3994 7.86453 13.322 7.81811 13.2425C7.20975 12.1993 6.25213 10.7721 4.84488 9.21027C4.23085 8.5288 3.75511 7.72573 3.58647 6.87791C3.41284 6.00499 3.50195 5.10019 3.84254 4.27792C4.18314 3.45566 4.75992 2.75285 5.49994 2.25839C6.23996 1.76392 7.10999 1.5 8 1.5C8.89002 1.5 9.76005 1.76392 10.5001 2.25839C11.2401 2.75285 11.8169 3.45566 12.1575 4.27793C12.4981 5.10019 12.5872 6.00499 12.4135 6.87791C12.2556 7.67171 11.6276 8.50093 10.9471 9.24321C9.52471 10.7949 8.61414 12.2233 8.05642 13.2731Z"></path></svg>`,
    };
    const createTab = (id, tbmVal, icon, label) => { const query = encodeURIComponent(Config.q).replace(/%20/g, '+');return `<div class="search-item"><a href="${id === "maps" ? `/maps?q=${query}` : `/search?q=${query}${tbmVal}${searchLangParam}${searchParam}`}" class="tab-wrapper" tab-id="${id}"><div class="label">${Config.windowWidth >= 780 ? svgIcons[icon] : ''}<span>${getText("tab", label)}</span></div></a></div>`.trim();};

    document.body.innerHTML = ` 
      <div class="app" id="main-bx"> 
        <div class="page-header"> 
          <div class="page-header__inner"> 
            <div class="logo-slot"><a title="Kembali" href="/"><img alt="Logo" src="/images/logo.png"></a></div> 
            <div class="header"> 
              <div class="search-box"> 
                <div class="search-field"> 
                  <input type="search" id="sear_21829_input" value="${Utils.escapeHTML(Config.q.trim())}" name="q" class="search-input" autocomplete="off" placeholder="${getText("placeholder")}"> 
                  <div role="button" class="search-toggle inpbtun" id="xclarGh" title="Cari"></div> 
                  <div role="button" class="cleartext inpbtun" style="display:none" id="Chasprn" title="Hapus"></div> 
                </div> 
              </div> 
            </div> 
          </div> 
          <div class="search-menu"> 
            ${createTab("all", "", "all", 0)} 
            ${createTab("images", "&tbm=isch", "images", 1)} 
            ${createTab("videos", "&tbm=vid", "videos", 2)} 
            ${createTab("news", "&tbm=nws", "news", 3)} 
            ${createTab("maps", "", "maps", 4)} 
          </div> 
        </div> 
        <div class="results-section"> 
          <div class="result-wrapper">${existingMainResult || '<div class="main-result"></div>'}</div> 
        </div> 
      </div> `;
    UI.setupEventListeners();
  },

    setupEventListeners: () => {
        const searchInput = document.querySelector(".search-input");
        const clearBtn = document.querySelector(".cleartext");
        const toggleBtn = document.querySelector(".search-toggle");

        if (!searchInput) return;

        SuggestionsManager.init();

        if (searchInput.value.trim() && clearBtn) {
            clearBtn.style.display = "block";
        }

        searchInput.addEventListener('input', () => {
            if (clearBtn) clearBtn.style.display = searchInput.value ? "block" : "none";
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                searchInput.setAttribute('data-backup-value', searchInput.value);
                searchInput.value = "";
                searchInput.focus();
                clearBtn.style.display = "none";
            });
        }

        searchInput.addEventListener('keyup', (e) => {
            if (e.key === "Enter" && toggleBtn) toggleBtn.click();
        });

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                if (searchInput.value.trim()) {
                    const searchData = Config.tbm ? `&tbm=${Config.tbm}` : "";
                    window.location.href = `/search?q=${encodeURIComponent(searchInput.value).replace(/%20/g,'+')}${searchData}${searchLangParam}${searchParam}`;
                }
            });
        }

        // Tombol "Hasil penelusuran lainnya" (didaftarkan sekali saja)
        if (!UI._clickBound) {
            UI._clickBound = true;
            document.addEventListener('click', e => {
                if (e.target.matches && e.target.matches('.show-wrapper .more')) handlePagination();
            });
        }
    },

    setupTabStyles: (opts = {}) => {
        const items = document.querySelectorAll(".search-item");
        const mainResult = document.querySelector(".main-result");

        if (Config.tbm === "vid") {
            items[2].classList.add("selected");
            mainResult.classList.add("video-grid");
        } else if (Config.tbm === "isch") {
            items[1].classList.add("selected");
            // Loader awal; ImageSearch.init() yang mengganti isinya dengan grid gambar
            mainResult.innerHTML = `<div class="show-wrapper">${Utils.loaderHtml}</div>`;
        } else if (Config.tbm === "nws") {
            items[3].classList.add("selected");
        } else {
            items[0].classList.add("selected");
            // Kalau hasil sudah di-render server (opts.preserveResults), .results-list
            // sudah ada di DOM -> jangan tambah lagi, nanti dobel.
            if (!opts.preserveResults && !mainResult.querySelector(".results-list")) {
                mainResult.innerHTML += `<div class="results-list"></div>`;
            }
        }
    },

    renderFooter: () => {
        const section = document.querySelector(".results-section");
        if (section && !document.querySelector("footer")) {
            section.insertAdjacentHTML('beforeend', `
                <footer>
                    <div class="footer-links">
                        <a href="/privacy" class="footer-link">Privacy</a>
                        <span class="footer-separator">•</span>
                        <a href="/settings" class="footer-link">Settings</a>
                    </div>
                    <span class="footer-copy">&copy; ${new Date().getFullYear()} Deevv Search</span>
                </footer>
            `);
        }
    },

    renderEmptyState: () => {
        const list = Array(3).fill(0).map((_, i) => `<li>${getText("noresultsug", i)}</li>`).join("");
        document.querySelector(".main-result").innerHTML += `
            <div class="result-card result-card--empty result-card--flat">
                <div class="title-black">${getText("noresult")}</div>
                <div class="suggestion">${getText("suggtext")}</div>
                <div><ul>${list}</ul></div>
            </div>`;
    },

    handleErrorState: () => {
        document.head.innerHTML = `<style>*{margin:0;padding:0}html{font:15px/22px arial,sans-serif;background:#fff;color:#222;padding:15px}body{margin:7% auto 0;max-width:390px;min-height:180px;padding:30px 0 15px}#error{font-size:40px;font-weight:bold;color:black}</style>`;
        document.body.innerHTML = `<span id="error">ERROR</span><p><b>503.</b> That’s an error.</p><p>Site under maintenance.</p>`;
        document.title = "Error 503";
    }
};

// ==========================================
// SUGGESTION MANAGER
// ==========================================
const SuggestionsManager = {
    isEnabled: () => {
        return settings.sug !== false && settings.suggest !== false && settings.sug !== 0 && settings.suggest !== 0;
    },

    debounceTimer: null,

    init: () => {
        if (!SuggestionsManager.isEnabled()) return;

        const mainInput = document.querySelector(".search-input");
        if (!mainInput) return;

        if (Config.windowWidth < 780 || Config.isMobile) {
            mainInput.addEventListener("focus", () => {
                SuggestionsManager.openMobileOverlay(mainInput.value);
            });
        } else {
            mainInput.addEventListener("input", (e) => {
                const query = e.target.value.trim();
                SuggestionsManager.handleDesktopInput(query);
            });

            mainInput.addEventListener("focus", (e) => {
                const query = e.target.value.trim();
                if (query) SuggestionsManager.handleDesktopInput(query);
            });

            document.addEventListener("click", (e) => {
                if (!e.target.closest(".search-box")) {
                    SuggestionsManager.closeDesktopDropdown();
                }
            });
        }
    },

    openMobileOverlay: (initialQuery) => {
        const tabParam = Config.tbm ? `&tbm=${Config.tbm}` : "";

        const mainInput = document.querySelector(".search-input");
        let originalMainQuery = "";
        if (mainInput) {
            originalMainQuery = mainInput.hasAttribute('data-backup-value')
                ? mainInput.getAttribute('data-backup-value')
                : mainInput.value;
            mainInput.removeAttribute('data-backup-value');
        }

        const activeQuery = mainInput && mainInput.value.trim() !== "" ? mainInput.value : (initialQuery || "");

        let overlay = document.querySelector(".sug-mobile-overlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.className = "sug-mobile-overlay";
            overlay.innerHTML = `
                <div class="sug-mobile-header">
                    <button type="button" class="sug-back-btn" id="sugBackBtn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                        </svg>
                    </button>
                    <div class="sug-input-wrap">
                        <input type="search" class="sug-mobile-input" placeholder="${getText("placeholder")}" autocomplete="off">
                        <button type="button" class="sug-clear-btn" id="sugClearBtn" style="display:none">&times;</button>
                    </div>
                </div>
                <div class="sug-mobile-list" id="sugMobileList"></div>
            `;
            document.body.appendChild(overlay);

            const mobInput = overlay.querySelector(".sug-mobile-input");
            const clearBtn = overlay.querySelector("#sugClearBtn");
            const backBtn = overlay.querySelector("#sugBackBtn");

            backBtn.addEventListener("click", () => {
                if (mainInput) {
                    mainInput.value = overlay.dataset.originalQuery || "";
                    const mainClearBtn = document.querySelector(".cleartext");
                    if (mainClearBtn) mainClearBtn.style.display = mainInput.value ? "block" : "none";
                }
                SuggestionsManager.closeMobileOverlay();
            });

            clearBtn.addEventListener("click", () => {
                mobInput.value = "";
                mobInput.focus();
                clearBtn.style.display = "none";
                document.getElementById("sugMobileList").innerHTML = "";
            });

            mobInput.addEventListener("input", (e) => {
                const val = e.target.value;
                clearBtn.style.display = val ? "block" : "none";
                SuggestionsManager.fetchAndRender(val.trim(), "#sugMobileList", true);
            });

            mobInput.addEventListener("keyup", (e) => {
                if (e.key === "Enter" && mobInput.value.trim()) {
                    if (mainInput) mainInput.value = mobInput.value.trim();
                    window.location.href = `/search?q=${encodeURIComponent(mobInput.value.trim()).replace(/%20/g, '+')}${searchLangParam}${searchParam}${tabParam}`;
                }
            });
        }

        overlay.dataset.originalQuery = originalMainQuery;
        overlay.classList.add("active");
        const mobInput = overlay.querySelector(".sug-mobile-input");
        const clearBtn = overlay.querySelector("#sugClearBtn");

        mobInput.value = activeQuery;
        clearBtn.style.display = activeQuery ? "block" : "none";

        mobInput.focus();
        setTimeout(() => { mobInput.setSelectionRange(mobInput.value.length, mobInput.value.length); }, 10);

        if (activeQuery.trim()) {
            SuggestionsManager.fetchAndRender(activeQuery.trim(), "#sugMobileList", true);
        }
    },

    closeMobileOverlay: () => {
        const overlay = document.querySelector(".sug-mobile-overlay");
        if (overlay) overlay.classList.remove("active");
    },

    handleDesktopInput: (query) => {
        if (!query) {
            SuggestionsManager.closeDesktopDropdown();
            return;
        }

        let dropdown = document.querySelector(".sug-desktop-dropdown");
        if (!dropdown) {
            dropdown = document.createElement("div");
            dropdown.className = "sug-desktop-dropdown";
            document.querySelector(".search-field").appendChild(dropdown);
        }

        SuggestionsManager.fetchAndRender(query, ".sug-desktop-dropdown", false);
    },

    closeDesktopDropdown: () => {
        const dropdown = document.querySelector(".sug-desktop-dropdown");
        if (dropdown) dropdown.remove();
    },

    fetchAndRender: (query, targetSelector, isMobile) => {
        const tabParam = Config.tbm ? `&tbm=${Config.tbm}` : "";
        clearTimeout(SuggestionsManager.debounceTimer);
        if (!query) {
            const el = document.querySelector(targetSelector);
            if (el) el.innerHTML = "";
            return;
        }

        SuggestionsManager.debounceTimer = setTimeout(async () => {
            try {
                const data = await API.fetchSuggestions(query);
                const targetEl = document.querySelector(targetSelector);
                if (!targetEl) return;

                if (!data || !data.suggestions || !data.suggestions.length) {
                    targetEl.innerHTML = "";
                    return;
                }

                // Teks saran disimpan di data-q (di-escape), bukan di dalam atribut onclick
                const listHtml = data.suggestions.map(sugText => {
                    const highlightedText = sugText.toLowerCase().startsWith(query.toLowerCase())
                        ? `<strong>${Utils.escapeHTML(sugText.slice(0, query.length))}</strong>${Utils.escapeHTML(sugText.slice(query.length))}`
                        : Utils.escapeHTML(sugText);

                    return `
                        <div class="sug-item" data-q="${Utils.escapeHTML(sugText)}">
                            <span class="sug-icon search-ic">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                                </svg>
                            </span>
                            <span class="sug-text">${highlightedText}</span>
                            ${isMobile ? `
                                <span class="sug-icon insert-ic" data-insert="1">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M5 15h2V7.83l11.88 11.88 1.41-1.41L8.41 6.5H16V4.5H5z"/>
                                    </svg>
                                </span>` : ''}
                        </div>
                    `;
                }).join("");

                targetEl.innerHTML = isMobile ? listHtml : `<div class="sug-desktop-list">${listHtml}</div>`;

                targetEl.querySelectorAll(".sug-item").forEach(itemEl => {
                    itemEl.addEventListener("click", (e) => {
                        const text = itemEl.dataset.q || "";
                        if (e.target.closest("[data-insert]")) {
                            e.stopPropagation();
                            SuggestionsManager.insertQuery(text);
                            return;
                        }
                        window.location.href = `/search?q=${encodeURIComponent(text).replace(/%20/g, '+')}${searchLangParam}${searchParam}${tabParam}`;
                    });
                });
            } catch (err) {
                console.error("Gagal mengambil suggest:", err);
            }
        }, 150);
    },

    insertQuery: (text) => {
        const mobInput = document.querySelector(".sug-mobile-input");
        if (mobInput) {
            mobInput.value = text;
            mobInput.focus();
            document.querySelector("#sugClearBtn").style.display = "block";
            SuggestionsManager.fetchAndRender(text, "#sugMobileList", true);
        }
    }
};


// ==========================================
// 7. MAIN EXECUTION & RENDER LOGIC
// ==========================================

// Tab Gambar: kembali memakai imgtest.js (grid masonry, preview overlay, infinite scroll 2x).
// imgtest.js dimuat SETELAH UI.renderBase/setupTabStyles selesai, karena ia langsung
// membaca .main-result dan .show-wrapper saat dijalankan.
function loadImgTest() {
    return new Promise((resolve) => {
        if (window.__imgTestLoaded) return resolve();
        window.__imgTestLoaded = true;
        const s = document.createElement("script");
        s.src = "/imgtest.js";
        s.onload = () => resolve();
        s.onerror = () => { UI.renderEmptyState(); resolve(); };
        document.body.appendChild(s);
    });
}

async function performSearch() {
    try {
        if (Config.tbm === "vid") {
            const data = await API.fetchVideo(Config.q, 100);
            renderVideos(data);
        } else if (Config.tbm === "nws") {
            const data = await API.fetchNews(Config.q);
            renderNews(data);
        } else if (Config.tbm === "isch") {
            // await ImageSearch.init(); // (versi grid baru, tidak dipakai lagi)
            await loadImgTest();
        } else {
            const data = await API.fetchWeb(Config.q, Config.startIndex);
            renderWebResults(data);
            if (Config.startIndex === 1) checkInstantAnswers();
        }
    } catch (err) {
        if (Config.startIndex === 1) {
            UI.renderEmptyState();
        } else {
            // Gagal saat "Hasil penelusuran lainnya": kembalikan tombol supaya bisa dicoba lagi
            Config.startIndex = Math.max(1, Config.startIndex - 10);
            handlePaginationUi("error");
        }
    }
}

function renderVideos(res) {
    const container = document.querySelector(".main-result");
    if (!res.items || !res.items.length) {
        UI.renderEmptyState();
        return;
    }

    // Pastikan container memiliki class video-grid
    container.className = "main-result video-grid";

    // Satu parser untuk semua judul (HTML entities ter-decode dengan rapi)
    const parser = new DOMParser();

    res.items.forEach(item => {
        const snippet = item?.snippet;
        if (!snippet) return;

        const decodedTitle = parser.parseFromString(snippet.title || "", 'text/html').body.textContent;
        const title = Utils.escapeHTML(decodedTitle);

        const thumb = Utils.attrUrl(snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url);
        const channel = Utils.escapeHTML(snippet.channelTitle);
        const timeStr = Utils.timeAgo(snippet.publishTime);
        const videoId = encodeURIComponent(item.id?.videoId || item.id || "");

        // Ambil data durasi dari API
        const rawDuration = item.contentDetails?.duration || item.duration || snippet.duration || "";
        const durationStr = Utils.escapeHTML(Utils.formatDuration(rawDuration));

        container.insertAdjacentHTML('beforeend', `
            <div class="video-card">
                <a href="https://youtube.com/watch?v=${videoId}" target="_blank" rel="noopener">
                    <div class="video-card__thumb-wrapper">
                        ${thumb ? `<img src="${thumb}" class="thumbnail" alt="${title}" loading="lazy">` : ""}
                        <div class="video-card__play-badge">
                            <svg viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </div>
                        ${durationStr ? `<div class="video-card__duration">${durationStr}</div>` : ''}
                    </div>
                    <div class="video-card__content">
                        <div class="title">${title}</div>
                        <div class="source">
                            <div class="info">
                                <img src="/images/youtube.png" class="favicon" alt="YouTube">
                                <span class="channel-name">${channel}</span>
                            </div>
                            <div class="time-ago">${timeStr}</div>
                        </div>
                    </div>
                </a>
            </div>
        `);
    });

    if (Config.startIndex === 1) {
        UI.renderFooter();
    }
    handlePaginationUi("stop", res);
}

// ==========================================
// RENDER BERITA (NEWS RESULTS)
// ==========================================
function renderNews(res) {
    const container = document.querySelector(".main-result");
    container.style.cssText = !Config.isMobile ? "min-width:var(--page-max-width);max-width:var(--page-max-width)" : "";
    const newsItems = res.results || res.news || res.items;

    if (!newsItems || !newsItems.length) {
        UI.renderEmptyState();
        return;
    }

    newsItems.forEach(item => {
        const title = Utils.escapeHTML(item.title || "");
        const safeLink = Utils.safeUrl(item.link);
        const link = Utils.escapeHTML(safeLink) || "#";
        const publisher = Utils.escapeHTML(item.publisher || item.domain || "Berita");

        // Membersihkan string tanggal
        const rawPubTime = String(item.publishedAt || item.published_at || item.pubDate || item.date || "");
        let timeStr = "";

        if (rawPubTime) {
            const cleanedTime = rawPubTime.replace(/[·•]/g, '').trim();
            if (cleanedTime.includes('T') || cleanedTime.includes('-') || !isNaN(Date.parse(cleanedTime))) {
                timeStr = Utils.dateConversion(cleanedTime) || Utils.escapeHTML(cleanedTime);
            } else {
                timeStr = Utils.escapeHTML(cleanedTime);
            }
        }

        // Gambar Thumbnail
        const thumbUrl = Utils.attrUrl(item.thumbnailUrl || item.thumbnail || item.image || item.og_image || "");
        const thumbHtml = thumbUrl
            ? `<div class="news-card__thumb-wrap"><img class="thumb" src="${thumbUrl}" alt="${title}" loading="lazy"></div>`
            : `<div class="news-card__thumb-wrap news-card__thumb-placeholder"></div>`;

        // Snippet Berita
        const snippetText = item.snippet || item.description || "";
        const snippetHtml = (Config.windowWidth > 780 && snippetText)
            ? `<div class="snippet">${Utils.escapeHTML(snippetText)}</div>`
            : "";

        // Favicon
        const faviconUrl = Utils.attrUrl(item.favicon) || Utils.escapeHTML(Utils.faviconFor(safeLink || ""));

        container.insertAdjacentHTML('beforeend', `
            <div class="result-card news-card">
                <a href="${link}" target="_blank" rel="noopener" class="news-card__body">
                    ${thumbHtml}
                    <div class="news-card__content">
                        <div class="top"><img src="${faviconUrl}" class="favicon" alt="${publisher}"><span class="link">${publisher}</span></div>
                        <div class="title">${title}</div>
                        ${snippetHtml}
                        ${timeStr ? `<div class="publishtime">${timeStr}</div>` : ''}
                    </div>
                </a>
            </div>
        `);
    });

    if (Config.startIndex === 1) {
        const existingFooter = document.querySelector(".search-footer");
        if (existingFooter) existingFooter.remove();
        UI.renderFooter();
    }
}


// ==========================================
// RENDER GAMBAR (IMAGE RESULTS) - data dari /api/images
// ==========================================
const ImageSearch = {
    page: 1,
    extraLoads: 0,
    maxExtraLoads: 2,       // infinite scroll maksimal 2x setelah muat awal
    pauseMs: 700,           // jeda loader sebelum fetch lanjutan
    loading: false,
    done: false,
    seen: new Set(),
    observer: null,

    injectStyles: () => {
        if (document.getElementById("image-search-style")) return;
        const style = document.createElement("style");
        style.id = "image-search-style";
        style.textContent = `
            .main-result.image-grid-page{min-width:0;max-width:none;width:100%;box-sizing:border-box;padding:0 8px}
            .image-grid{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
            .image-grid::after{content:"";flex-grow:1000000}
            .image-item{position:relative;margin:0;border-radius:8px;overflow:hidden;background:#e8eaed}
            .image-item i{display:block}
            .image-item a{position:absolute;top:0;right:0;bottom:0;left:0;display:block}
            .image-item img{width:100%;height:100%;object-fit:cover;display:block}
            body.dark .image-item{background:#303134}
            .image-sentinel{height:1px}
            .image-loader{display:flex;justify-content:center;align-items:center;padding:24px 0}
            .image-loader[hidden]{display:none}
        `;
        document.head.appendChild(style);
    },

    extractList: (data) => {
        if (Array.isArray(data)) return data;
        return data?.images || data?.results || data?.items || data?.data || [];
    },

    // Menyeragamkan berbagai kemungkinan nama field dari API
    normalize: (raw) => {
        if (!raw || typeof raw !== "object") return null;
        const imageField = typeof raw.image === "string" ? raw.image : raw.image?.url;
        const full = Utils.safeUrl(raw.url || raw.imageUrl || raw.image_url || raw.murl || raw.original || imageField || "");
        const thumb = Utils.safeUrl(raw.thumbnail || raw.thumbnailUrl || raw.thumbnail_url || raw.thumb || raw.turl || raw.image?.thumbnailLink || "") || full;
        if (!thumb) return null;
        const source = Utils.safeUrl(raw.sourceUrl || raw.source_url || raw.pageUrl || raw.page_url || raw.contextLink || raw.link || raw.source || "") || full || thumb;
        const width = Number(raw.width || raw.w || raw.image?.width) || 0;
        const height = Number(raw.height || raw.h || raw.image?.height) || 0;
        const title = String(raw.title || raw.alt || raw.name || "");
        return { key: full || thumb, thumb, full, source, width, height, title };
    },

    createItemHtml: (img) => {
        const rowHeight = Config.windowWidth < 780 ? 120 : 180;
        // Ukuran asli dipakai kalau ada; kalau tidak, pakai rasio 4:3
        const ratio = (img.width > 0 && img.height > 0) ? Math.min(3, Math.max(0.4, img.width / img.height)) : 4 / 3;
        const title = Utils.escapeHTML(img.title);
        return `
            <figure class="image-item" style="width:${(ratio * rowHeight).toFixed(1)}px;flex-grow:${(ratio * 100).toFixed(1)}">
                <i style="padding-bottom:${(100 / ratio).toFixed(2)}%"></i>
                <a href="${Utils.escapeHTML(img.source)}" target="_blank" rel="noopener noreferrer" title="${title}" aria-label="${title}">
                    <img src="${Utils.escapeHTML(img.thumb)}" alt="${title}" loading="lazy" referrerpolicy="no-referrer">
                </a>
            </figure>`;
    },

    setLoader: (visible) => {
        const loader = document.querySelector(".image-loader");
        if (loader) loader.hidden = !visible;
    },

    init: async () => {
        ImageSearch.injectStyles();
        const main = document.querySelector(".main-result");
        main.classList.add("image-grid-page");
        main.innerHTML = `
            <div class="image-grid"></div>
            <div class="image-sentinel"></div>
            <div class="image-loader show-wrapper">${Utils.loaderHtml}</div>`;
        await ImageSearch.loadMore(true);
    },

    loadMore: async (isFirst = false) => {
        if (ImageSearch.loading || ImageSearch.done) return;
        ImageSearch.loading = true;
        ImageSearch.setLoader(true);

        // Jeda singkat dengan loader sebelum memuat gambar berikutnya
        if (!isFirst) await Utils.sleep(ImageSearch.pauseMs);

        try {
            const data = await API.fetchImages(Config.q, ImageSearch.page);
            const fresh = [];
            ImageSearch.extractList(data).forEach(raw => {
                const img = ImageSearch.normalize(raw);
                if (!img || ImageSearch.seen.has(img.key)) return;
                ImageSearch.seen.add(img.key);
                fresh.push(img);
            });

            if (!fresh.length) {
                ImageSearch.done = true;
                if (isFirst) {
                    UI.renderEmptyState();
                    return;
                }
            } else {
                const grid = document.querySelector(".image-grid");
                if (grid) grid.insertAdjacentHTML('beforeend', fresh.map(ImageSearch.createItemHtml).join(""));
                ImageSearch.page += 1;
                if (!isFirst) ImageSearch.extraLoads += 1;
                if (ImageSearch.extraLoads >= ImageSearch.maxExtraLoads) ImageSearch.done = true;
            }

            if (isFirst) {
                UI.renderFooter();
                ImageSearch.observe();
            }
        } catch (err) {
            ImageSearch.done = true;
            if (isFirst) UI.renderEmptyState();
        } finally {
            ImageSearch.loading = false;
            if (!document.querySelector(".image-grid")) return; // halaman sudah diganti empty state
            ImageSearch.setLoader(false);
            if (ImageSearch.done) {
                ImageSearch.stopObserving();
            } else if (ImageSearch.observer) {
                // Cek ulang: kalau sentinel masih terlihat, lanjut memuat
                const sentinel = document.querySelector(".image-sentinel");
                if (sentinel) {
                    ImageSearch.observer.unobserve(sentinel);
                    ImageSearch.observer.observe(sentinel);
                }
            }
        }
    },

    observe: () => {
        const sentinel = document.querySelector(".image-sentinel");
        if (!sentinel || ImageSearch.done) return;
        if (!("IntersectionObserver" in window)) return;
        ImageSearch.observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) ImageSearch.loadMore(false);
        }, { rootMargin: "400px 0px" });
        ImageSearch.observer.observe(sentinel);
    },

    stopObserving: () => {
        if (ImageSearch.observer) {
            ImageSearch.observer.disconnect();
            ImageSearch.observer = null;
        }
    }
};


// ==========================================
// RENDER HASIL WEB
// ==========================================
function renderRelatedSearches(container) {
    API.fetchSuggestions(Config.q).then(sug => {
        if (sug && sug.suggestions && sug.suggestions.length) {
            const list = sug.suggestions.slice(0, 5).map(s =>
                `<a href="/search?q=${encodeURIComponent(s).replace(/%20/g, '+')}${searchLangParam}" class="related">${Utils.escapeHTML(Utils.capitalize(s))}</a>`
            ).join("");
            container.insertAdjacentHTML('beforeend', `<div class="related-search"><div class="title">${getText("related")}</div><div class="search-list">${list}</div></div>`);
        }
    }).catch(() => {});
}

function renderWebResults(res) {
  const container = document.querySelector(".main-result .results-list");
  const isFirstPage = Config.startIndex === 1;
  if (!res || !res.items || !res.items.length) {
    if (isFirstPage) UI.renderEmptyState();
    else handlePaginationUi("stop", {});
    return;
  }
  if (isFirstPage) {
    const info = res.searchInformation;
    if (Config.windowWidth > 700) {
      if (info) {
        document.querySelector(".main-result").insertAdjacentHTML('afterbegin', `<div class="result-stats">${isIdLang ? `Sekitar ${Utils.escapeHTML(info.formattedTotalResults)} hasil (${Utils.escapeHTML(info.formattedSearchTime)} detik)` : `Approximately ${Utils.escapeHTML(info.formattedTotalResults)} result (${Utils.escapeHTML(info.formattedSearchTime)} seconds)`}</div>`);
      }
      document.querySelector(".main-result").style.minWidth = "var(--page-max-width)";
    }
    if (res.spelling) {
      const corrected = res.spelling.correctedQuery || "";
      container.insertAdjacentHTML('beforeend', `<div class="corrected-word result-card result-card--flat"><div class="snippet">${getText("correct")} <a href="/search?q=${encodeURIComponent(corrected)}${searchLangParam}">${Utils.escapeHTML(corrected)}</a><span>?</span></div></div>`);
    }
    Widgets.renderWidgets(res);
    Widgets.checkPlayStoreWidget();
  }

  res.items.forEach((item, i) => {
    const siteName = Utils.escapeHTML(item.pagemap?.metatags?.[0]?.['og:site_name'] || item.displayLink);
    const displayLink = Utils.escapeHTML(item.displayLink);
    const href = Utils.attrUrl(item.link) || "#";

    let snippet = Utils.escapeHTML(item.snippet);
    const question = item.pagemap?.question?.[0];
    if (question?.text) {
      const dateLabel = Utils.dateConversion(question.datecreated, true);
      snippet = `${dateLabel ? `${dateLabel} - ` : ""}${Utils.escapeHTML(question.text)}`;
    }

    const faviconHtml = isFaviconDisabled ? "" : `<div class="favicon"><img src="${Utils.escapeHTML(Utils.faviconFor(item.link || ""))}"></div>`;

    container.insertAdjacentHTML('beforeend', `
      <div class="result-card result-card--flat">
        <div class="tab-link">
          <a href="${href}">
            <div class="top">
              ${faviconHtml}
              <div class="link-rw"><div class="link">${siteName}</div><div class="link link--meta">${displayLink}</div></div>
            </div>
            <div class="title">${Utils.escapeHTML(item.title)}</div>
          </a>
        </div>
        <div class="btm-snpt"><div class="snippet"><span>${snippet || getText("noSiteInfo")}</span></div></div>
      </div>
    `);

    if (i === 1 && isFirstPage) {
      container.insertAdjacentHTML('beforeend', `<div id="dynamic-video-widget-slot"></div>`);
    }
  });

  if (res.items.length < 2 && isFirstPage) {
    container.insertAdjacentHTML('beforeend', `<div id="dynamic-video-widget-slot"></div>`);
  }

  if (isFirstPage) {
    Widgets.checkVideoWidget();
  }

  if (res.queries?.nextPage && isFirstPage) {
    document.querySelector(".main-result").insertAdjacentHTML('beforeend', `<div class="show-wrapper"><button class="more">${getText("more")}</button></div>`);
  }

  if (isFirstPage) {
    UI.renderFooter();
    renderRelatedSearches(container);
  }
  handlePaginationUi("stop", res);

  if (settings.newtab) document.querySelectorAll(".main-result a").forEach(a => a.target = "_blank");
}

// Dipanggil kalau halaman 1 hasil web SUDAH di-render server (SSR).
// Bedanya dengan renderWebResults(): TIDAK menyisipkan ulang kartu hasil
// (sudah ada di DOM dari server), cuma nyalain bagian yang memang harus
// client-side: widget (AI overview/kalkulator/translator), video widget,
// related search, tombol pagination, dan target="_blank".
function hydrateWebResults(res) {
  const container = document.querySelector(".main-result .results-list");
  if (!container) { performSearch(); return; } // fallback kalau markup SSR tidak sesuai dugaan

  Widgets.renderWidgets(res);
  Widgets.checkVideoWidget();
  Widgets.checkPlayStoreWidget();
  UI.renderFooter();
  renderRelatedSearches(container);

  handlePaginationUi("stop", res);

  if (settings.newtab) document.querySelectorAll(".main-result a").forEach(a => a.target = "_blank");
}

async function checkInstantAnswers() {
    const queryMap = { "yahoo": "yahoo!", "notch": "markus persson", "bing": "microsoft bing", "bard": "google bard", "apple": "apple inc", "ronaldo": "cristiano ronaldo", "messi": "lionel messi" };
    const exactQuery = queryMap[Config.q.toLowerCase()] || Config.q;

    try {
        const res = await API.fetchInstantAnswer(exactQuery);
        if (res && res.snippet) Widgets.renderInstantCard(res);
    } catch(e) {}
}

// Tombol "Hasil penelusuran lainnya": memanggil /api/web lewat performSearch()
function handlePaginationUi(cmd, res) {
  const wrapper = document.querySelector(".show-wrapper");
  if (!wrapper) return;
  if (cmd === "start") {
    wrapper.innerHTML = Utils.loaderHtml;
    Config.startIndex += 10;
    setTimeout(performSearch, 500);
  } else if (cmd === "error") {
    wrapper.innerHTML = `<div class="pagination-divider"></div><button class="more">${getText("more")}</button>`;
  } else if (Config.startIndex >= Config.maxIndex || !res?.queries?.nextPage) {
    wrapper.remove();
  } else {
    wrapper.innerHTML = `<div class="pagination-divider"></div><button class="more">${getText("more")}</button>`;
  }
}

function handlePagination() { handlePaginationUi("start"); }

// ==========================================
// 8. INITIALIZE APPLICATION
// ==========================================
function initApp() {
    if (Config.rested) {
        UI.handleErrorState();
        return;
    }

    if (!Config.q || window.location.pathname.match(".html")) {
        window.location.href = "/";
    } else if (Config.q && navigator.onLine) {
        const ssrRes = window.__SSR_DATA__;
        const canHydrate = !!ssrRes && Config.startIndex === 1 && !["vid", "isch", "nws"].includes(Config.tbm);

        UI.renderBase({ preserveResults: canHydrate });
        UI.setupTabStyles({ preserveResults: canHydrate });

        if (canHydrate) {
            hydrateWebResults(ssrRes);
            checkInstantAnswers();
        } else {
            performSearch();
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
