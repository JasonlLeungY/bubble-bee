"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

function format(iso: string, timeZone?: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

/**
 * Shows a timestamp in the viewer's own time zone. The server does not know
 * that zone, so it renders UTC and the browser corrects it on load.
 */
export default function LocalTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => format(iso),
    () => format(iso, "UTC"),
  );
  return <time dateTime={iso}>{text}</time>;
}
