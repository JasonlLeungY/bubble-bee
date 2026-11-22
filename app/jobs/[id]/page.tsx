import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ApplyControl, type JobCardData } from "@/components/JobCard";
import { employmentLabel, payLine } from "@/utils/job-display";
import JobDetailContent from "@/components/JobDetailContent";
import SiteHeader from "@/components/SiteHeader";
import { UUID } from "@/utils/lifestyle";
import { applyModeFor } from "@/utils/job-search";
import { viewerAccess } from "@/utils/tenant-gate";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = { title: "Job" };

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-white font-sans text-neutral-900">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
          <Job params={params} />
        </Suspense>
      </main>
    </div>
  );
}

// Kilometres between two points (great-circle distance).
function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// Full details need an account, as for listings.
async function Job({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  await connection();
  const supabase = await createClient();
  const access = await viewerAccess(supabase);
  if (access === "guest") redirect("/signup?reason=details");
  if (access === "profile-incomplete") redirect("/dashboard/profile");

  const { data: row } = await supabase.from("job_posts").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();

  // The employer's nearest room, if it is within 25 km of this job.
  let room: { id: string; title: string; price_per_week: number; km: number } | null = null;
  if (row.latitude !== null && row.longitude !== null) {
    const { data: rooms } = await supabase
      .from("listings")
      .select("id, title, price_per_week, latitude, longitude")
      .eq("landlord_id", row.poster_id)
      .not("latitude", "is", null);
    for (const candidate of rooms ?? []) {
      const km = kmBetween(row.latitude, row.longitude, candidate.latitude, candidate.longitude);
      if (km <= 25 && (room === null || km < room.km)) {
        room = { id: candidate.id, title: candidate.title, price_per_week: candidate.price_per_week, km: Math.round(km * 10) / 10 };
      }
    }
  }

  const job: JobCardData = {
    ...row,
    distance_km: null,
    room_id: room?.id ?? null,
    room_title: room?.title ?? null,
    room_price: room?.price_per_week ?? null,
    room_km: room?.km ?? null,
  };

  const applyMode = await applyModeFor(supabase, access);
  const { data: applied } = await supabase.from("job_applications").select("id").eq("job_id", id).maybeSingle();

  return (
    <>
      <title>{`${job.title} at ${job.employer}`}</title>
      <Link href="/jobs" className="inline-flex min-h-11 items-center text-sm font-semibold text-neutral-700 underline underline-offset-2">
        Back to local jobs
      </Link>
      <p className="mt-4 text-sm font-bold uppercase tracking-wide text-neutral-500">{employmentLabel(job.employment_type)}</p>
      <h1 className="mt-1 text-[28px] leading-9 font-semibold tracking-tight break-words">{job.title}</h1>
      <p className="mt-1 text-neutral-600">
        {job.employer} · {job.suburb}
        {job.postcode ? `, SA ${job.postcode}` : ""}
      </p>
      <p className="mt-4 text-2xl font-bold tracking-tight">{payLine(job)}</p>
      <div className="mt-4">
        {applied ? (
          <p className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800">You have applied for this job</p>
        ) : (
          <ApplyControl jobId={job.id} mode={applyMode} />
        )}
      </div>
      <div className="mt-8">
        <JobDetailContent job={job} />
      </div>
    </>
  );
}
