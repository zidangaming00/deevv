import createSearchModule from './search_engine.js';
import searchWasmModule from './search_engine.wasm';

let loadedModule = null;

export async function onRequestGet(context) {
  const { request } = context;

  const reqUrl = new URL(request.url);
  const query = reqUrl.searchParams.get('q') || '';
  const hl = reqUrl.searchParams.get('hl') || 'en-US';
  const timeFilter = reqUrl.searchParams.get('tbs') || '';
  const start = parseInt(reqUrl.searchParams.get('start') || '1', 10);
  const wantDebug = reqUrl.searchParams.get('debug') === '1';

  try {
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
      loadedModule.FS.writeFile('/search_engine.db', new Uint8Array(dbBuffer));
    }

    // Endpoint diagnostic murni info file db, dihitung ulang tiap request via FS.stat
    // (jadi selalu akurat, nggak tergantung apakah ini cold start atau warm)
    if (query === '__debug__') {
      const stat = loadedModule.FS.stat('/search_engine.db');
      const bytes = loadedModule.FS.readFile('/search_engine.db', { count: 16 });
      const magicText = new TextDecoder().decode(bytes.slice(0, 16));

      return new Response(JSON.stringify({
        debug: {
          dbByteLength: stat.size,
          dbByteLengthMB: (stat.size / 1024 / 1024).toFixed(2),
          sqliteMagicOK: magicText.startsWith('SQLite format 3'),
          firstBytesPreview: magicText
        }
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    if (!query.trim()) {
      return new Response(
        JSON.stringify({ error: "Parameter 'q' wajib diisi." }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Search normal, pakai hl sesuai request (atau default en-US)
    const jsonResultString = loadedModule.searchJson(query, hl, timeFilter, start);

    if (!wantDebug) {
      return new Response(jsonResultString, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // --- MODE DEBUG DETAIL (?debug=1) ---
    const parsed = JSON.parse(jsonResultString);

    // Jalanin ulang query yang sama tapi hl dipaksa "all" (bypass filter bahasa di C++)
    // buat mastiin apakah 0 hasil itu soal filter bahasa atau soal index-nya emang kosong
    let bypassResult = null;
    let bypassError = null;
    try {
      const bypassJsonString = loadedModule.searchJson(query, 'all', timeFilter, start);
      bypassResult = JSON.parse(bypassJsonString);
    } catch (e) {
      bypassError = e.message;
    }

    const dbStat = loadedModule.FS.stat('/search_engine.db');

    parsed.__debug = {
      dbByteLength: dbStat.size,
      dbByteLengthMB: (dbStat.size / 1024 / 1024).toFixed(2),
      requestedHl: hl,
      normalTotalResults: parsed.searchInformation.totalResults,
      bypassLangFilter: {
        note: "Hasil query sama tapi hl dipaksa 'all' (bypass filter bahasa)",
        totalResults: bypassResult ? bypassResult.searchInformation.totalResults : null,
        sampleTitles: bypassResult ? bypassResult.items.slice(0, 3).map(it => ({ title: it.title, link: it.link, displayLink: it.displayLink })) : null,
        error: bypassError
      },
      diagnosis: (() => {
        const normalCount = parseInt(parsed.searchInformation.totalResults, 10);
        const bypassCount = bypassResult ? parseInt(bypassResult.searchInformation.totalResults, 10) : 0;
        if (normalCount > 0) return "Ada hasil normal, tidak ada masalah filter bahasa untuk query ini.";
        if (bypassCount > 0) return `Filter bahasa (hl=${hl}) yang membuang semua hasil. Index sebenarnya punya ${bypassCount} dokumen cocok, tapi lang-nya tidak match "${hl}".`;
        return "Bahkan dengan hl=all pun 0 hasil — kata ini kemungkinan besar memang belum ter-index sama sekali (bukan soal filter, tapi soal crawling/tokenizing).";
      })()
    };

    return new Response(JSON.stringify(parsed, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
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
