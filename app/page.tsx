import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
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
const JOB_COLUMNS = "id, title, employer, suburb, pay, hours";
const RADIUS_OPTIONS = [5, 10, 25, 50] as const;
const DEFAULT_RADIUS = 10;
const MAX_PRICE = 10000;

const CATEGORIES = [
  { key: "entire_home", label: "Entire home" },
  { key: "share_house", label: "Share house" },
  { key: "jobs", label: "Jobs" },
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

  // The price range. A minimum above the maximum is ignored, with a message.
  let min = parsePrice(first(params.min));
  let max = parsePrice(first(params.max));
  let priceProblem: string | null = null;
  if (min !== null && max !== null && min > max) {
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
          <Section title="Entire home" href={hrefFor({ category: "entire_home", filters })}>
            <ListingSection supabase={supabase} homeType="entire_home" filters={filters} />
          </Section>
          <Section title="Share house" href={hrefFor({ category: "share_house", filters })}>
            <ListingSection supabase={supabase} homeType="share_house" filters={filters} />
          </Section>
          <Section title="Jobs" href={hrefFor({ category: "jobs", filters })}>
            <JobSection supabase={supabase} search={search} />
          </Section>
        </div>
        {access !== "full" && <AccessNote access={access} noun="listing" />}
      </>
    );
  }

  // One category, with paging. Pages after the first need a finished profile.
  return (
    <>
      {picker}
      {notices}
      <Tabs active={category} filters={filters} />
      {summary(filters)}
      <div className="mt-8">
        {category === "jobs" ? (
          <JobFeed page={page} access={access} supabase={supabase} search={search} filters={filters} />
        ) : (
          <ListingFeed page={page} access={access} supabase={supabase} homeType={category} filters={filters} />
        )}
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
    <form action="/" method="get" className="mt-6 flex flex-wrap items-end gap-3">
      {category && <input type="hidden" name="category" value={category} />}
      <label className="block text-sm font-semibold">
        Suburb
        <input
          name="suburb"
          list="suburb-options"
          defaultValue={typed}
          placeholder="For example Glebe"
          maxLength={80}
          autoComplete="off"
          className={`${inputClass} w-56`}
        />
        <datalist id="suburb-options">
          {suburbs.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      <label className="block text-sm font-semibold">
        Within
        <select name="radius" defaultValue={String(km)} className={inputClass}>
          {RADIUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option} km
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold">
        Min price a week
        <input
          name="min"
          type="number"
          inputMode="decimal"
          min={0}
          max={MAX_PRICE}
          step={10}
          placeholder="$0"
          defaultValue={min ?? ""}
          className={`${inputClass} w-32`}
        />
      </label>
      <label className="block text-sm font-semibold">
        Max price a week
        <input
          name="max"
          type="number"
          inputMode="decimal"
          min={0}
          max={MAX_PRICE}
          step={10}
          placeholder="No limit"
          defaultValue={max ?? ""}
          className={`${inputClass} w-32`}
        />
      </label>
      <label className="block text-sm font-semibold">
        Sort by
        <select name="sort" defaultValue={sort} className={inputClass}>
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="hive cursor-pointer rounded-lg border border-neutral-900 px-4 py-2.5 text-sm font-semibold transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
      >
        Search
      </button>
      {filtered && (
        <Link
          href={hrefFor({ category: category ?? undefined, filters: NO_FILTERS })}
          className="py-2.5 text-sm font-semibold underline underline-offset-2"
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
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <Link href={href} className="text-sm font-semibold underline underline-offset-2">
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

type CardJob = {
  id: string;
  title: string;
  employer: string;
  suburb: string;
  pay: string;
  hours: string | null;
  /** Set only in a distance search. */
  distance_km?: number;
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

async function JobSection({ supabase, search }: { supabase: Supabase; search: Search | null }) {
  if (search) {
    const { data, error } = await supabase.rpc("jobs_near", {
      p_lat: search.lat,
      p_lng: search.lng,
      p_km: search.km,
      p_offset: 0,
      p_limit: PAGE_SIZE,
    });
    if (error || !data) return <LoadError />;
    if (data.length === 0) return <EmptyState message={emptyJobText(search)} />;
    return <JobRows jobs={data} />;
  }

  const { data, error } = await supabase
    .from("first_page_jobs")
    .select(JOB_COLUMNS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);
  if (error || !data) return <LoadError />;
  if (data.length === 0) return <EmptyState message={emptyJobText(null)} />;
  return <JobRows jobs={data} />;
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

function JobRows({ jobs }: { jobs: CardJob[] }) {
  return (
    <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
      {jobs.map((job) => (
        <li key={job.id}>
          <Link
            href={`/jobs/${job.id}`}
            className="flex flex-col gap-1 px-5 py-4 transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-neutral-900 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold">{job.title}</span>
              <span className="block truncate text-sm text-neutral-500">
                {job.employer} · {job.suburb}
                {job.hours ? ` · ${job.hours}` : ""}
                {job.distance_km !== undefined ? ` · ${job.distance_km} km away` : ""}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold">{job.pay}</span>
          </Link>
        </li>
      ))}
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
async function JobFeed({
  page,
  access,
  supabase,
  search,
  filters,
}: {
  page: number;
  access: ViewerAccess;
  supabase: Supabase;
  search: Search | null;
  filters: Filters;
}) {
  if (page > 1 && access !== "full") {
    return <MoreRoomsPrompt access={access} noun="jobs" />;
  }

  const from = (page - 1) * PAGE_SIZE;
  let jobs: CardJob[] | null = null;
  let error = null;
  let hasNext = false;

  if (search) {
    const result = await supabase.rpc("jobs_near", {
      p_lat: search.lat,
      p_lng: search.lng,
      p_km: search.km,
      p_offset: from,
      p_limit: PAGE_SIZE + 1,
    });
    error = result.error;
    hasNext = (result.data?.length ?? 0) > PAGE_SIZE;
    jobs = (result.data ?? []).slice(0, PAGE_SIZE);
  } else if (page === 1 && access !== "full") {
    const result = await supabase
      .from("first_page_jobs")
      .select(JOB_COLUMNS)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE);
    jobs = result.data;
    error = result.error;
  } else {
    const result = await supabase
      .from("job_posts")
      .select(JOB_COLUMNS)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE_SIZE);
    error = result.error;
    hasNext = (result.data?.length ?? 0) > PAGE_SIZE;
    jobs = (result.data ?? []).slice(0, PAGE_SIZE);
  }

  if (error || !jobs) return <LoadError />;
  if (jobs.length === 0) return <EmptyState message={emptyJobText(search)} />;

  return (
    <>
      <JobRows jobs={jobs} />
      <Pager category="jobs" page={page} hasNext={hasNext} filters={filters} />
      {access !== "full" && <AccessNote access={access} noun="job" />}
    </>
  );
}

function Pager({ category, page, hasNext, filters }: { category: Category; page: number; hasNext: boolean; filters: Filters }) {
  const pageHref = (target: number) => hrefFor({ category, page: target, filters });
  return (
    <nav aria-label="Pages" className="mt-10 flex items-center justify-between gap-4 text-sm">
      {page > 1 ? (
        <Link href={pageHref(page - 1)} className="font-semibold underline underline-offset-2">
          Previous page
        </Link>
      ) : (
        <span />
      )}
      {hasNext && (
        <Link href={pageHref(page + 1)} className="font-semibold underline underline-offset-2">
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
