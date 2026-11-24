"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readJobForm, type JobFields, type JobValues } from "@/utils/job-form";
import { UUID } from "@/utils/lifestyle";
import { suburbProblem } from "@/utils/suburb-lookup";
import { createClient } from "@/utils/supabase/server";

export type JobState = {
  error?: string;
  /** Echoed back so the form is not wiped when validation fails. */
  fields?: Partial<JobFields>;
};

/** Only landlords post jobs; the database checks this too. */
export async function createJob(_prevState: JobState, formData: FormData): Promise<JobState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  const { fields, values, error } = readJobForm(formData);
  if (error || !values) return { error: error ?? "Check the form and try again.", fields };
  const problem = await suburbProblem(values.suburb);
  if (problem) return { error: problem, fields };

  const { error: insertError } = await supabase.from("job_posts").insert({ poster_id: userId, ...values });
  if (insertError) {
    return { error: "We could not post the job. Check the form and try again.", fields };
  }

  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/** Only the poster can edit a job: Row Level Security allows updates to their own jobs only. */
export async function updateJob(jobId: string, _prevState: JobState, formData: FormData): Promise<JobState> {
  if (!UUID.test(jobId)) return { error: "This job is no longer available." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect("/login");

  const { fields, values, error } = readJobForm(formData);
  if (error || !values) return { error: error ?? "Check the form and try again.", fields };
  const problem = await suburbProblem(values.suburb);
  if (problem) return { error: problem, fields };

  const { data: updated, error: updateError } = await supabase
    .from("job_posts")
    .update(values as Omit<JobValues, "pay"> & { pay: string })
    .eq("id", jobId)
    .select("id");
  if (updateError || !updated || updated.length === 0) {
    return { error: "We could not save the job. Try again.", fields };
  }

  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  redirect("/dashboard");
}

export type DeleteState = { error?: string };

/** Only the poster can delete a job: Row Level Security allows deleting only their own. */
export async function deleteJob(jobId: string): Promise<DeleteState> {
  if (!UUID.test(jobId)) return { error: "This job is no longer available." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect("/login");

  // Asking for the deleted row back shows whether anything was removed.
  const { data, error } = await supabase.from("job_posts").delete().eq("id", jobId).select("id");
  if (error || !data || data.length === 0) {
    return { error: "We could not delete this job. Try again." };
  }

  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return {};
}

export type ApplyState = { applied?: boolean; error?: string };

/**
 * Quick Apply: one tap. The database allows it only for a finished tenant, and
 * only once per job.
 */
// The previous state is part of the action's signature, not used here.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function quickApply(jobId: string, _prevState: ApplyState): Promise<ApplyState> {
  if (!UUID.test(jobId)) return { error: "This job is no longer available." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect(`/signup?reason=details`);

  const { error } = await supabase.from("job_applications").insert({ job_id: jobId, applicant_id: userId });
  if (error?.code === "23505") return { applied: true };
  if (error) return { error: "We could not send your application. Finish your profile first, then try again." };

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard");
  return { applied: true };
}
