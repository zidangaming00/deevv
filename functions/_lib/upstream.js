// functions/_lib/upstream.js
// Satu-satunya tempat yang tahu alamat/kunci sumber data.
// Browser hanya pernah melihat /api/* milik domain kamu sendiri.
//
// Environment variable (Cloudflare Pages > Settings > Variables and Secrets):
//   GROQ_API_KEY      (Secret, WAJIB untuk AI Overview)
//   WEB_API_BASE      (opsional) default: worker datasearch
//   SCRAPER_API_BASE  (opsional) default: API Railway (news + images)
//   UPSTREAM_TOKEN    (opsional) dikirim sebagai header x-api-key ke worker/Railway,
//                     supaya kedua API itu bisa menolak request selain dari server kamu.

const DEFAULT_WEB_BASE = "https://datasearch.searchdata.workers.dev";
const DEFAULT_SCRAPER_BASE = "https://deevv-api-production.up.railway.app";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-20b";

const ALLOWED_LANGS = new Set([
  "en",
  "id",
  "es",
  "fr",
  "de",
  "ja",
  "ko",
  "zh"
]);

const webBase = (env) =>
  String(env?.WEB_API_BASE || DEFAULT_WEB_BASE).replace(/\/+$/, "");

const scraperBase = (env) =>
  String(env?.SCRAPER_API_BASE || DEFAULT_SCRAPER_BASE).replace(/\/+$/, "");

// ------------------------------------------------------------------
// Helper umum
// ------------------------------------------------------------------

export function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function cleanQuery(q, maxLen = 300) {
  return String(q || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export function jsonResponse(data, { status = 200, ttl = 0 } = {}) {
  const headers = {
    "Content-Type": "application/json; charset=UTF-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control":
      ttl > 0
        ? `public, max-age=${Math.min(ttl, 60)}, s-maxage=${ttl}`
        : "no-store",
  };

  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

// Hanya izinkan request yang datang dari halaman milik sendiri (fetch same-origin).
// Membuka /api/... langsung di address bar atau dari situs lain akan ditolak.
// Catatan: ini bukan pengaman mutlak (curl bisa memalsukan header),
// untuk itu pakai juga Rate Limiting Rule di Cloudflare WAF.
export function guardRequest(request) {
  const deny = () =>
    jsonResponse(
      { error: "forbidden" },
      { status: 403 }
    );

  const url = new URL(request.url);

  // Cek origin jika request datang dari domain lain (CORS)
  const origin = request.headers.get("origin");

  if (origin) {
    try {
      if (new URL(origin).host !== url.host) return deny();
    } catch {
      return deny();
    }
  }

  // Bagian sec-fetch-mode & sec-fetch-site dihapus
  // agar endpoint masih bisa dites via browser address bar.
  return null;
}

function ownHeaders(env) {
  const h = {
    Accept: "application/json",
  };

  if (env?.UPSTREAM_TOKEN) {
    h["x-api-key"] = env.UPSTREAM_TOKEN;
  }

  return h;
}

// ------------------------------------------------------------------
// Fetch helpers
// ------------------------------------------------------------------

/**
 * Fetch JSON dengan:
 * - timeout internal
 * - dukungan AbortSignal dari widgets.js
 * - signal diteruskan sampai fetch upstream
 */
async function fetchJson(
  url,
  {
    headers = {},
    init = {},
    timeoutMs = 10000,
    signal = null,
  } = {}
) {
  const ctrl = new AbortController();

  let abortHandler = null;

  if (signal) {
    if (signal.aborted) {
      ctrl.abort();
    } else {
      abortHandler = () => ctrl.abort();
      signal.addEventListener("abort", abortHandler, { once: true });
    }
  }

  const timer = setTimeout(() => {
    ctrl.abort();
  }, timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...headers,
        ...(init.headers || {}),
      },
      signal: ctrl.signal,
    });

    if (!res.ok) {
      throw new Error(`upstream_${res.status}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timer);

    if (signal && abortHandler) {
      signal.removeEventListener("abort", abortHandler);
    }
  }
}

/**
 * Versi text untuk sumber HTML seperti Google Translate / Play Store.
 * Juga mendukung AbortSignal dari widget.
 */
async function fetchText(
  url,
  {
    headers = {},
    init = {},
    timeoutMs = 10000,
    signal = null,
  } = {}
) {
  const ctrl = new AbortController();

  let abortHandler = null;

  if (signal) {
    if (signal.aborted) {
      ctrl.abort();
    } else {
      abortHandler = () => ctrl.abort();
      signal.addEventListener("abort", abortHandler, { once: true });
    }
  }

  const timer = setTimeout(() => {
    ctrl.abort();
  }, timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...headers,
        ...(init.headers || {}),
      },
      signal: ctrl.signal,
    });

    if (!res.ok) {
      throw new Error(`upstream_${res.status}`);
    }

    return await res.text();
  } finally {
    clearTimeout(timer);

    if (signal && abortHandler) {
      signal.removeEventListener("abort", abortHandler);
    }
  }
}

const langFilter = (hl) =>
  hl === "id"
    ? "&gl=id&lr=lang_id&hl=id"
    : "";

// ------------------------------------------------------------------
// Sumber data
// ------------------------------------------------------------------

// ================================================================
// WEB
// ================================================================

// Tab "Semua"
// page = 1, 11, 21, dst.
export function getWeb(env, { q, page = 1, hl } = {}) {
  const url =
    `${webBase(env)}/api` +
    `?q=${encodeURIComponent(q)}` +
    `${langFilter(hl)}` +
    `&page=${page}`;

  return fetchJson(url, {
    headers: ownHeaders(env),
  });
}

// ================================================================
// VIDEO
// ================================================================

// Tab "Video" dan widget video di tab Semua.
//
// Return upstream dipertahankan apa adanya.
// widgets.js mengharapkan:
// { items: [...] }
export function getVideos(
  env,
  {
    q,
    limit = 50,
    signal = null,
  } = {}
) {
  const url =
    `${webBase(env)}/api` +
    `?q=${encodeURIComponent(q)}` +
    `&tbm=vid` +
    `&maxResults=${limit}`;

  return fetchJson(url, {
    headers: ownHeaders(env),
    signal,
  });
}

// ================================================================
// NEWS
// ================================================================

// Tab "Berita"
export function getNews(env, { q, hl } = {}) {
  const url =
    `${scraperBase(env)}/api/search` +
    `?q=${encodeURIComponent(q)}` +
    `${langFilter(hl)}` +
    `&type=news`;

  return fetchJson(url, {
    headers: ownHeaders(env),
    timeoutMs: 15000,
  });
}

// ================================================================
// IMAGES
// ================================================================

// Tab "Gambar"
export function getImages(
  env,
  {
    q,
    page = 1,
    hl,
    start = null,
    num = 20,
    signal = null,
  } = {}
) {
  // imgtest.js memakai start + num=20.
  // Pemanggil lama masih bisa memakai page.
  const paging =
    start !== null
      ? `&start=${start}&num=${num}`
      : `&page=${page}`;

  const url =
    `${scraperBase(env)}/api/search` +
    `?q=${encodeURIComponent(q)}` +
    `${langFilter(hl)}` +
    `&type=images${paging}`;

  return fetchJson(url, {
    headers: ownHeaders(env),
    timeoutMs: 20000,
    signal,
  });
}

// ================================================================
// INSTANT ANSWER
// ================================================================

// Kartu jawaban instan (Wikipedia dsb.)
export function getInstant(
  env,
  {
    q,
    signal = null,
  } = {}
) {
  return fetchJson(
    `${webBase(env)}/?q=${encodeURIComponent(q)}`,
    {
      headers: ownHeaders(env),
      signal,
    }
  );
}

// ================================================================
// SUGGEST
// ================================================================

export function getSuggest(
  env,
  {
    q,
    signal = null,
  } = {}
) {
  return fetchJson(
    `${webBase(env)}/suggest?q=${encodeURIComponent(q)}`,
    {
      headers: ownHeaders(env),
      timeoutMs: 5000,
      signal,
    }
  );
}

// ------------------------------------------------------------------
// Helper pembersih karakter HTML entity
// ------------------------------------------------------------------

const decodeEntities = (s) =>
  String(s)
    .replace(
      /&#(\d+);/g,
      (_, n) => String.fromCodePoint(+n)
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

// ==================================================================
// Widget Penerjemah
// Google Translate Mobile - Cloudflare Safe
// ==================================================================

export async function translateText({
  text,
  sl,
  tl,
}) {
  const srcLang = String(sl || "")
    .toLowerCase()
    .trim()
    .split("-")[0];

  const tgtLang = String(tl || "")
    .toLowerCase()
    .trim()
    .split("-")[0];

  const isSrcValid =
    srcLang === "auto" ||
    ALLOWED_LANGS.has(srcLang);

  const isTgtValid =
    ALLOWED_LANGS.has(tgtLang);

  if (!isSrcValid || !isTgtValid) {
    throw new Error(
      `bad_lang (sl: '${sl}', tl: '${tl}')`
    );
  }

  if (srcLang === tgtLang) {
    return { text };
  }

  // Tembak halaman Google Translate versi Mobile Web
  const url =
    `https://translate.google.com/m` +
    `?sl=${encodeURIComponent(srcLang)}` +
    `&tl=${encodeURIComponent(tgtLang)}` +
    `&q=${encodeURIComponent(text)}`;

  try {
    const html = await fetchText(url, {
      timeoutMs: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Android 10; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    // Ekstrak teks hasil terjemahan dari div khusus
    const match = html.match(
      /<div class="(?:result-container|t0)">([\s\S]*?)<\/div>/i
    );

    if (match && match[1]) {
      const cleanText = decodeEntities(
        match[1].trim()
      );

      return {
        text: cleanText,
      };
    }

    throw new Error("parse_failed");
  } catch (err) {
    throw new Error(
      `gtx_fetch_failed: ${err.message}`
    );
  }
}

// ==================================================================
// AI Overview
// ==================================================================

export async function askAI(
  env,
  {
    q,
    context,
    signal = null,
  } = {}
) {
  if (!env?.GROQ_API_KEY) {
    throw new Error("missing_groq_key");
  }

  const payload = {
    model: GROQ_MODEL,

    messages: [
      {
        role: "system",
        content:
          `Kamu adalah AI Search Overview, sebelum menjawab pastikan kamu baca dahulu ${context || ""}. Jangan pernah gunakan sapaan. 
WAJIB berikan jawaban dengan format persis seperti ini (gunakan '---' sebagai pemisah):
[Paragraf definisi singkat tentang topik, maksimal 3 kalimat]
---
[Ketik SATU judul sub-topik yang paling relevan dengan pertanyaan, misal: 'Karakteristik [Topik]' atau 'Penyebab [Topik]']
---
[Berikan 3-5 poin penting (bullet). Awali setiap baris dengan '- **[Kata Kunci]:**' diikuti penjelasannya]
---
[Berikan 1-2 kalimat kesimpulan penutup ringkas]`,
      },

      {
        role: "user",
        content: q,
      },
    ],

    temperature: 0.3,
  };

  const data = await fetchJson(
    GROQ_URL,
    {
      timeoutMs: 25000,

      signal,

      init: {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${env.GROQ_API_KEY}`,
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(payload),
      },
    }
  );

  return {
    text: String(
      data?.choices?.[0]?.message?.content || ""
    ).trim(),
  };
}

// ==================================================================
// WIDGET COMPATIBILITY ALIASES
// ==================================================================
//
// widgets.js memakai nama:
//   upstream.getPlayStore()
//   upstream.getAI()
//
// API/client lama tetap memakai:
//   getPlayStoreSearch()
//   askAI()
//
// Jadi fungsi lama tidak dihapus.
// ==================================================================

export function getAI(
  env,
  {
    q,
    context,
    signal = null,
  } = {}
) {
  return askAI(env, {
    q,
    context,
    signal,
  });
}

// ------------------------------------------------------------------
// Play Store Scraper (Pure Fetch - Tanpa NPM Package)
// ------------------------------------------------------------------

/**
 * Mengambil detail game/aplikasi berdasarkan package ID dari Play Store
 */
export async function getPlayStoreDetails(
  env,
  {
    id,
    hl = "id",
    signal = null,
  } = {}
) {
  if (!id) return null;

  const targetUrl =
    `https://play.google.com/store/apps/details` +
    `?id=${encodeURIComponent(id)}` +
    `&hl=${hl}`;

  try {
    const html = await fetchText(targetUrl, {
      timeoutMs: 10000,
      signal,

      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language":
          "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    // Ekstrak data JSON-LD yang tertanam di HTML Play Store
    const ldMatch = html.match(
      /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i
    );

    let ldData = null;

    if (ldMatch && ldMatch[1]) {
      try {
        ldData = JSON.parse(ldMatch[1]);
      } catch (e) {}
    }

    if (ldData) {
      return {
        appId: id,

        title:
          ldData.name || null,

        url:
          ldData.url || targetUrl,

        icon:
          ldData.image || null,

        developer:
          ldData.author?.name || null,

        rating:
          ldData.aggregateRating?.ratingValue
            ? parseFloat(
                ldData.aggregateRating.ratingValue
              ).toFixed(1)
            : null,

        ratingCount:
          ldData.aggregateRating?.ratingCount ||
          null,

        price:
          ldData.offers?.[0]?.price ||
          "Free",

        category:
          ldData.applicationCategory ||
          null,

        description:
          ldData.description ||
          null,
      };
    }

    return null;
  } catch (err) {
    // AbortError juga sengaja ditangani sebagai kegagalan biasa.
    // widgets.js akan menghentikan widget saat timeout.
    console.error(
      "[PlayStoreDetails]",
      err
    );

    return null;
  }
}

/**
 * Mencari game/aplikasi di Play Store
 * dan mengembalikan N hasil teratas lengkap.
 */
export async function getPlayStoreSearch(
  env,
  {
    q,
    limit = 3,
    hl = "id",
    signal = null,
  } = {}
) {
  const searchUrl =
    `https://play.google.com/store/search` +
    `?q=${encodeURIComponent(q)}` +
    `&c=apps` +
    `&hl=${hl}`;

  try {
    const html = await fetchText(searchUrl, {
      timeoutMs: 12000,
      signal,

      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language":
          "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    // Cari ID aplikasi
    // (/store/apps/details?id=...)
    const appRegex =
      /\/store\/apps\/details\?id=([a-zA-Z0-9_.]+)/g;

    const foundIds = new Set();

    let match;

    while (
      (match = appRegex.exec(html)) !== null
    ) {
      if (match[1]) {
        foundIds.add(match[1]);
      }
    }

    // Ambil sejumlah limit
    // ID teratas
    const topIds =
      Array.from(foundIds).slice(0, limit);

    if (!topIds.length) {
      return [];
    }

    // Fetch detail paralel.
    // Signal yang sama diteruskan supaya timeout
    // widgets.js benar-benar bisa menghentikan request.
    const results = await Promise.all(
      topIds.map((id) =>
        getPlayStoreDetails(env, {
          id,
          hl,
          signal,
        })
      )
    );

    return results.filter(Boolean);
  } catch (err) {
    console.error(
      "[PlayStoreSearch]",
      err
    );

    return [];
  }
}

/**
 * Nama yang dipakai widgets.js.
 *
 * widgets.js:
 *   upstream.getPlayStore(env, { q, hl, signal })
 *
 * Return:
 *   array aplikasi
 */
export function getPlayStore(
  env,
  {
    q,
    limit = 3,
    hl = "id",
    signal = null,
  } = {}
) {
  return getPlayStoreSearch(env, {
    q,
    limit,
    hl,
    signal,
  });
}