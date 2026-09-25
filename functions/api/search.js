import createSearchModule from './search_engine.js';
import searchWasmModule from './search_engine.wasm';

let loadedModule = null;

export async function onRequestGet(context) {
  const { request, env } = context;

  // 1. Ambil query parameter dengan aman
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
      // Inisialisasi modul WASM
      loadedModule = await createSearchModule({
        wasmModule: searchWasmModule
      });

      // 2. Buat URL absolut untuk search_engine.db di folder public
      const dbTargetUrl = new URL('/search_engine.db', request.url);

      // 3. Fetch file database dari static asset Cloudflare Pages
      let dbResponse;
      if (env.ASSETS) {
        dbResponse = await env.ASSETS.fetch(dbTargetUrl);
      } else {
        dbResponse = await fetch(dbTargetUrl.href);
      }

      if (!dbResponse.ok) {
        throw new Error(`Gagal mengambil search_engine.db (Status: ${dbResponse.status})`);
      }

      const dbBuffer = await dbResponse.arrayBuffer();

      // 4. Simpan DB ke virtual filesystem Emscripten (MEMFS)
      loadedModule.FS.writeFile('/search_engine.db', new Uint8Array(dbBuffer));
    }

    // 5. Eksekusi pencarian C++
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
