import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * True when the signed-in user is a tenant who has not finished their profile
 * yet. Such a tenant may only see the profile form. The database also hides
 * listings from them (20261131000000_listing_visibility.sql).
 */
export async function tenantNeedsProfile(supabase: SupabaseClient) {
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.role !== "tenant") return false;

  const { data: intake } = await supabase
    .from("tenant_profiles")
    .select("profile_completed_at")
    .eq("tenant_id", userId)
    .maybeSingle();
  return !intake?.profile_completed_at;
}
