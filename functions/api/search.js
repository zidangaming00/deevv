import createSearchModule from './search_engine.js';
import searchWasmModule from './search_engine.wasm';

// Cache instance module agar tidak perlu di-load berulang kali di worker yang sama
let loadedModule = null;

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Ambil parameter dari URL: /api/search?q=keyword&hl=en-US&tbs=1h
  const query = url.searchParams.get('q') || '';
  const hl = url.searchParams.get('hl') || 'en-US';
  const timeFilter = url.searchParams.get('tbs') || '';

  if (!query.trim()) {
    return new Response(
      JSON.stringify({ error: "Parameter 'q' (query) wajib diisi." }), 
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 1. Inisialisasi Modul WASM jika belum ada di cache Worker
    if (!loadedModule) {
      loadedModule = await createSearchModule({
        instantiateWasm(imports, successCallback) {
          WebAssembly.instantiate(searchWasmModule, imports).then((instance) => {
            successCallback(instance);
          });
          return {};
        }
      });

      // 2. Load file database SQLite (search_engine.db)
      // Opsi A: Ambil dari Cloudflare R2 Bucket (Rekomendasi untuk file DB besar)
      // const dbObject = await env.MY_DB_BUCKET.get('search_engine.db');
      // const dbBuffer = await dbObject.arrayBuffer();

      // Opsi B: Fetch dari URL / Static Assets (jika file DB kecil)
      const dbUrl = new URL('/search_engine.db', request.url);
      const dbResponse = await fetch(dbUrl);
      if (!dbResponse.ok) {
        throw new Error("Gagal mengunduh file search_engine.db");
      }
      const dbBuffer = await dbResponse.arrayBuffer();

      // 3. Tulis file database ke Virtual Filesystem (MEMFS) Emscripten
      // Path '/search_engine.db' harus sama persis dengan yang di-hardcode pada C++ (sqlite3_open_v2)
      loadedModule.FS.writeFile('/search_engine.db', new Uint8Array(dbBuffer));
    }

    // 4. Panggil fungsi C++ searchJson yang sudah di-bind via embind
    const jsonResultString = loadedModule.searchJson(query, hl, timeFilter);

    // 5. Kembalikan response JSON ke frontend
    return new Response(jsonResultString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60'
      }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Terjadi kesalahan pada server WASM." }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
