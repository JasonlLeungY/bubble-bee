// Looks up the centre of each suburb with Google's Geocoding service and
// prints SQL that adds them to public.suburb_locations. Run it on your own
// computer, check each result, then paste the SQL into the Supabase SQL Editor.
//
//   node scripts/suburb-coordinates.mjs Marleston Glebe
//
// Needs GOOGLE_MAPS_API_KEY in the environment (a server key with the Geocoding
// API enabled). Only suburb centres are looked up, never street addresses.

const endpoint = process.env.GOOGLE_GEOCODE_URL ?? "https://maps.googleapis.com/maps/api/geocode/json";
const key = process.env.GOOGLE_MAPS_API_KEY;
if (!key) {
  console.error("Set GOOGLE_MAPS_API_KEY first (a server key with the Geocoding API enabled).");
  process.exit(1);
}
const names = process.argv.slice(2);

if (names.length === 0) {
  console.error("Give at least one suburb name, e.g. node scripts/suburb-coordinates.mjs Marleston");
  process.exit(1);
}

const PLACE_TYPES = ["locality", "sublocality", "sublocality_level_1", "neighborhood", "postal_town"];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sqlText = (value) => `'${String(value).replace(/'/g, "''")}'`;

for (const [index, name] of names.entries()) {
  if (index > 0) await sleep(1100);

  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    address: `${name}, Australia`,
    components: "country:AU",
    region: "au",
    key,
  });

  // The URL holds the key, so errors print the status only.
  const response = await fetch(url);
  if (!response.ok) {
    console.log(`-- ${name}: lookup failed (HTTP ${response.status}). Try again later.`);
    continue;
  }

  const body = await response.json();
  if (body.status !== "OK") {
    console.log(`-- ${name}: lookup status ${body.status}. ${body.error_message ?? "Add its coordinates by hand."}`);
    continue;
  }
  const place = body.results.find((r) => r.types.some((t) => PLACE_TYPES.includes(t))) ?? body.results[0];
  if (!place) {
    console.log(`-- ${name}: no result found. Add its coordinates by hand.`);
    continue;
  }

  const state = place.address_components.find((c) => c.types.includes("administrative_area_level_1"))?.long_name ?? null;
  const location = place.geometry.location;
  const suburbKey = name.trim().toLowerCase();
  console.log(`-- ${name}: matched "${place.formatted_address}". Check this is the right place.`);
  console.log("insert into public.suburb_locations (suburb_key, suburb, state, latitude, longitude, source)");
  console.log(
    `values (${sqlText(suburbKey)}, ${sqlText(name.trim())}, ${sqlText(state)}, ${Number(location.lat)}, ${Number(location.lng)}, 'google')`,
  );
  console.log("on conflict (suburb_key) do nothing;");
  console.log(`update public.listings set suburb = suburb where lower(btrim(suburb)) = ${sqlText(suburbKey)};`);
  console.log(`update public.job_posts set suburb = suburb where lower(btrim(suburb)) = ${sqlText(suburbKey)};`);
  console.log("");
}
