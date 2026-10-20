// functions/api/feed.js
// Proxy ringan untuk RSS publik Google Trends dan Google News (feed ini tidak mengirim header CORS,
// jadi tidak bisa dipanggil langsung dari browser). URL tujuan dibangun di server dari parameter
// yang sudah divalidasi, jadi ini bukan open proxy. Hasil di-cache di edge selama 5 menit.
//
//   /api/feed?type=trends&geo=ID
//   /api/feed?type=news&lang=id&topic=TOP|NATION|WORLD|BUSINESS|TECHNOLOGY|SPORTS|ENTERTAINMENT|SCIENCE|HEALTH
//   /api/feed?type=news&lang=id&q=kata+kunci

const UA = 'Mozilla/5.0 (compatible; DeevvFeed/1.0)';
const TOPICS = new Set(['NATION', 'WORLD', 'BUSINESS', 'TECHNOLOGY', 'SPORTS', 'ENTERTAINMENT', 'SCIENCE', 'HEALTH']);
const TTL = 300;
const bad = msg => new Response(msg, { status: 400 });

export async function onRequestGet({ request, waitUntil }) {
  const u = new URL(request.url), type = u.searchParams.get('type');
  let upstream;

  if (type === 'trends') {
    const geo = (u.searchParams.get('geo') || 'ID').toUpperCase();
    if (!/^[A-Z]{2}$/.test(geo)) return bad('geo');
    upstream = `https://trends.google.com/trending/rss?geo=${geo}`;
  } else if (type === 'news') {
    const en = u.searchParams.get('lang') === 'en';
    const loc = en ? 'hl=en-US&gl=US&ceid=US:en' : 'hl=id&gl=ID&ceid=ID:id';
    const q = (u.searchParams.get('q') || '').trim().slice(0, 100);
    const topic = (u.searchParams.get('topic') || 'TOP').toUpperCase();
    if (q) upstream = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${loc}`;
    else if (topic === 'TOP') upstream = `https://news.google.com/rss?${loc}`;
    else if (TOPICS.has(topic)) upstream = `https://news.google.com/rss/headlines/section/topic/${topic}?${loc}`;
    else return bad('topic');
  } else {
    return bad('type');
  }

  const cache = caches.default, key = new Request(upstream);
  const hit = await cache.match(key);
  if (hit) return hit;

  let r;
  try {
    r = await fetch(upstream, { headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml, text/xml, */*' } });
  } catch (_) {
    return new Response('upstream error', { status: 502 });
  }
  if (!r.ok) return new Response('upstream ' + r.status, { status: 502 });

  const res = new Response(await r.text(), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': `public, max-age=${TTL}` }
  });
  waitUntil(cache.put(key, res.clone()));
  return res;
}
