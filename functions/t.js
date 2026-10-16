export async function onRequest(context) {
  const { request } = context;

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
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    // Menggunakan DuckDuckGo HTML Lite version yang ramah script
    const targetUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    const htmlText = await response.text();

    // Sederhana: Parsing hasil pencarian dari HTML DuckDuckGo
    // (Atau Anda bisa menggunakan API gratis lain jika punya)
    const results = [];
    const resultRegex = /<a class="result__url" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    
    let match;
    while ((match = resultRegex.exec(htmlText)) !== null && results.length < 10) {
      let rawUrl = match[1];
      // Bersihkan URL redirect DuckDuckGo jika perlu
      if (rawUrl.includes('uddg=')) {
        try {
          rawUrl = decodeURIComponent(rawUrl.split('uddg=')[1].split('&')[0]);
        } catch (e) {}
      }

      results.push({
        url: rawUrl,
        title: match[2].replace(/<[^>]*>?/gm, '').trim(),
        content: match[3].replace(/<[^>]*>?/gm, '').trim()
      });
    }

    return new Response(JSON.stringify({ results }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}
