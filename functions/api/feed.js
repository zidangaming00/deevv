// functions/api/feed.js
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TTL = 300;

const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
const bad = m => new Response(m, { status: 400 });

export async function onRequestGet({ request, waitUntil }) {
  const u = new URL(request.url), type = u.searchParams.get('type');
  const cache = caches.default, key = new Request(request.url);
  const hit = await cache.match(key);
  if (hit) return hit;

  let res;

  if (type === 'trends') {
    const geo = (u.searchParams.get('geo') || 'ID').toUpperCase();
    if (!/^[A-Z]{2}$/.test(geo)) return bad('geo');
    
    try {
      const r = await fetch(`https://trends.google.com/trending/rss?geo=${geo}`, { 
        headers: { 'User-Agent': UA } 
      });
      
      if (!r.ok) return json({ err: 'upstream', status: r.status }, 502);
      const xml = await r.text();

      res = new Response(xml, { 
        headers: { 
          'Content-Type': 'application/xml; charset=utf-8', 
          'Cache-Control': `public, max-age=${TTL}` 
        } 
      });
    } catch (_) {
      return json({ err: 'upstream' }, 502);
    }
  } else {
    return bad('type');
  }

  waitUntil(cache.put(key, res.clone()));
  return res;
}
