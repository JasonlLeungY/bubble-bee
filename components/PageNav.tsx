"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const buttonClass =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-neutral-300 px-3.5 py-2 text-sm font-semibold text-neutral-900 transition hover:border-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";

// The app pages visited in this tab, most recent last. Kept in sessionStorage
// so it survives reloads but not a new tab. The browser's own history cannot
// be used: a page opened directly has a blank entry behind it.
const STACK_KEY = "sharehouse-page-stack";
const MAX_ENTRIES = 25;

function readStack(): string[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STACK_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeStack(stack: string[]) {
  try {
    sessionStorage.setItem(STACK_KEY, JSON.stringify(stack.slice(-MAX_ENTRIES)));
  } catch {
    // Storage blocked (private mode, for example): Back falls back to Home.
  }
}

/**
 * Back and Home buttons for every page. Back goes to the page visited before
 * this one in the same tab, and to the home page when there is none.
 */
export default function PageNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const onHome = pathname === "/";

  useEffect(() => {
    const stack = readStack();
    if (stack.at(-1) === current) return;
    if (stack.length >= 2 && stack.at(-2) === current) {
      // Arrived by the browser's own Back button: step back one entry.
      writeStack(stack.slice(0, -1));
    } else {
      writeStack([...stack, current]);
    }
  }, [current]);

  function goBack() {
    const stack = readStack();
    if (stack.length >= 2) {
      const previous = stack[stack.length - 2];
      writeStack(stack.slice(0, -1));
      router.push(previous);
    } else {
      router.push("/");
    }
  }

  return (
    <nav
      aria-label="Page navigation"
      className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8"
    >
      <button type="button" onClick={goBack} className={buttonClass}>
        <span aria-hidden="true">←</span> Back
      </button>
      <Link
        href="/"
        aria-current={onHome ? "page" : undefined}
        className={`${buttonClass} ${onHome ? "bg-neutral-900 text-white hover:bg-neutral-800" : ""}`}
      >
        Home
      </Link>
    </nav>
  );
}
