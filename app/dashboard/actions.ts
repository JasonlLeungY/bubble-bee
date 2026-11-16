"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type ListingState = {
  error?: string;
  /** Echoed back so the form is not wiped when validation fails. */
  fields?: {
    title: string;
    description: string;
    price: string;
    suburb: string;
    isSmokerAllowed: boolean;
    isShiftWorkerFriendly: boolean;
    toleratesNoise: boolean;
  };
};

const MAX_IMAGES = 5;
const MAX_PRICE = 100_000;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createListing(
  _prevState: ListingState,
  formData: FormData,
): Promise<ListingState> {
  const supabase = await createClient();

  // Never trust a user id from the form: take it from the verified session.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const fields = {
    title: text(formData, "title"),
    description: text(formData, "description"),
    price: text(formData, "price_per_week"),
    suburb: text(formData, "suburb"),
    isSmokerAllowed: formData.get("is_smoker_allowed") === "on",
    isShiftWorkerFriendly: formData.get("is_shift_worker_friendly") === "on",
    toleratesNoise: formData.get("tolerates_noise") === "on",
  };
  const imageUrls = formData
    .getAll("image_urls")
    .filter((value): value is string => typeof value === "string");

  if (fields.title.length < 3 || fields.title.length > 120) {
    return { error: "Give the listing a title of 3 to 120 characters.", fields };
  }
  if (fields.description.length > 5000) {
    return { error: "Keep the description under 5,000 characters.", fields };
  }
  const price = Number(fields.price);
  if (!fields.price || !Number.isFinite(price) || price <= 0 || price > MAX_PRICE) {
    return { error: "Enter the weekly rent as a number above 0.", fields };
  }
  if (!fields.suburb || fields.suburb.length > 80) {
    return { error: "Enter the suburb.", fields };
  }
  if (imageUrls.length > MAX_IMAGES) {
    return { error: `A listing can have up to ${MAX_IMAGES} photos.`, fields };
  }
  // Only accept files this user uploaded to our own bucket, so a listing can
  // never point at an arbitrary external URL.
  const ownFolder = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-images/${userId}/`;
  if (!imageUrls.every((url) => url.startsWith(ownFolder))) {
    return { error: "One of the photos is not valid. Remove it and try again.", fields };
  }

  const { error } = await supabase.from("listings").insert({
    landlord_id: userId,
    title: fields.title,
    description: fields.description,
    price_per_week: Math.round(price * 100) / 100,
    suburb: fields.suburb,
    image_urls: imageUrls,
    is_smoker_allowed: fields.isSmokerAllowed,
    is_shift_worker_friendly: fields.isShiftWorkerFriendly,
    tolerates_noise: fields.toleratesNoise,
  });

  if (error) {
    return {
      // 42501 = rejected by Row Level Security, i.e. not a landlord account.
      error:
        error.code === "42501"
          ? "Only landlord accounts can create listings."
          : "We could not save the listing. Try again.",
      fields,
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/");
  redirect("/dashboard");
}

export type LifestyleState = {
  saved?: boolean;
  error?: string;
  values?: {
    isSmoker: boolean;
    isShiftWorker: boolean;
    toleratesNoise: boolean;
  };
};

/** Saves the tenant's own lifestyle answers, which the contact gate reads. */
export async function updateLifestyle(
  _prevState: LifestyleState,
  formData: FormData,
): Promise<LifestyleState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const values = {
    isSmoker: formData.get("is_smoker") === "on",
    isShiftWorker: formData.get("is_shift_worker") === "on",
    toleratesNoise: formData.get("tolerates_noise") === "on",
  };

  // Row Level Security only lets a user update their own profile row.
  const { error } = await supabase
    .from("profiles")
    .update({
      is_smoker: values.isSmoker,
      is_shift_worker: values.isShiftWorker,
      tolerates_noise: values.toleratesNoise,
    })
    .eq("id", userId);

  if (error) {
    return { error: "We could not save that. Try again.", values };
  }

  revalidatePath("/dashboard");
  return { saved: true, values };
}
