import createSearchModule from './search_engine.js';
import searchWasmModule from './search_engine.wasm'; // Di-load sebagai WebAssembly.Module oleh Cloudflare

let loadedModule = null;

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);

  const query = url.searchParams.get('q') || '';
  const hl = url.searchParams.get('hl') || 'en-US';
  const timeFilter = url.searchParams.get('tbs') || '';

  if (!query.trim()) {
    return new Response(
      JSON.stringify({ error: "Parameter 'q' wajib diisi." }), 
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    if (!loadedModule) {
      // Pass langsung objek WebAssembly.Module ke Emscripten
      loadedModule = await createSearchModule({
        wasmModule: searchWasmModule
      });

      // Load database ke virtual filesystem Emscripten (MEMFS)
      const dbUrl = new URL('/search_engine.db', request.url);
      const dbResponse = await fetch(dbUrl);
      if (!dbResponse.ok) {
        throw new Error("Gagal mengunduh file search_engine.db dari folder public");
      }
      const dbBuffer = await dbResponse.arrayBuffer();

      loadedModule.FS.writeFile('/search_engine.db', new Uint8Array(dbBuffer));
    }

    // Panggil fungsi C++ searchJson
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
      JSON.stringify({ error: err.message || "Terjadi kesalahan pada server WASM." }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
