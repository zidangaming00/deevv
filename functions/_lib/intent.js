// functions/_lib/intent.js
// Port 1:1 dari PlayIntent & VideoIntent di script.js. Fungsi murni, tanpa DOM,
// supaya keputusan "tampilkan widget atau tidak" bisa diambil di server.

const MIN_SCORE = 0.6;
const POP_FULL = 6.5;
const POP_UNKNOWN = 0.4;
const MAX_SHOW = 3;

const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
export const tokens = (s) => norm(s).split(/[^a-z0-9]+/).filter((t) => t.length > 1);
const compact = (s) => norm(s).replace(/[^a-z0-9]+/g, "");
const coreTitle = (t) => String(t || "").split(/\s[-–—|]\s|[:(]/)[0].trim();

function within1(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export function same(a, b) {
  if (a === b) return true;
  const min = Math.min(a.length, b.length), max = Math.max(a.length, b.length);
  if (min >= 4 && min / max >= 0.6 && (a.startsWith(b) || b.startsWith(a))) return true;
  return min >= 5 && within1(a, b);
}

function coverage(needles, haystack) {
  if (!needles.length) return 0;
  return needles.filter((n) => haystack.some((h) => same(n, h))).length / needles.length;
}

function popularity(app) {
  const n = Number(app.ratingCount);
  if (!Number.isFinite(n) || n < 0) return POP_UNKNOWN;
  return Math.min(1, Math.log10(1 + n) / POP_FULL);
}

function score(qTokens, qCompact, app) {
  const core = coreTitle(app.title);
  const tTokens = tokens(core);
  if (!tTokens.length) return 0;
  const dTokens = tokens(app.developer);

  const tCover = coverage(tTokens, qTokens);
  const qCover = coverage(qTokens, tTokens);
  const qDev = coverage(qTokens, tTokens.concat(dTokens));
  const coreCompact = compact(core);
  const compactHit = coreCompact.length >= 3 && qCompact.includes(coreCompact);

  let name;
  if (tCover === 1 || compactHit) name = 1;
  else if (qCover === 1) name = 0.55 + 0.35 * tCover;
  else name = 0.6 * qDev;

  return name * (0.35 + 0.65 * popularity(app));
}

// App yang lolos beserta skornya, urut dari paling relevan. Kosong = bukan niat cari aplikasi.
export function rankApps(query, apps) {
  if (!Array.isArray(apps)) return [];
  const qTokens = tokens(query);
  const qCompact = compact(query);
  if (!qTokens.length) return [];

  const scored = apps
    .filter((app) => app && app.title)
    .map((app) => ({ app, score: score(qTokens, qCompact, app) }))
    .sort((a, b) => b.score - a.score);

  if (!scored.length || scored[0].score < MIN_SCORE) return [];
  return scored.filter((r) => r.score >= MIN_SCORE).slice(0, MAX_SHOW);
}

// ---------- Video ----------
const VIDEO_CATEGORIES = /^(game|entertainment|music|video)/i;
const MIN_CORE_DF = 0.4;
const MIN_CORE_RATIO = 0.5;

function isEntertainmentApp(ranked) {
  const total = ranked.reduce((s, r) => s + r.score, 0);
  if (!total) return false;
  const fun = ranked.reduce((s, r) => s + (VIDEO_CATEGORIES.test(String(r.app.category || "")) ? r.score : 0), 0);
  return fun / total >= 0.5;
}

function videosRelevant(query, items) {
  const qTokens = Array.from(new Set(tokens(query)));
  if (!qTokens.length || !Array.isArray(items) || !items.length) return false;
  const docs = items.map((it) => tokens(`${it?.snippet?.title || ""} ${it?.snippet?.channelTitle || ""}`));
  const core = qTokens.filter(
    (t) => docs.filter((d) => d.some((w) => same(t, w))).length / docs.length >= MIN_CORE_DF
  );
  return core.length / qTokens.length >= MIN_CORE_RATIO;
}

export function shouldShowVideo(query, apps, items) {
  const ranked = rankApps(query, apps);
  if (ranked.length && !isEntertainmentApp(ranked)) return false;
  return videosRelevant(query, items);
}
