/**
 * SEARCH ENGINE CORE - Refactored & Modernized
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
    startIndex: urlParams.get("p") > 1 ? parseInt(urlParams.get("p")) : 1,
    maxIndex: 30,
    sitelinksData: []
};

// Mengambil pengaturan dari Cookies
const settings = typeof getData === 'function' ? getData() : {};
const isIdLang = settings.lang === "id" || Config.hl === "id";

const searchLangParam = isIdLang ? `&hl=${Config.hl}` : "";
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
        aiThinking: "Thinking"
    },
    id: {
        news: "Hasil berita <pre>Beta</pre>", more: "Hasil penelusuran lainnya", vidTitle: "Video",
        related: "Orang lain juga menelusuri", placeholder: "Ketik untuk mencari...",
        correct: "Apakah maksudmu:", noresult: "Tidak ditemukan hasil",
        noSiteInfo: "Tidak ada informasi mengenai halaman ini.", suggtext: "Saran pencarian:", adlabel: "Iklan",
        noresultsug: ["Coba kata kunci yang berbeda.", "Coba kata kunci yang lebih umum.", "Coba lebih sedikit kata kunci."],
        tab: ["Semua", "Gambar", "Video", "Berita", "Peta"],
        aiHeader: "Ringkasan AI (Beta)", aiMore: "Tampilkan lainnya", aiLess: "Tampilkan lebih sedikit",
        aiThinking: "Berpikir"
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
    capitalize: (str) => str.charAt(0).toUpperCase() + str.slice(1),
    escapeHTML: (str) => str ? str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : "",
    insertAfter: (referenceNode, newNode) => referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling),
    
    timeAgo: (input) => {
        const date = input instanceof Date ? input : new Date(input);
        const formatter = new Intl.RelativeTimeFormat(localLang);
        const ranges = { years: 31536000, months: 2592000, weeks: 604800, days: 86400, hours: 3600, minutes: 60, seconds: 1 };
        const secondsElapsed = (date.getTime() - Date.now()) / 1000;
        
        for (let key in ranges) {
            if (ranges[key] < Math.abs(secondsElapsed)) {
                return formatter.format(Math.round(secondsElapsed / ranges[key]), key);
            }
        }
        return "Just now";
    },

    dateConversion: (val, shortMonth = false, skip = false) => {
        let parsedDate = new Date(val);
        if (isNaN(parsedDate)) {
            parsedDate = new Date(val.replace(/(\d{2}:\d{2}.*)/, "").trim());
            if (isNaN(parsedDate)) return "Invalid Date";
        }
        let year = parsedDate.getFullYear();
        let currentYear = new Date().getFullYear();
        let day = parsedDate.getDate();
        let month = parsedDate.toLocaleString(localLang, { month: shortMonth ? 'short' : 'long' });

        return (year === currentYear && !skip) ? Utils.timeAgo(parsedDate) : `${day} ${month} ${year}`;
    },
};


// ==========================================
// 4. API FETCHING
// ==========================================
const API = {
    baseUrl: 'https://GANTI-DENGAN-URL-WORKER-D1-KAMU.workers.dev', // <-- Worker yang query ke D1 (bukan lagi CSE)
    groqKeys: ["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"],
    
    fetchWeb: async (query, page) => {
        const langFilter = isIdLang ? `&gl=${Config.hl}&lr=lang_id&hl=id` : "";
        const res = await fetch(`${API.baseUrl}/api?q=${query}${langFilter}&page=${page}`);
        return res.json();
    },
    
    fetchVideo: async (query, limit = 100) => {
        const res = await fetch(`${API.baseUrl}/api?q=${query}&tbm=vid&maxResults=${limit}`);
        return res.json();
    },

    fetchNews: async (query) => {
        const langFilter = isIdLang ? `&gl=${Config.hl}&lr=lang_id&hl=id` : "";
        const res = await fetch(`${API.baseUrl}/api?q=${query}${langFilter}&tbm=nws`);
        return res.json();
    },

    fetchInstantAnswer: async (query) => {
        const res = await fetch(`${API.baseUrl}/?q=${query}`);
        return res.json();
    },
    
    fetchSuggestions: async (query) => {
        const res = await fetch(`${API.baseUrl}/suggest?q=${query}`);
        return res.json();
    },

    fetchAI: async (promptUser, context = "") => {
        const url = "https://api.groq.com/openai/v1/chat/completions";
        const payload = {
            model: "openai/gpt-oss-20b",
            messages: [
                { 
                    role: "system", 
                    content: `Kamu adalah AI Search Overview, sebelum menjawab pastikan kamu baca dahulu ${context}. Jangan pernah gunakan sapaan. 
WAJIB berikan jawaban dengan format persis seperti ini (gunakan '---' sebagai pemisah):
[Paragraf definisi singkat tentang topik, maksimal 3 kalimat]
---
[Ketik SATU judul sub-topik yang paling relevan dengan pertanyaan, misal: 'Karakteristik [Topik]' atau 'Penyebab [Topik]']
---
[Berikan 3-5 poin penting (bullet). Awali setiap baris dengan '- **[Kata Kunci]:**' diikuti penjelasannya]
---
[Berikan 1-2 kalimat kesimpulan penutup ringkas]` 
                },
                { role: "user", content: promptUser }
            ],
            temperature: 0.3
        };

        const response = await fetch(url, {
            method: "POST",
            headers: { "Authorization": `Bearer ${API.groqKeys[0]}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data.choices[0].message.content.trim();
    }

};


// ==========================================
// 5. WIDGETS & INSTANT ANSWERS
// ==========================================
const Widgets = {
    renderInstantCard: (res) => {
        if (!res.snippet || res.snippet.length <= 100) return;
        const container = document.createElement("div");
        container.className = "instant-answer";

        let subtitle = "";
        if (res.infobox && Array.isArray(res.infobox)) {
            const descItem = res.infobox.find(item => item.label === "Wikidata description" || item.data_type === "wd_description");
            if (descItem) subtitle = descItem.value;
        }

        let imageHtml = res.image ? `<img src="${res.image}" class="logo" alt="${res.title}" ${res.type ? 'style="border:1px solid #999"' : ''}>` : '';

        let infoboxHtml = '';
        if (res.infobox && res.infobox.length > 0) {
            const items = res.infobox.slice(0, 2).map(info => {
                if (!info.value.trim()) return '';
                return `
                    <div class="infobox-item">
                        <div class="infobox-item__label">${info.label}</div>
                        <div class="infobox-item__value">${info.value}</div>
                    </div>
                `;
            }).join("");
            if (items) infoboxHtml = `<div class="infobox">${items}</div>`;
        }

        container.innerHTML = `
            <div class="title">${res.title}</div>
            ${subtitle ? `<div class="instant-answer__subtitle">${subtitle}</div>` : ''}
            ${imageHtml}
            <div class="summary-box">
                <div class="instant-answer__section-title">Ringkasan</div>
                <div class="summary-text">
                    ${res.snippet.replace(/\<\/?(pre|code).*?\/>/g, "").slice(0, 140)}... 
                    <a href="${res.sourceUrl}" class="wikipedia">${res.source} ›</a>
                </div>
            </div>
            ${infoboxHtml}
        `;

        const wrapper = Config.windowWidth > 780 ? document.querySelector(".sidebar-panel") || (() => {
            const side = document.createElement("div"); side.className = "sidebar-panel";
            document.querySelector(".result-wrapper").appendChild(side);
            return side;
        })() : document.querySelectorAll(".result-card")[2];

        if (Config.windowWidth > 780) {
            wrapper.appendChild(container);
        } else {
            if (wrapper) Utils.insertAfter(wrapper, container);
            else document.querySelector(".main-result").appendChild(container);
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
            const dateStr = `${d.toLocaleDateString(localLang, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}, ${d.toString().match(/([A-Z]+[\+-][0-9]+.*)/)[1]}`;
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
            // 2. Kirim query DAN contextSnippets ke API.fetchAI
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
    let formattedText = teks.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    const parts = formattedText.split('---').map(p => p.trim());
    
    let summary = parts[0] || formattedText;
    let subTitle = parts[1] ? parts[1].replace(/\*\*/g, '') : "";
    let listContent = parts[2] || "";
    let conclusion = parts[3] ? parts[3].replace(/\*\*/g, '') : "";

    let listItems = listContent.split('\n')
        .filter(line => line.trim().match(/^[-*]/))
        .map(line => line.replace(/^[-*]\s*/, '').trim());

    const hasMoreContent = subTitle || listItems.length > 0 || conclusion;

    // 1. Bungkus seluruh isi teks di dalam .ai-content-wrapper
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
    
    // 2. Control class expanded langsung pada wrapper utama
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
            let limit = Math.min(data.items.length, 4);
            for (let i = 0; i < limit; i++) {
                let item = data.items[i];
                let videoId = item.id.videoId || item.id;
                let title = Utils.escapeHTML(item.snippet.title);
                let thumb = item.snippet.thumbnails.medium.url;
                let channel = Utils.escapeHTML(item.snippet.channelTitle);
                let dateStr = Utils.dateConversion(item.snippet.publishTime);

                videonya += `
                    <div class="video-widget-item">
                        <a href="https://youtube.com/watch?v=${videoId}">
                            <div class="video-widget-item__row">
                                <div class="thumbnail">
                                    <img src="${thumb}">
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
                                    <div class="video-widget-item__date">${dateStr}</div>
                                </div>
                            </div>
                        </a>
                    </div>`;
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
        
        calculatorBox.querySelectorAll("button").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const val = e.target.dataset.value;
                if (val === "=" && output !== "") {
                    try { output = eval(output.replace("%", "/100").replace(/×/g, "*").replace(/÷/g, "/")); } catch { output = "Error"; }
                } else if (val === "AC") {
                    output = "";
                } else if (val === "DEL") {
                    output = output.toString().slice(0, -1);
                } else {
                    if (output === "" && ["%", "*", "/", "-", "+", "="].includes(val)) return;
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
            if (!fromText.value) toText.value = "";
            else timer = setTimeout(translate, 500);
        });

        async function translate() {
            let text = fromText.value.trim();
            if (!text) return;
            toText.setAttribute("placeholder", "Translating...");
            try {
                const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${selects[0].value}&tl=${selects[1].value}&dt=t&q=${encodeURI(text)}`);
                const data = await res.json();
                let output = "";
                data[0].forEach(item => output += item[0]);
                toText.value = output;
            } catch (err) {
                toText.value = "Translation error";
            }
        }
    }
};


// ==========================================
// 6. UI BUILDER & LOGIC
// ==========================================
const UI = {
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
    const svgIcons = { all: `<svg width="16" height="16" viewBox="0 0 16 16" fill="#6e7780"><path fill-rule="evenodd" clip-rule="evenodd" d="M6 1C2.686 1 0 3.686 0 7C0 10.314 2.686 13 10.223 11.263L14.787 14.84C15.113 15.096 15.585 15.039 15.84 14.713C16.096 14.387 16.039 13.915 15.713 13.66L11.149 10.083C11.689 9.182 12 8.127 12 7C12 3.686 9.314 1 6 1ZM1.5 7C1.5 4.515 3.515 2.5 6 2.5C8.485 2.5 10.5 4.515 10.5 7C10.5 9.485 8.485 11.5 6 11.5C3.515 11.5 1.5 9.485 1.5 7Z"></path></svg>`, images: `<svg width="16" height="16" viewBox="0 0 16 16" fill="#6e7780"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.25 1C1.455 1 0 2.455 0 4.25V11.75C0 13.545 1.455 15 3.25 15H12.75C14.545 15 16 13.545 16 11.75V10.259C16 10.253 16 10.247 16 10.241V4.25C16 2.455 14.545 1 12.75 1H3.25ZM14.5 8.439V4.25C14.5 3.284 13.716 2.5 12.75 2.5H3.25C2.284 2.5 1.5 3.284 1.5 4.25V11.75C1.5 11.956 1.536 12.154 1.601 12.338L5.97 7.97C6.263 7.677 6.737 7.677 7.03 7.97L8 8.939L10.97 5.97C11.263 5.677 11.737 5.677 12.03 5.97L14.5 8.439ZM9.061 10L10.03 10.97C10.323 11.263 10.323 11.737 10.03 12.03C9.737 12.323 9.263 12.323 8.97 12.03L6.5 9.561L2.662 13.399C2.846 13.464 3.044 13.5 3.25 13.5H12.75C13.716 13.5 14.5 12.716 14.5 11.75V10.561L11.5 7.561L9.061 10Z"></path></svg>`, videos: `<svg width="16" height="16" viewBox="0 0 16 16" fill="#6e7780"><path fill-rule="evenodd" clip-rule="evenodd" d="M13.489 5.55C15.38 6.636 15.38 9.364 13.489 10.45L6.231 14.616C4.348 15.698 2 14.338 2 12.166L2 3.834C2 1.662 4.348 0.303 6.231 1.384L13.489 5.55ZM12.742 9.149C13.629 8.64 13.629 7.36 12.742 6.851L5.485 2.685C4.601 2.178 3.5 2.816 3.5 3.834L3.5 12.166C3.5 13.185 4.601 13.823 5.485 13.316L12.742 9.149Z"></path></svg>`, news: `<svg width="16" height="16" viewBox="0 0 22 22" fill="#6e7780"><path d="M12 11h6v2h-6v-2zm-6 6h12v-2H6v2zm0-4h4V7H6v6zm16-7.22v12.44c0 1.54-1.34 2.78-3 2.78H5c-1.64 0-3-1.25-3-2.78V5.78C2 4.26 3.36 3 5 3h14c1.64 0 3 1.25 3 2.78zM19.99 12V5.78c0-.42-.46-.78-1-.78H5c-.54 0-1 .36-1 .78v12.44c0 .42.46.78 1 .78h14c.54 0 1-.36 1-.78V12zM12 9h6V7h-6v2"></path></svg>`, maps: `<svg width="16" height="16" viewBox="0 0 16 16" fill="#6e7780"><path d="M8 8C9.105 8 10 7.105 10 6C10 4.895 9.105 4 8 4C6.895 4 6 4.895 6 6C6 7.105 6.895 8 8 8Z"></path></svg>` }; 
    const createTab = (id, tbmVal, icon, label) => `<div class="search-item"><a href="/searchV2?q=${encodeURIComponent(Config.q).replace(/%20/g,'+')}${tbmVal}${searchLangParam}${searchParam}" class="tab-wrapper" tab-id="${id}"><div class="label">${Config.windowWidth >= 780 ? svgIcons[icon] : ''}<span>${getText("tab", label)}</span></div></a></div>`; 
    
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
              <div class="search-menu"> 
                ${createTab("all", "", "all", 0)} 
                ${createTab("images", "&tbm=isch", "images", 1)} 
                ${createTab("videos", "&tbm=vid", "videos", 2)} 
                ${createTab("news", "&tbm=nws", "news", 3)} 
                ${createTab("maps", "", "maps", 4)} 
              </div> 
            </div> 
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
                    window.location.href = `/searchV2?q=${encodeURIComponent(searchInput.value).replace(/%20/g,'+')}${searchData}${searchLangParam}${searchParam}`;
                }
            });
        }
        
        document.addEventListener('click', e => { if (e.target.matches('.show-wrapper .more')) handlePagination(); });
    },

    setupTabStyles: (opts = {}) => {
        const items = document.querySelectorAll(".search-item");
        const mainResult = document.querySelector(".main-result");

        if (Config.tbm === "vid") {
            items[2].classList.add("selected");
            mainResult.classList.add("video-grid");
        } else if (Config.tbm === "isch") {
            items[1].classList.add("selected");
            mainResult.innerHTML = `<div class="show-wrapper"><div class="loader"><svg class="circular" viewBox="25 25 50 50"><circle class="path" cx="50" cy="50" r="20" fill="none" stroke-width="4" stroke-miterlimit="10"/></svg></div></div>`;
            const script = document.createElement("script"); script.src = "/imgtest.js"; document.body.appendChild(script);
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
        if (!document.querySelector(".footer")) {
            document.querySelector(".results-section").insertAdjacentHTML('beforeend', `
                <section class="footer">
                    <ul class="list"><li><a href="/settings">Settings</a></li><li><a href="/privacy">Privacy</a></li><li><a href="/searchV2?q=translate">Translate</a></li></ul>
                    <div class="copyright">©Copyright ${new Date().getFullYear()}</div>
                </section>
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
                    window.location.href = `/searchV2?q=${encodeURIComponent(mobInput.value.trim()).replace(/%20/g, '+')}${searchLangParam}${searchParam}`;
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

                const listHtml = data.suggestions.map(sugText => {
                    const encodedSug = encodeURIComponent(sugText).replace(/%20/g, '+');
                    const highlightedText = sugText.toLowerCase().startsWith(query.toLowerCase())
                        ? `<strong>${Utils.escapeHTML(sugText.slice(0, query.length))}</strong>${Utils.escapeHTML(sugText.slice(query.length))}`
                        : Utils.escapeHTML(sugText);

                    return `
                        <div class="sug-item" onclick="window.location.href='/searchV2?q=${encodedSug}${searchLangParam}${searchParam}'">
                            <span class="sug-icon search-ic">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                                </svg>
                            </span>
                            <span class="sug-text">${highlightedText}</span>
                            ${isMobile ? `
                                <span class="sug-icon insert-ic" onclick="event.stopPropagation(); SuggestionsManager.insertQuery('${Utils.escapeHTML(sugText)}')">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M5 15h2V7.83l11.88 11.88 1.41-1.41L8.41 6.5H16V4.5H5z"/>
                                    </svg>
                                </span>` : ''}
                        </div>
                    `;
                }).join("");

                targetEl.innerHTML = isMobile ? listHtml : `<div class="sug-desktop-list">${listHtml}</div>`;
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

async function performSearch() {
    try {
        if (Config.tbm === "vid") {
            const data = await API.fetchVideo(Config.q);
            renderVideos(data);
        } else if (Config.tbm === "nws") {
            const data = await API.fetchNews(Config.q);
            renderNews(data);
        } else if (!["vid", "isch", "nws"].includes(Config.tbm)) {
            const data = await API.fetchWeb(Config.q, Config.startIndex);
            renderWebResults(data);
            if (Config.startIndex === 1) checkInstantAnswers();
        }
    } catch (err) {
        if (Config.startIndex === 1) UI.renderEmptyState();
    }
}

function renderVideos(res) {
    const container = document.querySelector(".main-result");
    if (!res.items || !res.items.length) { UI.renderEmptyState(); return; }
    
    res.items.forEach(item => {
        container.insertAdjacentHTML('beforeend', `
            <div class="video-card">
                <a href="https://youtube.com/watch?v=${item.id.videoId}">
                    <img src="${item.snippet.thumbnails.medium.url}" class="thumbnail">
                    <div class="title">${item.snippet.title}</div>
                    <div class="source">
                        <div class="info">${Utils.timeAgo(item.snippet.publishTime)}</div>
                        <div class="info"><img src="images/youtube.png" class="favicon"><div>${item.snippet.channelTitle}</div></div>
                    </div>
                </a>
            </div>
        `);
    });
    if (Config.startIndex === 1) UI.renderFooter();
    handlePaginationUi("stop", res);
}

function renderNews(res) {
    const container = document.querySelector(".main-result");
    if (!res.items || !res.items.length) { UI.renderEmptyState(); return; }

    res.items.forEach(item => {
        const publisher = item.pagemap?.metatags?.[0]?.['og:site_name'] || item.displayLink;
        const pubTime = [item.pagemap?.metatags?.[0]?.['article:published_time'], item.pagemap?.newsarticle?.[0]?.datepublished].find(Boolean);
        const timeStr = pubTime ? Utils.dateConversion(pubTime) : "Published";
        const thumb = item.pagemap?.cse_thumbnail ? `<img class="thumb" src="${item.pagemap.cse_thumbnail[0].src}">` : "";
        const snippet = Config.windowWidth > 780 ? `<div class="snippet">${item.snippet}</div>` : "";

        container.insertAdjacentHTML('beforeend', `
            <div class="result-card news-card"><div class="news-card__body">
                <a href="${item.link}">${thumb}
                    <div class="top"><img src="https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&url=${item.link}&size=64" class="favicon"><div class="link">${publisher}</div></div>
                    <div class="title">${item.title.slice(0, 70)}</div>${snippet}<div class="publishtime">${timeStr}</div>
                </a>
            </div></div>
        `);
    });
    if (Config.startIndex === 1) UI.renderFooter();
}

function renderWebResults(res) {
  const container = document.querySelector(".main-result .results-list");
  const isFirstPage = Config.startIndex === 1;
  if (!res.items) {
    if (isFirstPage) UI.renderEmptyState();
    return;
  }
  if (isFirstPage) {
    if (Config.windowWidth > 700) {
      document.querySelector(".main-result").insertAdjacentHTML('afterbegin', `<div class="result-stats">${isIdLang ? `Sekitar ${res.searchInformation.formattedTotalResults} hasil (${res.searchInformation.formattedSearchTime} detik)` : `Approximately ${res.searchInformation.formattedTotalResults} result (${res.searchInformation.formattedSearchTime} seconds)`}</div>`);
    }
    if (res.spelling) {
      container.insertAdjacentHTML('beforeend', `<div class="corrected-word result-card result-card--flat"><div class="snippet">${getText("correct")} <a href="/searchV2?q=${encodeURIComponent(res.spelling.correctedQuery)}${searchLangParam}">${res.spelling.correctedQuery}</a><span>?</span></div></div>`);
    }
    Widgets.renderWidgets(res);
  }

  res.items.forEach((item, i) => {
    const siteName = item.pagemap?.metatags?.[0]?.['og:site_name'] || item.displayLink;
    const snippet = item.pagemap?.question?.[0]?.text ? `${Utils.dateConversion(item.pagemap.question[0].datecreated, true)} - ${Utils.escapeHTML(item.pagemap.question[0].text)}` : Utils.escapeHTML(item.snippet);
    const faviconHtml = isFaviconDisabled ? "" : `<div class="favicon"><img src="https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${item.link}&size=64"></div>`;

    container.insertAdjacentHTML('beforeend', `
      <div class="result-card result-card--flat">
        <div class="tab-link">
          <a href="${item.link}">
            <div class="top">
              ${faviconHtml}
              <div class="link-rw"><div class="link">${siteName}</div><div class="link link--meta">${item.displayLink}</div></div>
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
    API.fetchSuggestions(Config.q).then(sug => {
      if(sug.suggestions && sug.suggestions.length) {
        const list = sug.suggestions.slice(0,5).map(s => `<a href="/searchV2?q=${s}" class="related">${Utils.capitalize(s)}</a>`).join("");
        container.insertAdjacentHTML('beforeend', `<div class="related-search"><div class="title">${getText("related")}</div><div class="search-list">${list}</div></div>`);
      }
    });
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
  UI.renderFooter();

  API.fetchSuggestions(Config.q).then(sug => {
    if (sug.suggestions && sug.suggestions.length) {
      const list = sug.suggestions.slice(0, 5).map(s => `<a href="/searchV2?q=${s}" class="related">${Utils.capitalize(s)}</a>`).join("");
      container.insertAdjacentHTML('beforeend', `<div class="related-search"><div class="title">${getText("related")}</div><div class="search-list">${list}</div></div>`);
    }
  });

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

function handlePaginationUi(cmd, res) { 
  const wrapper = document.querySelector(".show-wrapper"); 
  if (!wrapper) return; 
  if (cmd === "start") { 
    wrapper.innerHTML = `<div class="loader"><svg class="circular" viewBox="25 25 50 50"><circle class="path" cx="50" cy="50" r="20" fill="none" stroke-width="4" stroke-miterlimit="10"/></svg></div>`; 
    Config.startIndex += 10; 
    setTimeout(performSearch, 500); 
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
