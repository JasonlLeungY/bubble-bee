import type { Metadata } from "next";
import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import JobsView from "@/app/jobs/JobsView";

export const metadata: Metadata = { title: "Work + Stay" };

export default function WorkAndStayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-white font-sans text-neutral-900">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
          <JobsView searchParams={searchParams} mode="bundle" />
        </Suspense>
      </main>
    </div>
  );
}
