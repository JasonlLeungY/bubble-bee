import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/messages"];
const GUEST_ONLY_PATHS = ["/login", "/signup"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // Refreshed tokens go on the request (for Server Components rendered
          // in this pass) and on the response (for the browser).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // Cache-Control headers that stop a CDN caching a response that
          // carries someone's session cookies.
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims(): this call is
  // what refreshes an expired session and verifies the token.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isSignedIn && isProtected) {
    // Posting a room needs an account, so send that visitor to sign up.
    if (pathname === "/dashboard/new" || pathname.startsWith("/dashboard/new/")) {
      return redirectTo("/signup?reason=post", request, response);
    }
    return redirectTo("/login", request, response);
  }
  if (isSignedIn && GUEST_ONLY_PATHS.includes(pathname)) {
    return redirectTo("/dashboard", request, response);
  }

  return response;
}

// A redirect is a new response, so carry over any cookies and headers the
// session refresh just set, or the browser and server fall out of sync.
function redirectTo(
  pathname: string,
  request: NextRequest,
  response: NextResponse,
) {
  const url = request.nextUrl.clone();
  // A path may carry a query string, e.g. "/signup?reason=post".
  const [path, query = ""] = pathname.split("?");
  url.pathname = path;
  url.search = query ? `?${query}` : "";

  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  const cacheControl = response.headers.get("cache-control");
  if (cacheControl) redirect.headers.set("cache-control", cacheControl);
  return redirect;
}
