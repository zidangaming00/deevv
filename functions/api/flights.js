// Cloudflare Pages Function: GET /api/flights?from=CGK&to=DPS&dep=2026-11-04&ret=2026-11-07
// Fetches the Google Flights page server-side and extracts the embedded results.
// Unofficial: Google can change the format or block Cloudflare IPs at any time.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const json = (o, s = 200, extra = {}) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', ...extra } });
const pad = n => String(n || 0).padStart(2, '0');
const hm = t => `${pad(t[0])}:${pad(t[1])}`;

export function parse(html) {
  const m = html.match(/AF_initDataCallback\(\{key:\s*'ds:1',[\s\S]*?data:(\[[\s\S]*?\]),\s*sideChannel/);
  if (!m) return null;
  const d = JSON.parse(m[1]), out = [];
  for (const grp of [d[2], d[3]]) {
    const arr = grp && grp[0]; if (!Array.isArray(arr)) continue;
    for (const k of arr) {
      try {
        const f = k[0], segs = f[2], a = segs[0], z = segs[segs.length - 1];
        out.push({ dep: hm(a[8]), arr: hm(z[10]), from: a[3], to: z[6], air: f[1] || [], st: segs.length - 1, mins: f[9], price: k[1][0][1] });
      } catch (_) {}
    }
  }
  return out.filter(x => x.price);
}

export async function onRequestGet({ request }) {
  const p = new URL(request.url).searchParams, from = p.get('from'), to = p.get('to'), dep = p.get('dep'), ret = p.get('ret'), dbg = p.get('debug');
  if (!/^[A-Z]{3}$/.test(from || '') || !/^[A-Z]{3}$/.test(to || '') || !/^\d{4}-\d{2}-\d{2}$/.test(dep || '') || (ret && !/^\d{4}-\d{2}-\d{2}$/.test(ret))) return json({ error: 'Bad parameters' }, 400);
  const q = `Flights from ${from} to ${to} on ${dep}` + (ret ? ` through ${ret}` : ' one way');
  const target = `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&curr=IDR&hl=en&gl=ID`;
  const cache = caches.default, ck = new Request(new URL(request.url).origin + '/__fl/' + encodeURIComponent(q));
  if (!dbg) { const hit = await cache.match(ck); if (hit) return hit; }
  let r, html;
  try {
    r = await fetch(target, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9', cookie: 'CONSENT=PENDING+987; SOCS=CAESHAgBEhJnd3NfMjAyMzA4MTAtMF9SQzIaAmRlIAEaBgiAo_CmBg' }, redirect: 'follow' });
    html = await r.text();
  } catch (e) { return json({ error: 'Could not reach Google' }, 502); }
  let flights = null; try { flights = parse(html); } catch (_) {}
  if (!flights) return json({ error: 'Could not read results (Google blocked or changed its format).', ...(dbg ? { status: r.status, final: r.url, len: html.length, hasDs1: html.includes("'ds:1'"), consent: /consent\./.test(r.url), head: html.slice(0, 300) } : {}) }, 502);
  const res = json({ flights }, 200, { 'cache-control': 'public, max-age=900' });
  if (!dbg && flights.length) await cache.put(ck, res.clone());
  return res;
}
