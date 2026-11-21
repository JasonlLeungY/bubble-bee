"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/utils/google-maps";

// Radius of the shaded area, in metres. The map shows the suburb, not the
// address: the circle is deliberately much wider than a street.
const AREA_RADIUS_METRES = 900;

// Google Maps runs in the browser. SuburbMapButton loads this file with ssr: false.
export default function SuburbMap({
  suburb,
  latitude,
  longitude,
}: {
  suburb: string;
  latitude: number;
  longitude: number;
}) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!key || !ref.current) return;
    let cancelled = false;
    const element = ref.current;

    loadGoogleMaps(key)
      .then((maps) => {
        if (cancelled) return;
        const centre = { lat: latitude, lng: longitude };
        const map = new maps.Map(element, {
          center: centre,
          zoom: 14,
          gestureHandling: "cooperative",
          mapTypeControl: false,
          streetViewControl: false,
        });
        new maps.Circle({
          map,
          center: centre,
          radius: AREA_RADIUS_METRES,
          strokeColor: "#e11d48",
          strokeWeight: 2,
          fillColor: "#e11d48",
          fillOpacity: 0.15,
        });
        // The suburb name is set as text, so it cannot inject markup.
        const label = document.createElement("strong");
        label.textContent = suburb;
        new maps.InfoWindow({ content: label, position: centre }).open({ map });
      })
      .catch(() => {
        if (!cancelled) setError("The map could not be loaded. Try again in a moment.");
      });

    return () => {
      cancelled = true;
    };
  }, [key, latitude, longitude, suburb]);

  if (!key) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-neutral-600">
        The map is not set up yet. The site owner needs to add the Google Maps key.
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-neutral-600">
        {error}
      </div>
    );
  }
  return <div ref={ref} className="h-full w-full" />;
}
