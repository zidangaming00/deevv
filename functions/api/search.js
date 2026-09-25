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
      // Inisialisasi WASM
      loadedModule = await createSearchModule({
        wasmModule: searchWasmModule,
        locateFile: (path) => path
      });

      // Fetch search_engine.db dari folder public
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

      // Simpan ke virtual filesystem Emscripten (MEMFS)
      loadedModule.FS.writeFile('/search_engine.db', new Uint8Array(dbBuffer));
    }

    // Eksekusi fungsi C++
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
