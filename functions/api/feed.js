// functions/api/feed.js
// Proxy ringan di server untuk feed publik yang tidak mengirim header CORS (jadi tidak bisa dipanggil langsung dari browser).
// URL tujuan dibangun di sini dari parameter yang sudah divalidasi, jadi ini bukan open proxy. Hasil sukses di-cache 5 menit di edge.
//
//   /api/feed?type=trends&geo=ID                      -> RSS Google Trends (XML apa adanya)
//   /api/feed?type=news&lang=id&topic=TOP|NATION|WORLD|BUSINESS|TECHNOLOGY|SPORTS|ENTERTAINMENT|SCIENCE|HEALTH
//   /api/feed?type=news&lang=id&q=kata+kunci          -> JSON { src, items:[{ t, u, s, p, i }] }
//
// Berita: Google News dulu; kalau gagal (diblokir/dibatasi) otomatis jatuh ke Bing News.
// Kalau semuanya gagal, balasannya 502 berisi JSON { err, tried:[{ s, status }] } supaya penyebabnya kelihatan.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TOPICS = new Set(['NATION', 'WORLD', 'BUSINESS', 'TECHNOLOGY', 'SPORTS', 'ENTERTAINMENT', 'SCIENCE', 'HEALTH']);
const TTL = 300, MAX = 100;
const BING_Q = {
  id: { TOP: 'berita terbaru hari ini', NATION: 'berita Indonesia', WORLD: 'berita dunia', BUSINESS: 'berita ekonomi bisnis', TECHNOLOGY: 'berita teknologi', SPORTS: 'berita olahraga', ENTERTAINMENT: 'berita hiburan', SCIENCE: 'berita sains', HEALTH: 'berita kesehatan' },
  en: { TOP: 'latest news today', NATION: 'US news', WORLD: 'world news', BUSINESS: 'business news', TECHNOLOGY: 'technology news', SPORTS: 'sports news', ENTERTAINMENT: 'entertainment news', SCIENCE: 'science news', HEALTH: 'health news' }
};

const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
const bad = m => new Response(m, { status: 400 });

// Parser RSS sederhana (Workers tidak punya DOMParser). Entitas HTML dibiarkan, klien yang mendekodenya.
const unwrap = v => v.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim();
const tag = (s, n) => { const m = s.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i')); return m ? unwrap(m[1]) : ''; };
const itemsOf = xml => xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
const iso = v => { const d = new Date(v); return isNaN(d) ? '' : d.toISOString(); };

const parseGoogle = xml => itemsOf(xml).map(it => ({ t: tag(it, 'title'), u: tag(it, 'link'), s: tag(it, 'source'), p: iso(tag(it, 'pubDate')), i: '' }));
const parseBing = xml => itemsOf(xml).map(it => {
  const link = tag(it, 'link'); let u = link;
  try { u = new URL(link.replace(/&amp;/g, '&')).searchParams.get('url') || link; } catch (_) {}
  return { t: tag(it, 'title'), u, s: tag(it, 'News:Source'), p: iso(tag(it, 'pubDate')), i: tag(it, 'News:Image') };
});

async function grab(url, name, tried) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml, text/xml, */*', 'Accept-Language': 'id,en;q=0.8' }, redirect: 'follow' });
    tried.push({ s: name, status: r.status });
    if (!r.ok) return '';
    const x = await r.text();
    return x.includes('<item') ? x : '';
  } catch (_) {
    tried.push({ s: name, status: 'error' });
    return '';
  }
}

export async function onRequestGet({ request, waitUntil }) {
  const u = new URL(request.url), type = u.searchParams.get('type');
  const cache = caches.default, key = new Request(request.url);
  const hit = await cache.match(key);
  if (hit) return hit;

  const tried = [];
  let res;

  if (type === 'trends') {
    const geo = (u.searchParams.get('geo') || 'ID').toUpperCase();
    if (!/^[A-Z]{2}$/.test(geo)) return bad('geo');
    const xml = await grab(`https://trends.google.com/trending/rss?geo=${geo}`, 'trends', tried);
    if (!xml) return json({ err: 'upstream', tried }, 502);
    res = new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': `public, max-age=${TTL}` } });
  } else if (type === 'news') {
    const lang = u.searchParams.get('lang') === 'en' ? 'en' : 'id';
    const q = (u.searchParams.get('q') || '').trim().slice(0, 100);
    const topic = (u.searchParams.get('topic') || 'TOP').toUpperCase();
    if (!q && topic !== 'TOP' && !TOPICS.has(topic)) return bad('topic');

    const loc = lang === 'en' ? 'hl=en-US&gl=US&ceid=US:en' : 'hl=id&gl=ID&ceid=ID:id';
    const g = q ? `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${loc}`
      : topic === 'TOP' ? `https://news.google.com/rss?${loc}`
      : `https://news.google.com/rss/headlines/section/topic/${topic}?${loc}`;
    const bq = q || BING_Q[lang][topic];
    const b = `https://www.bing.com/news/search?q=${encodeURIComponent(bq)}&format=rss&cc=${lang === 'en' ? 'US' : 'ID'}&setlang=${lang}`;

    let list = [], src = '';
    const gx = await grab(g, 'google', tried);
    if (gx) { list = parseGoogle(gx); src = 'google'; }
    if (!list.length) {
      const bx = await grab(b, 'bing', tried);
      if (bx) { list = parseBing(bx); src = 'bing'; }
    }
    if (!list.length) return json({ err: 'upstream', tried }, 502);
    res = json({ src, items: list.slice(0, MAX) }, 200, { 'Cache-Control': `public, max-age=${TTL}` });
  } else {
    return bad('type');
  }

  waitUntil(cache.put(key, res.clone()));
  return res;
}
