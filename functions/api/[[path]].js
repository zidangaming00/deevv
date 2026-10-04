// functions/api/[[path]].js
// Route: /api/web | /api/videos | /api/news | /api/images | /api/suggest | /api/instant  (GET)
//        /api/translate | /api/ai                                                       (POST)
//
// Frontend (script.js) hanya memanggil endpoint ini. Alamat sumber data & kunci API
// tidak pernah dikirim ke browser.

import {
  guardRequest,
  jsonResponse,
  clampInt,
  cleanQuery,
  getWeb,
  getVideos,
  getNews,
  getImages,
  getInstant,
  getSuggest,
  translateText,
  askAI,
} from "../_lib/upstream.js";

// run() mengembalikan Promise data, atau null kalau parameter tidak valid.
const GET_ROUTES = {
  web: {
    ttl: 300,
    run: (env, sp) => {
      const q = cleanQuery(sp.get("q"));
      if (!q) return null;
      return getWeb(env, {
        q,
        page: clampInt(sp.get("page"), 1, 91, 1),
        hl: sp.get("hl"),
      });
    },
  },
  videos: {
    ttl: 600,
    run: (env, sp) => {
      const q = cleanQuery(sp.get("q"));
      if (!q) return null;
      return getVideos(env, { q, limit: clampInt(sp.get("limit"), 1, 100, 50) });
    },
  },
  news: {
    ttl: 300,
    run: (env, sp) => {
      const q = cleanQuery(sp.get("q"));
      if (!q) return null;
      return getNews(env, { q, hl: sp.get("hl") });
    },
  },
  images: {
    ttl: 600,
    run: (env, sp) => {
      const q = cleanQuery(sp.get("q"));
      if (!q) return null;
      return getImages(env, {
        q,
        page: clampInt(sp.get("page"), 1, 10, 1),
        hl: sp.get("hl"),
        start: sp.get("start") !== null ? clampInt(sp.get("start"), 0, 200, 0) : null,
        num: clampInt(sp.get("num"), 1, 40, 20),
      });
    },
  },
  suggest: {
    ttl: 120,
    run: (env, sp) => {
      const q = cleanQuery(sp.get("q"), 150);
      if (!q) return null;
      return getSuggest(env, { q });
    },
  },
  instant: {
    ttl: 3600,
    run: (env, sp) => {
      const q = cleanQuery(sp.get("q"), 150);
      if (!q) return null;
      return getInstant(env, { q });
    },
  },
};

const POST_ROUTES = {
  translate: async (env, body) => {
    const text = String(body?.text || "").slice(0, 1000).trim();
    if (!text) return null;
    return translateText({ text, sl: String(body?.sl || ""), tl: String(body?.tl || "") });
  },
  ai: async (env, body) => {
    const q = cleanQuery(body?.q, 200);
    if (q.length < 4) return null;
    const context = String(body?.context || "").slice(0, 2500);
    return askAI(env, { q, context });
  },
};

async function readJsonBody(request) {
  const len = parseInt(request.headers.get("content-length") || "0", 10);
  if (len > 16 * 1024) return null;
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const { request, env, params } = context;

  const denied = guardRequest(request);
  if (denied) return denied;

  const route = Array.isArray(params.path) ? params.path[0] : params.path;
  const url = new URL(request.url);

  try {
    // ---------- GET ----------
    if (request.method === "GET" && GET_ROUTES[route]) {
      const { ttl, run } = GET_ROUTES[route];

      let cache = null;
      let cacheKey = null;
      try {
        cache = caches.default;
        cacheKey = new Request(url.toString(), { method: "GET" });
        const hit = await cache.match(cacheKey);
        if (hit) return hit;
      } catch {
        cache = null; // mis. saat dev lokal tanpa Cache API
      }

      const job = run(env, url.searchParams);
      if (!job) return jsonResponse({ error: "bad_request" }, { status: 400 });

      const data = await job;
      const response = jsonResponse(data, { ttl });
      if (cache && cacheKey) {
        context.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));
      }
      return response;
    }

    // ---------- POST ----------
    if (request.method === "POST" && POST_ROUTES[route]) {
      const body = await readJsonBody(request);
      if (!body) return jsonResponse({ error: "bad_request" }, { status: 400 });

      const result = await POST_ROUTES[route](env, body);
      if (!result) return jsonResponse({ error: "bad_request" }, { status: 400 });
      return jsonResponse(result);
    }

    if (GET_ROUTES[route] || POST_ROUTES[route]) {
      return jsonResponse({ error: "method_not_allowed" }, { status: 405 });
    }
    return jsonResponse({ error: "not_found" }, { status: 404 });
  } catch (err) {
    // Detail error hanya masuk log server, tidak dikirim ke browser.
    console.error(`[api/${route}]`, err && err.message ? err.message : err);
    return jsonResponse({ error: "upstream_error" }, { status: 502 });
  }
}
