import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import TenantProfileForm from "@/components/TenantProfileForm";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = { title: "Your profile" };

export default function TenantProfilePage() {
  return (
    <main className="min-h-screen flex-1 bg-white px-4 py-10 font-sans text-neutral-900">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/dashboard" className="text-sm font-semibold text-neutral-700 underline underline-offset-2">
          Back to dashboard
        </Link>
        <Suspense fallback={<p className="mt-6 text-sm text-neutral-500">Loading…</p>}>
          <Profile />
        </Suspense>
      </div>
    </main>
  );
}

const SIGNED_URL_SECONDS = 3600;

// Reads the session cookie, so it renders at request time behind Suspense.
async function Profile() {
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");
  const userId = auth.claims.sub;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, tolerates_noise")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.role !== "tenant") redirect("/dashboard");

  const [{ data: intake }, { data: privateRow }] = await Promise.all([
    supabase.from("tenant_profiles").select("*").eq("tenant_id", userId).maybeSingle(),
    supabase.from("tenant_private").select("phone, date_of_birth").eq("tenant_id", userId).maybeSingle(),
  ]);

  const selfieUrl = intake?.selfie_path
    ? (await supabase.storage.from("tenant-avatars").createSignedUrl(intake.selfie_path, SIGNED_URL_SECONDS)).data?.signedUrl ?? null
    : null;

  // Every answer as a list, so the form can use one shape for new, saved and
  // failed submissions.
  const one = (value: string | number | null | undefined) =>
    value === null || value === undefined ? [] : [String(value)];
  const yesNo = (value: boolean | null | undefined) =>
    value === null || value === undefined ? [] : [value ? "yes" : "no"];
  const initial: Record<string, string[]> = {
    full_name: one(intake?.full_name),
    preferred_name: one(intake?.preferred_name),
    gender: one(intake?.gender),
    housemate_preference: one(intake?.housemate_preference),
    phone: one(privateRow?.phone),
    date_of_birth: one(privateRow?.date_of_birth),
    selfie_path: one(intake?.selfie_path),
    bio: one(intake?.bio),
    employment_status: one(intake?.employment_status),
    job_title: one(intake?.job_title),
    industries: intake?.industries ?? [],
    open_to_job_offers: yesNo(intake?.open_to_job_offers),
    target_roles: one(intake?.target_roles?.join(", ")),
    preferred_shifts: intake?.preferred_shifts ?? [],
    work_rights: one(intake?.work_rights),
    income_verification: one(intake?.income_verification),
    work_schedule: one(intake?.work_schedule),
    wfh: one(intake?.wfh),
    smoking: one(intake?.smoking),
    alcohol: one(intake?.alcohol),
    guests: one(intake?.guests),
    cleanliness: one(intake?.cleanliness),
    dietary: intake?.dietary ?? [],
    has_pets: yesNo(intake?.has_pets),
    pets_details: one(intake?.pets_details),
    allergies: intake?.allergies ?? [],
    tolerates_noise: profile.tolerates_noise ? ["on"] : [],
    move_in_date: one(intake?.move_in_date),
    flexible_move_in: intake?.flexible_move_in ? ["on"] : [],
    stay_length: one(intake?.stay_length),
    max_weekly_budget: one(intake?.max_weekly_budget),
    parking_needed: one(intake?.parking_needed),
  };

  return (
    <TenantProfileForm
      userId={userId}
      email={auth.claims.email ?? ""}
      initial={initial}
      selfieUrl={selfieUrl}
      completed={Boolean(intake?.profile_completed_at)}
    />
  );
}
