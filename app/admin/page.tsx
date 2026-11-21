import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { isAdminUser } from "@/utils/access";
import { createClient } from "@/utils/supabase/server";

// Not linked from anywhere on the site or app, and kept out of search engines.
// Anyone who is not an administrator gets the same "not found" page as any
// missing address.
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

type Stats = {
  users: number;
  tenants: number;
  landlords: number;
  signups_7d: number;
  signups_30d: number;
  active_30d: number;
  listings: number;
  conversations: number;
  messages: number;
  paid: number;
  views_today: number;
  views_7d: number;
  views_30d: number;
  top_pages_30d: { path: string; views: number }[];
};

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-neutral-500">Loading…</p>}>
      <Gate />
    </Suspense>
  );
}

// Administrators only. Anyone else gets the standard "not found" page, so the
// existence of this page is not revealed.
async function Gate() {
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId || !(await isAdminUser(supabase, userId))) notFound();

  return (
    <main className="min-h-screen flex-1 bg-white px-4 py-10 font-sans text-neutral-900">
      <div className="mx-auto w-full max-w-5xl">
        <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
          <Dashboard />
        </Suspense>
      </div>
    </main>
  );
}

async function Dashboard() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_stats");
  if (error || !data) throw new Error("Could not load the statistics.");
  const stats = data as Stats;

  const cards: { label: string; value: number | string; note?: string }[] = [
    { label: "Users", value: stats.users },
    { label: "Tenants", value: stats.tenants },
    { label: "Landlords", value: stats.landlords },
    { label: "Active (signed in, 30 days)", value: stats.active_30d },
    { label: "New sign-ups (7 days)", value: stats.signups_7d },
    { label: "New sign-ups (30 days)", value: stats.signups_30d },
    { label: "Paid", value: stats.paid, note: "Payments are not set up yet" },
    { label: "Listings", value: stats.listings },
    { label: "Conversations", value: stats.conversations },
    { label: "Messages", value: stats.messages },
    { label: "Page views (today)", value: stats.views_today },
    { label: "Page views (7 days)", value: stats.views_7d },
    { label: "Page views (30 days)", value: stats.views_30d },
  ];

  return (
    <>
      <h1 className="text-[26px] leading-8 font-semibold tracking-tight">Admin</h1>
      <p className="mt-1 text-sm text-neutral-500">Traffic and user statistics. Visible to administrators only.</p>

      <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((card) => (
          <li key={card.label} className="rounded-xl border border-neutral-200 p-4">
            <p className="text-xs text-neutral-500">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold">{card.value.toLocaleString()}</p>
            {card.note && <p className="mt-1 text-xs text-neutral-500">{card.note}</p>}
          </li>
        ))}
      </ul>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Most viewed pages (30 days)</h2>
        {stats.top_pages_30d.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No page views recorded yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="py-2 font-medium">Page</th>
                <th className="py-2 text-right font-medium">Views</th>
              </tr>
            </thead>
            <tbody>
              {stats.top_pages_30d.map((page) => (
                <tr key={page.path} className="border-b border-neutral-100">
                  <td className="py-2 break-all">{page.path}</td>
                  <td className="py-2 text-right">{page.views.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
