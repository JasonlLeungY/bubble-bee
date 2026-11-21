import { createClient } from "@/utils/supabase/server";

/**
 * Records one page view for the admin statistics. Stores the path only: no
 * user, no address, no IP. Failures are ignored, so a page never fails because
 * of counting.
 */
export async function recordPageView(path: string) {
  try {
    const supabase = await createClient();
    await supabase.from("page_views").insert({ path: path.slice(0, 300) });
  } catch {
    // Counting is best effort.
  }
}
