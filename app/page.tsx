import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import JobBoard from "@/components/JobBoard";
import ModeSwitcher from "@/components/ModeSwitcher";
import type { ApplyMode, JobCardData } from "@/components/JobCard";
import { applyModeFor } from "@/utils/job-search";
import { LifestyleBadges } from "@/components/Lifestyle";
import SiteHeader from "@/components/SiteHeader";
import { recordPageView } from "@/utils/analytics";
import { formatPrice, listingImages } from "@/utils/listings";
import { SUBURB_PATTERN, knownSuburb, verifyAustralianSuburb } from "@/utils/suburb-lookup";
import { viewerAccess, type ViewerAccess } from "@/utils/tenant-gate";
import { createClient } from "@/utils/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const GRID_CLASS =
  "grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
const PAGE_SIZE = 10;
// The home page shows two jobs, to keep the first page clean. "See all" opens the rest.
const HOME_JOB_COUNT = 2;
const RADIUS_OPTIONS = [5, 10, 25, 50] as const;
const DEFAULT_RADIUS = 10;
const MAX_PRICE = 10000;

const CATEGORIES = [
  { key: "jobs", label: "Jobs" },
  { key: "share_house", label: "Share house" },
  { key: "entire_home", label: "Entire home" },
] as const;
type Category = (typeof CATEGORIES)[number]["key"];
type HomeType = "entire_home" | "share_house";

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

/** A search: the suburb the visitor typed, the radius, and the suburb's centre. */
type Search = { suburb: string; km: number; lat: number; lng: number };

/** Everything the visitor has chosen to narrow the results. */
type Filters = { search: Search | null; min: number | null; max: number | null; sort: Sort };

const NO_FILTERS: Filters = { search: null, min: null, max: null, sort: "newest" };

type SearchParams = Promise<{
  category?: string | string[];
  page?: string | string[];
  suburb?: string | string[];
  radius?: string | string[];
  min?: string | string[];
  max?: string | string[];
  sort?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePrice(value: string | undefined) {
  if (!value) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 && amount <= MAX_PRICE ? Math.round(amount * 100) / 100 : null;
}

export default function HomePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-white font-sans text-neutral-900">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-[26px] leading-8 font-semibold tracking-tight">Homes and jobs</h1>
        <p className="mt-1 text-sm text-neutral-500">Search a suburb, set a price range, and sort the results.</p>
        <div className="mt-6">
          <ModeSwitcher active="rooms" />
        </div>

        <div className="mt-8">
          <Suspense fallback={<GridSkeleton />}>
            <Feed searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

// Fetched per request so a new listing shows up straight away.
async function Feed({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  void recordPageView("/");
  const params = await searchParams;
  const requestedCategory = first(params.category);
  const category = CATEGORIES.find((option) => option.key === requestedCategory)?.key;
  const requestedPage = first(params.page);
  const page = Math.max(1, Number.parseInt(requestedPage ?? "1", 10) || 1);

  // The suburb and distance.
  const typed = (first(params.suburb) ?? "").trim();
  const suburbText = SUBURB_PATTERN.test(typed) ? typed : "";
  const radiusParam = Number.parseInt(first(params.radius) ?? "", 10);
  const km = (RADIUS_OPTIONS as readonly number[]).includes(radiusParam) ? radiusParam : DEFAULT_RADIUS;

  // The price range. A price that is not a number, or a minimum above the maximum, is ignored with a message.
  const minRaw = (first(params.min) ?? "").trim();
  const maxRaw = (first(params.max) ?? "").trim();
  let min = parsePrice(minRaw);
  let max = parsePrice(maxRaw);
  let priceProblem: string | null = null;
  if ((minRaw && min === null) || (maxRaw && max === null)) {
    priceProblem = "Enter prices between 0 and 10,000. Showing all prices.";
    min = null;
    max = null;
  } else if (min !== null && max !== null && min > max) {
    priceProblem = "The minimum price is higher than the maximum. Showing all prices.";
    min = null;
    max = null;
  }

  // The sort order.
  const sortParam = first(params.sort);
  const sort: Sort = SORTS.find((option) => option.value === sortParam)?.value ?? "newest";

  const supabase = await createClient();
  const access = await viewerAccess(supabase);
  const { data: suburbRows } = await supabase.rpc("browse_suburbs");
  const suburbs = (suburbRows ?? []).map((row: { suburb: string }) => row.suburb);

  // Find the centre of the searched suburb. If it is not in Australia, say so.
  let search: Search | null = null;
  let searchProblem: string | null = null;
  if (suburbText) {
    try {
      // Guests search only suburbs that are already on the map. Anyone else
      // may trigger a paid lookup for a new suburb.
      const point =
        access === "guest" ? await knownSuburb(suburbText) : await verifyAustralianSuburb(suburbText);
      if (point) {
        search = { suburb: suburbText, km, lat: point.latitude, lng: point.longitude };
      } else {
        searchProblem =
          access === "guest"
            ? `Create an account to search for "${suburbText}", or pick a suburb that is already listed.`
            : `We could not find "${suburbText}" in Australia. Check the suburb name.`;
      }
    } catch (error) {
      console.error("Suburb search failed", error);
      searchProblem = "We could not check that suburb just now. Try again in a moment.";
    }
  }

  const filters: Filters = { search, min, max, sort };
  const picker = (
    <SearchForm
      suburbs={suburbs}
      typed={suburbText}
      km={km}
      min={min}
      max={max}
      sort={sort}
      category={category ?? null}
      filtered={Boolean(suburbText || min !== null || max !== null || sort !== "newest")}
    />
  );

  if (searchProblem) {
    return (
      <>
        {picker}
        <p role="alert" className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-6 text-sm text-rose-800">
          {searchProblem}
        </p>
      </>
    );
  }

  const notices = priceProblem && (
    <p role="status" className="mt-6 rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
      {priceProblem}
    </p>
  );

  // The front page: the first 10 of each category, all on one page.
  if (!category) {
    return (
      <>
        {picker}
        {notices}
        <Tabs active="all" filters={filters} />
        {summary(filters)}
        <div className="mt-8 space-y-12">
          <Section title="Jobs" href={hrefFor({ category: "jobs", filters })}>
            <JobSection supabase={supabase} search={search} applyMode={await applyModeFor(supabase, access)} />
          </Section>
          <Section title="Share house" href={hrefFor({ category: "share_house", filters })}>
            <ListingSection supabase={supabase} homeType="share_house" filters={filters} />
          </Section>
          <Section title="Entire home" href={hrefFor({ category: "entire_home", filters })}>
            <ListingSection supabase={supabase} homeType="entire_home" filters={filters} />
          </Section>
        </div>
        {access !== "full" && <AccessNote access={access} noun="listing" />}
      </>
    );
  }

  // Local jobs have their own page now.
  if (category === "jobs") redirect("/jobs");

  // One category, with paging. Pages after the first need a finished profile.
  return (
    <>
      {picker}
      {notices}
      <Tabs active={category} filters={filters} />
      {summary(filters)}
      <div className="mt-8">
        <ListingFeed page={page} access={access} supabase={supabase} homeType={category} filters={filters} />
      </div>
    </>
  );
}

/** One line saying what the results are narrowed to. */
function summary(filters: Filters) {
  const parts: string[] = [];
  if (filters.search) parts.push(`within ${filters.search.km} km of ${filters.search.suburb}`);
  if (filters.min !== null || filters.max !== null) {
    parts.push(
      filters.min !== null && filters.max !== null
        ? `${formatPrice(filters.min)} to ${formatPrice(filters.max)} a week`
        : filters.min !== null
          ? `from ${formatPrice(filters.min)} a week`
          : `up to ${formatPrice(filters.max ?? 0)} a week`,
    );
  }
  if (parts.length === 0) return null;
  return <p className="mt-6 text-sm text-neutral-600">Showing listings {parts.join(", ")}.</p>;
}

/** A link to the front page or a category, keeping the search, price range and sort. */
function hrefFor({ category, page, filters }: { category?: Category; page?: number; filters: Filters }) {
  const query = new URLSearchParams();
  if (category) query.set("category", category);
  if (page && page > 1) query.set("page", String(page));
  if (filters.search) {
    query.set("suburb", filters.search.suburb);
    query.set("radius", String(filters.search.km));
  }
  if (filters.min !== null) query.set("min", String(filters.min));
  if (filters.max !== null) query.set("max", String(filters.max));
  if (filters.sort !== "newest") query.set("sort", filters.sort);
  const text = query.toString();
  return text ? `/?${text}` : "/";
}

// Suburb, distance, price range and sort. Works without JavaScript.
function SearchForm({
  suburbs,
  typed,
  km,
  min,
  max,
  sort,
  category,
  filtered,
}: {
  suburbs: string[];
  typed: string;
  km: number;
  min: number | null;
  max: number | null;
  sort: Sort;
  category: Category | null;
  filtered: boolean;
}) {
  const inputClass =
    "mt-1.5 block rounded-lg border border-neutral-400 bg-white px-3.5 py-2.5 text-base text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900";
  return (
    <form action="/" method="get" className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
      {category && <input type="hidden" name="category" value={category} />}
      <label className="col-span-2 block text-sm font-semibold sm:col-auto">
        Suburb
        <input
          name="suburb"
          list="suburb-options"
          defaultValue={typed}
          placeholder="For example Glebe"
          maxLength={80}
          autoComplete="off"
          className={`${inputClass} w-full sm:w-56`}
        />
        <datalist id="suburb-options">
          {suburbs.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      <label className="block text-sm font-semibold">
        Within
        <select name="radius" defaultValue={String(km)} className={`${inputClass} w-full sm:w-auto`}>
          {RADIUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option} km
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold">
        Min price a week
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-base text-neutral-500">$</span>
        <input
          name="min"
          type="number"
          inputMode="decimal"
          min={0}
          max={MAX_PRICE}
          step={10}
          placeholder="0"
          defaultValue={min ?? ""}
          className={`${inputClass} w-full pl-8 sm:w-32`}
        />
        </div>
      </label>
      <label className="block text-sm font-semibold">
        Max price a week
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-base text-neutral-500">$</span>
        <input
          name="max"
          type="number"
          inputMode="decimal"
          min={0}
          max={MAX_PRICE}
          step={10}
          placeholder="No limit"
          defaultValue={max ?? ""}
          className={`${inputClass} w-full pl-8 sm:w-32`}
        />
        </div>
      </label>
      <label className="block text-sm font-semibold">
        Sort by
        <select name="sort" defaultValue={sort} className={`${inputClass} w-full sm:w-auto`}>
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="hive col-span-2 min-h-11 cursor-pointer rounded-lg border border-neutral-900 px-4 py-2.5 text-sm font-semibold transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 sm:col-auto"
      >
        Search
      </button>
      {filtered && (
        <Link
          href={hrefFor({ category: category ?? undefined, filters: NO_FILTERS })}
          className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2"
        >
          Clear
        </Link>
      )}
    </form>
  );
}

function Tabs({ active, filters }: { active: Category | "all"; filters: Filters }) {
  const tabs = [
    { key: "all", label: "All", href: hrefFor({ filters }) },
    ...CATEGORIES.map((c) => ({ key: c.key, label: c.label, href: hrefFor({ category: c.key, filters }) })),
  ];
  return (
    <nav aria-label="Categories" className="mt-6 flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${
              isActive
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 text-neutral-800 hover:border-neutral-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Section({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-2xl leading-8 font-semibold tracking-tight sm:text-3xl sm:leading-9 lg:text-4xl lg:leading-10">{title}</h2>
        <Link href={href} className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2">
          See all
        </Link>
      </div>
      <div className="mt-5">{children}</div>
    </section>
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
  /** Set only in a distance search. */
  distance_km?: number | null;
};


function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500">
      {message}
    </div>
  );
}

function LoadError() {
  return (
    <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-8 text-sm text-rose-800">
      We could not load the rooms just now. Refresh the page to try again.
    </p>
  );
}

function emptyListingText(homeType: HomeType, filters: Filters) {
  const what = homeType === "entire_home" ? "entire homes" : "share houses";
  const narrowed = filters.min !== null || filters.max !== null;
  if (filters.search) {
    return `No ${what} within ${filters.search.km} km of ${filters.search.suburb}${narrowed ? " in this price range" : ""}.`;
  }
  return narrowed ? `No ${what} in this price range.` : `No ${what} listed yet.`;
}

function emptyJobText(search: Search | null) {
  return search ? `No jobs within ${search.km} km of ${search.suburb}.` : "No jobs posted yet.";
}

/** The listings for one search: any suburb, price range and sort, one page at a time. */
function findListings(
  supabase: Supabase,
  { homeType, filters, offset, limit }: { homeType: HomeType; filters: Filters; offset: number; limit: number },
) {
  return supabase.rpc("find_listings", {
    p_home_type: homeType,
    p_lat: filters.search?.lat ?? null,
    p_lng: filters.search?.lng ?? null,
    p_km: filters.search?.km ?? null,
    p_min_price: filters.min,
    p_max_price: filters.max,
    p_sort: filters.sort,
    p_offset: offset,
    p_limit: limit,
  });
}

// Listings of one home type: the first 10 for the front page.
async function ListingSection({ supabase, homeType, filters }: { supabase: Supabase; homeType: HomeType; filters: Filters }) {
  const { data, error } = await findListings(supabase, { homeType, filters, offset: 0, limit: PAGE_SIZE });
  if (error || !data) return <LoadError />;
  if (data.length === 0) return <EmptyState message={emptyListingText(homeType, filters)} />;
  return <ListingCards listings={data} />;
}

async function JobSection({
  supabase,
  search,
  applyMode,
}: {
  supabase: Supabase;
  search: Search | null;
  applyMode: ApplyMode;
}) {
  const { data, error } = await supabase.rpc("find_jobs", {
    p_lat: search?.lat ?? null,
    p_lng: search?.lng ?? null,
    p_km: search?.km ?? null,
    p_types: null,
    p_min_rate: null,
    p_immediate: false,
    p_shifts: null,
    p_bundle: false,
    p_offset: 0,
    p_limit: HOME_JOB_COUNT,
  });
  if (error || !data) return <LoadError />;
  if (data.length === 0) return <EmptyState message={emptyJobText(search)} />;
  // Guests get up to 10 from the database whatever the limit, so cap it here too.
  return <JobBoard jobs={(data as JobCardData[]).slice(0, HOME_JOB_COUNT)} mode={applyMode} />;
}

function ListingCards({ listings }: { listings: CardListing[] }) {
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
                  <p className="truncate font-semibold">
                    {listing.suburb}
                    {listing.distance_km !== undefined && listing.distance_km !== null && (
                      <span className="ml-2 text-sm font-normal text-neutral-500">{listing.distance_km} km away</span>
                    )}
                  </p>
                  <p className="shrink-0">
                    <span className="font-semibold">{formatPrice(listing.price_per_week)}</span>
                    <span className="text-neutral-500"> / week</span>
                  </p>
                </div>
                <p className="mt-0.5 truncate text-neutral-500">{listing.title}</p>
                <LifestyleBadges listing={listing} />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}


// One category, with paging.
async function ListingFeed({
  page,
  access,
  supabase,
  homeType,
  filters,
}: {
  page: number;
  access: ViewerAccess;
  supabase: Supabase;
  homeType: HomeType;
  filters: Filters;
}) {
  if (page > 1 && access !== "full") {
    return <MoreRoomsPrompt access={access} noun="rooms" />;
  }

  // One extra row tells us whether there is a next page. Guests only ever get the first 10.
  const { data, error } = await findListings(supabase, {
    homeType,
    filters,
    offset: (page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE + 1,
  });
  const hasNext = (data?.length ?? 0) > PAGE_SIZE;
  const listings = (data ?? []).slice(0, PAGE_SIZE);

  if (error || !data) return <LoadError />;
  if (listings.length === 0) return <EmptyState message={emptyListingText(homeType, filters)} />;

  return (
    <>
      <ListingCards listings={listings} />
      <Pager category={homeType} page={page} hasNext={hasNext} filters={filters} />
      {access !== "full" && <AccessNote access={access} noun="listing" />}
    </>
  );
}

// One category, with paging: the newest jobs (within the search, if there is one).

function Pager({ category, page, hasNext, filters }: { category: Category; page: number; hasNext: boolean; filters: Filters }) {
  const pageHref = (target: number) => hrefFor({ category, page: target, filters });
  return (
    <nav aria-label="Pages" className="mt-10 flex items-center justify-between gap-4 text-sm">
      {page > 1 ? (
        <Link href={pageHref(page - 1)} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
          Previous page
        </Link>
      ) : (
        <span />
      )}
      {hasNext && (
        <Link href={pageHref(page + 1)} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
          Next page
        </Link>
      )}
    </nav>
  );
}

// Shown under the first page to guests and unfinished tenants.
function AccessNote({ access, noun }: { access: ViewerAccess; noun: string }) {
  if (access === "full") return null;
  const isGuest = access === "guest";
  return (
    <div className="mt-10 rounded-2xl border border-neutral-200 px-6 py-6 text-center">
      <p className="font-semibold">
        {isGuest ? `Create a free account to see the full ${noun}` : `Finish your profile to see the full ${noun}`}
      </p>
      <p className="mt-1 text-sm text-neutral-500">
        {isGuest
          ? `Open a ${noun}, see every photo and detail, and see more.`
          : `Answer the sign-up questions to open ${noun}s and see more of them.`}
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
function MoreRoomsPrompt({ access, noun }: { access: ViewerAccess; noun: string }) {
  if (access === "full") return null;
  const isGuest = access === "guest";
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-16 text-center">
      <p className="font-semibold">See more {noun}</p>
      <p className="mt-1 text-sm text-neutral-500">
        {isGuest ? "Create an account to browse every page." : "Finish your profile to browse every page."}
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
