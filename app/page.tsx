import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LifestyleBadges } from "@/components/Lifestyle";
import SiteHeader from "@/components/SiteHeader";
import { recordPageView } from "@/utils/analytics";
import { formatPrice, listingImages } from "@/utils/listings";
import { viewerAccess } from "@/utils/tenant-gate";
import { createClient } from "@/utils/supabase/server";

const GRID_CLASS =
  "grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

const PAGE_SIZE = 10;
const CARD_COLUMNS =
  "id, title, suburb, price_per_week, image_urls, is_smoker_allowed, is_shift_worker_friendly, tolerates_noise";

export default function HomePage({ searchParams }: PageProps<"/">) {
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
            <ListingGrid searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

// Fetched per request so a new listing shows up straight away.
async function ListingGrid({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  await connection();
  void recordPageView("/");
  const { page: pageParam } = await searchParams;
  const requested = Array.isArray(pageParam) ? pageParam[0] : pageParam;
  const page = Math.max(1, Number.parseInt(requested ?? "1", 10) || 1);

  const supabase = await createClient();
  const access = await viewerAccess(supabase);

  // The first page is open to everyone. Later pages need a finished profile.
  if (page > 1 && access !== "full") {
    return <MoreRoomsPrompt access={access} />;
  }

  let listings: CardListing[] | null = null;
  let error = null;
  let hasNext = false;

  if (page === 1) {
    // Everyone: the newest 10, from a view that exposes only card details.
    const result = await supabase
      .from("first_page_listings")
      .select(CARD_COLUMNS)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE);
    listings = result.data;
    error = result.error;
    hasNext = (listings?.length ?? 0) === PAGE_SIZE;
  } else {
    // Full access, page 2 onwards. One extra row tells us whether there is a next page.
    const from = (page - 1) * PAGE_SIZE;
    const result = await supabase
      .from("listings")
      .select(CARD_COLUMNS)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE_SIZE);
    error = result.error;
    hasNext = (result.data?.length ?? 0) > PAGE_SIZE;
    listings = (result.data ?? []).slice(0, PAGE_SIZE);
  }

  if (error || !listings) {
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
    <>
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

      <nav aria-label="Pages" className="mt-10 flex items-center justify-between gap-4 text-sm">
        {page > 1 ? (
          <Link href={page === 2 ? "/" : `/?page=${page - 1}`} className="font-semibold underline underline-offset-2">
            Previous page
          </Link>
        ) : (
          <span />
        )}
        {hasNext && (
          <Link href={`/?page=${page + 1}`} className="font-semibold underline underline-offset-2">
            Next page
          </Link>
        )}
      </nav>

      {access !== "full" && <AccessNote access={access} />}
    </>
  );
}

type CardListing = {
  id: string;
  title: string;
  suburb: string;
  price_per_week: number;
  image_urls: string[] | null;
  is_smoker_allowed: boolean;
  is_shift_worker_friendly: boolean;
  tolerates_noise: boolean;
};

// Shown to guests and unfinished tenants under the first page.
function AccessNote({ access }: { access: "guest" | "profile-incomplete" }) {
  const isGuest = access === "guest";
  return (
    <div className="mt-10 rounded-2xl border border-neutral-200 px-6 py-6 text-center">
      <p className="font-semibold">
        {isGuest ? "Create a free account to see the full listing" : "Finish your profile to see the full listing"}
      </p>
      <p className="mt-1 text-sm text-neutral-500">
        {isGuest
          ? "Open a room, see every photo and detail, and see more rooms."
          : "Answer the sign-up questions to open rooms and see more of them."}
      </p>
      <Link
        href={isGuest ? "/signup" : "/dashboard/profile"}
        className="hive mt-5 inline-block rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
      >
        {isGuest ? "Create an account" : "Finish your profile"}
      </Link>
    </div>
  );
}

// Shown in place of pages 2 and up for guests and unfinished tenants.
function MoreRoomsPrompt({ access }: { access: "guest" | "profile-incomplete" }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-16 text-center">
      <p className="font-semibold">See more rooms</p>
      <p className="mt-1 text-sm text-neutral-500">
        {access === "guest" ? "Create an account to browse every page." : "Finish your profile to browse every page."}
      </p>
      <Link
        href={access === "guest" ? "/signup" : "/dashboard/profile"}
        className="hive mt-5 inline-block rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
      >
        {access === "guest" ? "Create an account" : "Finish your profile"}
      </Link>
    </div>
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
