import type { NextConfig } from "next";

// Listing photos are served from the public `listing-images` bucket of the
// Supabase project in NEXT_PUBLIC_SUPABASE_URL. next/image is only allowed to
// optimise images from that one bucket.
const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseUrl = URL.canParse(rawSupabaseUrl)
  ? new URL(rawSupabaseUrl)
  : null;
// True only when developing against `supabase start` on this machine.
const isLocalSupabase =
  supabaseUrl !== null &&
  ["127.0.0.1", "localhost"].includes(supabaseUrl.hostname);

// Report-only for now: the browser logs anything the policy would block, without
// blocking it. Switch the header name to Content-Security-Policy once the logs are clean.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://maps.gstatic.com https://*.googleapis.com https://*.ggpht.com",
  `connect-src 'self' ${supabaseUrl ? `${supabaseUrl.origin} ${supabaseUrl.origin.replace(/^http/, "ws")}` : ""} https://maps.googleapis.com`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(), microphone=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: supabaseUrl
      ? [
          {
            protocol: supabaseUrl.protocol === "http:" ? "http" : "https",
            hostname: supabaseUrl.hostname,
            port: supabaseUrl.port,
            pathname: "/storage/v1/object/public/listing-images/**",
          },
        ]
      : [],
    // Next.js refuses to fetch images from loopback addresses unless told to.
    dangerouslyAllowLocalIP: isLocalSupabase,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
