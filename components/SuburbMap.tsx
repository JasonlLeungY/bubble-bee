"use client";

import "leaflet/dist/leaflet.css";
import { Circle, MapContainer, TileLayer, Tooltip } from "react-leaflet";

// Radius of the shaded area, in metres. The map shows the suburb, not the
// address: the circle is deliberately much wider than a street.
const AREA_RADIUS_METRES = 900;

// Leaflet needs the browser. Only SuburbMapButton loads this file, and it does
// so with ssr: false.
export default function SuburbMap({
  suburb,
  latitude,
  longitude,
}: {
  suburb: string;
  latitude: number;
  longitude: number;
}) {
  const centre: [number, number] = [latitude, longitude];

  return (
    <MapContainer center={centre} zoom={14} scrollWheelZoom={false} className="h-full w-full">
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <Circle
        center={centre}
        radius={AREA_RADIUS_METRES}
        pathOptions={{
          color: "#e11d48",
          weight: 2,
          fillColor: "#e11d48",
          fillOpacity: 0.15,
        }}
      >
        <Tooltip permanent direction="center" className="font-semibold">
          {suburb}
        </Tooltip>
      </Circle>
    </MapContainer>
  );
}
