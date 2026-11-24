"use client";

import { useActionState } from "react";
import { deleteJob, type DeleteState } from "@/app/dashboard/jobs/actions";

export default function DeleteJobButton({ jobId, title }: { jobId: string; title: string }) {
  const [state, action, pending] = useActionState<DeleteState, FormData>(() => deleteJob(jobId), {});
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Delete the job "${title}"? This cannot be undone.`)) event.preventDefault();
      }}
      className="flex flex-col items-end gap-1"
    >
      <button
        type="submit"
        disabled={pending}
        aria-label={`Delete ${title}`}
        className="hive cursor-pointer rounded-lg border border-rose-300 px-3.5 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state.error && (
        <span role="alert" className="text-xs text-rose-800">
          {state.error}
        </span>
      )}
    </form>
  );
}
