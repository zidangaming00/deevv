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

  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return deny();

  const mode = request.headers.get("sec-fetch-mode");
  if (mode === "navigate") return deny();

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== url.host) return deny();
    } catch {
      return deny();
    }
  }
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

// Widget penerjemah
export async function translateText({ text, sl, tl }) {
  if (!ALLOWED_LANGS.has(sl) || !ALLOWED_LANGS.has(tl)) throw new Error("bad_lang");
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
  const data = await fetchJson(url, { timeoutMs: 8000 });
  const out = (Array.isArray(data?.[0]) ? data[0] : []).map((s) => (s && s[0]) || "").join("");
  return { text: out };
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
