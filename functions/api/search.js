import createSearchModule from './search_engine.js';
import searchWasmModule from './search_engine.wasm';

let loadedModule = null;

export async function onRequestGet(context) {
  const { request, env } = context;

  const reqUrl = new URL(request.url);
  const query = reqUrl.searchParams.get('q') || '';
  const hl = reqUrl.searchParams.get('hl') || 'en-US';
  const timeFilter = reqUrl.searchParams.get('tbs') || '';

  if (!query.trim()) {
    return new Response(
      JSON.stringify({ error: "Parameter 'q' wajib diisi." }), 
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    if (!loadedModule) {
      // Inisialisasi WASM khusus Cloudflare Workers
      loadedModule = await createSearchModule({
        instantiateWasm(imports, successCallback) {
          // Buat instance langsung dari modul WASM yang di-import statis
          const instance = new WebAssembly.Instance(searchWasmModule, imports);
          successCallback(instance);
          return instance.exports;
        }
      });

      // Fetch search_engine.db dari asset publik
      const dbUrl = `${reqUrl.origin}/search_engine.db`;
      
      let dbResponse;
      if (env.ASSETS) {
        dbResponse = await env.ASSETS.fetch(new Request(dbUrl));
      } else {
        dbResponse = await fetch(dbUrl);
      }

      if (!dbResponse.ok) {
        throw new Error(`Gagal mengambil search_engine.db (Status: ${dbResponse.status})`);
      }

      const dbBuffer = await dbResponse.arrayBuffer();

      // Simpan file DB ke virtual filesystem Emscripten (MEMFS)
      loadedModule.FS.writeFile('/search_engine.db', new Uint8Array(dbBuffer));
    }

    // Eksekusi fungsi C++ (C++ side: searchJson(std::string q, std::string hl, std::string tbs))
    const jsonResultString = loadedModule.searchJson(query, hl, timeFilter);

    return new Response(jsonResultString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ 
        error: err.message || "Terjadi kesalahan pada server WASM.",
        stack: err.stack || null 
      }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
