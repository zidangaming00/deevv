// functions/searchV2.js

const PAGE_SIZE = 10;

/* =========================================================
   TURSO / LIBSQL
========================================================= */

function getTursoHttpUrl(env) {
  const raw = String(env.TURSO_DATABASE_URL || "").trim();

  if (!raw) {
    throw new Error("Environment variable TURSO_DATABASE_URL belum diatur.");
  }

  if (raw.startsWith("libsql://")) {
    return raw.replace(/^libsql:\/\//, "https://");
  }

  if (raw.startsWith("https://") || raw.startsWith("http://")) {
    return raw;
  }

  throw new Error(
    `Format TURSO_DATABASE_URL tidak dikenali: ${raw}`
  );
}

function makeArg(value) {
  if (value === null || value === undefined) {
    return {
      type: "null"
    };
  }

  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return {
        type: "integer",
        value: String(value)
      };
    }

    return {
      type: "float",
      value: String(value)
    };
  }

  if (typeof value === "boolean") {
    return {
      type: "integer",
      value: value ? "1" : "0"
    };
  }

  return {
    type: "text",
    value: String(value)
  };
}

async function tursoExecute(env, sql, args = []) {
  const url = getTursoHttpUrl(env);
  const token = String(env.TURSO_AUTH_TOKEN || "").trim();

  if (!token) {
    throw new Error("Environment variable TURSO_AUTH_TOKEN belum diatur.");
  }

  const response = await fetch(`${url}/v3/pipeline`, {
    method: "POST",

    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${token}`
    },

    body: JSON.stringify({
      requests: [
        {
          type: "execute",

          stmt: {
            sql,
            args: args.map(makeArg)
          }
        },

        {
          type: "close"
        }
      ]
    })
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Turso HTTP ${response.status}: ${text}`
    );
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Response Turso bukan JSON: ${text.slice(0, 1000)}`
    );
  }

  if (!data.results || !data.results[0]) {
    throw new Error(
      `Response Turso tidak memiliki results: ${JSON.stringify(data).slice(0, 2000)}`
    );
  }

  const result = data.results[0];

  if (result.type === "error") {
    throw new Error(
      result.error?.message ||
      JSON.stringify(result.error) ||
      "Turso mengembalikan error."
    );
  }

  if (result.type !== "ok") {
    throw new Error(
      `Tipe response Turso tidak dikenali: ${JSON.stringify(result).slice(0, 2000)}`
    );
  }

  return result;
}


/* =========================================================
   TURSO RESULT HELPERS
========================================================= */

function tursoValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "object" && value !== null) {
    if ("value" in value) {
      return value.value;
    }
  }

  return value;
}

function tursoRows(result) {
  const cols = result?.result?.cols || [];
  const rows = result?.result?.rows || [];

  const names = cols.map((col, index) => {
    if (typeof col === "string") {
      return col;
    }

    return col?.name || `column_${index}`;
  });

  return rows.map(row => {
    const obj = {};

    names.forEach((name, index) => {
      obj[name] = tursoValue(row[index]);
    });

    return obj;
  });
}

function firstNumber(result, fallback = 0) {
  const rows = tursoRows(result);

  if (!rows.length) {
    return fallback;
  }

  const first = rows[0];

  const value =
    first.total ??
    first.count ??
    first["COUNT(*)"];

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}


/* =========================================================
   HTML HELPERS
========================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHTML(value);
}

function getText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}


/* =========================================================
   FTS QUERY
========================================================= */

function makeFtsQuery(query) {
  const words = String(query || "")
    .trim()
    .split(/\s+/)
    .map(word => word.trim())
    .filter(Boolean);

  if (!words.length) {
    return "";
  }

  return words
    .map(word => {
      const clean = word
        .replace(/"/g, "")
        .replace(/\*/g, "");

      if (!clean) {
        return "";
      }

      return `"${clean}"*`;
    })
    .filter(Boolean)
    .join(" ");
}


/* =========================================================
   RESULT CARD
========================================================= */

function buildResultCard(item) {
  const url = getText(item.url);
  const title = getText(item.title) || url || "Untitled";
  const snippet = getText(item.snippet);
  const domain = getText(item.domain);

  let favicon = getText(item.favicon);

  if (!favicon && url) {
    try {
      const parsed = new URL(url);

      favicon =
        `${parsed.protocol}//${parsed.hostname}/favicon.ico`;
    } catch {
      favicon = "";
    }
  }

  return `
    <article class="result-card">
      <div class="result-source">

        ${
          favicon
            ? `
              <img
                class="result-favicon"
                src="${escapeAttribute(favicon)}"
                alt=""
                width="20"
                height="20"
                loading="lazy"
                onerror="this.style.display='none'"
              >
            `
            : ""
        }

        <div class="result-domain">
          ${escapeHTML(domain || url)}
        </div>
      </div>

      <a
        class="result-title"
        href="${escapeAttribute(url)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        ${escapeHTML(title)}
      </a>

      ${
        snippet
          ? `
            <div class="result-snippet">
              ${escapeHTML(snippet)}
            </div>
          `
          : ""
      }
    </article>
  `;
}


/* =========================================================
   PAGE SHELL
========================================================= */

function buildPageShell({
  query,
  content,
  initialData
}) {
  const initialDataJson = JSON.stringify(initialData)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <title>
    ${escapeHTML(query || "Deevv Search")}
  </title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family:
        Arial,
        Helvetica,
        sans-serif;
      background: #fff;
      color: #202124;
    }

    .search-page {
      max-width: 900px;
      margin: 0 auto;
      padding: 30px 20px 60px;
    }

    .search-header {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-bottom: 30px;
    }

    .search-input {
      flex: 1;
      height: 46px;
      border: 1px solid #dfe1e5;
      border-radius: 24px;
      padding: 0 18px;
      font-size: 16px;
      outline: none;
    }

    .search-input:focus {
      border-color: #aaa;
    }

    .search-button {
      height: 46px;
      padding: 0 20px;
      border: 0;
      border-radius: 23px;
      background: #111;
      color: #fff;
      cursor: pointer;
      font-size: 15px;
    }

    .result-card {
      padding: 16px 0;
      border-bottom: 1px solid #eee;
    }

    .result-source {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 5px;
      color: #5f6368;
      font-size: 13px;
    }

    .result-favicon {
      width: 20px;
      height: 20px;
      object-fit: contain;
      border-radius: 4px;
    }

    .result-title {
      display: block;
      color: #1a0dab;
      text-decoration: none;
      font-size: 20px;
      line-height: 1.35;
      margin-bottom: 5px;
      word-break: break-word;
    }

    .result-title:hover {
      text-decoration: underline;
    }

    .result-snippet {
      color: #4d5156;
      font-size: 14px;
      line-height: 1.55;
    }

    .result-count {
      color: #70757a;
      font-size: 13px;
      margin-bottom: 10px;
    }

    .debug-box {
      margin-top: 30px;
      padding: 18px;
      border: 1px solid #f0b400;
      background: #fff8df;
      border-radius: 12px;
      overflow-x: auto;
    }

    .debug-title {
      font-weight: 700;
      font-size: 18px;
      margin-bottom: 12px;
    }

    .debug-line {
      margin: 7px 0;
      font-size: 14px;
    }

    .debug-label {
      font-weight: 700;
    }

    .debug-error {
      margin-top: 14px;
      padding: 12px;
      background: #fff;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      white-space: pre-wrap;
      word-break: break-word;
      color: #b00020;
      font-family: monospace;
      font-size: 13px;
    }

    .debug-sample {
      margin-top: 14px;
      padding: 12px;
      background: #fff;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: monospace;
      font-size: 12px;
    }

    .no-result {
      padding: 30px 0;
      color: #555;
    }

    @media (max-width: 600px) {
      .search-page {
        padding: 18px 14px 40px;
      }

      .search-header {
        margin-bottom: 20px;
      }

      .search-button {
        padding: 0 15px;
      }

      .result-title {
        font-size: 18px;
      }
    }
  </style>
</head>

<body>

  <main class="search-page">

    <form
      class="search-header"
      method="GET"
      action="/searchV2"
    >

      <input
        class="search-input"
        name="q"
        value="${escapeAttribute(query)}"
        placeholder="Search..."
        autocomplete="off"
      >

      <button
        class="search-button"
        type="submit"
      >
        Search
      </button>

    </form>

    ${content}

  </main>

  <script>
    window.__DEEVV_INITIAL_DATA__ =
      ${initialDataJson};
  </script>

  <script src="./script-v2.js"></script>

</body>
</html>`;
}


/* =========================================================
   DEBUG HTML
========================================================= */

function buildDebugBox(debug) {
  const sample = debug.sample || [];

  return `
    <section class="debug-box">

      <div class="debug-title">
        ⚠️ Debug: kenapa hasil pencarian kosong?
      </div>

      <div class="debug-line">
        <span class="debug-label">Query:</span>
        ${escapeHTML(debug.query)}
      </div>

      <div class="debug-line">
        <span class="debug-label">FTS Query:</span>
        ${escapeHTML(debug.ftsQuery)}
      </div>

      <div class="debug-line">
        <span class="debug-label">Page:</span>
        ${escapeHTML(debug.page)}
      </div>

      <div class="debug-line">
        <span class="debug-label">documents:</span>
        ${escapeHTML(debug.documentsCount)}
      </div>

      <div class="debug-line">
        <span class="debug-label">documents_fts:</span>
        ${escapeHTML(debug.ftsCount)}
      </div>

      <div class="debug-line">
        <span class="debug-label">FTS MATCH:</span>
        ${escapeHTML(debug.matchCount)}
      </div>

      <div class="debug-line">
        <span class="debug-label">JOIN documents ↔ documents_fts:</span>
        ${escapeHTML(debug.joinCount)}
      </div>

      ${
        debug.error
          ? `
            <div class="debug-error">
              ${escapeHTML(debug.error)}
            </div>
          `
          : ""
      }

      ${
        sample.length
          ? `
            <div class="debug-sample">
              <strong>Contoh data documents_fts:</strong>

${escapeHTML(
  JSON.stringify(sample, null, 2)
)}
            </div>
          `
          : `
            <div class="debug-sample">
              <strong>Contoh data documents_fts:</strong>

TIDAK ADA DATA.
            </div>
          `
      }

    </section>
  `;
}


/* =========================================================
   MAIN REQUEST
========================================================= */

export async function onRequestGet(context) {
  const { request, env } = context;

  const requestUrl = new URL(request.url);

  const query =
    requestUrl.searchParams.get("q")?.trim() || "";

  const pageParam =
    requestUrl.searchParams.get("p") ||
    requestUrl.searchParams.get("page") ||
    "1";

  let page = Number.parseInt(pageParam, 10);

  if (!Number.isFinite(page) || page < 1) {
    page = 1;
  }

  const offset =
    (page - 1) * PAGE_SIZE;

  /* =======================================================
     EMPTY QUERY
  ======================================================= */

  if (!query) {
    const initialData = {
      searchInformation: {
        totalResults: 0
      },

      items: [],

      queries: {
        request: [
          {
            searchTerms: "",
            startIndex: 1
          }
        ]
      }
    };

    return new Response(
      buildPageShell({
        query: "",
        content: `
          <div class="no-result">
            Masukkan kata pencarian terlebih dahulu.
          </div>
        `,
        initialData
      }),
      {
        headers: {
          "content-type": "text/html; charset=UTF-8"
        }
      }
    );
  }


  /* =======================================================
     BUILD FTS QUERY
  ======================================================= */

  const ftsQuery =
    makeFtsQuery(query);


  /* =======================================================
     DEBUG VARIABLES
  ======================================================= */

  let documentsCount = "ERROR";
  let ftsCount = "ERROR";
  let matchCount = "ERROR";
  let joinCount = "ERROR";

  let sample = [];

  let debugError = "";


  /* =======================================================
     DATABASE DEBUG
  ======================================================= */

  try {

    /* -------------------------------------------------------
       1. TEST DOCUMENTS
    ------------------------------------------------------- */

    try {
      const result =
        await tursoExecute(
          env,
          `
            SELECT COUNT(*) AS total
            FROM documents
          `
        );

      documentsCount =
        firstNumber(result);
    } catch (error) {
      debugError +=
        `[documents COUNT]\n${error.message}\n\n`;
    }


    /* -------------------------------------------------------
       2. TEST DOCUMENTS_FTS
    ------------------------------------------------------- */

    try {
      const result =
        await tursoExecute(
          env,
          `
            SELECT COUNT(*) AS total
            FROM documents_fts
          `
        );

      ftsCount =
        firstNumber(result);
    } catch (error) {
      debugError +=
        `[documents_fts COUNT]\n${error.message}\n\n`;
    }


    /* -------------------------------------------------------
       3. GET SAMPLE FTS ROWS
    ------------------------------------------------------- */

    try {
      const result =
        await tursoExecute(
          env,
          `
            SELECT
              rowid,
              title,
              snippet
            FROM documents_fts
            LIMIT 5
          `
        );

      sample =
        tursoRows(result);
    } catch (error) {
      debugError +=
        `[documents_fts SAMPLE]\n${error.message}\n\n`;
    }


    /* -------------------------------------------------------
       4. TEST FTS MATCH
    ------------------------------------------------------- */

    try {
      const result =
        await tursoExecute(
          env,
          `
            SELECT COUNT(*) AS total
            FROM documents_fts
            WHERE documents_fts MATCH ?
          `,
          [ftsQuery]
        );

      matchCount =
        firstNumber(result);
    } catch (error) {
      debugError +=
        `[FTS MATCH]\n${error.message}\n\n`;
    }


    /* -------------------------------------------------------
       5. TEST JOIN
    ------------------------------------------------------- */

    try {
      const result =
        await tursoExecute(
          env,
          `
            SELECT COUNT(*) AS total
            FROM documents_fts AS f
            JOIN documents AS d
              ON d.rowid = f.rowid
          `
        );

      joinCount =
        firstNumber(result);
    } catch (error) {
      debugError +=
        `[JOIN]\n${error.message}\n\n`;
    }

  } catch (error) {

    debugError +=
      `[GENERAL DATABASE ERROR]\n${error.message}\n\n`;
  }


  /* =======================================================
     REAL SEARCH
  ======================================================= */

  let items = [];
  let total = 0;

  try {

    /* -------------------------------------------------------
       COUNT SEARCH RESULT
    ------------------------------------------------------- */

    const countResult =
      await tursoExecute(
        env,
        `
          SELECT COUNT(*) AS total
          FROM documents_fts
          WHERE documents_fts MATCH ?
        `,
        [ftsQuery]
      );

    total =
      firstNumber(countResult);


    /* -------------------------------------------------------
       GET SEARCH RESULTS
    ------------------------------------------------------- */

    if (total > 0) {

      const result =
        await tursoExecute(
          env,
          `
            SELECT
              d.rowid AS rowid,
              d.url AS url,
              d.domain AS domain,
              d.title AS title,
              d.snippet AS snippet,
              d.favicon AS favicon,
              d.thumbnail AS thumbnail
            FROM documents_fts AS f
            JOIN documents AS d
              ON d.rowid = f.rowid
            WHERE documents_fts MATCH ?
            ORDER BY d.pagerank DESC
            LIMIT ?
            OFFSET ?
          `,
          [
            ftsQuery,
            PAGE_SIZE,
            offset
          ]
        );

      items =
        tursoRows(result);
    }

  } catch (error) {

    debugError +=
      `[REAL SEARCH]\n${error.message}\n\n`;

    total = 0;
    items = [];
  }


  /* =======================================================
     BUILD HTML
  ======================================================= */

  let content = "";


  if (items.length > 0) {

    content += `
      <div class="result-count">
        Sekitar ${escapeHTML(total)} hasil
        untuk
        <strong>${escapeHTML(query)}</strong>
      </div>
    `;

    content += items
      .map(buildResultCard)
      .join("");

  } else {

    content += `
      <div class="no-result">

        Tidak ada hasil untuk:
        <strong>${escapeHTML(query)}</strong>

      </div>
    `;

    /*
      Tampilkan informasi debug hanya ketika
      pencarian menghasilkan 0.
    */

    content += buildDebugBox({
      query,
      ftsQuery,
      page,
      documentsCount,
      ftsCount,
      matchCount,
      joinCount,
      sample,
      error:
        debugError.trim() ||
        "Tidak ada error SQL. Kemungkinan FTS MATCH memang menghasilkan 0."
    });
  }


  /* =======================================================
     DATA UNTUK CLIENT
  ======================================================= */

  const initialData = {
    searchInformation: {
      totalResults: total
    },

    items,

    queries: {
      request: [
        {
          searchTerms: query,
          startIndex: offset + 1
        }
      ]
    },

    debug: {
      query,
      ftsQuery,
      page,
      pageSize: PAGE_SIZE,
      offset,
      documentsCount,
      ftsCount,
      matchCount,
      joinCount,
      error: debugError.trim()
    }
  };


  /* =======================================================
     RESPONSE
  ======================================================= */

  return new Response(
    buildPageShell({
      query,
      content,
      initialData
    }),
    {
      status: 200,

      headers: {
        "content-type":
          "text/html; charset=UTF-8",

        "cache-control":
          "no-store, no-cache, must-revalidate"
      }
    }
  );
}
