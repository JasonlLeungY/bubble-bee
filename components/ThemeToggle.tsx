"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "bubble-bee-theme";

// The theme is whatever the page shows: the attribute the toggle or the saved
// choice sets. Watching it keeps the icon right.
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

// The app opens light. Dark is used only once the visitor chooses it.
function getSnapshot(): "light" | "dark" {
  const applied = document.documentElement.getAttribute("data-theme");
  return applied === "dark" ? "dark" : "light";
}

/**
 * Switches between light and dark. The app opens light; the choice is
 * remembered in this browser. The layout applies the
 * saved choice before the page paints, so there is no flash.
 */
export default function ThemeToggle() {
  // Unknown on the server, so the icon is shown once the page is in the browser.
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => null);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="hive inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-neutral-300 text-neutral-900 transition hover:border-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 fill-none stroke-current stroke-[1.75]"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isDark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        )}
      </svg>
    </button>
  );
}
