// functions/search.js
// Route: GET /search
// SSR shell + hasil web halaman pertama. Tab lain (vid/isch/nws) dan halaman
// berikutnya (p>1) tetap di-render client-side seperti semula oleh script.js.

import { getText, escapeHTML, buildResultCardHtml, buildPageShell } from "./_lib/shared.js";

const API_BASE_URL = "https://datasearch.searchdata.workers.dev";

export async function onRequestGet(context) {
  const { request } = context;
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
  // script.js yang lanjutin persis seperti sebelumnya (tidak diubah untuk kasus ini).
  const isDefaultFirstPage = startIndex === 1 && !["vid", "isch", "nws"].includes(tbm);

  let resultsListInner = "";
  let resultStatsHtml = "";
  let paginationHtml = "";
  let ssrData = null;

  if (isDefaultFirstPage) {
    try {
      const langFilter = isIdLang ? `&gl=${hl}&lr=lang_id&hl=id` : "";
      const apiRes = await fetch(
        `${API_BASE_URL}/api?q=${encodeURIComponent(q)}${langFilter}&page=${startIndex}`
      );
      ssrData = await apiRes.json();

      if (ssrData?.items?.length) {
        resultStatsHtml = `<div class="result-stats">${
          isIdLang
            ? `Sekitar ${ssrData.searchInformation.formattedTotalResults} hasil (${ssrData.searchInformation.formattedSearchTime} detik)`
            : `Approximately ${ssrData.searchInformation.formattedTotalResults} result (${ssrData.searchInformation.formattedSearchTime} seconds)`
        }</div>`;

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
      // Gagal fetch di server -> jangan block halaman, biarkan script.js yang coba fetch ulang di client.
      ssrData = null;
      resultsListInner = "";
    }
  }

  const svgIcons = {
    all: `<svg width="16" height="16" viewBox="0 0 16 16" fill="#6e7780"><path fill-rule="evenodd" clip-rule="evenodd" d="M6 1C2.686 1 0 3.686 0 7C0 10.314 2.686 13 10.223 11.263L14.787 14.84C15.113 15.096 15.585 15.039 15.84 14.713C16.096 14.387 16.039 13.915 15.713 13.66L11.149 10.083C11.689 9.182 12 8.127 12 7C12 3.686 9.314 1 6 1ZM1.5 7C1.5 4.515 3.515 2.5 6 2.5C8.485 2.5 10.5 4.515 10.5 7C10.5 9.485 8.485 11.5 6 11.5C3.515 11.5 1.5 9.485 1.5 7Z"></path></svg>`,
    images: `<svg width="16" height="16" viewBox="0 0 16 16" fill="#6e7780"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.25 1C1.455 1 0 2.455 0 4.25V11.75C0 13.545 1.455 15 3.25 15H12.75C14.545 15 16 13.545 16 11.75V10.259C16 10.253 16 10.247 16 10.241V4.25C16 2.455 14.545 1 12.75 1H3.25ZM14.5 8.439V4.25C14.5 3.284 13.716 2.5 12.75 2.5H3.25C2.284 2.5 1.5 3.284 1.5 4.25V11.75C1.5 11.956 1.536 12.154 1.601 12.338L5.97 7.97C6.263 7.677 6.737 7.677 7.03 7.97L8 8.939L10.97 5.97C11.263 5.677 11.737 5.677 12.03 5.97L14.5 8.439ZM9.061 10L10.03 10.97C10.323 11.263 10.323 11.737 10.03 12.03C9.737 12.323 9.263 12.323 8.97 12.03L6.5 9.561L2.662 13.399C2.846 13.464 3.044 13.5 3.25 13.5H12.75C13.716 13.5 14.5 12.716 14.5 11.75V10.561L11.5 7.561L9.061 10Z"></path></svg>`,
    videos: `<svg width="16" height="16" viewBox="0 0 16 16" fill="#6e7780"><path fill-rule="evenodd" clip-rule="evenodd" d="M13.489 5.55C15.38 6.636 15.38 9.364 13.489 10.45L6.231 14.616C4.348 15.698 2 14.338 2 12.166L2 3.834C2 1.662 4.348 0.303 6.231 1.384L13.489 5.55ZM12.742 9.149C13.629 8.64 13.629 7.36 12.742 6.851L5.485 2.685C4.601 2.178 3.5 2.816 3.5 3.834L3.5 12.166C3.5 13.185 4.601 13.823 5.485 13.316L12.742 9.149Z"></path></svg>`,
    news: `<svg width="16" height="16" viewBox="0 0 22 22" fill="#6e7780"><path d="M12 11h6v2h-6v-2zm-6 6h12v-2H6v2zm0-4h4V7H6v6zm16-7.22v12.44c0 1.54-1.34 2.78-3 2.78H5c-1.64 0-3-1.25-3-2.78V5.78C2 4.26 3.36 3 5 3h14c1.64 0 3 1.25 3 2.78zM19.99 12V5.78c0-.42-.46-.78-1-.78H5c-.54 0-1 .36-1 .78v12.44c0 .42.46.78 1 .78h14c.54 0 1-.36 1-.78V12zM12 9h6V7h-6v2"></path></svg>`,
    maps: `<svg width="16" height="16" viewBox="0 0 16 16" fill="#6e7780"><path d="M8 8C9.105 8 10 7.105 10 6C10 4.895 9.105 4 8 4C6.895 4 6 4.895 6 6C6 7.105 6.895 8 8 8Z"></path></svg>`,
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

  const bodyHtml = `
<div class="app" id="main-bx">
  <div class="page-header">
    <div class="page-header__inner">
      <div class="logo-slot"><a title="Kembali" href="/"><img alt="Logo" src="/images/logo.png"></a></div>
      <div class="header">
        <div class="search-box">
          <div class="search-field">
            <input type="search" id="sear_21829_input" value="${escapeHTML(q)}" name="q" class="search-input" autocomplete="off" placeholder="${getText(
    isIdLang,
    "placeholder"
  )}">
            <div role="button" class="search-toggle inpbtun" id="xclarGh" title="Cari"></div>
            <div role="button" class="cleartext inpbtun" style="display:${q ? "block" : "none"}" id="Chasprn" title="Hapus"></div>
          </div>
        </div>
        <div class="search-menu">${tabs}</div>
      </div>
    </div>
  </div>
  <div class="results-section">
    <div class="result-wrapper"><div class="main-result">${mainResultInner}</div></div>
  </div>
</div>`;

  const html = buildPageShell({
    q,
    isIdLang,
    bodyHtml,
    initialDataJson: ssrData ? JSON.stringify(ssrData) : "null",
  });

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=UTF-8" },
  });
}
