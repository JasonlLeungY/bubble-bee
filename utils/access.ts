import type { SupabaseClient } from "@supabase/supabase-js";

/** True when the user is an administrator (profiles.is_admin, set in the database). */
export async function isAdminUser(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  return data?.is_admin === true;
}
