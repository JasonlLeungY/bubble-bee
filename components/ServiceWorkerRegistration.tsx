"use client";

import { useEffect } from "react";

/** Registers the minimal service worker that makes the site installable. */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installing still works from the browser menu without it.
      });
    }
  }, []);
  return null;
}
