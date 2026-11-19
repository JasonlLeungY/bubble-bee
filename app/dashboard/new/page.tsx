import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import ListingForm from "@/components/ListingForm";

export const metadata: Metadata = { title: "Create a listing" };

export default function NewListingPage() {
  return (
    <main className="min-h-screen flex-1 bg-white px-4 py-10 font-sans text-neutral-900">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="mt-4 text-[26px] leading-8 font-semibold tracking-tight">
          Create a listing
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Describe the room and add a few photos. You can list it in minutes.
        </p>

        <div className="mt-8">
          <Suspense
            fallback={<p className="text-sm text-neutral-500">Loading…</p>}
          >
            <LandlordOnly>
              <ListingForm mode="create" />
            </LandlordOnly>
          </Suspense>
        </div>
      </div>
    </main>
  );
}

// Reads the session, so it renders at request time behind Suspense. The
// database enforces the same rule; this just avoids showing tenants a form
// that would be rejected.
async function LandlordOnly({ children }: { children: React.ReactNode }) {
  await connection();
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.claims.sub)
    .maybeSingle();
  if (profile?.role !== "landlord") redirect("/dashboard");

  return children;
}
