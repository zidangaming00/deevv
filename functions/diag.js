// functions/diag.js
// SEMENTARA: hapus file ini setelah selesai diagnosa.
// Route: GET /diag

export async function onRequestGet({ request, env }) {
  const base = String(env.WEB_API_BASE || "https://datasearch.searchdata.workers.dev").replace(/\/+$/, "");
  const scraper = String(env.SCRAPER_API_BASE || "https://deevv-api-production.up.railway.app").replace(/\/+$/, "");
  const stamp = Date.now();
  const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  // [nama, builder URL, header]
  const probes = [
    // --- kontrol: host yang tidak ada hubungannya dengan backend kamu ---
    ["kontrol: cf trace", () => "https://www.cloudflare.com/cdn-cgi/trace", {}],
    ["kontrol: example.com", () => "https://example.com/", {}],

    // --- worker datasearch ---
    ["web: tanpa header", (q) => `${base}/api?q=${q}&page=1`, {}],
    ["web: Accept json", (q) => `${base}/api?q=${q}&page=1`, { Accept: "application/json" }],
    ["web: UA browser", (q) => `${base}/api?q=${q}&page=1`, { "User-Agent": UA, Accept: "application/json" }],

    // --- Railway scraper ---
    ["news: Accept json", (q) => `${scraper}/api/search?q=${q}&type=news`, { Accept: "application/json" }],
    ["news: UA browser", (q) => `${scraper}/api/search?q=${q}&type=news`, { "User-Agent": UA, Accept: "application/json" }],
  ];

  const run = async ([name, build, headers], i) => {
    const t0 = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(build(`tes${stamp}${i}`), { headers, signal: ctrl.signal });
      const body = await res.text();
      return {
        name,
        status: res.status,
        ms: Date.now() - t0,
        bytes: body.length,
        head: body.slice(0, 300),
      };
    } catch (err) {
      return { name, error: String(err?.message || err), ms: Date.now() - t0 };
    } finally {
      clearTimeout(timer);
    }
  };

  const results = await Promise.all(probes.map(run));

  return new Response(
    JSON.stringify(
      {
        base,
        scraper,
        hasToken: !!env.UPSTREAM_TOKEN,
        hasWebBaseEnv: !!env.WEB_API_BASE,
        hasScraperEnv: !!env.SCRAPER_API_BASE,
        // datacenter Cloudflare tempat fungsi ini berjalan
        colo: request.cf?.colo || null,
        results,
      },
      null,
      2
    ),
    {
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "Cache-Control": "no-store",
      },
    }
  );
}
