"use client";

import Link from "next/link";
import { useActionState } from "react";
import { quickApply, type ApplyState } from "@/app/dashboard/jobs/actions";
import { employmentLabel, payLine, shiftLabels, startLabel } from "@/utils/job-display";

/** One job as the cards and the detail panel show it. Description is null for guests. */
export type JobCardData = {
  id: string;
  title: string;
  employer: string;
  suburb: string;
  postcode: string | null;
  pay: string;
  pay_rate_min: number | null;
  pay_rate_max: number | null;
  pay_unit: string | null;
  super_included: boolean | null;
  employment_type: string | null;
  immediate_start: boolean | null;
  start_date: string | null;
  shift_windows: string[] | null;
  hours_per_week: number | null;
  no_experience: boolean | null;
  visa_friendly: boolean | null;
  hours: string | null;
  description: string | null;
  distance_km: number | null;
  room_id: string | null;
  room_title: string | null;
  room_price: number | null;
  room_km: number | null;
  /** True when the signed-in tenant has already applied. Set by the page that lists the job. */
  applied?: boolean;
};

/** What the viewer may do with a job: sign in, finish the profile, apply, or nothing. */
export type ApplyMode = "signin" | "profile" | "apply" | "none" | "preview";

const TYPE_STYLE: Record<string, string> = {
  casual: "bg-amber-100 text-amber-900",
  part_time: "bg-sky-100 text-sky-900",
  full_time: "bg-emerald-100 text-emerald-900",
};

function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "strong" }) {
  const style =
    tone === "strong"
      ? "bg-emerald-600 text-white"
      : "bg-neutral-100 text-neutral-800";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{children}</span>;
}

/** Apply in one tap, or a link to the step that comes first. */
export function ApplyControl({ jobId, mode, applied = false }: { jobId: string; mode: ApplyMode; applied?: boolean }) {
  if (mode === "signin") {
    return (
      <Link href="/signup?reason=details" className="inline-flex min-h-11 items-center rounded-lg border border-neutral-900 px-4 text-sm font-semibold hover:bg-neutral-50">
        Sign in to apply
      </Link>
    );
  }
  if (mode === "profile") {
    return (
      <Link href="/dashboard/profile" className="inline-flex min-h-11 items-center rounded-lg border border-neutral-900 px-4 text-sm font-semibold hover:bg-neutral-50">
        Finish profile to apply
      </Link>
    );
  }
  if (mode === "none") return null;
  // Already applied (from an earlier visit): say so, rather than offer to apply again.
  if (applied && mode === "apply") {
    return <span className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800">Applied</span>;
  }
  if (mode === "preview") {
    return (
      <button type="button" disabled className="inline-flex min-h-11 cursor-not-allowed items-center rounded-lg bg-neutral-200 px-4 text-sm font-semibold text-neutral-500">
        Quick Apply
      </button>
    );
  }
  return <QuickApply jobId={jobId} />;
}

/**
 * Quick Apply on the job page jumps to the message box, so the tenant can say
 * hello straight after applying. Pages without that box do nothing here.
 */
function jumpToMessageBox() {
  const section = document.getElementById("message-employer");
  if (!section) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  section.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  section.querySelector("textarea")?.focus({ preventScroll: true });
}

function QuickApply({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(
    (prev) => quickApply(jobId, prev),
    {},
  );

  if (state.applied) {
    return <span className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800">Applied</span>;
  }
  return (
    <form action={action} onSubmit={jumpToMessageBox} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={pending}
        className="hive inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Sending…" : "Quick Apply"}
      </button>
      {state.error && <span role="alert" className="text-xs text-rose-800">{state.error}</span>}
    </form>
  );
}

/** A job for a 5-second scan: pay and type first, then the role and the practical details. */
export default function JobCard({
  job,
  mode,
  onOpen,
}: {
  job: JobCardData;
  mode: ApplyMode;
  onOpen: (job: JobCardData) => void;
}) {
  const shifts = shiftLabels(job.shift_windows);
  const immediate = Boolean(job.immediate_start);
  return (
    // Full height, so cards in one row line up, with the footer at the bottom.
    <article className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)] transition hover:border-neutral-400">
      <button
        type="button"
        onClick={() => onOpen(job)}
        className="block w-full flex-1 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900"
      >
        {/* Row 1: pay and employment type */}
        <div className="flex items-start justify-between gap-3">
          <p className="text-lg font-bold tracking-tight text-neutral-950">{payLine(job)}</p>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${TYPE_STYLE[job.employment_type ?? ""] ?? "bg-neutral-100 text-neutral-800"}`}>
            {employmentLabel(job.employment_type)}
          </span>
        </div>

        {/* Row 2: role, place and distance */}
        <h3 className="mt-2 text-base font-semibold text-neutral-900">{job.title}</h3>
        <p className="mt-0.5 text-sm text-neutral-600">
          {job.suburb}
          {job.postcode ? `, SA ${job.postcode}` : ""}
          {job.distance_km !== null && job.distance_km !== undefined && (
            <span className="ml-2 font-semibold text-neutral-800">{job.distance_km} km away</span>
          )}
        </p>

        {/* Row 3: compact badges */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip tone={immediate ? "strong" : "neutral"}>{startLabel(job)}</Chip>
          {shifts.map((label) => (
            <Chip key={label}>{label}</Chip>
          ))}
          {job.hours_per_week && <Chip>{job.hours_per_week} hrs/wk</Chip>}
          {job.no_experience && <Chip>No experience</Chip>}
          {job.visa_friendly && <Chip>Visa friendly</Chip>}
        </div>

        {/* Row 4: two lines of plain English */}
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-neutral-700">
          {job.description ?? "Sign in to read the full description."}
        </p>
      </button>

      {/* Footer: who is hiring, and one tap to apply */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-neutral-200 pt-4">
        <p className="flex min-w-0 items-center gap-2 text-sm text-neutral-700">
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-white">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />
            </svg>
            Landlord
          </span>
          <span className="truncate font-medium">{job.employer}</span>
        </p>
        <ApplyControl jobId={job.id} mode={mode} applied={job.applied} />
      </div>
    </article>
  );
}
