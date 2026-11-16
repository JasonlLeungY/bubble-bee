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

const nextConfig: NextConfig = {
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
