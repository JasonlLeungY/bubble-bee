// Looks up the centre of each suburb with OpenStreetMap's Nominatim service and
// prints SQL that adds them to public.suburb_locations. Run it on your own
// computer, check each result, then paste the SQL into the Supabase SQL Editor.
//
//   node scripts/suburb-coordinates.mjs Marleston Glebe
//
// Nominatim allows one request per second and needs a descriptive user agent.
// Only suburb centres are looked up, never street addresses.

const endpoint = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org/search";
const names = process.argv.slice(2);

if (names.length === 0) {
  console.error("Give at least one suburb name, e.g. node scripts/suburb-coordinates.mjs Marleston");
  process.exit(1);
}

const PLACE_TYPES = ["suburb", "neighbourhood", "quarter", "locality", "village", "town", "city"];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sqlText = (value) => `'${String(value).replace(/'/g, "''")}'`;

for (const [index, name] of names.entries()) {
  if (index > 0) await sleep(1100);

  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    q: `${name}, Australia`,
    format: "jsonv2",
    countrycodes: "au",
    addressdetails: "1",
    limit: "5",
  });

  const response = await fetch(url, {
    headers: { "user-agent": "sharehouse-marketplace-suburb-lookup/1.0" },
  });
  if (!response.ok) {
    console.log(`-- ${name}: lookup failed (HTTP ${response.status}). Try again later.`);
    continue;
  }

  const results = await response.json();
  const place = results.find((r) => PLACE_TYPES.includes(r.addresstype)) ?? results[0];
  if (!place) {
    console.log(`-- ${name}: no result found. Add its coordinates by hand.`);
    continue;
  }

  const state = place.address?.state ?? null;
  const key = name.trim().toLowerCase();
  console.log(`-- ${name}: matched "${place.display_name}". Check this is the right place.`);
  console.log("insert into public.suburb_locations (suburb_key, suburb, state, latitude, longitude, source)");
  console.log(
    `values (${sqlText(key)}, ${sqlText(name.trim())}, ${sqlText(state)}, ${Number(place.lat)}, ${Number(place.lon)}, 'nominatim')`,
  );
  console.log("on conflict (suburb_key) do nothing;");
  console.log(`update public.listings set suburb = suburb where lower(btrim(suburb)) = ${sqlText(key)};`);
  console.log(`update public.job_posts set suburb = suburb where lower(btrim(suburb)) = ${sqlText(key)};`);
  console.log("");
}
