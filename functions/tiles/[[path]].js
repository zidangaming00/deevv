// Cloudflare Pages Function: /api/tiles/:style/:z/:x/:y  (proxy MapTiler + cache)
// Key diambil dari env.MAPTILER_KEY (Secret di dashboard), tidak pernah dikirim ke browser.
const STYLES={
  streets:'maps/streets-v2/256/{z}/{x}/{y}.png',
  outdoor:'maps/outdoor-v2/256/{z}/{x}/{y}.png',
  hybrid:'maps/hybrid/256/{z}/{x}/{y}.jpg',
  satellite:'tiles/satellite-v2/{z}/{x}/{y}.jpg'
};
export async function onRequestGet({request,env,waitUntil}){
  const u=new URL(request.url),m=u.pathname.match(/^\/api\/tiles\/(\w+)\/(\d{1,2})\/(\d+)\/(\d+)$/);
  if(!m||!STYLES[m[1]])return new Response('Not found',{status:404});
  const[,st,z,x,y]=m;
  if(+z>22||+x>=2**+z||+y>=2**+z)return new Response('Bad tile',{status:400});
  if(!env.MAPTILER_KEY)return new Response('MAPTILER_KEY belum diset',{status:500});
  const cache=caches.default,key=new Request(u.origin+u.pathname);
  let res=await cache.match(key);if(res)return res;
  const path=STYLES[st].replace('{z}',z).replace('{x}',x).replace('{y}',y);
  const up=await fetch(`https://api.maptiler.com/${path}?key=${env.MAPTILER_KEY}`);
  if(!up.ok)return new Response('Upstream '+up.status,{status:up.status===404?404:502,headers:{'Cache-Control':'no-store'}});
  res=new Response(up.body,{headers:{'Content-Type':up.headers.get('Content-Type')||'image/png','Cache-Control':'public, max-age=604800'}});
  waitUntil(cache.put(key,res.clone()));
  return res;
}
