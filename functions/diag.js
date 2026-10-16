// functions/diag.js  (v2)
// SEMENTARA: hapus file ini setelah selesai diagnosa.
// Route: GET /diag
// Probe dijalankan per batch (maks 4 paralel) supaya batas koneksi
// simultan Workers tidak membuat hasil bias.

export async function onRequestGet({ request, env }) {
  const base = String(env.WEB_API_BASE || "https://datasearch.searchdata.workers.dev").replace(/\/+$/, "");
  const scraper = String(env.SCRAPER_API_BASE || "https://deevv-api-production.up.railway.app").replace(/\/+$/, "");
  const stamp = Date.now();
  const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const TIMEOUT = 6000;

  // [nama, url, header]
  const probes = [
    // kontrol: host non-Cloudflare yang tidak ada hubungannya dengan kamu
    ["kontrol: httpbin", `https://httpbin.org/get?x=${stamp}`, { "User-Agent": UA }],
    ["kontrol: github zen", "https://api.github.com/zen", { "User-Agent": UA }],
    ["kontrol: jsonplaceholder", `https://jsonplaceholder.typicode.com/todos/1?x=${stamp}`, { "User-Agent": UA }],

    // worker: root dan /suggest (ringan) vs /api (berat)
    ["worker: root", `${base}/`, { "User-Agent": UA }],
    ["worker: suggest", `${base}/suggest?q=tes${stamp}`, { "User-Agent": UA }],
    ["worker: api", `${base}/api?q=tes${stamp}&page=1`, { "User-Agent": UA, Accept: "application/json" }],

    // railway: root vs /api/search
    ["railway: root", `${scraper}/`, { "User-Agent": UA }],
    ["railway: news", `${scraper}/api/search?q=tes${stamp}&type=news`, { "User-Agent": UA, Accept: "application/json" }],
  ];

  const run = async ([name, url, headers]) => {
    const t0 = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
      const ttfb = Date.now() - t0; // waktu sampai header diterima
      const body = await res.text();
      return { name, status: res.status, ttfb_ms: ttfb, total_ms: Date.now() - t0, bytes: body.length, head: body.slice(0, 160) };
    } catch (err) {
      return { name, error: String(err?.message || err), ms: Date.now() - t0 };
    } finally {
      clearTimeout(timer);
    }
  };

  const results = [];
  for (let i = 0; i < probes.length; i += 4) {
    const batch = await Promise.all(probes.slice(i, i + 4).map(run));
    results.push(...batch);
  }

  return new Response(
    JSON.stringify(
      {
        colo: request.cf?.colo || null,
        base,
        scraper,
        hasToken: !!env.UPSTREAM_TOKEN,
        results,
      },
      null,
      2
    ),
    { headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store" } }
  );
}
