import Link from "next/link";
import { connection } from "next/server";
import JobBoard from "@/components/JobBoard";
import JobFilterBar from "@/components/JobFilterBar";
import ModeSwitcher from "@/components/ModeSwitcher";
import { applyModeFor, jobHref, loadJobs, readJobFilters, readPage, resolveSearch } from "@/utils/job-search";
import { viewerAccess, type ViewerAccess } from "@/utils/tenant-gate";
import { createClient } from "@/utils/supabase/server";

const PAGE_SIZE = 10;

/**
 * The local jobs list, and the Work + Stay list (only jobs whose employer also
 * has a room nearby). Both use the same filters and the same guest limits.
 */
export default async function JobsView({
  searchParams,
  mode,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  mode: "jobs" | "bundle";
}) {
  await connection();
  const params = await searchParams;
  const bundle = mode === "bundle";
  const base = bundle ? "/work-and-stay" : "/jobs";
  const filters = readJobFilters(params);
  const page = readPage(params);

  const supabase = await createClient();
  const access = await viewerAccess(supabase);
  const applyMode = await applyModeFor(supabase, access);
  const { data: suburbRows } = await supabase.rpc("browse_suburbs");
  const suburbs = (suburbRows ?? []).map((row: { suburb: string }) => row.suburb);
  const { search, problem } = await resolveSearch(filters, access);

  const header = (
    <>
      <h1 className="text-[26px] leading-8 font-semibold tracking-tight">{bundle ? "Work + Stay" : "Local jobs"}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {bundle
          ? "Jobs from employers who also have a room within 25 km. Work close to home."
          : "Newest first. Pick a suburb, job type or shift to narrow the list."}
      </p>
      <div className="mt-6">
        <ModeSwitcher active={bundle ? "bundle" : "jobs"} />
      </div>
      <div className="mt-6">
        <JobFilterBar base={base} filters={filters} suburbs={suburbs} />
      </div>
    </>
  );

  if (problem) {
    return (
      <>
        {header}
        <Alert>{problem}</Alert>
      </>
    );
  }

  if (page > 1 && access !== "full") {
    return (
      <>
        {header}
        <AccessNote access={access} page />
      </>
    );
  }

  // One extra job tells us whether there is a next page. Guests get the first 10 only.
  const found = await loadJobs(supabase, applyMode, {
    search,
    types: filters.types,
    minRate: filters.minRate,
    immediate: filters.immediate,
    shifts: filters.shifts,
    bundle,
    offset: (page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE + 1,
  });
  if (!found) {
    return (
      <>
        {header}
        <Alert>We could not load the jobs just now. Refresh the page to try again.</Alert>
      </>
    );
  }

  const hasNext = found.length > PAGE_SIZE;
  const jobs = found.slice(0, PAGE_SIZE);
  const summary = [
    filters.suburb ? `within ${filters.km} km of ${filters.suburb}` : null,
    filters.minRate !== null ? `from $${filters.minRate}/hr` : null,
    filters.immediate ? "starting straight away" : null,
  ].filter(Boolean);
  const count = jobs.length === 1 ? "1 job" : `${jobs.length} jobs`;

  return (
    <>
      {header}
      <p className="mt-8 text-sm text-neutral-600">
        {jobs.length === 0 ? "No jobs match these filters." : `${count}${summary.length ? `, ${summary.join(", ")}` : ""}.`}
      </p>
      <div className="mt-4">
        <JobBoard jobs={jobs} mode={applyMode} />
      </div>
      <nav aria-label="Pages" className="mt-10 flex items-center justify-between gap-4 text-sm">
        {page > 1 ? (
          <Link href={jobHref(base, filters, { page: String(page - 1) })} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
            Previous page
          </Link>
        ) : (
          <span />
        )}
        {hasNext && (
          <Link href={jobHref(base, filters, { page: String(page + 1) })} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
            Next page
          </Link>
        )}
      </nav>
      {access !== "full" && <AccessNote access={access} />}
    </>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-6 text-sm text-rose-800">
      {children}
    </p>
  );
}

// Shown to guests and unfinished tenants: what they can do next.
function AccessNote({ access, page = false }: { access: ViewerAccess; page?: boolean }) {
  if (access === "full") return null;
  const isGuest = access === "guest";
  return (
    <div className={`${page ? "mt-8" : "mt-10"} rounded-2xl border border-dashed border-neutral-300 px-6 py-10 text-center`}>
      <p className="font-semibold">{page ? "See more jobs" : "See full details and apply"}</p>
      <p className="mt-1 text-sm text-neutral-500">
        {isGuest
          ? "Create a free account to read job details, apply in one tap, and browse every page."
          : "Finish your profile to read job details, apply in one tap, and browse every page."}
      </p>
      <Link
        href={isGuest ? "/signup?reason=details" : "/dashboard/profile"}
        className="hive mt-5 inline-flex min-h-11 items-center rounded-lg bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
      >
        {isGuest ? "Create an account" : "Finish your profile"}
      </Link>
    </div>
  );
}
