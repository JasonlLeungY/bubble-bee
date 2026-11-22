import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/utils/access";

/**
 * What the signed-in visitor may do on the listing pages.
 *
 * - guest: not signed in. Sees the first page of listings only.
 * - profile-incomplete: a tenant who has not finished the sign-up questions.
 *   Sees the first page of listings only.
 * - full: a landlord, an administrator, or a tenant with a finished profile.
 *
 * The database enforces the same rules (20261131000000_listing_visibility.sql).
 */
export type ViewerAccess = "guest" | "profile-incomplete" | "full";

export async function viewerAccess(supabase: SupabaseClient): Promise<ViewerAccess> {
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return "guest";

  if (await isAdminUser(supabase)) return "full";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.role !== "tenant") return "full";

  const { data: intake } = await supabase
    .from("tenant_profiles")
    .select("profile_completed_at")
    .eq("tenant_id", userId)
    .maybeSingle();
  return intake?.profile_completed_at ? "full" : "profile-incomplete";
}
