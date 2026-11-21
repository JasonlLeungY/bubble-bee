import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LIFESTYLE_RULES, LifestyleIcon } from "@/components/Lifestyle";
import SiteHeader from "@/components/SiteHeader";
import SuburbMapButton from "@/components/SuburbMapButton";
import { isAdminUser } from "@/utils/access";
import { genderFits } from "@/utils/gender";
import { UUID, lifestyleConflicts } from "@/utils/lifestyle";
import { formatPrice, listingImages } from "@/utils/listings";
import { recordPageView } from "@/utils/analytics";
import { viewerAccess } from "@/utils/tenant-gate";
import { createClient } from "@/utils/supabase/server";
import MessageLandlord from "@/components/MessageLandlord";
import ContactButton, { type ContactStatus } from "./contact-button";

const listedOn = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" });
const availableOn = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "UTC" });

export default function ListingPage({ params, searchParams }: PageProps<"/listings/[id]">) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-white font-sans text-neutral-900">
      <SiteHeader />
      {/* Bottom padding leaves room for the fixed contact bar on small screens. */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-32 sm:px-6 lg:px-8 lg:pb-16">
        <div className="mt-5">
          {/* The id comes from the URL and the data from the database, so
              both are only known at request time. */}
          <Suspense fallback={<DetailSkeleton />}>
            <Listing params={params} searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function Listing({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: PageProps<"/listings/[id]">["searchParams"];
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  // Anything that is not a uuid cannot be a listing; skip the query.
  if (!UUID.test(id)) notFound();

  await connection();
  const supabase = await createClient();
  // Full details need an account: guests sign up, and tenants finish their profile first.
  const access = await viewerAccess(supabase);
  if (access === "guest") redirect("/signup?reason=details");
  if (access === "profile-incomplete") redirect("/dashboard/profile");
  const { data: listing, error } = await supabase
    .from("listings")
    .select(
      "id, landlord_id, title, description, price_per_week, suburb, image_urls, is_smoker_allowed, is_shift_worker_friendly, tolerates_noise, latitude, longitude, available_from, bond_amount, bills_included, gender_preference, home_type, bedrooms, bathrooms, parking, parking_other, created_at, landlord:profiles(first_name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("Could not load the listing.");
  if (!listing) notFound();

  const images = listingImages(listing.image_urls);
  const price = formatPrice(listing.price_per_week);
  const availableText = listing.available_from
    ? availableOn.format(new Date(`${listing.available_from}T00:00:00Z`))
    : "Now";
  const bondText = listing.bond_amount === null ? "Not set" : formatPrice(listing.bond_amount);
  const parkingText = listing.parking === "other" ? listing.parking_other || "Other" : listing.parking === "garage" ? "Garage" : listing.parking === "street" ? "Street" : "Not stated";
  const hostRow: { first_name?: string | null } | null | undefined = Array.isArray(listing.landlord)
    ? listing.landlord[0]
    : listing.landlord;
  const hostName = hostRow?.first_name?.trim() || null;
  const homeTypeText = listing.home_type === "entire_home" ? "Entire home" : "Share house";
  const housemateText =
    listing.gender_preference === "female_only"
      ? "Female only sharehouse"
      : listing.gender_preference === "male_only"
        ? "Male only sharehouse"
        : "Open to any gender";
  void recordPageView(`/listings/${listing.id}`);

  // Work out, on the server, what the contact button should be for whoever is
  // looking. This only decides what to show: the server action and the
  // database both re-check before a conversation is created.
  const { data: auth } = await supabase.auth.getClaims();
  const viewerId = auth?.claims?.sub;
  let status: ContactStatus;
  let conflicts: ReturnType<typeof lifestyleConflicts> = [];

  if (!viewerId) redirect("/signup?reason=details");
  if (viewerId === listing.landlord_id) {
    status = { kind: "owner", listingId: listing.id, title: listing.title };
  } else {
    const [{ data: viewer }, { data: existing }, { data: tenantIntake }] = await Promise.all([
      supabase
        .from("profiles")
        .select("role, is_smoker, is_shift_worker, tolerates_noise")
        .eq("id", viewerId)
        .maybeSingle(),
      supabase
        .from("conversations")
        .select("id")
        .eq("listing_id", listing.id)
        .eq("tenant_id", viewerId)
        .maybeSingle(),
      supabase
        .from("tenant_profiles")
        .select("gender")
        .eq("tenant_id", viewerId)
        .maybeSingle(),
    ]);

    // Checked on its own, so a missing admin column cannot make a tenant look
    // like a landlord.
    const admin = await isAdminUser(supabase, viewerId);
    if (admin) {
      // Administrators can edit any listing, but cannot contact landlords as a tenant.
      status = { kind: "admin", listingId: listing.id };
    } else if (!viewer || viewer.role !== "tenant") {
      status = { kind: "landlord" };
    } else if (existing) {
      status = { kind: "existing", href: `/messages?c=${existing.id}` };
    } else if (!genderFits(listing.gender_preference, tenantIntake?.gender)) {
      status = { kind: "gender" };
    } else {
      conflicts = lifestyleConflicts(viewer, listing);
      status =
        conflicts.length > 0
          ? { kind: "mismatch" }
          : { kind: "can-contact", listingId: listing.id };
    }
  }
  const conflictingRules = new Set<string>(conflicts.map((pair) => pair.rule));

  return (
    <>
      <title>{`${listing.title} in ${listing.suburb}`}</title>

      {saved === "1" && (
        <p role="status" className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Changes saved.
        </p>
      )}
      <Gallery images={images} title={listing.title} />

      <div className="mt-8 grid grid-cols-1 gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-9 font-semibold tracking-tight break-words">
            {listing.title}
          </h1>
          <div className="mt-2 flex items-center gap-1.5 text-neutral-600">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4 shrink-0 fill-none stroke-current stroke-2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <div>
              <SuburbMapButton
                suburb={listing.suburb}
                latitude={listing.latitude}
                longitude={listing.longitude}
              />
              <span className="text-neutral-400">
                {" "}
                · Listed {listedOn.format(new Date(listing.created_at))}
              </span>
            </div>
          </div>
          <p className="mt-4 text-xl">
            <span className="font-semibold">{price}</span>
            <span className="text-neutral-500"> / week</span>
          </p>
          {hostName && <p className="mt-2 text-neutral-600">Hosted by {hostName}</p>}
          <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-neutral-200 p-3">
              <dt className="text-neutral-500">Available</dt>
              <dd className="font-semibold">{availableText}</dd>
            </div>
            <div className="rounded-xl border border-neutral-200 p-3">
              <dt className="text-neutral-500">Bond</dt>
              <dd className="font-semibold">{bondText}</dd>
            </div>
            <div className="rounded-xl border border-neutral-200 p-3">
              <dt className="text-neutral-500">Bills</dt>
              <dd className="font-semibold">{listing.bills_included ? "Included" : "Not included"}</dd>
            </div>
          </dl>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-neutral-200 p-3">
              <dt className="text-neutral-500">Bedrooms</dt>
              <dd className="font-semibold">{listing.bedrooms ?? "Not stated"}</dd>
            </div>
            <div className="rounded-xl border border-neutral-200 p-3">
              <dt className="text-neutral-500">Bathrooms</dt>
              <dd className="font-semibold">{listing.bathrooms ?? "Not stated"}</dd>
            </div>
            <div className="rounded-xl border border-neutral-200 p-3">
              <dt className="text-neutral-500">Parking</dt>
              <dd className="font-semibold">{parkingText}</dd>
            </div>
          </dl>
          <p className="mt-3 inline-block rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-800">{housemateText}</p>
          <p className="mt-2 inline-block rounded-full bg-neutral-100 px-3 py-1 text-sm font-semibold text-neutral-800">{homeTypeText}</p>

          {(status.kind === "can-contact" || status.kind === "existing") && (
            <div className="mt-8 border-t border-neutral-200 pt-8 lg:hidden">
              <MessageLandlord
                listingId={listing.id}
                id="message-landlord"
                conversationHref={status.kind === "existing" ? status.href : undefined}
              />
            </div>
          )}

          <section className="mt-8 border-t border-neutral-200 pt-8">
            <h2 className="text-xl font-semibold">About this room</h2>
            {listing.description ? (
              <p className="mt-3 leading-7 break-words whitespace-pre-line text-neutral-700">
                {listing.description}
              </p>
            ) : (
              <p className="mt-3 text-neutral-500">
                The landlord has not added a description yet.
              </p>
            )}
          </section>

          <section className="mt-8 border-t border-neutral-200 pt-8">
            <h2 className="text-xl font-semibold">House rules and lifestyle</h2>
            <p className="mt-1 text-sm text-neutral-500">
              How this house lives, so you can tell if it suits you.
            </p>
            <ul className="mt-5 divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
              {LIFESTYLE_RULES.map((rule) => {
                const allowed = listing[rule.key];
                const state = allowed ? rule.yes : rule.no;
                return (
                  <li key={rule.key} className="flex items-center gap-4 p-4">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                        allowed
                          ? "bg-neutral-900 text-white"
                          : "bg-neutral-100 text-neutral-400"
                      }`}
                    >
                      <LifestyleIcon path={rule.icon} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{rule.title}</p>
                      <p className="text-sm text-neutral-600">{state.text}</p>
                      {conflictingRules.has(rule.key) && (
                        <p className="mt-0.5 text-sm font-medium text-rose-700">
                          Conflicts with your profile
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        allowed
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-3.5 w-3.5 fill-none stroke-current stroke-[2.5]"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path
                          d={allowed ? "M5 12.5l4.5 4.5L19 7.5" : "M6 6l12 12M18 6 6 18"}
                        />
                      </svg>
                      {state.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* Large screens: sticky card beside the content. */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-neutral-200 p-6 shadow-[0_8px_28px_rgba(0,0,0,0.08)]">
            <p className="text-2xl">
              <span className="font-semibold">{price}</span>
              <span className="text-base text-neutral-500"> / week</span>
            </p>
            <div className="mt-1 text-sm text-neutral-500">
              <SuburbMapButton
                suburb={listing.suburb}
                latitude={listing.latitude}
                longitude={listing.longitude}
                className="text-sm"
              />
            </div>
            {status.kind === "can-contact" || status.kind === "existing" ? (
              <div className="mt-5 border-t border-neutral-200 pt-5">
                <MessageLandlord
                  listingId={listing.id}
                  compact
                  conversationHref={status.kind === "existing" ? status.href : undefined}
                />
              </div>
            ) : (
              <div className="mt-5">
                <ContactButton status={status} fullWidth />
              </div>
            )}
            {status.kind === "mismatch" && (
              <div className="mt-4 text-sm text-neutral-600">
                <ul className="space-y-1">
                  {conflicts.map((pair) => (
                    <li key={pair.rule}>{pair.reason}</li>
                  ))}
                </ul>
                <Link
                  href="/dashboard"
                  className="mt-2 inline-block font-semibold text-neutral-900 underline underline-offset-2"
                >
                  Review your lifestyle answers
                </Link>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Small screens: the same action, fixed to the bottom edge. */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-4 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden">
        <p>
          <span className="text-lg font-semibold">{price}</span>
          <span className="text-sm text-neutral-500"> / week</span>
        </p>
        <ContactButton status={status} />
      </div>
    </>
  );
}

// Desktop: a large photo with up to four beside it, and "+N more" over the
// last of those. Phones swipe through every photo, and a grid of all photos
// is shown below on desktop when there are more than five.
const LEAD = "md:col-span-2 md:row-span-2";
const GALLERY_SPANS: Record<number, string[]> = {
  1: ["md:col-span-4 md:row-span-2"],
  2: [LEAD, LEAD],
  3: [LEAD, "md:col-span-2", "md:col-span-2"],
  4: [LEAD, "md:col-span-2", "", ""],
  5: [LEAD, "", "", "", ""],
};

function Gallery({ images, title }: { images: string[]; title: string }) {
  if (images.length === 0) {
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-2xl bg-neutral-100 text-neutral-400 md:h-72">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-10 w-10 fill-none stroke-current stroke-[1.5]"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M9.5 21v-6h5v6" />
        </svg>
        <span className="text-sm">No photos yet</span>
      </div>
    );
  }

  const hero = images.slice(0, 5);
  const more = images.length - hero.length;
  const spans = GALLERY_SPANS[hero.length];
  const single = images.length === 1;

  return (
    <>
      {/* Phones: swipe through every photo. */}
      <ul className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-2xl [scrollbar-width:none] md:hidden">
        {images.map((url, index) => (
          <li
            key={url}
            className={`relative aspect-[4/3] shrink-0 snap-center overflow-hidden bg-neutral-100 ${
              single ? "w-full" : "w-[88%]"
            }`}
          >
            <Image
              src={url}
              alt={`${title}, photo ${index + 1} of ${images.length}`}
              fill
              sizes="88vw"
              loading={index === 0 ? "eager" : "lazy"}
              className="object-cover"
            />
          </li>
        ))}
      </ul>

      {/* Desktop: the first five photos. */}
      <ul className="hidden h-[440px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl md:grid">
        {hero.map((url, index) => (
          <li key={url} className={`relative overflow-hidden bg-neutral-100 ${spans[index]}`}>
            <Image
              src={url}
              alt={`${title}, photo ${index + 1} of ${images.length}`}
              fill
              sizes={index === 0 ? "(min-width: 1152px) 544px, 50vw" : "(min-width: 1152px) 272px, 25vw"}
              loading={index === 0 ? "eager" : "lazy"}
              className="object-cover"
            />
            {index === hero.length - 1 && more > 0 && (
              <a
                href="#all-photos"
                className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-semibold text-white transition hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
              >
                +{more} more
              </a>
            )}
          </li>
        ))}
      </ul>

      {images.length > hero.length && (
        <section id="all-photos" className="mt-8 hidden scroll-mt-24 md:block">
          <h2 className="text-lg font-semibold">All {images.length} photos</h2>
          <ul className="mt-3 grid grid-cols-3 gap-3">
            {images.map((url, index) => (
              <li key={url} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-neutral-100">
                <Image
                  src={url}
                  alt={`${title}, photo ${index + 1} of ${images.length}`}
                  fill
                  sizes="(min-width: 1152px) 360px, 33vw"
                  loading="lazy"
                  className="object-cover"
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      <div className="aspect-[4/3] rounded-2xl bg-neutral-200 md:aspect-auto md:h-[440px]" />
      <div className="mt-8 h-8 w-2/3 rounded bg-neutral-200" />
      <div className="mt-3 h-4 w-1/3 rounded bg-neutral-100" />
      <div className="mt-8 h-24 rounded bg-neutral-100" />
    </div>
  );
}
