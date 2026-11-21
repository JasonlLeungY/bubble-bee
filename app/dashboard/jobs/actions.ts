"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UUID } from "@/utils/lifestyle";
import { createClient } from "@/utils/supabase/server";

export type JobState = {
  error?: string;
  /** Echoed back so the form is not wiped when validation fails. */
  fields?: Record<string, string>;
};

const MAX = { title: 120, employer: 80, suburb: 80, pay: 80, hours: 120, description: 5000 };

function readJob(formData: FormData) {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const fields = {
    title: text("title"),
    employer: text("employer"),
    suburb: text("suburb"),
    pay: text("pay"),
    hours: text("hours"),
    description: text("description"),
  };
  const checks: [boolean, string][] = [
    [fields.title.length >= 3 && fields.title.length <= MAX.title, "Give the job a title of 3 to 120 characters."],
    [fields.employer.length >= 2 && fields.employer.length <= MAX.employer, "Enter the employer's name."],
    [fields.suburb.length >= 2 && fields.suburb.length <= MAX.suburb, "Enter the suburb where the job is."],
    [fields.pay.length >= 2 && fields.pay.length <= MAX.pay, "Enter the pay, for example $28 to $32 an hour."],
    [fields.hours.length <= MAX.hours, "Keep the hours under 120 characters."],
    [fields.description.length <= MAX.description, "Keep the description under 5,000 characters."],
  ];
  const failed = checks.find(([ok]) => !ok);
  return { fields, error: failed ? failed[1] : null };
}

export async function createJob(_prevState: JobState, formData: FormData): Promise<JobState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  const { fields, error } = readJob(formData);
  if (error) return { error, fields };

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
