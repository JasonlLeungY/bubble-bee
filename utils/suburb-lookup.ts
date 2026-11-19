import { createClient } from "@supabase/supabase-js";

// Finds the centre of a suburb for the listing map. Server-side only.
//
// Order: 1) the suburb_locations table, 2) this server's memory, 3) a
// Nominatim lookup (OpenStreetMap). A lookup result is saved to the table, so
// each suburb is looked up at most once, as Nominatim's usage policy asks.
//
// Only suburbs that a published listing uses are looked up, so this cannot be
// used to send arbitrary searches to the geocoder.

export type SuburbPoint = {
  suburb: string;
  state: string | null;
  latitude: number;
  longitude: number;
};

export const SUBURB_PATTERN = /^[A-Za-z][A-Za-z' -]{0,79}$/;

const SEARCH_URL = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "sharehouse-marketplace/1.0 (suburb map lookup)";
const PLACE_TYPES = ["suburb", "neighbourhood", "quarter", "locality", "village", "town", "city"];

const memory = new Map<string, SuburbPoint>();
const inflight = new Map<string, Promise<SuburbPoint | null>>();
let queue: Promise<unknown> = Promise.resolve();

function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// Writes need the secret key. Without it, lookups still work, but results are
// only remembered in memory, so each restart looks them up again.
function secretClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  });
}

function inAustralia(latitude: number, longitude: number) {
  return latitude >= -44 && latitude <= -10 && longitude >= 112 && longitude <= 154;
}

// One Nominatim request at a time, at least 1.1 s apart.
function geocode(name: string): Promise<SuburbPoint | null> {
  const next = queue.then(() => search(name));
  queue = next.catch(() => null).then(() => new Promise((resolve) => setTimeout(resolve, 1100)));
  return next;
}

async function search(name: string): Promise<SuburbPoint | null> {
  const url = new URL(SEARCH_URL);
  url.search = new URLSearchParams({
    q: `${name}, Australia`,
    format: "jsonv2",
    countrycodes: "au",
    addressdetails: "1",
    limit: "5",
  }).toString();

  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, "accept-language": "en" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Geocoder returned ${response.status}`);

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    addresstype?: string;
    address?: { state?: string };
  }>;
  // Only accept a place that is a suburb-level area, never a street.
  const place = results.find((result) => PLACE_TYPES.includes(result.addresstype ?? ""));
  if (!place) return null;

  const latitude = Number(place.lat);
  const longitude = Number(place.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !inAustralia(latitude, longitude)) {
    return null;
  }
  return { suburb: name, state: place.address?.state ?? null, latitude, longitude };
}

async function remember(key: string, point: SuburbPoint) {
  const admin = secretClient();
  if (!admin) return;
  try {
    await admin.from("suburb_locations").upsert(
      {
        suburb_key: key,
        suburb: point.suburb,
        state: point.state,
        latitude: point.latitude,
        longitude: point.longitude,
        source: "nominatim",
      },
      { onConflict: "suburb_key", ignoreDuplicates: true },
    );
    // Give the listings that use this suburb their coordinates too.
    await admin
      .from("listings")
      .update({ latitude: point.latitude, longitude: point.longitude })
      .ilike("suburb", point.suburb)
      .is("latitude", null);
  } catch (error) {
    console.error("Could not save suburb location", error);
  }
}

export async function findSuburb(name: string): Promise<SuburbPoint | null> {
  const trimmed = name.trim();
  const key = trimmed.toLowerCase();

  const { data: row } = await publicClient()
    .from("suburb_locations")
    .select("suburb, state, latitude, longitude")
    .eq("suburb_key", key)
    .maybeSingle();
  if (row) {
    return { suburb: row.suburb, state: row.state, latitude: row.latitude, longitude: row.longitude };
  }

  // Only suburbs that a published listing uses (anonymous visitors can see
  // published listings only, so this check is made under the same rules).
  const { data: listing } = await publicClient()
    .from("listings")
    .select("id")
    .eq("status", "published")
    .ilike("suburb", trimmed)
    .limit(1)
    .maybeSingle();
  if (!listing) return null;

  const known = memory.get(key);
  if (known) return known;

  // Two visitors asking at once share one lookup.
  const pending =
    inflight.get(key) ??
    (async () => {
      const point = await geocode(trimmed);
      if (point) {
        memory.set(key, point);
        await remember(key, point);
      }
      return point;
    })();
  inflight.set(key, pending);
  try {
    return await pending;
  } finally {
    inflight.delete(key);
  }
}
