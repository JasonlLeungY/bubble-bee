"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readJobForm, type JobFields } from "@/utils/job-form";
import { suburbProblem } from "@/utils/suburb-lookup";
import { UUID } from "@/utils/lifestyle";
import { createClient } from "@/utils/supabase/server";

export type JobState = {
  error?: string;
  /** Echoed back so the form is not wiped when validation fails. */
  fields?: Partial<JobFields>;
};

export async function createJob(_prevState: JobState, formData: FormData): Promise<JobState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  const { fields, error } = readJobForm(formData);
  if (error) return { error, fields };
  const problem = await suburbProblem(fields.suburb);
  if (problem) return { error: problem, fields };

  const { error: insertError } = await supabase.from("job_posts").insert({
    poster_id: userId,
    title: fields.title,
    employer: fields.employer,
    suburb: fields.suburb,
    pay: fields.pay,
    hours: fields.hours || null,
    description: fields.description,
  });
  if (insertError) {
    return { error: "We could not post the job. Check the form and try again.", fields };
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/** Only the poster can edit a job: Row Level Security allows updates to their own jobs only. */
export async function updateJob(jobId: string, _prevState: JobState, formData: FormData): Promise<JobState> {
  if (!UUID.test(jobId)) return { error: "This job is no longer available." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect("/login");

  const { fields, error } = readJobForm(formData);
  if (error) return { error, fields };
  const problem = await suburbProblem(fields.suburb);
  if (problem) return { error: problem, fields };

  const { data: updated, error: updateError } = await supabase
    .from("job_posts")
    .update({
      title: fields.title,
      employer: fields.employer,
      suburb: fields.suburb,
      pay: fields.pay,
      hours: fields.hours || null,
      description: fields.description,
    })
    .eq("id", jobId)
    .select("id");
  if (updateError || !updated || updated.length === 0) {
    return { error: "We could not save the job. Try again.", fields };
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  redirect("/dashboard");
}

export async function deleteJob(jobId: string): Promise<void> {
  if (!UUID.test(jobId)) return;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect("/login");

  // Row Level Security allows deleting only the poster's own jobs.
  await supabase.from("job_posts").delete().eq("id", jobId);
  revalidatePath("/");
  revalidatePath("/dashboard");
}
