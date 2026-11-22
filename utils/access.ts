import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * True when the signed-in user is an administrator. The flag itself is not
 * readable through the API, so the check runs in the database (public.is_admin).
 */
export async function isAdminUser(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.rpc("is_admin");
  return data === true;
}
