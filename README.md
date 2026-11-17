# Sharehouse

A lead-generation marketplace for share houses. Landlords list rooms with
house rules; tenants can only contact a landlord when their lifestyle fits
those rules.

Built with Next.js (App Router), Tailwind CSS and Supabase. There are no
payments.

## What is in here

| Area | Where |
| --- | --- |
| Sign up, log in, session handling | `app/login`, `app/signup`, `app/auth`, `proxy.ts`, `utils/supabase` |
| Landlord dashboard and listing creation | `app/dashboard`, `components/ImageUploader.tsx` |
| Public grid and listing pages | `app/page.tsx`, `app/listings/[id]` |
| Gated contact and inbox | `app/listings/[id]/actions.ts`, `app/messages`, `utils/lifestyle.ts` |
| Database schema and security rules | `supabase/migrations` |

## Set up Supabase

In your Supabase project, open the SQL Editor and run these files in order:

1. `supabase/migrations/20261115000000_profiles.sql`
2. `supabase/migrations/20261115010000_listings.sql`
3. `supabase/migrations/20261115020000_messaging.sql`

Each script can only be run once. If one fails with `already exists`, nothing
was changed (a failed script is undone as a whole). Run `supabase/check.sql`
to see what is already set up:

- Tables showing the columns above (`first_name`, `price_per_week`,
  `content`...) are done; run only the scripts for the missing ones.
- `display_name`, `rent_amount` or a `listing_images` table mean an old draft
  schema. Run `supabase/reset.sql`, delete your test users under
  Authentication, Users, then run all three scripts. The reset deletes all
  app data, so never run it on a live project with real users.

## Run locally

Copy `.env.example` to `.env.local` and fill in your project URL and
publishable key (Supabase Dashboard, "Connect"). Never use the secret key.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000.

## Deploy

1. Import this repository on Vercel.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   as environment variables before deploying.
3. In Supabase, under Authentication, URL Configuration, set "Site URL" to the
   live address and add `http://localhost:3000/**` under "Redirect URLs".
4. Connect an email provider under the SMTP settings. The built-in sender is
   for testing only.

## The lifestyle gate

A tenant trait that is switched on needs the matching house rule switched on:

| Tenant (`profiles`) | House rule (`listings`) |
| --- | --- |
| `is_smoker` | `is_smoker_allowed` |
| `is_shift_worker` | `is_shift_worker_friendly` |
| `tolerates_noise` | `tolerates_noise` |

The rule lives in two places that must stay in step: `utils/lifestyle.ts`
(for the page and the friendly error) and the insert policy on
`public.conversations` (which enforces it even if the app is bypassed).
