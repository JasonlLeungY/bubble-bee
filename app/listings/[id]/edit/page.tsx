import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import ListingForm from "@/components/ListingForm";
import { isAdminUser } from "@/utils/access";
import { UUID } from "@/utils/lifestyle";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = { title: "Edit listing" };

export default function EditListingPage({ params }: PageProps<"/listings/[id]/edit">) {
  return (
    <main className="min-h-screen flex-1 bg-white px-4 py-10 font-sans text-neutral-900">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-[26px] leading-8 font-semibold tracking-tight">Edit listing</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Changes appear on the listing as soon as you save.
        </p>

        <div className="mt-8">
          <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
            <Editor params={params} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

// Reads the session and the listing, so it renders at request time.
async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  await connection();
  const supabase = await createClient();

  // Logged out: send them to log in, then back here.
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/listings/${id}/edit`)}`);

  const { data: listing } = await supabase
    .from("listings")
    .select(
      "id, landlord_id, title, description, price_per_week, suburb, image_urls, available_from, bond_amount, bills_included, is_smoker_allowed, is_shift_worker_friendly, tolerates_noise",
    )
    .eq("id", id)
    .maybeSingle();
  if (!listing) notFound();

  // Only the owner and administrators may edit. Anyone else goes to the public page.
  if (listing.landlord_id !== userId && !(await isAdminUser(supabase, userId))) {
    redirect(`/listings/${id}`);
  }

  return (
    <ListingForm
      mode="edit"
      listingId={id}
      initial={{
        title: listing.title,
        description: listing.description ?? "",
        price_per_week: Number(listing.price_per_week),
        suburb: listing.suburb,
        image_urls: listing.image_urls ?? [],
        available_from: listing.available_from,
        bond_amount: listing.bond_amount,
        bills_included: listing.bills_included,
        is_smoker_allowed: listing.is_smoker_allowed,
        is_shift_worker_friendly: listing.is_shift_worker_friendly,
        tolerates_noise: listing.tolerates_noise,
      }}
    />
  );
}
