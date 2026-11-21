"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdminUser } from "@/utils/access";
import { ABOUT_MAX_WORDS, countWords } from "@/utils/words";
import { UUID } from "@/utils/lifestyle";
import { listingImagePath, readListingForm, type ListingFields } from "@/utils/listing-form";
import { createClient } from "@/utils/supabase/server";

export type ListingState = {
  error?: string;
  /** Echoed back so the form is not wiped when validation fails. */
  fields?: ListingFields;
};

const BUCKET = "listing-images";

export async function createListing(
  _prevState: ListingState,
  formData: FormData,
): Promise<ListingState> {
  const supabase = await createClient();

  // Never trust a user id from the form: take it from the verified session.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const parsed = readListingForm(formData, [userId]);
  if (!parsed.values) {
    return { error: parsed.error ?? "Check the form and try again.", fields: parsed.fields };
  }

  const { error } = await supabase
    .from("listings")
    .insert({ landlord_id: userId, ...parsed.values });

  if (error) {
    return {
      // 42501 = rejected by Row Level Security, i.e. not a landlord account.
      error:
        error.code === "42501"
          ? "Only landlord accounts can create listings."
          : "We could not save the listing. Try again.",
      fields: parsed.fields,
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/");
  redirect("/dashboard");
}

export async function updateListing(
  listingId: string,
  _prevState: ListingState,
  formData: FormData,
): Promise<ListingState> {
  if (!UUID.test(listingId)) return { error: "We could not find that listing." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/listings/${listingId}/edit`)}`);

  // Only the owner or an administrator may edit. The database enforces the
  // same rule through the update policy and the column grants.
  const { data: current } = await supabase
    .from("listings")
    .select("image_urls, landlord_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!current) return { error: "We could not find that listing." };

  const isOwner = current.landlord_id === userId;
  if (!isOwner && !(await isAdminUser(supabase, userId))) {
    return { error: "Only the listing owner or an administrator can edit this listing." };
  }
  // Photos may sit in the owner's folder; an administrator may also use their own.
  const folders = isOwner ? [userId] : [current.landlord_id, userId];

  const parsed = readListingForm(formData, folders);
  if (!parsed.values) {
    return { error: parsed.error ?? "Check the form and try again.", fields: parsed.fields };
  }
  const values = parsed.values;

  const { data: updated, error } = await supabase
    .from("listings")
    .update(values)
    .eq("id", listingId)
    .select("id");
  if (error || !updated || updated.length === 0) {
    return { error: "We could not save your changes. Try again.", fields: parsed.fields };
  }

  // Delete photos the editor removed.
  const kept = new Set(values.image_urls);
  const removed = (current.image_urls ?? [])
    .filter((url: string) => !kept.has(url))
    .map((url: string) => listingImagePath(url, folders))
    .filter((path: string | null): path is string => path !== null);
  if (removed.length > 0) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(removed);
    if (removeError) console.error("Could not delete removed listing photos", removeError);
  }

  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/dashboard");
  revalidatePath("/");
  redirect(`/listings/${listingId}?saved=1`);
}

export async function deleteListing(listingId: string): Promise<ListingState> {
  if (!UUID.test(listingId)) return { error: "We could not find that listing." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/listings/${listingId}`)}`);

  const { data: current } = await supabase
    .from("listings")
    .select("image_urls")
    .eq("id", listingId)
    .eq("landlord_id", userId)
    .maybeSingle();
  if (!current) return { error: "You can only delete your own listings." };

  // Delete the row first: if this fails, nothing else has been removed.
  const { data: deleted, error } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("landlord_id", userId)
    .select("id");
  if (error || !deleted || deleted.length === 0) {
    return { error: "We could not delete the listing. Try again." };
  }

  const paths = (current.image_urls ?? [])
    .map((url: string) => listingImagePath(url, [userId]))
    .filter((path: string | null): path is string => path !== null);
  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
    if (removeError) console.error("Could not delete listing photos", removeError);
  }

  revalidatePath("/dashboard");
  revalidatePath("/");
  revalidatePath(`/listings/${listingId}`);
  redirect("/dashboard");
}

export type AboutState = { saved?: boolean; error?: string; about?: string };

/** Saves the tenant's description for landlords, up to ABOUT_MAX_WORDS words. */
export async function saveTenantAbout(_prevState: AboutState, formData: FormData): Promise<AboutState> {
  const raw = formData.get("about");
  const about = typeof raw === "string" ? raw.trim() : "";

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  if (countWords(about) > ABOUT_MAX_WORDS) {
    return { error: `Keep it to ${ABOUT_MAX_WORDS.toLocaleString()} words or fewer.`, about };
  }
  if (about.length > 20000) {
    return { error: "That is too long. Shorten it and try again.", about };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role !== "tenant") {
    return { error: "Only tenant accounts can add a description.", about };
  }

  // Update the row if there is one, otherwise insert it. (An upsert would also
  // need table-wide update permission, which is deliberately not granted.)
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("tenant_profiles")
    .select("tenant_id")
    .eq("tenant_id", userId)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from("tenant_profiles").update({ about, updated_at: now }).eq("tenant_id", userId)
    : await supabase.from("tenant_profiles").insert({ tenant_id: userId, about, updated_at: now });
  if (error) {
    return { error: "We could not save your description. Try again.", about };
  }

  revalidatePath("/dashboard");
  revalidatePath("/messages");
  return { saved: true, about };
}
