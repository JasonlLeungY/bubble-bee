"use client";

import Link from "next/link";
import { useActionState, useRef, type ReactNode } from "react";
import { createJob, updateJob, type JobState } from "@/app/dashboard/jobs/actions";
import { EMPLOYMENT_TYPES, SHIFT_WINDOWS, type JobFields } from "@/utils/job-form";
import { useUnsavedChanges } from "./useUnsavedChanges";

const labelClass = "block text-sm font-semibold";
const inputClass =
  "mt-1.5 block w-full min-h-11 rounded-lg border border-neutral-400 bg-white px-3.5 py-2.5 text-base text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900";
const choiceClass =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm font-medium transition hover:border-neutral-900 has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-100 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900";

function Question({ legend, hint, children }: { legend: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className={labelClass}>{legend}</legend>
      {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
      <div className="mt-2">{children}</div>
    </fieldset>
  );
}

export default function JobForm({
  mode = "create",
  jobId,
  initial,
}: {
  mode?: "create" | "edit";
  jobId?: string;
  initial?: Partial<JobFields>;
}) {
  const isEdit = mode === "edit" && Boolean(jobId);
  const [state, formAction, saving] = useActionState<JobState, FormData>(
    (prev, formData) => (isEdit ? updateJob(jobId ?? "", prev, formData) : createJob(prev, formData)),
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  useUnsavedChanges(formRef);

  // After a failed save, show what was typed; otherwise show what is saved.
  const source = state.fields ?? initial ?? {};
  const text = (key: keyof JobFields) => (source[key] as string | undefined) ?? "";
  const picked = (key: keyof JobFields, value: string) => text(key) === value;
  const checked = (key: keyof JobFields) => text(key) === "on";
  const shifts = (state.fields?.shifts ?? initial?.shifts ?? []) as string[];

  return (
    <form ref={formRef} action={formAction} className="mt-6 space-y-8">
      {state.error && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
          {state.error}
        </p>
      )}

      <section className="space-y-5">
        <h2 className="border-b border-neutral-200 pb-2 text-lg font-semibold">The job</h2>
        <label className="block">
          <span className={labelClass}>Job title</span>
          <input className={inputClass} name="title" maxLength={120} required defaultValue={text("title")} placeholder="Barista" />
        </label>
        <label className="block">
          <span className={labelClass}>Employer</span>
          <span className="block text-xs text-neutral-500">The business or person hiring.</span>
          <input className={inputClass} name="employer" maxLength={80} required defaultValue={text("employer")} />
        </label>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className={labelClass}>Suburb</span>
            <input className={inputClass} name="suburb" maxLength={80} required defaultValue={text("suburb")} />
          </label>
          <label className="block">
            <span className={labelClass}>Postcode</span>
            <input className={inputClass} name="postcode" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required defaultValue={text("postcode")} />
          </label>
        </div>
        <Question legend="Employment type">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {EMPLOYMENT_TYPES.map((option) => (
              <label key={option.value} className={choiceClass}>
                <input type="radio" name="employment_type" value={option.value} defaultChecked={picked("employmentType", option.value)} required className="h-4 w-4 accent-neutral-900" />
                {option.label}
              </label>
            ))}
          </div>
        </Question>
      </section>

      <section className="space-y-5">
        <h2 className="border-b border-neutral-200 pb-2 text-lg font-semibold">Pay</h2>
        <Question legend="Pay is">
          <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
            <label className={choiceClass}>
              <input type="radio" name="pay_unit" value="hour" defaultChecked={text("rateUnit") !== "year"} required className="h-4 w-4 accent-neutral-900" />
              Per hour
            </label>
            <label className={choiceClass}>
              <input type="radio" name="pay_unit" value="year" defaultChecked={text("rateUnit") === "year"} className="h-4 w-4 accent-neutral-900" />
              Per year
            </label>
          </div>
        </Question>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Lowest pay</span>
            <input className={inputClass} name="pay_rate_min" type="number" min={1} step="0.01" required defaultValue={text("rateMin")} />
          </label>
          <label className="block">
            <span className={labelClass}>Highest pay <span className="font-normal text-neutral-500">(optional)</span></span>
            <input className={inputClass} name="pay_rate_max" type="number" min={1} step="0.01" defaultValue={text("rateMax")} />
          </label>
        </div>
        <label className={choiceClass}>
          <input type="checkbox" name="super_included" defaultChecked={checked("superIncluded")} className="h-4 w-4 accent-neutral-900" />
          Super is included
        </label>
      </section>

      <section className="space-y-5">
        <h2 className="border-b border-neutral-200 pb-2 text-lg font-semibold">When</h2>
        <label className={choiceClass}>
          <input type="checkbox" name="immediate_start" defaultChecked={checked("immediateStart")} className="h-4 w-4 accent-neutral-900" />
          Immediate start
        </label>
        <label className="block max-w-xs">
          <span className={labelClass}>Or start on</span>
          <span className="block text-xs text-neutral-500">Leave empty when you tick Immediate start.</span>
          <input className={inputClass} name="start_date" type="date" defaultValue={text("startDate")} />
        </label>
        <Question legend="Shift times" hint="Pick every one that applies.">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SHIFT_WINDOWS.map((option) => (
              <label key={option.value} className={choiceClass}>
                <input type="checkbox" name="shift_windows" value={option.value} defaultChecked={shifts.includes(option.value)} className="h-4 w-4 accent-neutral-900" />
                {option.label}
              </label>
            ))}
          </div>
        </Question>
        <label className="block max-w-xs">
          <span className={labelClass}>Hours per week</span>
          <input className={inputClass} name="hours_per_week" type="number" min={1} max={80} step={1} required defaultValue={text("hoursPerWeek")} />
        </label>
        <label className="block">
          <span className={labelClass}>Schedule note <span className="font-normal text-neutral-500">(optional)</span></span>
          <input className={inputClass} name="hours" maxLength={120} defaultValue={text("hours")} placeholder="Weekends and Friday evenings" />
        </label>
      </section>

      <section className="space-y-5">
        <h2 className="border-b border-neutral-200 pb-2 text-lg font-semibold">Who can apply</h2>
        <label className={choiceClass}>
          <input type="checkbox" name="no_experience" defaultChecked={checked("noExperience")} className="h-4 w-4 accent-neutral-900" />
          No experience needed
        </label>
        <label className={choiceClass}>
          <input type="checkbox" name="visa_friendly" defaultChecked={checked("visaFriendly")} className="h-4 w-4 accent-neutral-900" />
          Visa friendly (student visa holders welcome)
        </label>
        <label className="block">
          <span className={labelClass}>Description <span className="font-normal text-neutral-500">(optional)</span></span>
          <span className="block text-xs text-neutral-500">What the job involves, and anything else applicants should know.</span>
          <textarea className={`${inputClass} min-h-32`} name="description" maxLength={5000} defaultValue={text("description")} />
        </label>
      </section>

      <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-neutral-200 bg-white/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <button
          type="submit"
          disabled={saving}
          className="hive min-h-11 cursor-pointer rounded-lg bg-rose-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : isEdit ? "Save job" : "Post job"}
        </button>
        <Link href="/dashboard" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2">
          Cancel
        </Link>
      </div>
    </form>
  );
}
