"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { useUnsavedChanges } from "./useUnsavedChanges";
import { createJob, updateJob, type JobState } from "@/app/dashboard/jobs/actions";
import type { JobFields } from "@/utils/job-form";

const labelClass = "block text-sm font-semibold";
const inputClass =
  "mt-1.5 block w-full rounded-lg border border-neutral-400 bg-white px-3.5 py-3 text-base text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900";

export default function JobForm({
  mode = "create",
  jobId,
  initial,
}: {
  mode?: "create" | "edit";
  jobId?: string;
  initial?: JobFields;
}) {
  const isEdit = mode === "edit" && Boolean(jobId);
  const [state, formAction, saving] = useActionState<JobState, FormData>(
    (prev, formData) => (isEdit ? updateJob(jobId ?? "", prev, formData) : createJob(prev, formData)),
    {},
  );
  const value = (name: keyof JobFields) => state.fields?.[name] ?? initial?.[name] ?? "";
  const formRef = useRef<HTMLFormElement>(null);
  useUnsavedChanges(formRef);

  return (
    <form ref={formRef} action={formAction} className="mt-6 space-y-6">
      <label className="block">
        <span className={labelClass}>Job title</span>
        <input className={inputClass} name="title" maxLength={120} required defaultValue={value("title")} placeholder="Barista" />
      </label>
      <label className="block">
        <span className={labelClass}>Employer</span>
        <span className="block text-xs text-neutral-500">The business or person hiring.</span>
        <input className={inputClass} name="employer" maxLength={80} required defaultValue={value("employer")} />
      </label>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Suburb</span>
          <input className={inputClass} name="suburb" maxLength={80} required defaultValue={value("suburb")} />
        </label>
        <label className="block">
          <span className={labelClass}>Pay</span>
          <span className="block text-xs text-neutral-500">For example $28 to $32 an hour.</span>
          <input className={inputClass} name="pay" maxLength={80} required defaultValue={value("pay")} />
        </label>
      </div>
      <label className="block">
        <span className={labelClass}>Hours <span className="font-normal text-neutral-500">(optional)</span></span>
        <input className={inputClass} name="hours" maxLength={120} defaultValue={value("hours")} placeholder="Weekends, 15 hours a week" />
      </label>
      <label className="block">
        <span className={labelClass}>Description <span className="font-normal text-neutral-500">(optional)</span></span>
        <textarea className={`${inputClass} min-h-32`} name="description" maxLength={5000} defaultValue={value("description")} />
      </label>

      {state.error && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="hive cursor-pointer rounded-lg bg-rose-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : isEdit ? "Save job" : "Post job"}
        </button>
        <Link href="/dashboard" className="text-sm font-semibold underline underline-offset-2">
          Cancel
        </Link>
      </div>
    </form>
  );
}
