// functions/api/feed.js
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TTL = 300;

const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
const bad = m => new Response(m, { status: 400 });

// Parser RSS sederhana untuk mengubah XML Google Trends menjadi format JSON yang disesuaikan
const unwrap = v => v.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim();
const tag = (s, n) => { const m = s.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i')); return m ? unwrap(m[1]) : ''; };
const itemsOf = xml => xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
const iso = v => { const d = new Date(v); return isNaN(d) ? '' : d.toISOString(); };

const parseTrends = xml => itemsOf(xml).map(it => {
  const rawTraffic = tag(it, 'ht:approx_traffic');
  // Ubah format angka kaku ala google menjadi gaya indeks aktivitas organik Deevv
  let cleanTraffic = rawTraffic;
  const numVal = parseInt(rawTraffic.replace(/\D/g, ''), 10);
  if (numVal) {
    if (numVal >= 10000) cleanTraffic = 'Lonjakan Tinggi (Hot Index)';
    else if (numVal >= 1000) cleanTraffic = 'Aktivitas Signifikan';
    else cleanTraffic = 'Diskusi Publik Aktif';
  }

  const newsItems = [...it.getElementsByTagName('ht:news_item')].slice(0, 3).map(n => ({
    t: tag(n, 'ht:news_item_title'),
    u: tag(n, 'ht:news_item_url'),
    s: tag(n, 'ht:news_item_source') || 'Deevv Index'
  })).filter(n => n.t && n.u);

  return {
    q: tag(it, 'title'),
    v: cleanTraffic ? cleanTraffic : 'Trending Aktif',
    p: iso(tag(it, 'pubDate')),
    i: tag(it, 'ht:picture'),
    n: newsItems
  };
}).filter(x => x.q);

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
      
      // Parse dan ubah format data XML mentah menjadi JSON bersih berasa independen
      const list = parseTrends(xml);

      res = json(list, 200, { 
        Cache_Control: `public, max-age=${TTL}` 
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
