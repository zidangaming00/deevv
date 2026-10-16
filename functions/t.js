export async function onRequest(context) {
  const { request } = context;

  // Handling Preflight CORS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q");

  if (!query) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      }
    });
  }

  // Daftar instance SearXNG publik yang umumnya stabil & mendukung API JSON
  const PUBLIC_INSTANCES = [
    "https://searx.be",
    "https://searxng.site",
    "https://search.bus-hit.me",
    "https://searx.priv.pw"
  ];

  let lastError = null;

  // Coba giliran satu per satu jika ada instance yang gagal/memblokir
  for (const instance of PUBLIC_INSTANCES) {
    try {
      const targetUrl = `${instance}/search?q=${encodeURIComponent(query)}&format=json`;
      
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json"
        }
      });

      // Cek apakah balasan benar-benar JSON
      const contentType = response.headers.get("content-type") || "";
      if (response.ok && contentType.includes("application/json")) {
        const data = await response.json();
        
        return new Response(JSON.stringify(data), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    } catch (err) {
      lastError = err;
    }
  }

  // Jika semua instance publik gagal
  return new Response(
    JSON.stringify({ 
      error: "Gagal mengambil data JSON dari seluruh instance SearXNG publik.",
      detail: lastError ? lastError.message : "Instance membalikkan respons HTML/Blocked." 
    }), 
    {
      status: 502,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      }
    }
  );
}
