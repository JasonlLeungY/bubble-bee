import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import BeeLogo from "./BeeLogo";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg text-lg font-bold tracking-tight text-yellow-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yellow-600"
        >
          <BeeLogo className="h-9 w-9" />
          Bubble Bee
        </Link>

        <nav className="flex items-center gap-2 text-sm font-semibold">
          {/* Reads the session, so it streams in after the static shell. */}
          <Suspense fallback={<span className="h-9 w-28" />}>
            <AccountLinks />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

const textLinkClass =
  "rounded-full px-3 py-2 transition hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";
const pillClass =
  "rounded-full border border-neutral-300 px-4 py-2 transition hover:border-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";

async function AccountLinks() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    return (
      <>
        <Link href="/messages" className={textLinkClass}>
          Messages
        </Link>
        <Link href="/dashboard" className={pillClass}>
          Dashboard
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href="/login" className={textLinkClass}>
        Log in
      </Link>
      <Link href="/signup" className={pillClass}>
        Sign up
      </Link>
    </>
  );
}
