// functions/diag.js  (SEMENTARA, hapus setelah selesai)
export async function onRequestGet({ env }) {
  const base = String(env.WEB_API_BASE || "https://datasearch.searchdata.workers.dev").replace(/\/+$/, "");
  const scraper = String(env.SCRAPER_API_BASE || "https://deevv-api-production.up.railway.app").replace(/\/+$/, "");
  const stamp = Date.now();
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

  const probes = [
    ["web: tanpa header", (q) => `${base}/api?q=${q}&page=1`, {}],
    ["web: Accept json", (q) => `${base}/api?q=${q}&page=1`, { Accept: "application/json" }],
    ["web: UA browser", (q) => `${base}/api?q=${q}&page=1`, { "User-Agent": UA, Accept: "application/json" }],
    ["news: Accept json", (q) => `${scraper}/api/search?q=${q}&type=news`, { Accept: "application/json" }],
    ["news: UA browser", (q) => `${scraper}/api/search?q=${q}&type=news`, { "User-Agent": UA, Accept: "application/json" }],
  ];

  const run = async ([name, mk, headers], i) => {
    const t0 = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(mk(`tes${stamp}${i}`), { headers, signal: ctrl.signal });
      const body = await r.text();
      return { name, status: r.status, ms: Date.now() - t0, bytes: body.length, head: body.slice(0, 120) };
    } catch (e) {
      return { name, error: String(e?.message || e), ms: Date.now() - t0 };
    } finally {
      clearTimeout(timer);
    }
  };

  const results = await Promise.all(probes.map(run));
  return Response.json(
    {
      base, scraper,
      hasToken: !!env.UPSTREAM_TOKEN,
      hasWebBaseEnv: !!env.WEB_API_BASE,
      hasScraperEnv: !!env.SCRAPER_API_BASE,
      results,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}