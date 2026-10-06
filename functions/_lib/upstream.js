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

const ALLOWED_LANGS = new Set(["en", "id", "es", "fr", "de", "ja", "ko", "zh"]);

const webBase = (env) => String(env?.WEB_API_BASE || DEFAULT_WEB_BASE).replace(/\/+$/, "");
const scraperBase = (env) => String(env?.SCRAPER_API_BASE || DEFAULT_SCRAPER_BASE).replace(/\/+$/, "");

// ------------------------------------------------------------------
// Helper umum
// ------------------------------------------------------------------
export function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function cleanQuery(q, maxLen = 300) {
  return String(q || "").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

export function jsonResponse(data, { status = 200, ttl = 0 } = {}) {
  const headers = {
    "Content-Type": "application/json; charset=UTF-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": ttl > 0 ? `public, max-age=${Math.min(ttl, 60)}, s-maxage=${ttl}` : "no-store",
  };
  return new Response(JSON.stringify(data), { status, headers });
}

// Hanya izinkan request yang datang dari halaman milik sendiri (fetch same-origin).
// Membuka /api/... langsung di address bar atau dari situs lain akan ditolak.
// Catatan: ini bukan pengaman mutlak (curl bisa memalsukan header),
// untuk itu pakai juga Rate Limiting Rule di Cloudflare WAF.
export function guardRequest(request) {
  const deny = () => jsonResponse({ error: "forbidden" }, { status: 403 });
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

  // Bagian sec-fetch-mode & sec-fetch-site dihapus agar bisa dites via browser address bar
  return null;
}


function ownHeaders(env) {
  const h = { Accept: "application/json" };
  if (env?.UPSTREAM_TOKEN) h["x-api-key"] = env.UPSTREAM_TOKEN;
  return h;
}

async function fetchJson(url, { headers = {}, init = {}, timeoutMs = 10000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { ...headers, ...(init.headers || {}) },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`upstream_${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const langFilter = (hl) => (hl === "id" ? "&gl=id&lr=lang_id&hl=id" : "");

// ------------------------------------------------------------------
// Sumber data
// ------------------------------------------------------------------

// Tab "Semua" (termasuk tombol "Hasil penelusuran lainnya": page = 1, 11, 21)
export function getWeb(env, { q, page = 1, hl }) {
  const url = `${webBase(env)}/api?q=${encodeURIComponent(q)}${langFilter(hl)}&page=${page}`;
  return fetchJson(url, { headers: ownHeaders(env) });
}

// Tab "Video" dan widget video di tab Semua
export function getVideos(env, { q, limit = 50 }) {
  const url = `${webBase(env)}/api?q=${encodeURIComponent(q)}&tbm=vid&maxResults=${limit}`;
  return fetchJson(url, { headers: ownHeaders(env) });
}

// Tab "Berita"
export function getNews(env, { q, hl }) {
  const url = `${scraperBase(env)}/api/search?q=${encodeURIComponent(q)}${langFilter(hl)}&type=news`;
  return fetchJson(url, { headers: ownHeaders(env), timeoutMs: 15000 });
}

// Tab "Gambar"
export function getImages(env, { q, page = 1, hl, start = null, num = 20 }) {
  // imgtest.js memakai start + num=20; pemanggil lama masih bisa pakai page.
  const paging = start !== null ? `&start=${start}&num=${num}` : `&page=${page}`;
  const url = `${scraperBase(env)}/api/search?q=${encodeURIComponent(q)}${langFilter(hl)}&type=images${paging}`;
  return fetchJson(url, { headers: ownHeaders(env), timeoutMs: 20000 });
}

// Kartu jawaban instan (Wikipedia dsb.)
export function getInstant(env, { q }) {
  return fetchJson(`${webBase(env)}/?q=${encodeURIComponent(q)}`, { headers: ownHeaders(env) });
}

export function getSuggest(env, { q }) {
  return fetchJson(`${webBase(env)}/suggest?q=${encodeURIComponent(q)}`, { headers: ownHeaders(env), timeoutMs: 5000 });
}

// Widget penerjemah (MyMemory, tanpa API key)
const MM_MAX_BYTES = 450; // batas MyMemory sekitar 500 byte per request

const byteLen = (s) => new TextEncoder().encode(s).length;

// Pecah teks panjang per kalimat supaya tiap potongan <= MM_MAX_BYTES
function splitForMyMemory(text) {
  const sentences = text.match(/[^.!?。！？\n]+[.!?。！？]*\s*/g) || [text];
  const chunks = [];
  let cur = "";
  const push = () => { if (cur.trim()) chunks.push(cur.trim()); cur = ""; };

  for (const s of sentences) {
    if (byteLen(cur + s) <= MM_MAX_BYTES) { cur += s; continue; }
    push();
    if (byteLen(s) <= MM_MAX_BYTES) { cur = s; continue; }
    // satu kalimat terlalu panjang: potong paksa per karakter
    let piece = "";
    for (const ch of s) {
      if (byteLen(piece + ch) > MM_MAX_BYTES) { chunks.push(piece.trim()); piece = ""; }
      piece += ch;
    }
    cur = piece;
  }
  push();
  return chunks;
}

const decodeEntities = (s) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
   .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
   .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

async function myMemoryChunk(chunk, sl, tl, email) {
  const code = (c) => (c === "zh" ? "zh-CN" : c);
  let url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${encodeURIComponent(code(sl) + "|" + code(tl))}`;
  if (email) url += `&de=${encodeURIComponent(email)}`;

  const data = await fetchJson(url, { timeoutMs: 8000 });
  const status = Number(data?.responseStatus);
  const out = data?.responseData?.translatedText;
  if (status === 429 || data?.quotaFinished) throw new Error("mymemory_quota");
  if (status !== 200 || !out) throw new Error(`mymemory_${status || "empty"}`);
  return decodeEntities(String(out));
}

export async function translateText({ text, sl, tl, env }) {
  if (!ALLOWED_LANGS.has(sl) || !ALLOWED_LANGS.has(tl)) throw new Error("bad_lang");
  if (sl === tl) return { text };

  const email = env?.MYMEMORY_EMAIL || ""; // opsional: kuota 5.000 -> 50.000 karakter/hari
  const chunks = splitForMyMemory(text);
  const parts = await Promise.all(
  chunks.map((c) =>
    myMemoryChunk(c, sl, tl, email).catch((e) => { throw new Error("mymemory:" + e.message); })
  )
);
  return { text: parts.join(" ") };
}

// AI Overview (kunci Groq hanya ada di server)
export async function askAI(env, { q, context }) {
  if (!env?.GROQ_API_KEY) throw new Error("missing_groq_key");

  const payload = {
    model: GROQ_MODEL,
    messages: [
      {
        role: "system",
        content: `Kamu adalah AI Search Overview, sebelum menjawab pastikan kamu baca dahulu ${context || ""}. Jangan pernah gunakan sapaan. 
WAJIB berikan jawaban dengan format persis seperti ini (gunakan '---' sebagai pemisah):
[Paragraf definisi singkat tentang topik, maksimal 3 kalimat]
---
[Ketik SATU judul sub-topik yang paling relevan dengan pertanyaan, misal: 'Karakteristik [Topik]' atau 'Penyebab [Topik]']
---
[Berikan 3-5 poin penting (bullet). Awali setiap baris dengan '- **[Kata Kunci]:**' diikuti penjelasannya]
---
[Berikan 1-2 kalimat kesimpulan penutup ringkas]`,
      },
      { role: "user", content: q },
    ],
    temperature: 0.3,
  };

  const data = await fetchJson(GROQ_URL, {
    timeoutMs: 25000,
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  });

  return { text: String(data?.choices?.[0]?.message?.content || "").trim() };
}

// ------------------------------------------------------------------
// Play Store Scraper (Pure Fetch - Tanpa NPM Package)
// ------------------------------------------------------------------

/**
 * Mengambil detail game/aplikasi berdasarkan package ID dari Play Store
 */
export async function getPlayStoreDetails(env, { id, hl = "id" }) {
  if (!id) return null;
  const targetUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(id)}&hl=${hl}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);

  try {
    const res = await fetch(targetUrl, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
      }
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Ekstrak data JSON-LD yang tertanam di HTML Play Store
    const ldMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    let ldData = null;
    if (ldMatch && ldMatch[1]) {
      try {
        ldData = JSON.parse(ldMatch[1]);
      } catch (e) {}
    }

    if (ldData) {
      return {
        appId: id,
        title: ldData.name || null,
        url: ldData.url || targetUrl,
        icon: ldData.image || null,
        developer: ldData.author?.name || null,
        rating: ldData.aggregateRating?.ratingValue ? parseFloat(ldData.aggregateRating.ratingValue).toFixed(1) : null,
        ratingCount: ldData.aggregateRating?.ratingCount || null,
        price: ldData.offers?.[0]?.price || "Free",
        category: ldData.applicationCategory || null,
        description: ldData.description || null
      };
    }

    return null;
  } catch (err) {
    console.error("[PlayStoreDetails]", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Mencari game di Play Store dan mengembalikan N hasil teratas lengkap
 */
export async function getPlayStoreSearch(env, { q, limit = 3, hl = "id" }) {
  const searchUrl = `https://play.google.com/store/search?q=${encodeURIComponent(q)}&c=apps&hl=${hl}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);

  try {
    const res = await fetch(searchUrl, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
      }
    });

    if (!res.ok) return [];
    const html = await res.text();

    // Cari ID aplikasi (/store/apps/details?id=...) dari HTML hasil pencarian
    const appRegex = /\/store\/apps\/details\?id=([a-zA-Z0-9_.]+)/g;
    const foundIds = new Set();
    let match;

    while ((match = appRegex.exec(html)) !== null) {
      if (match[1]) {
        foundIds.add(match[1]);
      }
    }

    // Ambil sejumlah limit (default 3 ID teratas)
    const topIds = Array.from(foundIds).slice(0, limit);

    // Fetch detail paralel untuk hasil pencarian teratas
    const results = await Promise.all(
      topIds.map(id => getPlayStoreDetails(env, { id, hl }))
    );

    return results.filter(Boolean);
  } catch (err) {
    console.error("[PlayStoreSearch]", err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}
