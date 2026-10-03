// search.js - Cloudflare Worker / Serverless Backend

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") || "";
    const tab = url.searchParams.get("tab") || "all";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const isApiRequest = url.pathname.startsWith("/api/search") || request.headers.get("accept")?.includes("application/json");

    if (!query) {
      if (isApiRequest) {
        return new Response(JSON.stringify({ error: "Query parameter 'q' is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response("Query required", { status: 400 });
    }

    try {
      // Route pemrosesan API berdasarkan Tab di Server Side
      let responseData = {};

      switch (tab) {
        case "images":
          responseData = await fetchImagesTab(query, page, env);
          break;
        case "videos":
          responseData = await fetchVideosTab(query, page, env);
          break;
        case "news":
          responseData = await fetchNewsTab(query, page, env);
          break;
        case "all":
        default:
          responseData = await fetchAllTab(query, page, env);
          break;
      }

      // Jika request datang dari fetch client-side (/api/search), kembalikan JSON
      if (isApiRequest) {
        return new Response(JSON.stringify(responseData), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=60"
          }
        });
      }

      // Jika request awal dari browser (SSR Navigation), render HTML lengkap
      const fullHTML = renderSSRPage(responseData, query, tab, page);
      return new Response(fullHTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });

    } catch (err) {
      console.error("Server Fetch Error:", err);
      return new Response(JSON.stringify({ error: "Internal Server Error", details: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};

// ==========================================
// SERVER-SIDE FETCHERS & INTEGRATIONS
// ==========================================

async function fetchAllTab(query, page, env) {
  // Eksekusi paralel di server untuk mempercepat respon Tab ALL
  const [webResults, aiData] = await Promise.all([
    fetchSearchEngineData(query, "all", page, env),
    page === 1 ? fetchGroqAIOverview(query, env.GROQ_API_KEY) : Promise.resolve(null)
  ]);

  return {
    tab: "all",
    query: query,
    page: page,
    aiOverview: aiData,
    results: webResults.items || [],
    widgets: webResults.widgets || {},
    relatedSearches: webResults.relatedSearches || [],
    pagination: webResults.pagination || {}
  };
}

async function fetchImagesTab(query, page, env) {
  const data = await fetchSearchEngineData(query, "images", page, env);
  return { tab: "images", query, page, results: data.items || [], pagination: data.pagination || {} };
}

async function fetchVideosTab(query, page, env) {
  const data = await fetchSearchEngineData(query, "videos", page, env);
  return { tab: "videos", query, page, results: data.items || [], pagination: data.pagination || {} };
}

async function fetchNewsTab(query, page, env) {
  const data = await fetchSearchEngineData(query, "news", page, env);
  return { tab: "news", query, page, results: data.items || [], pagination: data.pagination || {} };
}

// Logika pemanggilan Groq AI langsung dari serverless (Key Tersimpan Aman)
async function fetchGroqAIOverview(query, apiKey) {
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "Berikan ringkasan pencarian yang akurat, padat, dan format ringkas berbasis Markdown." },
          { role: "user", content: query }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error("Groq AI Error:", e);
    return null;
  }
}

// Gateway utama pemanggilan Search Provider (SerpApi / Custom Engine)
async function fetchSearchEngineData(query, tab, page, env) {
  // Ganti URL dan Param berikut sesuai Provider API yang Kamu gunakan di server
  const apiKey = env.SEARCH_API_KEY;
  const endpoint = `https://api.searchprovider.com/search?q=${encodeURIComponent(query)}&tab=${tab}&page=${page}&key=${apiKey}`;
  
  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`Provider returned ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Search Provider Error:", err);
    return { items: [], widgets: {}, relatedSearches: [], pagination: {} };
  }
}

// Helper untuk menyuntikkan data SSR ke HTML Shell tanpa merusak markup
function renderSSRPage(data, query, tab, page) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(query)} - Pencarian</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div id="app">
    <!-- Header & Search Input Shell -->
    <header class="search-header">
      <input type="text" id="search-input" value="${escapeHTML(query)}" />
      <div class="tabs-nav">
        <button class="tab-item ${tab === 'all' ? 'active' : ''}" data-tab="all">Semua</button>
        <button class="tab-item ${tab === 'images' ? 'active' : ''}" data-tab="images">Gambar</button>
        <button class="tab-item ${tab === 'videos' ? 'active' : ''}" data-tab="videos">Video</button>
        <button class="tab-item ${tab === 'news' ? 'active' : ''}" data-tab="news">Berita</button>
      </div>
    </header>

    <!-- Main Content Slot -->
    <main id="results-container">
      <div id="resultsListInner"></div>
    </main>
  </div>

  <!-- Inject SSR State ke Window -->
  <script>
    window.__SSR_DATA__ = ${JSON.stringify(data)};
  </script>
  <script src="/script.js" defer></script>
</body>
</html>`;
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
