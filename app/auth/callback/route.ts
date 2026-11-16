import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Landing route for the confirmation link in the sign-up email.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  if (searchParams.get("error")) {
    return NextResponse.redirect(`${origin}/login?message=link-expired`);
  }

  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  // The email is confirmed even when the code cannot be exchanged here (for
  // example the link was opened in a different browser), so ask them to log in.
  return NextResponse.redirect(`${origin}/login?message=confirmed`);
}
