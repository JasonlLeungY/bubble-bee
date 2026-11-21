import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import JobForm from "@/components/JobForm";
import { UUID } from "@/utils/lifestyle";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = { title: "Edit job" };

export default function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="min-h-screen flex-1 bg-white px-4 py-10 font-sans text-neutral-900">
      <div className="mx-auto w-full max-w-2xl">
        <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
          <Editor params={params} />
        </Suspense>
      </div>
    </main>
  );
}

// Only the poster may edit a job.
async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: job } = await supabase
    .from("job_posts")
    .select("id, poster_id, title, employer, suburb, pay, hours, description")
    .eq("id", id)
    .maybeSingle();
  if (!job || job.poster_id !== userId) notFound();

  return (
    <>
      <h1 className="text-[26px] leading-8 font-semibold tracking-tight">Edit job</h1>
      <p className="mt-1 text-sm text-neutral-500">Changes show on the Jobs tab straight away.</p>
      <JobForm
        mode="edit"
        jobId={job.id}
        initial={{
          title: job.title,
          employer: job.employer,
          suburb: job.suburb,
          pay: job.pay,
          hours: job.hours ?? "",
          description: job.description ?? "",
        }}
      />
    </>
  );
}
