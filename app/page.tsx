import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LifestyleBadges } from "@/components/Lifestyle";
import SiteHeader from "@/components/SiteHeader";
import { recordPageView } from "@/utils/analytics";
import { formatPrice, listingImages } from "@/utils/listings";
import { createClient } from "@/utils/supabase/server";

const GRID_CLASS =
  "grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-white font-sans text-neutral-900">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-[26px] leading-8 font-semibold tracking-tight">
          Rooms in share houses
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Find a house that fits how you live. Newest listings first.
        </p>

        <div className="mt-8">
          <Suspense fallback={<GridSkeleton />}>
            <ListingGrid />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

// Fetched per request so a new listing shows up straight away.
async function ListingGrid() {
  await connection();
  void recordPageView("/");
  const supabase = await createClient();
  const { data: listings, error } = await supabase
    .from("listings")
    .select(
      "id, title, suburb, price_per_week, image_urls, is_smoker_allowed, is_shift_worker_friendly, tolerates_noise",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-8 text-sm text-rose-800"
      >
        We could not load the rooms just now. Refresh the page to try again.
      </p>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-16 text-center">
        <p className="font-semibold">No rooms listed yet</p>
        <p className="mt-1 text-sm text-neutral-500">
          Have a room to fill? Create a landlord account and list it.
        </p>
        <Link
          href="/signup"
          className="hive mt-5 inline-block rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          List a room
        </Link>
      </div>
    );
  }

  return (
    <ul className={GRID_CLASS}>
      {listings.map((listing, index) => {
        const cover = listingImages(listing.image_urls)[0];
        return (
          <li key={listing.id}>
            <Link
              href={`/listings/${listing.id}`}
              className="listing-card group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900"
            >
              <div className="relative aspect-square overflow-hidden rounded-xl bg-neutral-100">
                {cover ? (
                  <Image
                    src={cover}
                    alt={`Photo of ${listing.title}`}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
                    // The first row is above the fold; the rest load on scroll.
                    loading={index < 4 ? "eager" : "lazy"}
                    className="object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <NoPhoto />
                )}
              </div>

              <div className="mt-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-semibold">{listing.suburb}</p>
                  <p className="shrink-0">
                    <span className="font-semibold">
                      {formatPrice(listing.price_per_week)}
                    </span>
                    <span className="text-neutral-500"> / week</span>
                  </p>
                </div>
                <p className="mt-0.5 truncate text-neutral-500">
                  {listing.title}
                </p>
                <LifestyleBadges listing={listing} />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function NoPhoto() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-neutral-400">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-9 w-9 fill-none stroke-current stroke-[1.5]"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M9.5 21v-6h5v6" />
      </svg>
      <span className="text-xs">No photos yet</span>
    </div>
  );
}

function GridSkeleton() {
  return (
    <ul className={GRID_CLASS} aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <li key={index} className="animate-pulse">
          <div className="aspect-square rounded-xl bg-neutral-200" />
          <div className="mt-3 h-4 w-2/3 rounded bg-neutral-200" />
          <div className="mt-2 h-4 w-1/2 rounded bg-neutral-100" />
        </li>
      ))}
    </ul>
  );
}
