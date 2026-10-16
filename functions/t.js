export default {
  async fetch(request) {
    // Handling Preflight CORS dari browser
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

    // Daftar beberapa instance SearXNG publik yang aktif
    const PUBLIC_INSTANCES = [
      "https://searx.be",
      "https://search.bus-hit.me",
      "https://searx.priv.pw"
    ];

    // Pilih instance secara acak / fallback
    const targetInstance = PUBLIC_INSTANCES[Math.floor(Math.random() * PUBLIC_INSTANCES.length)];
    const targetUrl = `${targetInstance}/search?q=${encodeURIComponent(query)}&format=json`;

    try {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });

      if (!response.ok) throw new Error("Gagal mengambil data dari instance publik");

      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*" // Bebas CORS di browser!
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*" 
        }
      });
    }
  }
};
