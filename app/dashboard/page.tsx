import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { signOut } from "@/app/login/actions";
import { formatPrice } from "@/utils/listings";
import { createClient } from "@/utils/supabase/server";
import LifestyleForm from "./lifestyle-form";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <main className="min-h-screen flex-1 bg-white px-4 py-10 font-sans text-neutral-900">
      <div className="mx-auto w-full max-w-2xl">
        <Suspense
          fallback={<p className="text-sm text-neutral-500">Loading…</p>}
        >
          <Hub />
        </Suspense>
      </div>
    </main>
  );
}

// Reads the session cookie, so it renders at request time behind Suspense.
async function Hub() {
  // The Supabase client compares token expiry against the clock, which Next.js
  // will not allow in a prerender or prefetch. Render at request time only.
  await connection();
  const supabase = await createClient();

  // proxy.ts already guards this route; re-check next to the data anyway.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  const userId = data.claims.sub;

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, role, is_smoker, is_shift_worker, tolerates_noise")
    .eq("id", userId)
    .maybeSingle();
  const isLandlord = profile?.role === "landlord";

  const { data: listings } = isLandlord
    ? await supabase
        .from("listings")
        .select("id, title, suburb, price_per_week, image_urls")
        .eq("landlord_id", userId)
        .order("created_at", { ascending: false })
    : { data: null };

  return (
    <>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] leading-8 font-semibold tracking-tight">
            Welcome{profile?.first_name ? `, ${profile.first_name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{data.claims.email}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/messages"
            className="rounded-lg border border-neutral-300 px-3.5 py-2 text-sm font-semibold transition hover:border-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            Messages
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="cursor-pointer rounded-lg border border-neutral-300 px-3.5 py-2 text-sm font-semibold transition hover:border-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      {isLandlord ? (
        <section className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Your listings</h2>
            <Link
              href="/dashboard/new"
              className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              Create New Listing
            </Link>
          </div>

          {listings && listings.length > 0 ? (
            <ul className="mt-4 divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
              {listings.map((listing) => (
                <li key={listing.id}>
                  <Link
                    href={`/listings/${listing.id}`}
                    className="flex items-center gap-4 p-4 transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-900"
                  >
                  {listing.image_urls?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={listing.image_urls[0]}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-xl bg-neutral-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{listing.title}</p>
                    <p className="text-sm text-neutral-500">{listing.suburb}</p>
                  </div>
                  <p className="shrink-0 text-sm">
                    <span className="font-semibold">
                      {formatPrice(listing.price_per_week)}
                    </span>
                    <span className="text-neutral-500"> / week</span>
                  </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500">
              You have no listings yet. Create your first one to start
              receiving enquiries.
            </p>
          )}
        </section>
      ) : (
        <section className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Your lifestyle</h2>
            <Link
              href="/"
              className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              Browse rooms
            </Link>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Landlords set house rules. You can only contact houses whose rules
            fit the answers below, so keep them honest.
          </p>
          <div className="mt-4">
            <LifestyleForm
              initial={{
                isSmoker: profile?.is_smoker ?? false,
                isShiftWorker: profile?.is_shift_worker ?? false,
                toleratesNoise: profile?.tolerates_noise ?? false,
              }}
            />
          </div>
        </section>
      )}
    </>
  );
}
