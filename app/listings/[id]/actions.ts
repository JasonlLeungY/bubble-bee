"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MISMATCH_ERROR, UUID, lifestyleConflicts } from "@/utils/lifestyle";
import { createClient } from "@/utils/supabase/server";

const MESSAGE_MAX = 2000;

export type ContactState = { error?: string; message?: string };

/**
 * Starts (or continues) a conversation between the signed-in tenant and the
 * listing's landlord with a first message. Only if the tenant's lifestyle fits
 * the house rules.
 *
 * Rejections are returned, not thrown: Next.js strips the message from errors
 * thrown in Server Actions in production, so a thrown "Lifestyle mismatch"
 * would reach the browser as a generic error.
 */
export async function initiateContact(
  listingId: string,
  _prevState: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const raw = formData.get("message");
  const message = typeof raw === "string" ? raw.trim() : "";

  if (!UUID.test(listingId)) {
    return { error: "This listing is no longer available.", message };
  }
  if (!message) {
    return { error: "Write a message to the landlord first.", message };
  }
  if (message.length > MESSAGE_MAX) {
    return { error: `Keep your message under ${MESSAGE_MAX.toLocaleString()} characters.`, message };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(`/listings/${listingId}`)}`);
  }

  // 1. The tenant's own profile and the listing they want to contact.
  const [{ data: tenant }, { data: listing }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, is_smoker, is_shift_worker, tolerates_noise")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("listings")
      .select("id, landlord_id, is_smoker_allowed, is_shift_worker_friendly, tolerates_noise")
      .eq("id", listingId)
      .maybeSingle(),
  ]);

  if (!listing) {
    return { error: "This listing is no longer available.", message };
  }
  if (!tenant || tenant.role !== "tenant") {
    return { error: "Only tenant accounts can contact landlords.", message };
  }

  // 2. The gate.
  if (lifestyleConflicts(tenant, listing).length > 0) {
    return { error: MISMATCH_ERROR, message };
  }

  // 3. Create the conversation. The database re-checks the gate itself, so
  //    this insert fails with 42501 if the check above was somehow skipped.
  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      listing_id: listing.id,
      tenant_id: userId,
      landlord_id: listing.landlord_id,
    })
    .select("id")
    .single();

  let conversationId: string | undefined = created?.id;

  if (error?.code === "23505") {
    // Already talking about this listing: carry on in that conversation.
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("listing_id", listing.id)
      .eq("tenant_id", userId)
      .maybeSingle();
    conversationId = existing?.id;
  } else if (error?.code === "42501") {
    return { error: MISMATCH_ERROR, message };
  }

  if (!conversationId) {
    return { error: "We could not start the conversation. Try again.", message };
  }

  // 4. The first message.
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
