"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import JobDetailContent from "./JobDetailContent";
import { ApplyControl, type ApplyMode, type JobCardData } from "./JobCard";
import { employmentLabel, payLine } from "@/utils/job-display";

/**
 * Job details, in a side panel. The apply action and the pay stay at the top
 * while the rest scrolls. Escape closes the panel.
 */
export default function JobDetailDrawer({
  job,
  mode,
  onClose,
}: {
  job: JobCardData | null;
  mode: ApplyMode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (job && !dialog.open) dialog.showModal();
    if (!job && dialog.open) dialog.close();
  }, [job]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={job ? `${job.title} details` : "Job details"}
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-lg rounded-none bg-white p-0 text-neutral-900 backdrop:bg-black/50 sm:rounded-l-2xl"
    >
      {job && (
        <div className="flex h-full flex-col">
          {/* Sticky header: the apply action stays on screen */}
          <header className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
            <div className="min-w-0">
              <p className="text-xl font-bold tracking-tight">{payLine(job)}</p>
              <p className="truncate text-sm text-neutral-600">
                {job.title} · {job.employer} · {employmentLabel(job.employment_type)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ApplyControl jobId={job.id} mode={mode} applied={job.applied} />
              <button
                type="button"
                onClick={() => ref.current?.close()}
                aria-label="Close job details"
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-300 hover:border-neutral-900"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-7 overflow-y-auto px-5 py-6">
            <JobDetailContent job={job} />
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link href={`/jobs/${job.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2">
                Open the full job page
              </Link>
              {mode === "apply" && (
                <Link href={`/jobs/${job.id}#message-employer`} className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2">
                  Message the employer
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
