// functions/api/feed.js
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TOPICS = new Set(['NATION', 'WORLD', 'BUSINESS', 'TECHNOLOGY', 'SPORTS', 'ENTERTAINMENT', 'SCIENCE', 'HEALTH']);
const TTL = 300, MAX = 100;

// Pemetaan topik untuk pencarian GDELT jika tidak ada keyword (q)
const GDELT_TOPIC_MAP = {
  TOP: 'news',
  NATION: 'Indonesia news',
  WORLD: 'world news',
  BUSINESS: 'business economics',
  TECHNOLOGY: 'technology tech',
  SPORTS: 'sports match',
  ENTERTAINMENT: 'entertainment celebrity',
  SCIENCE: 'science research',
  HEALTH: 'health medical'
};

const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
const bad = m => new Response(m, { status: 400 });

async function grab(url, name, tried) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, redirect: 'follow' });
    tried.push({ s: name, status: r.status });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) {
    tried.push({ s: name, status: 'error' });
    return null;
  }
}

export async function onRequestGet({ request, waitUntil }) {
  const u = new URL(request.url), type = u.searchParams.get('type');
  const cache = caches.default, key = new Request(request.url);
  const hit = await cache.match(key);
  if (hit) return hit;

  const tried = [];
  let res;

  // 1. Fungsi Trends tetap dipertahankan aman tanpa terpengaruh
  if (type === 'trends') {
    const geo = (u.searchParams.get('geo') || 'ID').toUpperCase();
    if (!/^[A-Z]{2}$/.test(geo)) return bad('geo');
    
    // Menggunakan fungsi grab lama untuk Google Trends
    const r = await fetch(`https://trends.google.com/trending/rss?geo=${geo}`, { headers: { 'User-Agent': UA } });
    tried.push({ s: 'trends', status: r.status });
    if (!r.ok) return json({ err: 'upstream', tried }, 502);
    const xml = await r.text();

    res = new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': `public, max-age=${TTL}` } });
  
  // 2. Fungsi News dialihkan menggunakan GDELT agar search tetap lancar & anti blokir
  } else if (type === 'news') {
    const lang = u.searchParams.get('lang') === 'en' ? 'en' : 'id';
    const q = (u.searchParams.get('q') || '').trim().slice(0, 100);
    const topic = (u.searchParams.get('topic') || 'TOP').toUpperCase();
    if (!q && topic !== 'TOP' && !TOPICS.has(topic)) return bad('topic');

    // Tentukan query pencarian untuk GDELT
    const searchQuery = q ? q : GDELT_TOPIC_MAP[topic] || 'news';
    
    // GDELT Doc API Endpoint (Format JSON, mode article list)
    const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(searchQuery)}&mode=artlist&maxrecords=${MAX}&format=json`;

    const data = await grab(gdeltUrl, 'gdelt', tried);
    
    if (!data || !data.articles) {
      return json({ err: 'upstream', tried }, 502);
    }

    // Normalisasi format GDELT agar sesuai dengan struktur frontend Deeve News (t, u, s, p, i)
    const list = data.articles.map(art => ({
      t: art.title || '',
      u: art.url || '',
      s: art.domain || 'GDELT News',
      p: art.seendate ? new Date(art.seendate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')).toISOString() : '',
      i: art.socialimage || '' // GDELT menyediakan gambar/thumbnail asli!
    }));

    res = json({ src: 'gdelt', items: list.slice(0, MAX) }, 200, { 'Cache-Control': `public, max-age=${TTL}` });
  } else {
    return bad('type');
  }

  waitUntil(cache.put(key, res.clone()));
  return res;
}
