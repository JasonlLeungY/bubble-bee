"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { echoFields, readTenantProfile } from "@/utils/tenant-profile";
import { createClient } from "@/utils/supabase/server";

export type TenantProfileState = {
  /** Every answer that still needs fixing. */
  errors?: string[];
  /** The answers as typed, so a failed save does not wipe the form. */
  fields?: Record<string, string[]>;
};

const SELFIE_BUCKET = "tenant-avatars";

/**
 * Saves the tenant intake. Only a tenant can save it, and only for themselves:
 * the user id comes from the verified session, never from the form.
 */
export async function saveTenantProfile(
  _prevState: TenantProfileState,
  formData: FormData,
): Promise<TenantProfileState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (me?.role !== "tenant") {
    return { errors: ["Only tenant accounts have a tenant profile."], fields: echoFields(formData) };
  }

  const parsed = readTenantProfile(formData, userId, new Date());
  if (!parsed.ok) {
    return { errors: parsed.errors, fields: echoFields(formData) };
  }
  const { profile, privateDetails, lifestyle } = parsed;
  const failed = { errors: ["We could not save your profile. Try again."], fields: echoFields(formData) };

  // The lifestyle gate reads these three switches on public.profiles.
  const { error: profileError } = await supabase
    .from("profiles")
    .update(lifestyle)
    .eq("id", userId);
  if (profileError) return failed;

  // Phone and date of birth are private. Update the row if there is one.
  const now = new Date().toISOString();
  const { data: privateRow } = await supabase
    .from("tenant_private")
    .select("tenant_id")
    .eq("tenant_id", userId)
    .maybeSingle();
  const privateResult = privateRow
    ? await supabase
        .from("tenant_private")
        .update({ ...privateDetails, updated_at: now })
        .eq("tenant_id", userId)
    : await supabase
        .from("tenant_private")
        .insert({ tenant_id: userId, ...privateDetails, updated_at: now });
  if (privateResult.error) return failed;

  // The intake. Update the row if there is one (the database grants plain
  // update and insert, not upsert).
  const { data: existing } = await supabase
    .from("tenant_profiles")
    .select("tenant_id, selfie_path")
    .eq("tenant_id", userId)
    .maybeSingle();
  const intake = { ...profile, updated_at: now, profile_completed_at: now };
  const result = existing
    ? await supabase.from("tenant_profiles").update(intake).eq("tenant_id", userId)
    : await supabase.from("tenant_profiles").insert({ tenant_id: userId, ...intake });
  if (result.error) return failed;

  // Replaced selfies are deleted so old photos do not pile up.
  if (existing?.selfie_path && existing.selfie_path !== profile.selfie_path) {
    await supabase.storage.from(SELFIE_BUCKET).remove([existing.selfie_path]);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  redirect("/dashboard");
}
