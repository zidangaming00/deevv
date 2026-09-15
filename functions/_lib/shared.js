// functions/_lib/shared.js
// Modul dipakai bareng oleh Cloudflare Pages Functions.
// Nama folder diawali underscore (_lib) supaya TIDAK jadi route sendiri.

export const LANG_DICT = {
  en: {
    more: "More search results",
    related: "People also search for",
    placeholder: "Type to search...",
    correct: "Did you mean:",
    noSiteInfo: "There is no information on this page.",
    tab: ["All", "Images", "Videos", "News", "Maps"],
  },
  id: {
    more: "Hasil penelusuran lainnya",
    related: "Orang lain juga menelusuri",
    placeholder: "Ketik untuk mencari...",
    correct: "Apakah maksudmu:",
    noSiteInfo: "Tidak ada informasi mengenai halaman ini.",
    tab: ["Semua", "Gambar", "Video", "Berita", "Peta"],
  },
};

export function getText(isIdLang, key, index = null) {
  const lang = isIdLang ? "id" : "en";
  const val = LANG_DICT[lang][key];
  return index !== null ? val[index] : val;
}

export function escapeHTML(str) {
  return str
    ? String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
    : "";
}

// Sama persis dengan bagian dalam res.items.forEach() di renderWebResults()
// (script.js baris ~972-995), dipindah jadi function biasa (tanpa DOM).
export function buildResultCardHtml(item, isFaviconDisabled) {
  const siteName = item.pagemap?.metatags?.[0]?.["og:site_name"] || item.displayLink;
  const snippet = escapeHTML(item.snippet);
  const faviconHtml = isFaviconDisabled
    ? ""
    : `<div class="favicon"><img src="https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${item.link}&size=64"></div>`;

  return `
    <div class="result-card result-card--flat">
      <div class="tab-link">
        <a href="${item.link}">
          <div class="top">
            ${faviconHtml}
            <div class="link-rw"><div class="link">${escapeHTML(siteName)}</div><div class="link link--meta">${escapeHTML(item.displayLink)}</div></div>
          </div>
          <div class="title">${escapeHTML(item.title)}</div>
        </a>
      </div>
      <div class="btm-snpt"><div class="snippet"><span>${snippet || getText(false, "noSiteInfo")}</span></div></div>
    </div>
  `;
}

// Struktur head diambil dari search.html yang kamu upload.
// searchQuery WAJIB sudah di-escape sebelum dipanggil ke sini.
export function buildPageShell({ q, isIdLang, bodyHtml, initialDataJson }) {
  const title = isIdLang ? `${q} - Penelusuran` : `${q} - Search`;

  return `<!DOCTYPE html><html lang="${isIdLang ? "id" : "en"}"><head>
<meta charset="UTF-8">
<meta http-equiv="content-type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Search and explore anything on the internet, you can explore web pages, videos, news and much more.">
<title>${escapeHTML(title)}</title>
<meta name="referrer" content="origin">
<link rel="stylesheet" href="/base.css">
<link rel="stylesheet" href="/results.css">
<link rel="stylesheet" href="/media.css">
<link rel="icon" type="image/png" href="images/search.png">
</head>
<body id="rslt-m">
${bodyHtml}
<script>window.__SSR_DATA__ = ${initialDataJson};</script>
<script type="text/javascript" src="./script.js"></script>
<script type="text/javascript" src="./cookie.js"></script>
</body></html>`;
}
