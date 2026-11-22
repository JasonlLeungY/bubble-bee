import Link from "next/link";
import { EMPLOYMENT_TYPES, SHIFT_WINDOWS } from "@/utils/job-form";
import { MIN_RATE_OPTIONS, RADIUS_OPTIONS, type JobFilters } from "@/utils/job-search";

// A plain GET form, so the filters work without JavaScript.
const pill =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-neutral-300 px-4 text-sm font-semibold transition hover:border-neutral-900 has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900";
const field =
  "mt-1.5 block w-full min-h-11 rounded-lg border border-neutral-400 bg-white px-3.5 py-2.5 text-base text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900";

export default function JobFilterBar({
  base,
  filters,
  suburbs,
}: {
  /** The page the filters apply to: "/jobs" or "/work-and-stay". */
  base: string;
  filters: JobFilters;
  suburbs: string[];
}) {
  const anyFilter = Boolean(filters.suburb || filters.types.length || filters.minRate !== null || filters.immediate || filters.shifts.length);
  return (
    <form action={base} method="get" className="space-y-5 rounded-2xl border border-neutral-200 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
        <label className="block text-sm font-semibold">
          Suburb
          <input
            name="suburb"
            list="job-suburbs"
            defaultValue={filters.suburb}
            placeholder="For example Woodville"
            maxLength={80}
            autoComplete="off"
            className={field}
          />
          <datalist id="job-suburbs">
            {suburbs.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        <label className="block text-sm font-semibold">
          Within
          <select name="radius" defaultValue={String(filters.km)} className={`${field} sm:w-32`}>
            {RADIUS_OPTIONS.map((km) => (
              <option key={km} value={km}>
                {km} km
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Job type</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {EMPLOYMENT_TYPES.map((option) => (
            <label key={option.value} className={pill}>
              <input type="checkbox" name="type" value={option.value} defaultChecked={filters.types.includes(option.value)} className="sr-only" />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Minimum hourly pay
          <select name="rate" defaultValue={filters.minRate === null ? "" : String(filters.minRate)} className={field}>
            <option value="">Any pay</option>
            {MIN_RATE_OPTIONS.map((rate) => (
              <option key={rate} value={rate}>
                ${rate}/hr or more
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="text-sm font-semibold">Start</legend>
          <div className="mt-2">
            <label className={pill}>
              <input type="checkbox" name="now" value="1" defaultChecked={filters.immediate} className="sr-only" />
              Immediate start
            </label>
          </div>
        </fieldset>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Shift times</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SHIFT_WINDOWS.map((option) => (
            <label key={option.value} className={pill}>
              <input type="checkbox" name="shift" value={option.value} defaultChecked={filters.shifts.includes(option.value)} className="sr-only" />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="hive inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          Show jobs
        </button>
        {anyFilter && (
          <Link href={base} className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2">
            Clear filters
          </Link>
        )}
      </div>
    </form>
  );
}
