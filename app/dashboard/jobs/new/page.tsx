import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import JobForm from "@/components/JobForm";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = { title: "Post a job" };

export default function NewJobPage() {
  return (
    <main className="min-h-screen flex-1 bg-white px-4 py-10 font-sans text-neutral-900">
      <div className="mx-auto w-full max-w-2xl">
        <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
          <Gate />
        </Suspense>
      </div>
    </main>
  );
}

// Only landlords post jobs.
async function Gate() {
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/signup?reason=post");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role !== "landlord") redirect("/dashboard");

  return (
    <>
      <h1 className="text-[26px] leading-8 font-semibold tracking-tight">Post a job</h1>
      <p className="mt-1 text-sm text-neutral-500">Jobs appear on the Jobs tab, newest first.</p>
      <JobForm />
    </>
  );
}
