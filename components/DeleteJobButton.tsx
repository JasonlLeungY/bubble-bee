"use client";

import { deleteJob } from "@/app/dashboard/jobs/actions";

export default function DeleteJobButton({ jobId, title }: { jobId: string; title: string }) {
  return (
    <form
      action={() => deleteJob(jobId)}
      onSubmit={(event) => {
        if (!window.confirm(`Delete the job "${title}"? This cannot be undone.`)) event.preventDefault();
      }}
    >
      <button
        type="submit"
        aria-label={`Delete ${title}`}
        className="hive cursor-pointer rounded-lg border border-rose-300 px-3.5 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
      >
        Delete
      </button>
    </form>
  );
}
