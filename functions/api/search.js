import createSearchModule from './search_engine.js';
import searchWasmModule from './search_engine.wasm';

let loadedModule = null;

export async function onRequestGet(context) {
  const { request, env } = context;

  // 1. Parsing URL secara aman
  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "URL Request tidak valid." }), 
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

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
      // Inisialisasi modul WASM
      loadedModule = await createSearchModule({
        wasmModule: searchWasmModule
      });

      // 2. Buat URL bersih hanya memakai origin (mencegah error Invalid URL dari query string)
      const dbUrl = new URL('/search_engine.db', url.origin);
      
      // 3. Fetch file database menggunakan env.ASSETS (Fitur bawaan Cloudflare Pages)
      let dbResponse;
      if (env.ASSETS) {
        dbResponse = await env.ASSETS.fetch(dbUrl.toString());
      } else {
        dbResponse = await fetch(dbUrl.toString());
      }

      if (!dbResponse.ok) {
        throw new Error(`Gagal mengambil search_engine.db dari folder public (Status: ${dbResponse.status})`);
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
