
/**
 * CLOUDFLARE PAGES FUNCTION / WORKERS SSR - SEARCH ENGINE CORE
 * File: functions/search.js
 */

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const userAgent = request.headers.get("user-agent") || "";
    const cookieHeader = request.headers.get("cookie") || "";

    // Parse Cookies
    const cookies = parseCookies(cookieHeader);
    const settings = typeof cookies.settings === "string" ? safeJsonParse(cookies.settings) : {};

    // 1. STATE & CONFIGURATION
    const queryParam = (url.searchParams.get("q") || "").trim();
    const pageParam = url.searchParams.get("p");
    const hlParam = url.searchParams.get("hl") || "";
    const ufParam = url.searchParams.get("uf") || "";
    const fvParam = url.searchParams.get("fv") || "";
    const sfParam = url.searchParams.get("sf") || "";
    const thParam = url.searchParams.get("th") || "";
    const tbmParam = url.searchParams.get("tbm") || "";

    // Redirect jika tidak ada query search
    if (!queryParam) {
        return Response.redirect(new URL("/", request.url).toString(), 302);
    }

    const Config = {
        q: queryParam,
        p: pageParam,
        hl: hlParam,
        uf: ufParam,
        fv: fvParam,
        sf: sfParam,
        th: thParam,
        tbm: tbmParam,
        isMobile: /iPhone|iPad|iPod|Android/i.test(userAgent),
        startIndex: parseInt(pageParam) > 1 ? parseInt(pageParam) : 1,
        maxIndex: 30
    };

    const isIdLang = settings.lang === "id" || Config.hl === "id";
    const searchLangParam = isIdLang ? `&hl=${Config.hl}` : "";
    const localLang = isIdLang ? "id-ID" : "en-US";
    const isFaviconDisabled = Config.fv === "0" || settings.fv === 0 || settings.fv === false || settings.favicon === false;

    let searchParam = "";
    searchParam += Config.uf === "1" ? "&uf=1" : "";
    searchParam += isFaviconDisabled ? "&fv=0" : "";
    searchParam += Config.sf === "1" ? "&sf=1" : "";
    searchParam += Config.th === "1" ? "&th=1" : "";

    // 2. DICTIONARY & LANGUAGE
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

    // 3. UTILITIES
    const Utils = {
        capitalize: (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : "",
        escapeHTML: (str) => str ? String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : "",
        timeAgo: (input) => {
            const date = input instanceof Date ? input : new Date(input);
            if (isNaN(date.getTime())) return "Just now";
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
            if (!val) return "";
            let parsedDate = new Date(val);
            if (isNaN(parsedDate)) {
                parsedDate = new Date(String(val).replace(/(\d{2}:\d{2}.*)/, "").trim());
                if (isNaN(parsedDate)) return "Invalid Date";
            }
            let year = parsedDate.getFullYear();
            let currentYear = new Date().getFullYear();
            let day = parsedDate.getDate();
            let month = parsedDate.toLocaleString(localLang, { month: shortMonth ? 'short' : 'long' });
            return (year === currentYear && !skip) ? Utils.timeAgo(parsedDate) : `${day} ${month} ${year}`;
        }
    };

    // 4. API FETCHING (SERVER SIDE)
    const API = {
        baseUrl: 'https://datasearch.searchdata.workers.dev',
        groqKeys: [env.GROQ_API_KEY || "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"],

        fetchWeb: async (query, page) => {
            const langFilter = isIdLang ? `&gl=${Config.hl || 'id'}&lr=lang_id&hl=id` : "";
            const res = await fetch(`${API.baseUrl}/api?q=${encodeURIComponent(query)}${langFilter}&page=${page}`);
            return res.ok ? res.json() : null;
        },
        fetchVideo: async (query, limit = 100) => {
            const res = await fetch(`${API.baseUrl}/api?q=${encodeURIComponent(query)}&tbm=vid&maxResults=${limit}`);
            return res.ok ? res.json() : null;
        },
        fetchNews: async (query) => {
            const langFilter = isIdLang ? `&gl=${Config.hl || 'id'}&lr=lang_id&hl=id` : "";
            const res = await fetch(`${API.baseUrl}/api?q=${encodeURIComponent(query)}${langFilter}&tbm=nws`);
            return res.ok ? res.json() : null;
        },
        fetchInstantAnswer: async (query) => {
            const queryMap = { "yahoo": "yahoo!", "notch": "markus persson", "bing": "microsoft bing", "bard": "google bard", "apple": "apple inc", "ronaldo": "cristiano ronaldo", "messi": "lionel messi" };
            const exactQuery = queryMap[query.toLowerCase()] || query;
            const res = await fetch(`${API.baseUrl}/?q=${encodeURIComponent(exactQuery)}`);
            return res.ok ? res.json() : null;
        },
        fetchSuggestions: async (query) => {
            const res = await fetch(`${API.baseUrl}/suggest?q=${encodeURIComponent(query)}`);
            return res.ok ? res.json() : null;
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

            if (!response.ok) return null;
            const data = await response.json();
            return data.choices?.[0]?.message?.content?.trim() || null;
        }
    };

    // 5. PARSERS & WIDGET GENERATORS (SSR)
    const renderAIOverviewHTML = async (query, webRes) => {
        if (webRes?.spelling || !query || query.length < 4) return "";
        const isQuestion = /(\?|\b(apa|siapa|mengapa|kenapa|bagaimana|kapan|di\s*mana|dimana|jelaskan|sebutkan|resep|cara)\b)/i.test(query);
        if (!isQuestion) return "";

        const contextSnippets = webRes?.items 
            ? webRes.items.slice(0, 4).map(item => `- ${item.title}: ${item.snippet}`).join("\n")
            : "";

        try {
            const rawText = await API.fetchAI(query, contextSnippets);
            if (!rawText || /i('m| am) sorry|can'?t provide|cannot provide|maaf,?\s*(saya|kami)?|tidak dapat|tidak bisa/i.test(rawText) || !rawText.includes('---')) {
                return "";
            }

            const headerTitle = getText("aiHeader");
            let formattedText = rawText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            const parts = formattedText.split('---').map(p => p.trim());
            
            let summary = parts[0] || formattedText;
            let subTitle = parts[1] ? parts[1].replace(/\*\*/g, '') : "";
            let listContent = parts[2] || "";
            let conclusion = parts[3] ? parts[3].replace(/\*\*/g, '') : "";

            let listItems = listContent.split('\n')
                .filter(line => line.trim().match(/^[-*]/))
                .map(line => line.replace(/^[-*]\s*/, '').trim());

            const hasMoreContent = subTitle || listItems.length > 0 || conclusion;

            let html = `
                <div class="result-card result-card--flat ai-overview-card">
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

            html += `</div>`;

            if (hasMoreContent) {
                html += `
                    <button class="btn-show-more" onclick="toggleAIList(this)">
                        <span>${getText("aiMore")}</span>
                        <svg viewBox="0 0 16 16"><path fill="currentColor" d="M3.5 5.5l4.5 4.5 4.5-4.5L14 7l-6 6-6-6z"/></svg>
                    </button>
                `;
            }

            html += `</div>`;
            return html;
        } catch (e) {
            return "";
        }
    };

    const renderInstantCardHTML = (res) => {
        if (!res || !res.snippet || res.snippet.length <= 100) return "";
        let subtitle = "";
        if (res.infobox && Array.isArray(res.infobox)) {
            const descItem = res.infobox.find(item => item.label === "Wikidata description" || item.data_type === "wd_description");
            if (descItem) subtitle = descItem.value;
        }

        let imageHtml = res.image ? `<img src="${res.image}" class="logo" alt="${Utils.escapeHTML(res.title)}" ${res.type ? 'style="border:1px solid #999"' : ''}>` : '';
        let infoboxHtml = '';

        if (res.infobox && res.infobox.length > 0) {
            const items = res.infobox.slice(0, 2).map(info => {
                if (!info.value.trim()) return '';
                return `
                    <div class="infobox-item">
                        <div class="infobox-item__label">${Utils.escapeHTML(info.label)}</div>
                        <div class="infobox-item__value">${Utils.escapeHTML(info.value)}</div>
                    </div>
                `;
            }).join("");
            if (items) infoboxHtml = `<div class="infobox">${items}</div>`;
        }

        return `
            <div class="instant-answer">
                <div class="title">${Utils.escapeHTML(res.title)}</div>
                ${subtitle ? `<div class="instant-answer__subtitle">${Utils.escapeHTML(subtitle)}</div>` : ''}
                ${imageHtml}
                <div class="summary-box">
                    <div class="instant-answer__section-title">Ringkasan</div>
                    <div class="summary-text">
                        ${Utils.escapeHTML(res.snippet.replace(/\<\/?(pre|code).*?\/>/g, "").slice(0, 140))}... 
                        <a href="${res.sourceUrl}" class="wikipedia">${Utils.escapeHTML(res.source)} ›</a>
                    </div>
                </div>
                ${infoboxHtml}
            </div>
        `;
    };

    const renderWidgetsHTML = (query) => {
        const q = query.toLowerCase();
        const isTime = /jam|waktu|time|clock/.test(q) && q.length < 15 && q.split(" ").length < 4;
        const isDate = /tanggal|date/.test(q) && q.length < 15 && q.split(" ").length < 4;
        const isCalc = (/kalkulator|calculator/.test(q) && q.split(" ").length <= 2) || (/calculator\s+online|kalkulator\s+online/.test(q) && q.split(" ").length <= 3);
        const isTranslate = /translate|terjemah|terjemahan/.test(q);
        const d = new Date();

        if (isTime) {
            const timeStr = `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
            const dateStr = `${d.toLocaleDateString(localLang, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
            return `<div class="result-card result-card--flat result-card--empty"><div class="big-title">${timeStr}</div><div class="snippet-info">${dateStr}</div></div>`;
        } 
        if (isDate) {
            return `<div class="result-card result-card--flat result-card--empty"><div class="big-title">${d.toLocaleDateString(localLang, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div></div>`;
        } 
        if (isCalc) {
            return `
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
                </div>`;
        } 
        if (isTranslate) {
            return `
                <div class="trnsl"><div class="wrpl"><ul class="controls">
                    <li class="row from"><div class="icons"><i class="fas fa-volume-up"></i><i class="fas fa-copy"></i></div><select></select></li>
                    <li class="exchange"><i class="fas fa-exchange-alt"></i></li>
                    <li class="row to"><select></select><div class="icons"><i class="fas fa-volume-up"></i><i class="fas fa-copy"></i></div></li>
                </ul>
                <div class="text-input"><textarea spellcheck="false" class="from-text" placeholder="Enter text"></textarea><textarea spellcheck="false" readonly disabled class="to-text" placeholder="Translation"></textarea></div></div></div>
            `;
        }
        return "";
    };

    const renderVideoWidgetHTML = async (query) => {
        try {
            const data = await API.fetchVideo(query, 4);
            if (!data || !data.items || !data.items.length) return "";

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

            return `<div class="result-card video-widget result-card--flat"><div class="title video-widget__title">${getText("vidTitle")}</div><div class="video-widget__list">${videonya}</div></div>`;
        } catch (e) {
            return "";
        }
    };

    // 6. MAIN EXECUTION & CONTENT BUILDER
    let mainResultsContent = "";
    let sidebarContent = "";
    let isVideoGrid = false;

    if (Config.tbm === "vid") {
        isVideoGrid = true;
        const res = await API.fetchVideo(Config.q);
        if (!res || !res.items || !res.items.length) {
            mainResultsContent = renderEmptyStateHTML(getText);
        } else {
            res.items.forEach(item => {
                mainResultsContent += `
                    <div class="video-card">
                        <a href="https://youtube.com/watch?v=${item.id.videoId}">
                            <img src="${item.snippet.thumbnails.medium.url}" class="thumbnail">
                            <div class="title">${Utils.escapeHTML(item.snippet.title)}</div>
                            <div class="source">
                                <div class="info">${Utils.timeAgo(item.snippet.publishTime)}</div>
                                <div class="info"><img src="images/youtube.png" class="favicon"><div>${Utils.escapeHTML(item.snippet.channelTitle)}</div></div>
                            </div>
                        </a>
                    </div>
                `;
            });
        }
    } else if (Config.tbm === "nws") {
        const res = await API.fetchNews(Config.q);
        if (!res || !res.items || !res.items.length) {
            mainResultsContent = renderEmptyStateHTML(getText);
        } else {
            res.items.forEach(item => {
                const publisher = item.pagemap?.metatags?.[0]?.['og:site_name'] || item.displayLink;
                const pubTime = [item.pagemap?.metatags?.[0]?.['article:published_time'], item.pagemap?.newsarticle?.[0]?.datepublished].find(Boolean);
                const timeStr = pubTime ? Utils.dateConversion(pubTime) : "Published";
                const thumb = item.pagemap?.cse_thumbnail ? `<img class="thumb" src="${item.pagemap.cse_thumbnail[0].src}">` : "";

                mainResultsContent += `
                    <div class="result-card news-card"><div class="news-card__body">
                        <a href="${item.link}">${thumb}
                            <div class="top"><img src="https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&url=${item.link}&size=64" class="favicon"><div class="link">${Utils.escapeHTML(publisher)}</div></div>
                            <div class="title">${Utils.escapeHTML(item.title.slice(0, 70))}</div>
                            <div class="publishtime">${timeStr}</div>
                        </a>
                    </div></div>
                `;
            });
        }
    } else if (Config.tbm === "isch") {
        mainResultsContent = `<div class="show-wrapper"><div class="loader"><svg class="circular" viewBox="25 25 50 50"><circle class="path" cx="50" cy="50" r="20" fill="none" stroke-width="4" stroke-miterlimit="10"/></svg></div></div><script src="/imgtest.js"></script>`;
    } else {
        // Mode Pencarian Utama (Web) - Fetch Parallel
        const [webRes, instantRes, videoWidgetHtml, sugData] = await Promise.all([
            API.fetchWeb(Config.q, Config.startIndex),
            Config.startIndex === 1 ? API.fetchInstantAnswer(Config.q) : Promise.resolve(null),
            Config.startIndex === 1 ? renderVideoWidgetHTML(Config.q) : Promise.resolve(""),
            Config.startIndex === 1 ? API.fetchSuggestions(Config.q) : Promise.resolve(null)
        ]);

        if (!webRes || !webRes.items || !webRes.items.length) {
            mainResultsContent = renderEmptyStateHTML(getText);
        } else {
            let listHtml = `<div class="results-list">`;

            if (Config.startIndex === 1) {
                if (webRes.searchInformation) {
                    mainResultsContent += `<div class="result-stats">${isIdLang ? `Sekitar ${webRes.searchInformation.formattedTotalResults} hasil (${webRes.searchInformation.formattedSearchTime} detik)` : `Approximately ${webRes.searchInformation.formattedTotalResults} result (${webRes.searchInformation.formattedSearchTime} seconds)`}</div>`;
                }
                if (webRes.spelling) {
                    listHtml += `<div class="corrected-word result-card result-card--flat"><div class="snippet">${getText("correct")} <a href="/search?q=${encodeURIComponent(webRes.spelling.correctedQuery)}${searchLangParam}">${Utils.escapeHTML(webRes.spelling.correctedQuery)}</a><span>?</span></div></div>`;
                }

                // Render AI Overview
                const aiOverviewHtml = await renderAIOverviewHTML(Config.q, webRes);
                listHtml += aiOverviewHtml;

                // Render Widget Interaktif (Kalkulator/Jam/Translate)
                listHtml += renderWidgetsHTML(Config.q);

                // Render Instant Answer
                if (instantRes) {
                    const instantHtml = renderInstantCardHTML(instantRes);
                    if (!Config.isMobile) sidebarContent += instantHtml;
                    else listHtml += instantHtml;
                }
            }

            // Loop Item Hasil Pencarian
            webRes.items.forEach((item, i) => {
                const siteName = item.pagemap?.metatags?.[0]?.['og:site_name'] || item.displayLink;
                const snippet = item.pagemap?.question?.[0]?.text ? `${Utils.dateConversion(item.pagemap.question[0].datecreated, true)} - ${Utils.escapeHTML(item.pagemap.question[0].text)}` : Utils.escapeHTML(item.snippet);
                const faviconHtml = isFaviconDisabled ? "" : `<div class="favicon"><img src="https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${item.link}&size=64"></div>`;

                listHtml += `
                    <div class="result-card result-card--flat">
                        <div class="tab-link">
                        <a href="${item.link}" ${settings.newtab ? 'target="_blank"' : ''}>
                            <div class="top">
                            ${faviconHtml}
                            <div class="link-rw"><div class="link">${Utils.escapeHTML(siteName)}</div><div class="link link--meta">${Utils.escapeHTML(item.displayLink)}</div></div>
                            </div>
                            <div class="title">${Utils.escapeHTML(item.title)}</div>
                        </a>
                        </div>
                        <div class="btm-snpt"><div class="snippet"><span>${snippet || getText("noSiteInfo")}</span></div></div>
                    </div>
                `;

                if (i === 1 && videoWidgetHtml) {
                    listHtml += videoWidgetHtml;
                }
            });

            if (webRes.items.length < 2 && videoWidgetHtml) {
                listHtml += videoWidgetHtml;
            }

            // Suggestion List "People also search for"
            if (sugData && sugData.suggestions && sugData.suggestions.length) {
                const list = sugData.suggestions.slice(0, 5).map(s => `<a href="/search?q=${encodeURIComponent(s)}" class="related">${Utils.capitalize(Utils.escapeHTML(s))}</a>`).join("");
                listHtml += `<div class="related-search"><div class="title">${getText("related")}</div><div class="search-list">${list}</div></div>`;
            }

            listHtml += `</div>`; // Close .results-list
            mainResultsContent += listHtml;

            // Pagination Button
            if (webRes.queries?.nextPage) {
                mainResultsContent += `<div class="show-wrapper"><button class="more" onclick="handlePagination()">${getText("more")}</button></div>`;
            }
        }
    }

    // SVG Icons
    const svgIcons = {
        all: `<svg width="16" height="16" viewBox="0 0 16 16" fill="#6e7780"><path fill-rule="evenodd" clip-rule="evenodd" d="M6 1C2.686 1 0 3.686 0 7C0 10.314 2.686 13 10.223 11.263L14.787 14.84C15.113 15.096 15.585 15.039 15.84 14.713C16.096 14.387 16.039 13.915 15.713 13.66L11.149 10.083C11.689 9.182 12 8.127 12 7C12 3.686 9.314 1 6 1ZM1.5 7C1.5 4.515 3.515 2.5 6 2.5C8.485 2.5 10.5 4.515 10.5 7C10.5 9.485 8.485 11.5 6 11.5C3.515 11.5 1.5 9.485 1.5 7Z"></path></svg>`,
        images: `<svg width="16" height="16" viewBox="0 0 16 16" fill="#6e7780"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.25 1C1.455 1 0 2.455 0 4.25V11.75C0 13.545 1.455 15 3.25 15H12.75C14.545 15 16 13.545 16 11.75V10.259C16 10.253 16 10.247 16 10.241V4.25C16 2.455 14.545 1 12.75 1H3.25ZM14.5 8.439V4.25C14.5 3.284 13.716 2.5 12.75 2.5H3.25C2.284 2.5 1.5 3.284 1.5 4.25V11.75C1.5 11.956 1.536 12.154 1.601 12.338L5.97 7.97C6.263 7.677 6.737 7.677 7.03 7.97L8 8.939L10.97 5.97C11.263 5.677 11.737 5.677 12.03 5.97L14.5 8.439ZM9.061 10L10.03 10.97C10.323 11.263 10.323 11.737 10.03 12.03C9.737 12.323 9.263 12.323 8.97 12.03L6.5 9.561L2.662 13.399C2.846 13.464 3.044 13.5 3.25 13.5H12.75C13.716 13.5 14.5 12.716 14.5 11.75V10.561L11.5 7.561L9.061 10Z"></path></svg>`,
        videos: `<svg width="16" height="16" viewBox="0 0 16 16" fill="#6e7780"><path fill-rule="evenodd" clip-rule="evenodd" d="M13.489 5.55C15.38 6.636 15.38 9.364 13.489 10.45L6.231 14.616C4.348 15.698 2 14.338 2 12.166L2 3.834C2 1.662 4.348 0.303 6.231 1.384L13.489 5.55ZM12.742 9.149C13.629 8.64 13.629 7.36 12.742 6.851L5.485 2.685C4.601 2.178 3.5 2.816 3.5 3.834L3.5 12.166C3.5 13.185 4.601 13.823 5.485 13.316L12.742 9.149Z"></path></svg>`,
        news: `<svg width="16" height="16" viewBox="0 0 22 22" fill="#6e7780"><path d="M12 11h6v2h-6v-2zm-6 6h12v-2H6v2zm0-4h4V7H6v6zm16-7.22v12.44c0 1.54-1.34 2.78-3 2.78H5c-1.64 0-3-1.25-3-2.78V5.78C2 4.26 3.36 3 5 3h14c1.64 0 3 1.25 3 2.78zM19.99 12V5.78c0-.42-.46-.78-1-.78H5c-.54 0-1 .36-1 .78v12.44c0 .42.46.78 1 .78h14c.54 0 1-.36 1-.78V12zM12 9h6V7h-6v2"></path></svg>`,
        maps: `<svg width="16" height="16" viewBox="0 0 16 16" fill="#6e7780"><path d="M8 8C9.105 8 10 7.105 10 6C10 4.895 9.105 4 8 4C6.895 4 6 4.895 6 6C6 7.105 6.895 8 8 8Z"></path></svg>`
    };

    const createTab = (id, tbmVal, icon, label, selected) => `
        <div class="search-item ${selected ? 'selected' : ''}">
            <a href="/search?q=${encodeURIComponent(Config.q).replace(/%20/g,'+')}${tbmVal}${searchLangParam}${searchParam}" class="tab-wrapper" tab-id="${id}">
                <div class="label">
                    ${!Config.isMobile ? svgIcons[icon] : ''}
                    <span>${getText("tab", label)}</span>
                </div>
            </a>
        </div>`;

    const isDark = settings.theme === "dark" || Config.th === "1";
    const pageTitle = isIdLang ? `${Utils.escapeHTML(Config.q)} - Penelusuran` : `${Utils.escapeHTML(Config.q)} - Search`;

    // 7. HTML TEMPLATE RENDERING
    const htmlResponse = `<!DOCTYPE html>
<html lang="${isIdLang ? 'id' : 'en'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
    <link rel="stylesheet" href="/style.css">
    ${isDark ? '<style>body{background-color:#171717;color:#fff}</style>' : ''}
</head>
<body class="${isDark ? 'dark' : ''}">
    <div class="app" id="main-bx"> 
        <div class="page-header"> 
            <div class="page-header__inner"> 
                <div class="logo-slot"><a title="Kembali" href="/"><img alt="Logo" src="/images/logo.png"></a></div> 
                <div class="header"> 
                    <div class="search-box"> 
                        <div class="search-field"> 
                            <input type="search" id="sear_21829_input" value="${Utils.escapeHTML(Config.q)}" name="q" class="search-input" autocomplete="off" placeholder="${getText("placeholder")}"> 
                            <div role="button" class="search-toggle inpbtun" id="xclarGh" title="Cari"></div> 
                            <div role="button" class="cleartext inpbtun" style="${Config.q ? 'display:block' : 'display:none'}" id="Chasprn" title="Hapus"></div> 
                        </div> 
                    </div> 
                    <div class="search-menu"> 
                        ${createTab("all", "", "all", 0, !Config.tbm)} 
                        ${createTab("images", "&tbm=isch", "images", 1, Config.tbm === "isch")} 
                        ${createTab("videos", "&tbm=vid", "videos", 2, Config.tbm === "vid")} 
                        ${createTab("news", "&tbm=nws", "news", 3, Config.tbm === "nws")} 
                        ${createTab("maps", "", "maps", 4, false)} 
                    </div> 
                </div> 
            </div> 
        </div> 
        <div class="results-section"> 
            <div class="result-wrapper">
                <div class="main-result ${isVideoGrid ? 'video-grid' : ''}">${mainResultsContent}</div>
                ${sidebarContent ? `<div class="sidebar-panel">${sidebarContent}</div>` : ''}
            </div> 
            <section class="footer">
                <ul class="list"><li><a href="/settings">Settings</a></li><li><a href="/privacy">Privacy</a></li><li><a href="/search?q=translate">Translate</a></li></ul>
                <div class="copyright">©Copyright ${new Date().getFullYear()}</div>
            </section>
        </div> 
    </div>

    <!-- CLIENT INTERACTIVE CONTROLLERS -->
    <script>
        window.Config = ${JSON.stringify(Config)};
        window.isIdLang = ${isIdLang};
        window.searchLangParam = "${searchLangParam}";
        window.searchParam = "${searchParam}";

        function toggleAIList(btn) {
            const parent = btn.closest('.ai-overview-card');
            if (!parent) return;
            const wrapper = parent.querySelector('.ai-content-wrapper');
            const isExpanded = btn.classList.toggle('expanded');
            if (wrapper) wrapper.classList.toggle('expanded', isExpanded);
            btn.querySelector('span').textContent = isExpanded ? "${getText("aiLess")}" : "${getText("aiMore")}";
        }

        document.addEventListener('DOMContentLoaded', () => {
            const searchInput = document.querySelector(".search-input");
            const clearBtn = document.querySelector(".cleartext");
            const toggleBtn = document.querySelector(".search-toggle");

            if (searchInput && clearBtn) {
                searchInput.addEventListener('input', () => {
                    clearBtn.style.display = searchInput.value ? "block" : "none";
                });
                clearBtn.addEventListener('click', () => { 
                    searchInput.value = ""; 
                    searchInput.focus(); 
                    clearBtn.style.display = "none"; 
                });
                searchInput.addEventListener('keyup', (e) => { 
                    if (e.key === "Enter" && toggleBtn) toggleBtn.click(); 
                });
            }

            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    if (searchInput.value.trim()) {
                        const searchData = Config.tbm ? "&tbm=" + Config.tbm : "";
                        window.location.href = "/search?q=" + encodeURIComponent(searchInput.value).replace(/%20/g,'+') + searchData + searchLangParam + searchParam;
                    }
                });
            }

            // Init Calculator Listener jika ada
            const calculatorBox = document.querySelector(".calculator");
            if (calculatorBox) {
                const display = calculatorBox.querySelector(".display");
                let output = "";
                calculatorBox.querySelectorAll("button").forEach(btn => {
                    btn.addEventListener("click", (e) => {
                        const val = e.target.dataset.value;
                        if (val === "=" && output !== "") {
                            try { output = eval(output.replace("%", "/100").replace(/×/g, "*").replace(/÷/g, "/")); } catch { output = "Error"; }
                        } else if (val === "AC") { output = ""; }
                        else if (val === "DEL") { output = output.toString().slice(0, -1); }
                        else {
                            if (output === "" && ["%", "*", "/", "-", "+", "="].includes(val)) return;
                            output += val;
                        }
                        display.value = output; display.blur();
                    });
                });
            }
        });

        function handlePagination() {
            const wrapper = document.querySelector(".show-wrapper"); 
            if (!wrapper) return; 
            wrapper.innerHTML = '<div class="loader"><svg class="circular" viewBox="25 25 50 50"><circle class="path" cx="50" cy="50" r="20" fill="none" stroke-width="4" stroke-miterlimit="10"/></svg></div>'; 
            Config.startIndex += 10; 
            const searchData = Config.tbm ? "&tbm=" + Config.tbm : "";
            window.location.href = "/search?q=" + encodeURIComponent(Config.q).replace(/%20/g,'+') + "&p=" + Config.startIndex + searchData + searchLangParam + searchParam;
        }
    </script>
</body>
</html>`;

    return new Response(htmlResponse, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
    });
}

// HELPER FUNCTIONS
function parseCookies(header) {
    const list = {};
    if (!header) return list;
    header.split(';').forEach(cookie => {
        let [name, ...rest] = cookie.split('=');
        name = name?.trim();
        if (!name) return;
        const value = rest.join('=').trim();
        list[name] = decodeURIComponent(value);
    });
    return list;
}

function safeJsonParse(str) {
    try { return JSON.parse(str); } catch { return {}; }
}

function renderEmptyStateHTML(getText) {
    const list = Array(3).fill(0).map((_, i) => `<li>${getText("noresultsug", i)}</li>`).join("");
    return `
        <div class="result-card result-card--empty result-card--flat">
            <div class="title-black">${getText("noresult")}</div>
            <div class="suggestion">${getText("suggtext")}</div>
            <div><ul>${list}</ul></div>
        </div>`;
}
