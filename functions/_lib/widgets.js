// functions/_lib/widgets.js
// Server-Side Orchestration widget tab "All":
//  - semua sumber ditembak PARALEL begitu request masuk (sebelum hasil web selesai)
//  - tiap widget punya timeout sendiri, satu yang lambat tidak menahan yang lain
//  - hasil di-stream sebagai fragmen <template> + <script> kecil yang menaruh
//    widget di posisi yang benar (aturan prioritas sama dengan placeByPriority di script.js)

import * as upstream from "./upstream.js";
import { rankApps, shouldShowVideo } from "./intent.js";

// ==========================================
// ADAPTER: hanya bagian ini yang perlu disesuaikan dengan upstream.js milikmu.
// Return yang diharapkan sama dengan respons /api/* yang dipakai script.js.
// ==========================================
const src = {
  playstore: (env, { q, hl, signal }) => upstream.getPlayStore(env, { q, hl, signal }), // -> array app
  videos: (env, { q, limit, signal }) => upstream.getVideos(env, { q, limit, signal }), // -> { items: [...] }
  instant: (env, { q, signal }) => upstream.getInstant(env, { q, signal }),             // -> { title, snippet, ... }
  ai: (env, { q, context, signal }) => upstream.getAI(env, { q, context, signal }),      // -> string | { text }
};

// Batas waktu per sumber (ms). Naikkan/turunkan sesuai kebutuhan.
const TIMEOUT = { play: 2500, video: 2500, instant: 2500, ai: 6000 };

const INSTANT_ALIAS = {
  yahoo: "yahoo!", notch: "markus persson", bing: "microsoft bing", bard: "google bard",
  apple: "apple inc", ronaldo: "cristiano ronaldo", messi: "lionel messi",
};

const T = {
  id: { video: "Video", aiHeader: "Ringkasan AI (Beta)", aiMore: "Tampilkan lainnya", thinking: "Berpikir", apps: "Aplikasi", summary: "Ringkasan", justNow: "Baru saja" },
  en: { video: "Videos", aiHeader: "AI Overview (Beta)", aiMore: "Show more", thinking: "Thinking", apps: "Apps", summary: "Summary", justNow: "Just now" },
};

// ---------- util ----------
const esc = (s) =>
  s ? String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : "";
const stripTags = (s) => (s ? String(s).replace(/<[^>]*>/g, "") : "");
const safeUrl = (u) => {
  if (!u || typeof u !== "string") return "";
  try {
    const p = new URL(u.trim());
    return /^https?:$/.test(p.protocol) ? p.href : "";
  } catch {
    return "";
  }
};
const attrUrl = (u) => esc(safeUrl(u));

function guard(fn, ms) {
  const ac = new AbortController();
  let timer;
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => { ac.abort(); rej(new Error("timeout")); }, ms);
  });
  return Promise.race([Promise.resolve().then(() => fn(ac.signal)), timeout]).finally(() => clearTimeout(timer));
}

function formatCount(v) {
  const n = Number(v);
  if (!n) return "";
  if (n >= 1e6) return `${Math.floor(n / 1e6)}jt`;
  if (n >= 1e3) return `${Math.floor(n / 1e3)}rb`;
  return String(n);
}

function timeAgo(date, lang, tr) {
  const f = new Intl.RelativeTimeFormat(lang);
  const sec = (date.getTime() - Date.now()) / 1000;
  const ranges = { years: 31536000, months: 2592000, weeks: 604800, days: 86400, hours: 3600, minutes: 60, seconds: 1 };
  for (const key in ranges) {
    if (ranges[key] < Math.abs(sec)) return f.format(Math.round(sec / ranges[key]), key);
  }
  return tr.justNow;
}

function dateConversion(val, lang, tr) {
  if (!val) return "";
  let d = new Date(String(val));
  if (isNaN(d)) {
    d = new Date(String(val).replace(/(\d{2}:\d{2}.*)/, "").trim());
    if (isNaN(d)) return "";
  }
  if (d.getFullYear() === new Date().getFullYear()) return timeAgo(d, lang, tr);
  return `${d.getDate()} ${d.toLocaleString(lang, { month: "long" })} ${d.getFullYear()}`;
}

// ---------- AI ----------
const SPARKLE = `<svg viewBox="0 0 24 24"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>`;

const IS_QUESTION = /(\?|\b(apa|siapa|mengapa|kenapa|bagaimana|kapan|di\s*mana|dimana|jelaskan|sebutkan|resep|cara)\b)/i;

// Dipakai bersama oleh skeleton (search.js) dan fetch AI, supaya keputusannya selalu sama.
export function wantAI(q, web) {
  if (web?.spelling) return false;
  const s = String(q || "").trim();
  return s.length >= 4 && IS_QUESTION.test(s);
}

export function aiSkeletonHtml(isId) {
  const t = isId ? T.id : T.en;
  return `<div id="w-ai" class="result-card result-card--flat ai-overview-card"><div class="ai-header">${SPARKLE}<span>${t.thinking}</span></div><div class="bone-container"><div class="bone-line"></div><div class="bone-line medium"></div><div class="bone-line short"></div></div></div>`;
}

function renderAI(raw, isId) {
  const text = String(raw?.text ?? raw ?? "").trim();
  const refusal = /i('m| am) sorry|can'?t provide|cannot provide|maaf,?\s*(saya|kami)?|tidak dapat|tidak bisa/i.test(text);
  if (!text || refusal || !text.includes("---")) return null;
  const t = isId ? T.id : T.en;

  const safe = esc(text).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  const parts = safe.split("---").map((p) => p.trim());
  const summary = parts[0] || safe;
  const subTitle = parts[1] ? parts[1].replace(/<\/?strong>/g, "") : "";
  const listItems = (parts[2] || "").split("\n").filter((l) => /^\s*[-*]/.test(l)).map((l) => l.replace(/^[-*]\s*/, "").trim());
  const conclusion = parts[3] ? parts[3].replace(/<\/?strong>/g, "") : "";
  const more = subTitle || listItems.length > 0 || conclusion;

  let body = `<div class="ai-summary-text">${summary}</div>`;
  if (more) {
    body += `<div class="ai-collapsible-body">`;
    if (subTitle) body += `<div class="ai-sub-title">${subTitle}</div>`;
    if (listItems.length) body += `<ul class="dynamic-list">${listItems.map((i) => `<li>${i}</li>`).join("")}</ul>`;
    if (conclusion) body += `<div class="ai-summary-text" style="margin-top: 12px;">${conclusion}</div>`;
    body += `</div>`;
  }

  const btn = more
    ? `<button class="btn-show-more" onclick="Widgets.toggleAIList(this)"><span>${t.aiMore}</span><svg viewBox="0 0 16 16"><path fill="currentColor" d="M3.5 5.5l4.5 4.5 4.5-4.5L14 7l-6 6-6-6z"/></svg></button>`
    : "";

  return `<div class="result-card result-card--flat ai-overview-card"><div class="ai-header">${SPARKLE}<span>${t.aiHeader}</span></div><div class="ai-content-wrapper">${body}</div>${btn}</div>`;
}

// ---------- Play Store ----------
function renderPlayStore(apps, isId) {
  const t = isId ? T.id : T.en;
  const logo = `<img src="https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://play.google.com/&size=64" width="20px" height="20px" />`;
  const header = `<div style="display:flex; align-items:center; gap:8px; font-size: var(--dtext-medium); color:var(--color-text-dark); padding-bottom: 2px;">${logo}<span>${t.apps}</span></div>`;

  const items = apps
    .map((app, index) => {
      if (!app.title) return "";
      const title = esc(app.title);
      const icon = attrUrl(app.icon);
      const url = attrUrl(app.url);
      const rating = app.rating ? parseFloat(app.rating).toFixed(1) : null;
      const isFree = app.price === "0" || app.price === 0;
      const priceText = isFree ? "Install" : `Rp ${Number(app.price).toLocaleString("id-ID")}`;
      const countText = app.ratingCount ? `(${formatCount(app.ratingCount)})` : "";
      const category = app.category
        ? app.category.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())
        : "";
      const meta = rating ? `${rating} ⭐ ${countText}`.trim() : "";
      const border = index !== apps.length - 1 ? "border-bottom: 1px solid var(--color-border); padding-bottom: 12px;" : "";
      const ell = "font-size:13px; color:var(--color-text-muted); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;";

      return `<div style="display:flex; align-items:center; gap:12px; ${border}">${
        icon ? `<img src="${icon}" alt="${title}" style="width:60px; height:60px; border-radius:12px; object-fit:cover; flex-shrink:0;">` : ""
      }<div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:2px;"><div style="font-size:var(--dtext-small); color:var(--color-title); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${title}</div>${
        meta ? `<div style="${ell}">${meta}</div>` : ""
      }<div style="${ell}">${esc(app.developer)} • ${category}</div></div><a href="${url}" target="_blank" rel="noopener" style="background:var(--color-title); color:#fff; padding:6px 16px; border-radius:18px; text-decoration:none; font-size:13px; font-weight:500; white-space:nowrap; flex-shrink:0;">${priceText}</a></div>`;
    })
    .join("");

  if (!items.trim()) return null;
  return `<div class="result-card result-card--flat playstore-widget" style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">${header}${items}</div>`;
}

// ---------- Video ----------
function renderVideos(items, isId) {
  const t = isId ? T.id : T.en;
  const lang = isId ? "id" : "en";
  let list = "";
  for (const item of items.slice(0, 4)) {
    const sn = item?.snippet;
    if (!sn) continue;
    const videoId = encodeURIComponent(item.id?.videoId || item.id || "");
    const thumb = attrUrl(sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url);
    const date = dateConversion(sn.publishTime, lang, t);
    list += `<div class="video-widget-item"><a href="https://youtube.com/watch?v=${videoId}"><div class="video-widget-item__row"><div class="thumbnail">${
      thumb ? `<img src="${thumb}" alt="">` : ""
    }<div class="video-widget-item__play"><span class="play-icon"><svg focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle fill="#fff" cx="12" cy="12" r="6.2"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5"></path></svg></span></div></div><div class="video-widget-item__text"><div class="video-widget-item__title">${esc(sn.title)}</div><div class="video-widget-item__meta">YouTube<span class="dot"></span><div class="video-widget-item__channel">${esc(sn.channelTitle)}</div></div>${
      date ? `<div class="video-widget-item__date">${date}</div>` : ""
    }</div></div></a></div>`;
  }
  if (!list) return null;
  return `<div class="result-card video-widget result-card--flat"><div class="title video-widget__title">${t.video}</div><div class="video-widget__list">${list}</div></div>`;
}

// ---------- Instant answer ----------
function renderInstant(res, isId) {
  const t = isId ? T.id : T.en;
  const snippet = stripTags(res?.snippet || "");
  if (!snippet || snippet.length <= 100) return null;

  let subtitle = "";
  if (Array.isArray(res.infobox)) {
    const d = res.infobox.find((i) => i.label === "Wikidata description" || i.data_type === "wd_description");
    if (d) subtitle = esc(stripTags(d.value));
  }
  const title = esc(stripTags(res.title || ""));
  const img = attrUrl(res.image);
  const imageHtml = img ? `<img src="${img}" class="logo" alt="${title}" ${res.type ? 'style="border:1px solid #999"' : ""}>` : "";

  let infobox = "";
  if (Array.isArray(res.infobox) && res.infobox.length) {
    const rows = res.infobox
      .slice(0, 2)
      .map((i) => {
        const v = stripTags(i.value || "").trim();
        if (!v) return "";
        return `<div class="infobox-item"><div class="infobox-item__label">${esc(stripTags(i.label || ""))}</div><div class="infobox-item__value">${esc(v)}</div></div>`;
      })
      .join("");
    if (rows) infobox = `<div class="infobox">${rows}</div>`;
  }
  const href = attrUrl(res.sourceUrl) || "#";
  const source = esc(stripTags(res.source || ""));

  return `<div class="instant-answer"><div class="title">${title}</div>${
    subtitle ? `<div class="instant-answer__subtitle">${subtitle}</div>` : ""
  }${imageHtml}<div class="summary-box"><div class="instant-answer__section-title">${t.summary}</div><div class="summary-text">${esc(snippet.slice(0, 140))}... <a href="${href}" class="wikipedia">${source} ›</a></div></div>${infobox}</div>`;
}

// ==========================================
// ORKESTRASI
// ==========================================
// Panggil SEGERA di awal request (sebelum await getWeb). Mengembalikan { key: Promise<html|null> }.
// Semua promise tidak pernah reject.
export function startWidgets(env, { q, isId, webPromise }) {
  const hl = isId ? "id" : "en";
  const run = (name, fn) =>
    guard(fn, TIMEOUT[name]).catch((e) => {
      console.error(`[widget:${name}]`, e && e.message ? e.message : e);
      return null;
    });

  // satu panggilan Play Store dipakai bersama widget Play Store & keputusan video
  const playP = run("play", (signal) => src.playstore(env, { q, hl, signal }));
  const videoP = run("video", (signal) => src.videos(env, { q, limit: 8, signal }));
  const instantP = run("instant", (signal) => src.instant(env, { q: INSTANT_ALIAS[q.toLowerCase()] || q, signal }));

  const tasks = {
    play: playP.then((apps) => {
      const ranked = rankApps(q, apps);
      return ranked.length ? renderPlayStore(ranked.map((r) => r.app), isId) : null;
    }),
    video: Promise.all([videoP, playP]).then(([v, apps]) =>
      v?.items?.length && shouldShowVideo(q, apps || [], v.items) ? renderVideos(v.items, isId) : null
    ),
    instant: instantP.then((r) => renderInstant(r, isId)),
    // AI butuh snippet hasil web, jadi menunggu webPromise (satu-satunya dependensi)
    ai: Promise.resolve(webPromise)
      .then((web) => {
        if (!web?.items?.length || !wantAI(q, web)) return null;
        const context = web.items.slice(0, 4).map((i) => `- ${i.title}: ${i.snippet}`).join("\n");
        return run("ai", (signal) => src.ai(env, { q, context, signal })).then((r) => (r ? renderAI(r, isId) : null));
      })
      .catch(() => null),
  };

  for (const k in tasks) tasks[k] = tasks[k].catch(() => null);
  return tasks;
}

// ==========================================
// STREAMING
// ==========================================
// Dieksekusi sekali di stream, sebelum fragmen pertama. Meniru placeByPriority di script.js:
// kata terkoreksi > widget alat > AI > Play Store. Video mengisi slot yang sudah ada,
// AI mengganti skeleton di tempat.
const CLIENT_HELPER = `<script>(function(){
function place(list,el,sels){var a=null;sels.forEach(function(s){var n=list.querySelector(s);while(n&&n.parentElement!==list)n=n.parentElement;if(!n)return;if(!a||(a.compareDocumentPosition(n)&Node.DOCUMENT_POSITION_FOLLOWING))a=n;});a?a.insertAdjacentElement("afterend",el):list.insertAdjacentElement("afterbegin",el);}
var PH={ai:"w-ai",video:"dynamic-video-widget-slot"};
window.__W=function(k,ok){
var tpl=document.querySelector('template[data-w="'+k+'"]'),html=tpl?tpl.innerHTML:"";if(tpl)tpl.remove();
var ph=PH[k]?document.getElementById(PH[k]):null,list=document.querySelector(".main-result .results-list");
if(!ok||!html||!list){if(ph)ph.remove();return;}
var box=document.createElement("div");box.innerHTML=html;var el=box.firstElementChild;if(!el){if(ph)ph.remove();return;}
if(k==="ai"){ph?ph.replaceWith(el):place(list,el,[".corrected-word","[data-top-widget]"]);}
else if(k==="video"){if(ph){ph.className=el.className;ph.innerHTML=el.innerHTML;}}
else if(k==="play"){place(list,el,[".corrected-word","[data-top-widget]",".ai-overview-card"]);}
else if(k==="instant"){
if(window.matchMedia("(min-width:781px)").matches){var wrap=document.querySelector(".sidebar-panel");
if(!wrap){wrap=document.createElement("div");wrap.className="sidebar-panel";var host=document.querySelector(".result-wrapper");if(host)host.appendChild(wrap);}
wrap.appendChild(el);}
else{var c=document.querySelectorAll(".result-card")[2];if(c)c.parentNode.insertBefore(el,c.nextSibling);else{var m=document.querySelector(".main-result");if(m)m.appendChild(el);}}
}};})();</script>`;

const fragment = (k, html) =>
  html ? `<template data-w="${k}">${html}</template><script>__W("${k}",1)</script>` : `<script>__W("${k}",0)</script>`;

// html = dokumen penuh dari buildPageShell. 10 hasil inti (sudah ada di html) dikirim PERTAMA,
// lalu tiap widget di-flush begitu selesai, apa pun urutannya.
export function streamPage(context, html, tasks, headers) {
  const enc = new TextEncoder();
  const cut = html.lastIndexOf("</body>");
  const head = cut === -1 ? html : html.slice(0, cut);
  const tail = cut === -1 ? "" : html.slice(cut);

  const { readable, writable } = new TransformStream();
  const w = writable.getWriter();

  const pump = (async () => {
    try {
      await w.write(enc.encode(head + CLIENT_HELPER));
      await Promise.all(
        Object.entries(tasks).map(async ([key, p]) => {
          const out = await p;
          await w.write(enc.encode(fragment(key, out)));
        })
      );
      if (tail) await w.write(enc.encode(tail));
    } catch (e) {
      console.error("[stream]", e && e.message ? e.message : e);
    } finally {
      try { await w.close(); } catch {}
    }
  })();

  context.waitUntil(pump);
  return new Response(readable, { headers });
}
