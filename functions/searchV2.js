// functions/searchV2.js
// Route: GET /searchV2
// SSR shell + hasil web halaman pertama
// Database: Turso/libSQL langsung via HTTP API
//
// Cloudflare Pages Environment Variables / Secrets:
// TURSO_DATABASE_URL = libsql://deevv-zidangaming00.aws-ap-northeast-1.turso.io
// TURSO_AUTH_TOKEN  = token Turso kamu

import {
  getText,
  escapeHTML,
  buildResultCardHtml,
  buildPageShell
} from "./_lib/shared.js";

const PAGE_SIZE = 10;

/* =========================================================
   TURSO
========================================================= */

function getTursoHttpUrl(env) {
  const raw = (env.TURSO_DATABASE_URL || "").trim();

  if (!raw) {
    throw new Error(
      "TURSO_DATABASE_URL belum diset di Cloudflare Pages."
    );
  }

  if (raw.startsWith("libsql://")) {
    return raw.replace(/^libsql:\/\//, "https://");
  }

  if (raw.startsWith("https://")) {
    return raw;
  }

  if (raw.startsWith("http://")) {
    return raw.replace(/^http:\/\//, "https://");
  }

  throw new Error(
    "Format TURSO_DATABASE_URL tidak valid."
  );
}


/**
 * Menjalankan SQL ke Turso menggunakan HTTP Pipeline API.
 */
async function tursoExecute(env, sql, args = []) {
  const baseUrl = getTursoHttpUrl(env);

  const token = (
    env.TURSO_AUTH_TOKEN || ""
  ).trim();

  if (!token) {
    throw new Error(
      "TURSO_AUTH_TOKEN belum diset di Cloudflare Pages."
    );
  }

  const endpoint = `${baseUrl}/v3/pipeline`;

  const stmtArgs = args.map((value) => {
    if (
      value === null ||
      value === undefined
    ) {
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
        value
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
  });

  const response = await fetch(
    endpoint,
    {
      method: "POST",

      headers: {
        "Authorization":
          `Bearer ${token}`,

        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        baton: null,

        requests: [
          {
            type: "execute",

            stmt: {
              sql,
              args: stmtArgs
            }
          },

          {
            type: "close"
          }
        ]
      })
    }
  );

  if (!response.ok) {
    const errorText =
      await response
        .text()
        .catch(() => "");

    throw new Error(
      `Turso HTTP ${response.status}: ${
        errorText.slice(0, 500)
      }`
    );
  }

  const data =
    await response.json();

  const firstResult =
    data?.results?.[0];

  if (!firstResult) {
    throw new Error(
      "Respons Turso tidak memiliki result."
    );
  }

  if (
    firstResult.type === "error"
  ) {
    throw new Error(
      firstResult.error?.message ||
      "Turso query error."
    );
  }

  return (
    firstResult.response?.result ||
    null
  );
}


/* =========================================================
   TURSO VALUE / ROW CONVERTER
========================================================= */

function tursoValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  switch (value.type) {
    case "null":
      return null;

    case "integer":
      return Number(value.value);

    case "float":
      return Number(value.value);

    case "text":
      return value.value;

    case "blob":
      return value.value;

    default:
      return value.value ?? null;
  }
}


function tursoRows(result) {
  if (!result) {
    return [];
  }

  const cols =
    result.cols || [];

  const rows =
    result.rows || [];

  return rows.map((row) => {
    const obj = {};

    cols.forEach(
      (col, index) => {
        const name =
          typeof col === "string"
            ? col
            : col?.name;

        if (name) {
          obj[name] =
            tursoValue(row[index]);
        }
      }
    );

    return obj;
  });
}


/* =========================================================
   FTS5
========================================================= */

/**
 * Membuat query FTS5 prefix.
 *
 * Contoh:
 *
 * Google
 * -> "Google"*
 *
 * Google Search
 * -> "Google"* "Search"*
 */
function escapeFtsQuery(q) {
  return q
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const clean =
        word
          .replace(/"/g, "")
          .trim();

      if (!clean) {
        return "";
      }

      return `"${clean}"*`;
    })
    .filter(Boolean)
    .join(" ");
}


/* =========================================================
   MAIN REQUEST
========================================================= */

export async function onRequestGet(
  context
) {
  const {
    request,
    env
  } = context;

  const url =
    new URL(request.url);

  const q =
    (
      url.searchParams.get("q") ||
      ""
    ).trim();


  /*
   * Support:
   *
   * ?p=1
   * ?page=1
   *
   * supaya frontend lama maupun baru
   * tetap kompatibel.
   */
  const p =
    url.searchParams.get("p") ||
    url.searchParams.get("page");


  const hl =
    url.searchParams.get("hl");

  const fv =
    url.searchParams.get("fv");

  const th =
    url.searchParams.get("th");

  const uf =
    url.searchParams.get("uf");

  const sf =
    url.searchParams.get("sf");

  const tbm =
    url.searchParams.get("tbm");


  /* =======================================================
     EMPTY QUERY
  ======================================================= */

  if (!q) {
    return Response.redirect(
      new URL(
        "/",
        request.url
      ).toString(),
      302
    );
  }


  /* =======================================================
     LANGUAGE / OPTIONS
  ======================================================= */

  const isIdLang =
    hl === "id";

  const isFaviconDisabled =
    fv === "0";


  /* =======================================================
     PAGE
  ======================================================= */

  const parsedPage =
    parseInt(p, 10);

  const startIndex =
    Number.isFinite(parsedPage) &&
    parsedPage > 1
      ? parsedPage
      : 1;


  const offset =
    (startIndex - 1) *
    PAGE_SIZE;


  /* =======================================================
     SEARCH PARAMS
  ======================================================= */

  const searchLangParam =
    isIdLang
      ? `&hl=${hl}`
      : "";


  let searchParam = "";

  searchParam +=
    uf === "1"
      ? "&uf=1"
      : "";

  searchParam +=
    isFaviconDisabled
      ? "&fv=0"
      : "";

  searchParam +=
    sf === "1"
      ? "&sf=1"
      : "";

  searchParam +=
    th === "1"
      ? "&th=1"
      : "";


  /* =======================================================
     SSR ONLY FOR WEB RESULT
  ======================================================= */

  const isDefaultFirstPage =
    ![
      "vid",
      "isch",
      "nws"
    ].includes(tbm);


  let resultsListInner = "";

  let resultStatsHtml = "";

  let paginationHtml = "";

  let ssrData = null;


  /* =======================================================
     DATABASE SEARCH
  ======================================================= */

  if (isDefaultFirstPage) {
    try {
      const t0 =
        Date.now();


      /*
       * FTS QUERY
       */
      const ftsQuery =
        escapeFtsQuery(q);


      if (!ftsQuery) {
        throw new Error(
          "Query pencarian kosong setelah diproses FTS5."
        );
      }


      /* =====================================================
         COUNT
      ===================================================== */

      const countResult =
        await tursoExecute(
          env,

          `
          SELECT
            COUNT(*) AS total
          FROM documents_fts
          WHERE documents_fts MATCH ?
          `,

          [
            ftsQuery
          ]
        );


      const countRows =
        tursoRows(
          countResult
        );


      const total =
        Number(
          countRows[0]?.total || 0
        );


      /* =====================================================
         SEARCH RESULT

         PENTING:
         documents_fts menggunakan rowid
         yang mengacu ke documents.rowid.

         Jadi JOIN:
         d.rowid = f.rowid

         BUKAN:
         d.url = f.url
      ===================================================== */

      const itemsResult =
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
          LIMIT ? OFFSET ?
          `,

          [
            ftsQuery,
            PAGE_SIZE,
            offset
          ]
        );


      const rows =
        tursoRows(
          itemsResult
        );


      const searchTimeSec =
        (
          (Date.now() - t0) /
          1000
        ).toFixed(2);


      /* =====================================================
         CONVERT TO SEARCH DATA
      ===================================================== */

      ssrData = {
        searchInformation: {
          formattedTotalResults:
            total.toLocaleString(
              "id-ID"
            ),

          formattedSearchTime:
            searchTimeSec
        },

        items:
          rows.length
            ? rows.map((row) => ({
                title:
                  row.title ||
                  row.url ||
                  "Untitled",

                link:
                  row.url || "",

                displayLink:
                  row.domain ||
                  "",

                snippet:
                  row.snippet ||
                  "",

                pagemap: {
                  metatags: [
                    {
                      "og:site_name":
                        row.domain ||
                        ""
                    }
                  ]
                },

                favicon:
                  row.favicon ||
                  null,

                thumbnail:
                  row.thumbnail ||
                  null
              }))
            : null,

        queries:
          offset + PAGE_SIZE < total
            ? {
                nextPage: [
                  {
                    startIndex:
                      startIndex + 1
                  }
                ]
              }
            : null
      };


      /* =====================================================
         RESULT STATS
      ===================================================== */

      resultStatsHtml =
        total > 0
          ? `
            <div class="result-stats">
              ${
                isIdLang
                  ? `Sekitar ${escapeHTML(
                      ssrData
                        .searchInformation
                        .formattedTotalResults
                    )} hasil (${escapeHTML(
                      ssrData
                        .searchInformation
                        .formattedSearchTime
                    )} detik)`
                  : `Approximately ${escapeHTML(
                      ssrData
                        .searchInformation
                        .formattedTotalResults
                    )} results (${escapeHTML(
                      ssrData
                        .searchInformation
                        .formattedSearchTime
                    )} seconds)`
              }
            </div>
          `
          : `
            <div class="result-stats">
              ${
                isIdLang
                  ? "Tidak ditemukan hasil dalam index Deevv."
                  : "No results found in the Deevv index."
              }
            </div>
          `;


      /* =====================================================
         HASIL ADA
      ===================================================== */

      if (
        ssrData.items?.length
      ) {
        const correctedHtml =
          ssrData.spelling
            ? `
              <div class="corrected-word result-card result-card--flat">
                <div class="snippet">
                  ${getText(
                    isIdLang,
                    "correct"
                  )}

                  <a href="/searchV2?q=${encodeURIComponent(
                    ssrData
                      .spelling
                      .correctedQuery
                  )}${searchLangParam}">
                    ${escapeHTML(
                      ssrData
                        .spelling
                        .correctedQuery
                    )}
                  </a>

                  <span>?</span>
                </div>
              </div>
            `
            : "";


        const itemsHtml =
          ssrData.items
            .map(
              (item, i) => {
                const card =
                  buildResultCardHtml(
                    item,
                    isFaviconDisabled
                  );


                const videoSlot =
                  i === 1
                    ? `
                      <div id="dynamic-video-widget-slot"></div>
                    `
                    : "";


                return (
                  card +
                  videoSlot
                );
              }
            )
            .join("");


        const trailingVideoSlot =
          ssrData.items.length < 2
            ? `
              <div id="dynamic-video-widget-slot"></div>
            `
            : "";


        resultsListInner =
          correctedHtml +
          itemsHtml +
          trailingVideoSlot;


        /* ===================================================
           MORE BUTTON
        =================================================== */

        if (
          ssrData
            .queries
            ?.nextPage
        ) {
          paginationHtml =
            `
            <div class="show-wrapper">
              <button class="more">
                ${getText(
                  isIdLang,
                  "more"
                )}
              </button>
            </div>
            `;
        }
      }

      /* =====================================================
         TIDAK ADA HASIL
      ===================================================== */

      else {
        resultsListInner =
          `
          <div class="result-card result-card--flat">
            <div class="snippet">
              <strong>
                ${
                  isIdLang
                    ? "Tidak ada hasil"
                    : "No results"
                }
              </strong>

              <br>

              ${
                isIdLang
                  ? `Tidak ada halaman yang cocok dengan <strong>${escapeHTML(
                      q
                    )}</strong> di index Deevv.`
                  : `No indexed pages matched <strong>${escapeHTML(
                      q
                    )}</strong>.`
              }
            </div>
          </div>
          `;
      }
    }


    /* =======================================================
       TURSO ERROR
    ======================================================= */

    catch (err) {
      console.error(
        "Search V2 Turso error:",
        err
      );


      ssrData = null;


      const errorMessage =
        err instanceof Error
          ? err.message
          : String(err);


      resultsListInner =
        `
        <div class="result-card result-card--flat">
          <div class="snippet">

            <strong>
              ${
                isIdLang
                  ? "Database search error"
                  : "Search database error"
              }
            </strong>

            <br><br>

            <span>
              ${escapeHTML(
                errorMessage
              )}
            </span>

            <br><br>

            <small>
              ${
                isIdLang
                  ? "Periksa TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, struktur tabel, dan query FTS5."
                  : "Check TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, table structure, and FTS5 query."
              }
            </small>

          </div>
        </div>
        `;


      resultStatsHtml =
        `
        <div class="result-stats">
          ${
            isIdLang
              ? "Turso gagal menjalankan pencarian."
              : "Turso search failed."
          }
        </div>
        `;
    }
  }


  /* =========================================================
     SVG ICONS
  ========================================================= */

  const svgIcons = {

    all:
      `
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="#6e7780"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M7 1C3.686 1 1 3.686 1 7C1 10.314 3.686 13 7 13C8.127 13 9.182 12.689 10.083 12.149L13.47 15.536C13.763 15.829 14.237 15.829 14.53 15.536C14.823 15.243 14.823 14.769 14.53 14.476L11.149 11.095C11.689 10.194 12 9.127 12 8C12 4.686 9.314 2 6 2C2.686 2 0 4.686 0 8C0 11.314 2.686 14 6 14C7.127 14 8.182 13.689 9.083 13.149L12.47 16.536C12.763 16.829 13.237 16.829 13.53 16.536C13.823 16.243 13.823 15.769 13.53 15.476L10.149 12.095C10.689 11.194 11 10.127 11 9C11 5.686 8.314 3 5 3C1.686 3 -1 5.686 -1 9C-1 12.314 1.686 15 5 15"
        ></path>
      </svg>
      `,

    images:
      `
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="#6e7780"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M3.25 1C1.455 1 0 2.455 0 4.25V11.75C0 13.545 1.455 15 3.25 15H12.75C14.545 15 16 13.545 16 11.75V4.25C16 2.455 14.545 1 12.75 1H3.25ZM14.5 8.439V4.25C14.5 3.284 13.716 2.5 12.75 2.5H3.25C2.284 2.5 1.5 3.284 1.5 4.25V11.75C1.5 11.956 1.536 12.154 1.601 12.338L5.97 7.97C6.263 7.677 6.737 7.677 7.03 7.97L8 8.939L10.97 5.97C11.263 5.677 11.737 5.677 12.03 5.97L14.5 8.439ZM9.061 10L10.03 10.97C10.323 11.263 10.323 11.737 10.03 12.03C9.737 12.323 9.263 12.323 8.97 12.03L6.5 9.561L2.662 13.399C2.846 13.464 3.044 13.5 3.25 13.5C13.716 13.5 14.5 12.716 14.5 11.75V10.561L11.5 7.561L9.061 10Z"
        ></path>
      </svg>
      `,

    videos:
      `
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="#6e7780"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M13.489 5.55C15.38 6.636 15.38 9.364 13.489 10.45L6.231 14.616C4.348 15.698 2 14.338 2 12.166V3.834C2 1.662 4.348 0.303 6.231 1.384L13.489 5.55ZM12.742 9.149C13.629 8.64 13.629 7.36 12.742 6.851L5.485 2.685C4.601 2.178 3.5 2.816 3.5 3.834V12.166C3.5 13.185 4.601 13.823 5.485 13.316L12.742 9.149Z"
        ></path>
      </svg>
      `,

    news:
      `
      <svg
        width="16"
        height="16"
        viewBox="0 0 22 22"
        fill="#6e7780"
        aria-hidden="true"
      >
        <path
          d="M12 11h6v2h-6v-2zm-6 6h12v-2H6v2zm0-4h4V7H6v6zm16-7.22v12.44c0 1.54-1.34 2.78-3 2.78H5c-1.64 0-3-1.25-3-2.78V5.78C2 4.26 3.36 3 5 3h14c1.64 0 3 1.25 3 2.78zM19.99 12V5.78c0-.42-.46-.78-1-.78H5c-.54 0-.99.36-.99.78v12.44c0 .42.45.78.99.78h14c.54 0 1-.36 1-.78V12zM12 9h6V7h-6v2"
        ></path>
      </svg>
      `,

    maps:
      `
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="#6e7780"
        aria-hidden="true"
      >
        <path
          d="M8 8C9.105 8 10 7.105 10 6C10 4.895 9.105 4 8 4C6.895 4 6 4.895 6 6C6 7.105 6.895 8 8 8Z"
        ></path>
      </svg>
      `
  };


  /* =========================================================
     TAB
  ========================================================= */

  const createTab = (
    tbmVal,
    icon,
    labelIndex,
    isSelected
  ) =>
    `
    <div class="search-item${
      isSelected
        ? " selected"
        : ""
    }">

      <a
        href="/searchV2?q=${encodeURIComponent(
          q
        ).replace(
          /%20/g,
          "+"
        )}${tbmVal}${searchLangParam}${searchParam}"
        class="tab-wrapper"
      >

        <div class="label">
          ${svgIcons[icon]}

          <span>
            ${getText(
              isIdLang,
              "tab",
              labelIndex
            )}
          </span>
        </div>

      </a>
    </div>
    `;


  const selectedTabIndex = {
    vid: 2,
    isch: 1,
    nws: 3
  }[tbm] ?? 0;


  const tabs = [
    createTab(
      "",
      "all",
      0,
      selectedTabIndex === 0
    ),

    createTab(
      "&tbm=isch",
      "images",
      1,
      selectedTabIndex === 1
    ),

    createTab(
      "&tbm=vid",
      "videos",
      2,
      selectedTabIndex === 2
    ),

    createTab(
      "&tbm=nws",
      "news",
      3,
      selectedTabIndex === 3
    ),

    createTab(
      "",
      "maps",
      4,
      false
    )
  ].join("");


  /* =========================================================
     MAIN RESULTS
  ========================================================= */

  const mainResultInner =
    isDefaultFirstPage
      ? `
        ${resultStatsHtml}

        <div class="results-list">
          ${resultsListInner}
        </div>

        ${paginationHtml}
      `
      : "";


  /* =========================================================
     BODY
  ========================================================= */

  const bodyHtml =
    `
    <div
      class="app"
      id="main-bx"
    >

      <div class="page-header">

        <div class="page-header__inner">

          <div class="logo-slot">

            <a
              title="Kembali"
              href="/"
            >

              <img
                alt="Logo"
                src="/images/logo.png"
              >

            </a>

          </div>


          <div class="header">

            <div class="search-box">

              <div class="search-field">

                <input
                  type="search"
                  id="sear_21829_input"
                  value="${escapeHTML(q)}"
                  name="q"
                  class="search-input"
                  autocomplete="off"
                  placeholder="${getText(
                    isIdLang,
                    "placeholder"
                  )}"
                >


                <div
                  role="button"
                  class="search-toggle inpbtun"
                  id="xclarGh"
                  title="Cari"
                ></div>


                <div
                  role="button"
                  class="cleartext inpbtun"
                  style="display:${
                    q
                      ? "block"
                      : "none"
                  }"
                  id="Chasprn"
                  title="Hapus"
                ></div>

              </div>

            </div>


            <div class="search-menu">
              ${tabs}
            </div>

          </div>

        </div>

      </div>


      <div class="results-section">

        <div class="result-wrapper">

          <div class="main-result">
            ${mainResultInner}
          </div>

        </div>

      </div>

    </div>
    `;


  /* =========================================================
     BUILD SHELL
  ========================================================= */

  let html =
    buildPageShell({
      q,
      isIdLang,
      bodyHtml,

      initialDataJson:
        ssrData
          ? JSON.stringify(
              ssrData
            )
          : "null"
    });


  /* =========================================================
     SCRIPT V2
  ========================================================= */

  html =
    html.replace(
      'src="./script.js"',
      'src="./script-v2.js"'
    );


  /* =========================================================
     RESPONSE
  ========================================================= */

  return new Response(
    html,
    {
      headers: {
        "Content-Type":
          "text/html; charset=UTF-8",

        "Cache-Control":
          "no-store"
      }
    }
  );
}
