// functions/search.js
// Route: GET /search
// SSR shell + hasil web halaman pertama. Tab lain (vid/isch/nws) dan halaman
// berikutnya (p>1) di-render client-side oleh script.js lewat /api/*.

import { getText, escapeHTML, buildResultCardHtml, buildPageShell } from "./_lib/shared.js";
import { getWeb } from "./_lib/upstream.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const q = (url.searchParams.get("q") || "").trim();
  const p = url.searchParams.get("p");
  const hl = url.searchParams.get("hl");
  const fv = url.searchParams.get("fv");
  const th = url.searchParams.get("th");
  const uf = url.searchParams.get("uf");
  const sf = url.searchParams.get("sf");
  const tbm = url.searchParams.get("tbm");

  if (!q) {
    return Response.redirect(new URL("/", request.url).toString(), 302);
  }

  const isIdLang = hl === "id";
  const isFaviconDisabled = fv === "0";
  const startIndex = p && parseInt(p, 10) > 1 ? parseInt(p, 10) : 1;

  const searchLangParam = isIdLang ? `&hl=${hl}` : "";
  let searchParam = "";
  searchParam += uf === "1" ? "&uf=1" : "";
  searchParam += isFaviconDisabled ? "&fv=0" : "";
  searchParam += sf === "1" ? "&sf=1" : "";
  searchParam += th === "1" ? "&th=1" : "";

  // Halaman >1 atau tab selain web (vid/isch/nws): kirim shell kosong saja,
  // script.js yang lanjutin lewat /api/*.
  const isDefaultFirstPage = startIndex === 1 && !["vid", "isch", "nws"].includes(tbm);

  let resultsListInner = "";
  let resultStatsHtml = "";
  let paginationHtml = "";
  let ssrData = null;

  if (isDefaultFirstPage) {
    try {
      ssrData = await getWeb(env, { q, page: startIndex, hl: isIdLang ? "id" : "" });

      if (ssrData?.items?.length) {
        const info = ssrData.searchInformation;
        if (info) {
          resultStatsHtml = `<div class="result-stats">${
            isIdLang
              ? `Sekitar ${info.formattedTotalResults} hasil (${info.formattedSearchTime} detik)`
              : `Approximately ${info.formattedTotalResults} result (${info.formattedSearchTime} seconds)`
          }</div>`;
        }

        const correctedHtml = ssrData.spelling
          ? `<div class="corrected-word result-card result-card--flat"><div class="snippet">${getText(
              isIdLang,
              "correct"
            )} <a href="/search?q=${encodeURIComponent(ssrData.spelling.correctedQuery)}${searchLangParam}">${escapeHTML(
              ssrData.spelling.correctedQuery
            )}</a><span>?</span></div></div>`
          : "";

        const itemsHtml = ssrData.items
          .map((item, i) => {
            const card = buildResultCardHtml(item, isFaviconDisabled);
            const videoSlot = i === 1 ? `<div id="dynamic-video-widget-slot"></div>` : "";
            return card + videoSlot;
          })
          .join("");

        const trailingVideoSlot =
          ssrData.items.length < 2 ? `<div id="dynamic-video-widget-slot"></div>` : "";

        resultsListInner = correctedHtml + itemsHtml + trailingVideoSlot;

        if (ssrData.queries?.nextPage) {
          paginationHtml = `<div class="show-wrapper"><button class="more">${getText(
            isIdLang,
            "more"
          )}</button></div>`;
        }
      } else {
        resultsListInner = `<!-- empty: ditangani client-side (UI.renderEmptyState) -->`;
      }
    } catch (err) {
      // Gagal fetch di server -> jangan block halaman, biarkan script.js coba lewat /api/web.
      console.error("[search] SSR gagal:", err && err.message ? err.message : err);
      ssrData = null;
      resultsListInner = "";
      resultStatsHtml = "";
      paginationHtml = "";
    }
  }

  const svgIcons = {
    all: `<svg width="16" height="16" viewBox="0 0 16 16" fill="#6e7780" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M6 1C2.68629 1 0 3.68629 0 7C0 10.3137 2.68629 13 6 13C7.64669 13 9.13845 12.3366 10.2226 11.2626L14.7873 14.8403C15.1133 15.0959 15.5848 15.0387 15.8403 14.7127C16.0958 14.3867 16.0387 13.9153 15.7126 13.6597L11.1487 10.0826C11.6892 9.18164 12 8.12711 12 7C12 3.68629 9.31371 1 6 1ZM1.5 7C1.5 4.51472 3.51472 2.5 6 2.5C8.48528 2.5 10.5 4.51472 10.5 7C10.5 9.48528 8.48528 11.5 6 11.5C3.51472 11.5 1.5 9.48528 1.5 7Z"></path></svg>`,
    images: `<svg width="16" height="16" viewBox="0 0 16 16" fill="#6e7780"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.25 1C1.455 1 0 2.455 0 4.25V11.75C0 13.545 1.455 15 3.25 15H12.75C14.545 15 16 13.545 16 11.75V10.259C16 10.253 16 10.247 16 10.241V4.25C16 2.455 14.545 1 12.75 1H3.25ZM14.5 8.439V4.25C14.5 3.284 13.716 2.5 12.75 2.5H3.25C2.284 2.5 1.5 3.284 1.5 4.25V11.75C1.5 11.956 1.536 12.154 1.601 12.338L5.97 7.97C6.263 7.677 6.737 7.677 7.03 7.97L8 8.939L10.97 5.97C11.263 5.677 11.737 5.677 12.03 5.97L14.5 8.439ZM9.061 10L10.03 10.97C10.323 11.263 10.323 11.737 10.03 12.03C9.737 12.323 9.263 12.323 8.97 12.03L6.5 9.561L2.662 13.399C2.846 13.464 3.044 13.5 3.25 13.5H12.75C13.716 13.5 14.5 12.716 14.5 11.75V10.561L11.5 7.561L9.061 10Z"></path></svg>`,
    videos: `<svg width="16" height="16" viewBox="0 0 16 16" fill="#6e7780"><path fill-rule="evenodd" clip-rule="evenodd" d="M13.489 5.55C15.38 6.636 15.38 9.364 13.489 10.45L6.231 14.616C4.348 15.698 2 14.338 2 12.166L2 3.834C2 1.662 4.348 0.303 6.231 1.384L13.489 5.55ZM12.742 9.149C13.629 8.64 13.629 7.36 12.742 6.851L5.485 2.685C4.601 2.178 3.5 2.816 3.5 3.834L3.5 12.166C3.5 13.185 4.601 13.823 5.485 13.316L12.742 9.149Z"></path></svg>`,
    news: `<svg width="16" height="16" viewBox="0 0 22 22" fill="#6e7780"><path d="M12 11h6v2h-6v-2zm-6 6h12v-2H6v2zm0-4h4V7H6v6zm16-7.22v12.44c0 1.54-1.34 2.78-3 2.78H5c-1.64 0-3-1.25-3-2.78V5.78C2 4.26 3.36 3 5 3h14c1.64 0 3 1.25 3 2.78zM19.99 12V5.78c0-.42-.46-.78-1-.78H5c-.54 0-1 .36-1 .78v12.44c0 .42.46.78 1 .78h14c.54 0 1-.36 1-.78V12zM12 9h6V7h-6v2"></path></svg>`,
    maps: `<svg width="16" height="16" viewBox="0 0 16 16" fill="#6e7780" xmlns="http://www.w3.org/2000/svg"><path d="M8 8C9.10457 8 10 7.10457 10 6C10 4.89543 9.10457 4 8 4C6.89543 4 6 4.89543 6 6C6 7.10457 6.89543 8 8 8Z"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M8 0C6.81332 0 5.65328 0.351894 4.66658 1.01118C3.67989 1.67047 2.91085 2.60754 2.45673 3.7039C2.0026 4.80026 1.88378 6.00666 2.11529 7.17054C2.35179 8.35952 2.99591 9.39906 3.73051 10.2144C5.0603 11.6902 5.95884 13.0319 6.52237 13.9981C6.80408 14.4812 7.00183 14.87 7.1277 15.1343C7.19062 15.2665 7.23554 15.3675 7.26398 15.4334C7.27819 15.4664 7.28829 15.4907 7.29444 15.5057L7.30075 15.5212L7.30129 15.5226L7.30168 15.5236C7.41829 15.8212 7.71074 16.0123 8.03018 15.9994C8.34937 15.9865 8.62531 15.7729 8.71783 15.4673L8.71818 15.4662L8.72264 15.4522C8.72711 15.4384 8.73473 15.4154 8.74578 15.3837C8.76791 15.3202 8.80379 15.2219 8.85585 15.0927C8.95997 14.8342 9.12867 14.452 9.38109 13.9769C9.88586 13.0267 10.7253 11.7051 12.0529 10.2568C12.7338 9.51391 13.6375 8.41354 13.8847 7.17054C14.1162 6.00666 13.9974 4.80026 13.5433 3.7039C13.0892 2.60754 12.3201 1.67047 11.3334 1.01118C10.3467 0.351894 9.18669 0 8 0ZM8.05642 13.2731C8.01989 13.3419 7.98488 13.409 7.95134 13.4745C7.90893 13.3994 7.86453 13.322 7.81811 13.2425C7.20975 12.1993 6.25213 10.7721 4.84488 9.21027C4.23085 8.5288 3.75511 7.72573 3.58647 6.87791C3.41284 6.00499 3.50195 5.10019 3.84254 4.27792C4.18314 3.45566 4.75992 2.75285 5.49994 2.25839C6.23996 1.76392 7.10999 1.5 8 1.5C8.89002 1.5 9.76005 1.76392 10.5001 2.25839C11.2401 2.75285 11.8169 3.45566 12.1575 4.27793C12.4981 5.10019 12.5872 6.00499 12.4135 6.87791C12.2556 7.67171 11.6276 8.50093 10.9471 9.24321C9.52471 10.7949 8.61414 12.2233 8.05642 13.2731Z"></path></svg>`,
  };

  const createTab = (tbmVal, icon, labelIndex, isSelected) =>
    `<div class="search-item${isSelected ? " selected" : ""}"><a href="/search?q=${encodeURIComponent(q).replace(/%20/g, "+")}${tbmVal}${searchLangParam}${searchParam}" class="tab-wrapper"><div class="label">${svgIcons[icon]}<span>${getText(isIdLang, "tab", labelIndex)}</span></div></a></div>`;

  const selectedTabIndex = { vid: 2, isch: 1, nws: 3 }[tbm] ?? 0;
  const tabs = [
    createTab("", "all", 0, selectedTabIndex === 0),
    createTab("&tbm=isch", "images", 1, selectedTabIndex === 1),
    createTab("&tbm=vid", "videos", 2, selectedTabIndex === 2),
    createTab("&tbm=nws", "news", 3, selectedTabIndex === 3),
    createTab("", "maps", 4, false),
  ].join("");

  const mainResultInner = isDefaultFirstPage
    ? `${resultStatsHtml}<div class="results-list">${resultsListInner}</div>${paginationHtml}`
    : "";

  const userAgent = request.headers.get("user-agent") || "";
  const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);

  // Bukan mobile: pakai max-width. Mobile: kosongkan.
  const mainResultStyle = !isMobile
    ? "min-width:var(--page-max-width);max-width:var(--page-max-width)"
    : "";

  const bodyHtml = `  
      <div class="app" id="main-bx">  
        <div class="page-header">  
          <div class="page-header__inner">  
            <div class="logo-slot"><a title="Kembali" href="/"><img alt="Logo" src="/images/logo.png"></a></div>  
            <div class="header">  
              <div class="search-box">  
                <div class="search-field">  
                  <input type="search" id="sear_21829_input" value="${escapeHTML(q)}" name="q" class="search-input" autocomplete="off" placeholder="${getText(isIdLang, "placeholder")}">  
                  <div role="button" class="search-toggle inpbtun" id="xclarGh" title="Cari"></div>  
                  <div role="button" class="cleartext inpbtun" style="display:none" id="Chasprn" title="Hapus"></div>  
                </div>  
              </div>  
            </div>  
          </div>  
          <div class="search-menu">  
            ${tabs}
          </div>  
        </div>  
        <div class="results-section">  
          <div class="result-wrapper">
            <div class="main-result" style="${mainResultStyle}">${mainResultInner}</div>
          </div>  
        </div>  
      </div>`;

  // "<" di-escape supaya data JSON tidak bisa menutup tag <script> di halaman.
  const initialDataJson = ssrData ? JSON.stringify(ssrData).replace(/</g, "\\u003c") : "null";

  const html = buildPageShell({
    q,
    isIdLang,
    bodyHtml,
    initialDataJson,
    tbm,
  });

  return new Response(html, {
  headers: {
    "Content-Type": "text/html; charset=UTF-8",
    "Link": "</font/BRVQLLXNOS.woff2>; rel=preload; as=font; crossorigin, </font/JBDCITAYMP.woff2>; rel=preload; as=font; crossorigin",
  },
});
  
}
