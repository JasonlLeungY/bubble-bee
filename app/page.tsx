import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LifestyleBadges } from "@/components/Lifestyle";
import SiteHeader from "@/components/SiteHeader";
import { recordPageView } from "@/utils/analytics";
import { formatPrice, listingImages } from "@/utils/listings";
import { viewerAccess, type ViewerAccess } from "@/utils/tenant-gate";
import { createClient } from "@/utils/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const GRID_CLASS =
  "grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
const PAGE_SIZE = 10;
const LISTING_COLUMNS =
  "id, title, suburb, price_per_week, image_urls, is_smoker_allowed, is_shift_worker_friendly, tolerates_noise";
const JOB_COLUMNS = "id, title, employer, suburb, pay, hours";

const CATEGORIES = [
  { key: "entire_home", label: "Entire home" },
  { key: "share_house", label: "Share house" },
  { key: "jobs", label: "Jobs" },
] as const;
type Category = (typeof CATEGORIES)[number]["key"];

type SearchParams = Promise<{ category?: string | string[]; page?: string | string[] }>;

export default function HomePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-white font-sans text-neutral-900">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-[26px] leading-8 font-semibold tracking-tight">Homes and jobs</h1>
        <p className="mt-1 text-sm text-neutral-500">Newest first. Pick a category to see more.</p>

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
  const requestedCategory = Array.isArray(params.category) ? params.category[0] : params.category;
  const category = CATEGORIES.find((option) => option.key === requestedCategory)?.key;
  const requestedPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(1, Number.parseInt(requestedPage ?? "1", 10) || 1);

  const supabase = await createClient();
  const access = await viewerAccess(supabase);

  // The front page: the first 10 of each category, all on one page.
  if (!category) {
    return (
      <>
        <Tabs active="all" />
        <div className="mt-8 space-y-12">
          <Section title="Entire home" href="/?category=entire_home">
            <ListingSection supabase={supabase} homeType="entire_home" />
          </Section>
          <Section title="Share house" href="/?category=share_house">
            <ListingSection supabase={supabase} homeType="share_house" />
          </Section>
          <Section title="Jobs" href="/?category=jobs">
            <JobSection supabase={supabase} />
          </Section>
        </div>
        {access !== "full" && <AccessNote access={access} noun="listing" />}
      </>
    );
  }

  // One category, with paging. Pages after the first need a finished profile.
  return (
    <>
      <Tabs active={category} />
      <div className="mt-8">
        {category === "jobs" ? (
          <JobFeed page={page} access={access} supabase={supabase} />
        ) : (
          <ListingFeed page={page} access={access} supabase={supabase} homeType={category} />
        )}
      </div>
    </>
  );
}

function Tabs({ active }: { active: Category | "all" }) {
  const tabs = [{ key: "all", label: "All", href: "/" }, ...CATEGORIES.map((c) => ({ key: c.key, label: c.label, href: `/?category=${c.key}` }))];
  return (
    <nav aria-label="Categories" className="flex flex-wrap gap-2">
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
};

type CardJob = {
  id: string;
  title: string;
  employer: string;
  suburb: string;
  pay: string;
  hours: string | null;
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

// The first page of one home type: the newest 10, from the card view.
async function firstPageListings(supabase: Supabase, homeType: "entire_home" | "share_house") {
  return supabase
    .from("first_page_listings")
    .select(LISTING_COLUMNS)
    .eq("home_type", homeType)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);
}

async function firstPageJobs(supabase: Supabase) {
  return supabase
    .from("first_page_jobs")
    .select(JOB_COLUMNS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);
}

async function ListingSection({ supabase, homeType }: { supabase: Supabase; homeType: "entire_home" | "share_house" }) {
  const { data, error } = await firstPageListings(supabase, homeType);
  if (error || !data) return <LoadError />;
  if (data.length === 0) {
    return <EmptyState message={homeType === "entire_home" ? "No entire homes listed yet." : "No share houses listed yet."} />;
  }
  return <ListingCards listings={data} />;
}

async function JobSection({ supabase }: { supabase: Supabase }) {
  const { data, error } = await firstPageJobs(supabase);
  if (error || !data) return <LoadError />;
  if (data.length === 0) return <EmptyState message="No jobs posted yet." />;
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
                  <p className="truncate font-semibold">{listing.suburb}</p>
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
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold">{job.pay}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// One category, with paging: the newest rooms of a home type.
async function ListingFeed({
  page,
  access,
  supabase,
  homeType,
}: {
  page: number;
  access: ViewerAccess;
  supabase: Supabase;
  homeType: "entire_home" | "share_house";
}) {
  if (page > 1 && access !== "full") {
    return <MoreRoomsPrompt access={access} noun="rooms" />;
  }

  let listings: CardListing[] | null = null;
  let error = null;
  let hasNext = false;

  if (page === 1) {
    const result = await firstPageListings(supabase, homeType);
    listings = result.data;
    error = result.error;
    hasNext = (listings?.length ?? 0) === PAGE_SIZE;
  } else {
    // Full access, page 2 onwards. One extra row tells us whether there is a next page.
    const from = (page - 1) * PAGE_SIZE;
    const result = await supabase
      .from("listings")
      .select(LISTING_COLUMNS)
      .eq("home_type", homeType)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE_SIZE);
    error = result.error;
    hasNext = (result.data?.length ?? 0) > PAGE_SIZE;
    listings = (result.data ?? []).slice(0, PAGE_SIZE);
  }

  if (error || !listings) return <LoadError />;
  if (listings.length === 0) {
    return <EmptyState message={homeType === "entire_home" ? "No entire homes listed yet." : "No share houses listed yet."} />;
  }

  return (
    <>
      <ListingCards listings={listings} />
      <Pager category={homeType} page={page} hasNext={hasNext} />
      {access !== "full" && <AccessNote access={access} noun="listing" />}
    </>
  );
}

// One category, with paging: the newest jobs.
async function JobFeed({ page, access, supabase }: { page: number; access: ViewerAccess; supabase: Supabase }) {
  if (page > 1 && access !== "full") {
    return <MoreRoomsPrompt access={access} noun="jobs" />;
  }

  let jobs: CardJob[] | null = null;
  let error = null;
  let hasNext = false;

  if (page === 1) {
    const result = await firstPageJobs(supabase);
    jobs = result.data;
    error = result.error;
    hasNext = (jobs?.length ?? 0) === PAGE_SIZE;
  } else {
    const from = (page - 1) * PAGE_SIZE;
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
  if (jobs.length === 0) return <EmptyState message="No jobs posted yet." />;

  return (
    <>
      <JobRows jobs={jobs} />
      <Pager category="jobs" page={page} hasNext={hasNext} />
      {access !== "full" && <AccessNote access={access} noun="job" />}
    </>
  );
}

function Pager({ category, page, hasNext }: { category: Category; page: number; hasNext: boolean }) {
  const pageHref = (target: number) =>
    target === 1 ? `/?category=${category}` : `/?category=${category}&page=${target}`;
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
