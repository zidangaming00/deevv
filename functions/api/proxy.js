// Cloudflare Pages Function: /api/proxy?url=...
// Letakkan di repo GitHub kamu sebagai functions/api/proxy.js (sejajar dengan flight.html).
// Karena satu domain dengan halamanmu, tidak ada masalah CORS sama sekali.
const ALLOW = ['api.airplanes.live', 'api.adsb.lol', 'opensky-network.org'];

export async function onRequestGet({ request }) {
  let t;
  try { t = new URL(new URL(request.url).searchParams.get('url')); }
  catch { return new Response('bad url', { status: 400 }); }
  if (t.protocol !== 'https:' || !ALLOW.includes(t.hostname)) return new Response('host not allowed', { status: 403 });
  const r = await fetch(t.toString(), { headers: { 'User-Agent': 'deevv-flight' }, cf: { cacheTtl: 10, cacheEverything: true } });
  return new Response(r.body, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json', 'Cache-Control': 'no-store' } });
}
