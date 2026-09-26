import createSearchModule from './search_engine.js';
import searchWasmModule from './search_engine.wasm';

let loadedModule = null;

export async function onRequestGet(context) {
  const { request } = context;

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
    let debugInfo = {};

    if (!loadedModule) {
      loadedModule = await createSearchModule({
        instantiateWasm(imports, successCallback) {
          const instance = new WebAssembly.Instance(searchWasmModule, imports);
          successCallback(instance);
          return instance.exports;
        }
      });

      const dbUrl = 'https://github.com/zidangaming00/deevv/releases/download/db-latest/search_engine.db';
      const dbResponse = await fetch(dbUrl);

      if (!dbResponse.ok) {
        throw new Error(`Gagal mengambil search_engine.db dari GitHub Release (Status: ${dbResponse.status})`);
      }

      const dbBuffer = await dbResponse.arrayBuffer();

      debugInfo.dbByteLength = dbBuffer.byteLength;
      debugInfo.dbByteLengthMB = (dbBuffer.byteLength / 1024 / 1024).toFixed(2);
      debugInfo.dbContentType = dbResponse.headers.get('content-type');
      debugInfo.dbUrl = dbUrl;

      const firstBytes = new Uint8Array(dbBuffer.slice(0, 16));
      const asText = new TextDecoder().decode(firstBytes);
      debugInfo.looksLikeHTML = asText.trim().toLowerCase().startsWith('<!doctype') || asText.trim().toLowerCase().startsWith('<html');
      debugInfo.sqliteMagicOK = asText.startsWith('SQLite format 3');

      loadedModule.FS.writeFile('/search_engine.db', new Uint8Array(dbBuffer));
      loadedModule._debugInfo = debugInfo;
    }

    if (query === '__debug__') {
      return new Response(JSON.stringify({
        debug: loadedModule._debugInfo || { note: 'module sudah pernah di-load sebelumnya, tidak fetch ulang db' }
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    const jsonResultString = loadedModule.searchJson(query, hl, timeFilter);

    if (reqUrl.searchParams.get('debug') === '1') {
      const parsed = JSON.parse(jsonResultString);
      parsed.__debug = loadedModule._debugInfo || null;
      return new Response(JSON.stringify(parsed, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
      });
    }

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
