import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import DeleteJobButton from "@/components/DeleteJobButton";
import DeleteListingButton from "@/components/DeleteListingButton";
import { signOut } from "@/app/login/actions";
import AboutForm from "@/components/AboutForm";
import { formatPrice } from "@/utils/listings";
import { createClient } from "@/utils/supabase/server";

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
    .select("first_name, role")
    .eq("id", userId)
    .maybeSingle();
  const isLandlord = profile?.role === "landlord";
  const { data: intake } =
    profile?.role === "tenant"
      ? await supabase
          .from("tenant_profiles")
          .select("about, profile_completed_at, preferred_name, full_name")
          .eq("tenant_id", userId)
          .maybeSingle()
      : { data: null };

  // A tenant finishes their profile before anything else.
  if (profile?.role === "tenant" && !intake?.profile_completed_at) redirect("/dashboard/profile");

  const { data: listings } = isLandlord
    ? await supabase
        .from("listings")
        .select("id, title, suburb, price_per_week, image_urls, home_type")
        .eq("landlord_id", userId)
        .order("created_at", { ascending: false })
    : { data: null };

  const { data: jobs } = isLandlord
    ? await supabase
        .from("job_posts")
        .select("id, title, employer, suburb, pay")
        .eq("poster_id", userId)
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
            className="hive rounded-lg border border-neutral-300 px-3.5 py-2 text-sm font-semibold transition hover:border-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            Messages
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="hive cursor-pointer rounded-lg border border-neutral-300 px-3.5 py-2 text-sm font-semibold transition hover:border-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      {isLandlord ? (
        <>
        <section className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Your listings</h2>
            <Link
              href="/dashboard/new"
              className="hive rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              Create New Listing
            </Link>
          </div>

          <div className="mt-6 space-y-8">
            <ListingGroup
              heading="Entire homes"
              listings={(listings ?? []).filter((listing) => listing.home_type === "entire_home")}
              emptyText="You have no entire homes yet."
            />
            <ListingGroup
              heading="Share houses"
              listings={(listings ?? []).filter((listing) => listing.home_type !== "entire_home")}
              emptyText="You have no share houses yet. Create your first room listing to start receiving enquiries."
            />
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Your job posts</h2>
            <Link
              href="/dashboard/jobs/new"
              className="hive rounded-lg border border-neutral-900 px-4 py-2.5 text-sm font-semibold transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              Post a job
            </Link>
          </div>
          {jobs && jobs.length > 0 ? (
            <ul className="mt-4 divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
              {jobs.map((job) => (
                <li key={job.id} className="flex items-center gap-3 p-4">
                  <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{job.title}</p>
                    <p className="truncate text-sm text-neutral-500">
                      {job.employer} · {job.suburb} · {job.pay}
                    </p>
                  </Link>
                  <Link
                    href={`/dashboard/jobs/${job.id}/edit`}
                    aria-label={`Edit ${job.title}`}
                    className="hive shrink-0 rounded-lg border border-neutral-900 px-3.5 py-2 text-sm font-semibold transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                  >
                    Edit
                  </Link>
                  <DeleteJobButton jobId={job.id} title={job.title} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-neutral-300 px-6 py-8 text-center text-sm text-neutral-500">
              You have not posted any jobs.
            </p>
          )}
        </section>
        </>
      ) : (
        <>
        <section className="mt-8 rounded-2xl border border-neutral-200 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Your profile</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Landlords see this after you message them. {intake?.preferred_name || intake?.full_name ? `Shown as ${intake.preferred_name || intake.full_name}.` : ""}
              </p>
            </div>
            <Link
              href="/dashboard/profile"
              className="hive shrink-0 rounded-lg border border-neutral-900 px-4 py-2.5 text-sm font-semibold transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              Edit profile
            </Link>
          </div>
        </section>
        <AboutForm initial={intake?.about ?? ""} />
        <div className="mt-8">
          <Link
            href="/"
            className="hive inline-block rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            Browse rooms
          </Link>
        </div>
        </>
      )}
    </>
  );
}

type DashboardListing = {
  id: string;
  title: string;
  suburb: string;
  price_per_week: number;
  image_urls: string[] | null;
  home_type: string;
};

// One group of the landlord's listings: entire homes, or share houses.
function ListingGroup({
  heading,
  listings,
  emptyText,
}: {
  heading: string;
  listings: DashboardListing[];
  emptyText: string;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold">
        {heading} <span className="font-normal text-neutral-500">({listings.length})</span>
      </h3>
      {listings.length > 0 ? (
        <ul className="mt-3 divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
          {listings.map((listing) => (
            <li key={listing.id} className="flex items-center gap-3 p-4">
              <Link
                href={`/listings/${listing.id}`}
                className="flex min-w-0 flex-1 items-center gap-4 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              >
                {listing.image_urls?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={listing.image_urls[0]} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-xl bg-neutral-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{listing.title}</p>
                  <p className="text-sm text-neutral-500">{listing.suburb}</p>
                </div>
                <p className="shrink-0 text-sm">
                  <span className="font-semibold">{formatPrice(listing.price_per_week)}</span>
                  <span className="text-neutral-500"> / week</span>
                </p>
              </Link>
              <Link
                href={`/listings/${listing.id}/edit`}
                aria-label={`Edit ${listing.title}`}
                className="hive shrink-0 rounded-lg border border-neutral-900 px-3.5 py-2 text-sm font-semibold transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              >
                Edit
              </Link>
              <DeleteListingButton listingId={listing.id} title={listing.title} className="shrink-0" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-2xl border border-dashed border-neutral-300 px-6 py-8 text-center text-sm text-neutral-500">
          {emptyText}
        </p>
      )}
    </div>
  );
}
