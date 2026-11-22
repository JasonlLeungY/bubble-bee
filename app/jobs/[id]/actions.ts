"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UUID } from "@/utils/lifestyle";
import { createClient } from "@/utils/supabase/server";

export type JobMessageState = { error?: string; message?: string };

const MESSAGE_MAX = 2000;

/**
 * Starts (or continues) a conversation between a finished tenant and the
 * employer who posted the job, with a message. Rejections are returned, not
 * thrown, so the text reaches the page in production.
 */
export async function messageEmployer(
  jobId: string,
  _prevState: JobMessageState,
  formData: FormData,
): Promise<JobMessageState> {
  const raw = formData.get("message");
  const message = typeof raw === "string" ? raw.trim() : "";

  if (!UUID.test(jobId)) {
    return { error: "This job is no longer available.", message };
  }
  if (!message) {
    return { error: "Write a message to the employer first.", message };
  }
  if (message.length > MESSAGE_MAX) {
    return { error: `Keep your message under ${MESSAGE_MAX.toLocaleString()} characters.`, message };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(`/jobs/${jobId}`)}`);
  }

  const { data: job } = await supabase
    .from("job_posts")
    .select("id, poster_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) {
    return { error: "This job is no longer available.", message };
  }
  if (job.poster_id === userId) {
    return { error: "This is your own job post.", message };
  }

  // Carry on in the existing conversation about this job, if there is one.
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("job_id", job.id)
    .eq("tenant_id", userId)
    .maybeSingle();
  let conversationId: string | undefined = existing?.id;

  if (!conversationId) {
    // Row Level Security re-checks the tenant, the profile and the poster here.
    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ job_id: job.id, tenant_id: userId, landlord_id: job.poster_id })
      .select("id")
      .single();

    if (error?.code === "42501") {
      return { error: "Only tenants with a finished profile can message an employer.", message };
    }
    if (error?.code === "23505") {
      // Created a moment ago by another request: use that one.
      const { data: again } = await supabase
        .from("conversations")
        .select("id")
        .eq("job_id", job.id)
        .eq("tenant_id", userId)
        .maybeSingle();
      conversationId = again?.id;
    } else {
      conversationId = created?.id;
    }
  }

  if (!conversationId) {
    return { error: "We could not start the conversation. Try again.", message };
  }

  const { error: sendError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: userId,
    content: message,
  });
  if (sendError) {
    return { error: "We could not send your message. Try again.", message };
  }

  revalidatePath("/messages");
  redirect(`/messages?c=${conversationId}`);
}
