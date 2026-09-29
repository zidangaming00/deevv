const API_KEY = "ISI_API_KEY_KAMU_DI_SINI";
const ALLOWED_ORIGIN = "https://deevv.pages.dev";

const CATEGORY_MAP = {
  restoran: "restaurant",
  hotel: "hotel",
  "kedai kopi": "cafe",
  spbu: "fuel_station"
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);

  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const input = (url.searchParams.get("category") || "")
    .trim()
    .toLowerCase();

  const radius = Math.min(
    Math.max(Number(url.searchParams.get("radius")) || 3000, 100),
    50000
  );

  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 30, 1),
    100
  );

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return json({ error: "Invalid coordinates" }, 400);
  }

  const category = CATEGORY_MAP[input];

  if (!category) {
    return json({
      error: "Unknown category",
      available: Object.keys(CATEGORY_MAP)
    }, 400);
  }

  const api = new URL(
    "https://api.latlng.work/v1/places/nearby"
  );

  api.searchParams.set("lat", String(lat));
  api.searchParams.set("lon", String(lon));
  api.searchParams.set("radius", String(radius));
  api.searchParams.set("category", category);
  api.searchParams.set("limit", String(limit));
  api.searchParams.set("country", "id");

  try {
    const response = await fetch(api.toString(), {
      method: "GET",
      headers: {
        "X-Api-Key": API_KEY,
        "Accept": "application/json"
      }
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return json({
        error: "Invalid provider response",
        status: response.status
      }, 502);
    }

    if (!response.ok) {
      return json({
        error: "Places provider error",
        status: response.status,
        details: data
      }, 502);
    }

    return json(data);

  } catch (error) {
    return json({
      error: "Failed to contact Places provider",
      message: error instanceof Error
        ? error.message
        : String(error)
    }, 502);
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders()
  });
}
