import { createClient } from "@supabase/supabase-js";

// Finds the centre of a suburb for the listing map. Server-side only.
//
// Order: 1) the suburb_locations table, 2) this server's memory, 3) a
// Google Geocoding lookup. A lookup result is saved to the table, so
// each suburb is looked up at most once.
//
// Only suburbs that a published listing uses are looked up, so this cannot be
// used to send arbitrary searches to the geocoder.

export type SuburbPoint = {
  suburb: string;
  state: string | null;
  latitude: number;
  longitude: number;
};

// Letters, spaces, apostrophes, hyphens and full stops (listings contain
// names such as "Wynn Vale.").
export const SUBURB_PATTERN = /^[A-Za-z][A-Za-z.' -]{0,79}$/;

const GEOCODE_URL = process.env.GOOGLE_GEOCODE_URL ?? "https://maps.googleapis.com/maps/api/geocode/json";
// Google's types for a suburb-sized place.
const PLACE_TYPES = ["locality", "sublocality", "sublocality_level_1", "neighborhood", "postal_town"];

type GoogleResult = {
  geometry: { location: { lat: number; lng: number } };
  types: string[];
  address_components: { long_name: string; short_name: string; types: string[] }[];
};

const memory = new Map<string, SuburbPoint>();
const notFoundAt = new Map<string, number>();
const DAY_MS = 24 * 60 * 60 * 1000;
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

// One geocoding request at a time, at least 1.1 s apart.
function geocode(name: string): Promise<SuburbPoint | null> {
  const next = queue.then(() => search(name));
  queue = next.catch(() => null).then(() => new Promise((resolve) => setTimeout(resolve, 1100)));
  return next;
}

async function search(name: string): Promise<SuburbPoint | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not set.");

  // Drop a trailing full stop before searching; keep the name as the listing has it.
  const query = name.replace(/\.$/, "").trim();
  const url = new URL(GEOCODE_URL);
  url.search = new URLSearchParams({
    address: `${query}, Australia`,
    components: "country:AU",
    region: "au",
    key,
  }).toString();

  // Errors name the status only: the URL holds the key and must never be logged.
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Geocoder returned ${response.status}`);

  const body = (await response.json()) as { status: string; results?: GoogleResult[] };
  if (body.status === "ZERO_RESULTS") return null;
  if (body.status !== "OK") throw new Error(`Geocoder status ${body.status}`);

  // Only accept a suburb-sized place in Australia, never a street.
  const place = (body.results ?? []).find(
    (result) =>
      result.types.some((type) => PLACE_TYPES.includes(type)) &&
      result.address_components.some((part) => part.types.includes("country") && part.short_name === "AU"),
  );
  if (!place) return null;

  const { lat: latitude, lng: longitude } = place.geometry.location;
  if (!inAustralia(latitude, longitude)) return null;

  const state =
    place.address_components.find((part) => part.types.includes("administrative_area_level_1"))?.long_name ?? null;
  return { suburb: name, state, latitude, longitude };
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
        source: "google",
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

/**
 * For saving a listing or a job: the suburb must be a real place in Australia.
 * Unlike findSuburb, this does not require a listing to exist first. A place
 * found once is remembered, so it is looked up at most once.
 *
 * Returns the place, or null when the geocoder has no Australian place by that
 * name. Throws when the geocoder cannot be reached.
 */
export async function verifyAustralianSuburb(name: string): Promise<SuburbPoint | null> {
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

  const known = memory.get(key);
  if (known) return known;
  const missing = notFoundAt.get(key);
  if (missing !== undefined && Date.now() - missing < DAY_MS) return null;

  const pending =
    inflight.get(key) ??
    (async () => {
      const point = await geocode(trimmed);
      if (point) {
        memory.set(key, point);
        await remember(key, point);
      } else {
        notFoundAt.set(key, Date.now());
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

/** The message to show when a suburb cannot be accepted, or null if it can. */
export async function suburbProblem(name: string): Promise<string | null> {
  try {
    const point = await verifyAustralianSuburb(name);
    return point ? null : `We could not find "${name.trim()}" in Australia. Check the suburb name.`;
  } catch (error) {
    console.error("Suburb check failed", error);
    return "We could not check the suburb just now. Try again in a moment.";
  }
}

/**
 * A suburb that is already on the map. Never calls the geocoder, so anonymous
 * visitors can use it without costing a paid lookup.
 */
export async function knownSuburb(name: string): Promise<SuburbPoint | null> {
  const { data: row } = await publicClient()
    .from("suburb_locations")
    .select("suburb, state, latitude, longitude")
    .eq("suburb_key", name.trim().toLowerCase())
    .maybeSingle();
  if (!row) return null;
  return { suburb: row.suburb, state: row.state, latitude: row.latitude, longitude: row.longitude };
}
