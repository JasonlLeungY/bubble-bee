import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import { UUID } from "@/utils/lifestyle";
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

const postedOn = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" });

// Full details need an account, as for listings.
async function Job({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  await connection();
  const supabase = await createClient();
  const access = await viewerAccess(supabase);
  if (access === "guest") redirect("/signup?reason=details");
  if (access === "profile-incomplete") redirect("/dashboard/profile");

  const { data: job } = await supabase
    .from("job_posts")
    .select("id, title, employer, suburb, pay, hours, description, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();

  return (
    <>
      <title>{`${job.title} at ${job.employer}`}</title>
      <Link href="/?category=jobs" className="text-sm font-semibold text-neutral-700 underline underline-offset-2">
        Back to jobs
      </Link>
      <h1 className="mt-4 text-[28px] leading-9 font-semibold tracking-tight break-words">{job.title}</h1>
      <p className="mt-1 text-neutral-600">
        {job.employer} · {job.suburb}
      </p>
      <dl className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 p-3">
          <dt className="text-neutral-500">Pay</dt>
          <dd className="font-semibold">{job.pay}</dd>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <dt className="text-neutral-500">Hours</dt>
          <dd className="font-semibold">{job.hours || "Not stated"}</dd>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <dt className="text-neutral-500">Posted</dt>
          <dd className="font-semibold">{postedOn.format(new Date(job.created_at))}</dd>
        </div>
      </dl>
      {job.description && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">About the job</h2>
          <p className="mt-2 whitespace-pre-line break-words text-neutral-700">{job.description}</p>
        </div>
      )}
    </>
  );
}
