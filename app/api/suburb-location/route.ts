import { SUBURB_PATTERN, findSuburb } from "@/utils/suburb-lookup";

// GET /api/suburb-location?suburb=Marleston
// Returns the centre of a suburb for the listing map. Suburb names only; no
// listing ids or addresses are accepted or returned.
export async function GET(request: Request) {
  const name = (new URL(request.url).searchParams.get("suburb") ?? "").trim();
  if (!SUBURB_PATTERN.test(name)) {
    return Response.json({ error: "Enter a suburb name." }, { status: 400 });
  }

  try {
    const point = await findSuburb(name);
    if (!point) {
      return Response.json({ error: "This suburb is not on the map yet." }, { status: 404 });
    }
    return Response.json(point, { headers: { "cache-control": "public, max-age=3600" } });
  } catch (error) {
    console.error("Suburb lookup failed", error);
    return Response.json({ error: "The map could not be loaded." }, { status: 502 });
  }
}
