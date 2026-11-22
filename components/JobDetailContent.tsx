import Link from "next/link";
import type { JobCardData } from "./JobCard";
import { payLine, shiftLabels, startLabel } from "@/utils/job-display";

// Icon paths: pay, shifts, calendar, car, work rights, hours.
const ICONS = {
  pay: "M12 3v18M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 2.6 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3",
  shifts: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  calendar: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4",
  car: "M5 16V11l2-5h10l2 5v5M5 16h14",
  rights: "M12 3 4 6v6c0 4.5 3.4 7.8 8 9 4.6-1.2 8-4.5 8-9V6z",
  hours: "M12 6v6l4 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18",
};

function Tile({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex min-h-[4.5rem] flex-col justify-between rounded-xl border border-neutral-200 p-3">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-neutral-900 stroke-2" strokeLinecap="round" strokeLinejoin="round">
        <path d={icon} />
      </svg>
      <div className="mt-2">
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="text-sm font-semibold text-neutral-900">{value}</p>
      </div>
    </div>
  );
}

/**
 * The details of one job: a 2 x 3 at-a-glance grid, three bullets, and the
 * linked room when the employer also has one nearby. Used by the job panel and
 * the job page.
 */
export default function JobDetailContent({ job }: { job: JobCardData }) {
  const shifts = shiftLabels(job.shift_windows);
  return (
    <div className="space-y-7">
      <section aria-label="At a glance" className="grid grid-cols-2 gap-3">
        <Tile label="Pay" value={payLine(job)} icon={ICONS.pay} />
        <Tile label="Roster" value={shifts.length ? shifts.join(", ") : "To agree"} icon={ICONS.shifts} />
        <Tile label="Start" value={startLabel(job)} icon={ICONS.calendar} />
        <Tile label="Getting there" value={job.distance_km !== null ? `${job.distance_km} km away` : "Ask the employer"} icon={ICONS.car} />
        <Tile label="Work rights" value={job.visa_friendly ? "Visa friendly" : "Check with employer"} icon={ICONS.rights} />
        <Tile label="Hours" value={job.hours_per_week ? `${job.hours_per_week} hrs/wk` : "To agree"} icon={ICONS.hours} />
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-500">What you&rsquo;ll do</h3>
          <p className="mt-1.5 whitespace-pre-line break-words text-sm leading-6 text-neutral-800">
            {job.description ?? "The full description is shared once you sign in."}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Requirements</h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-neutral-800">
            <li>{job.no_experience ? "No experience needed" : "Some experience helpful"}</li>
            <li>{job.visa_friendly ? "Student visa holders welcome" : "Work rights to be confirmed with the employer"}</li>
            {job.hours_per_week && <li>Available around {job.hours_per_week} hours a week</li>}
            {job.hours && <li>Schedule: {job.hours}</li>}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Perks</h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-neutral-800">
            {job.super_included && <li>Super included</li>}
            {job.immediate_start && <li>Can start straight away</li>}
            {shifts.length > 0 && <li>Shifts: {shifts.join(", ")}</li>}
            {!job.super_included && !job.immediate_start && shifts.length === 0 && <li>Ask the employer about perks</li>}
          </ul>
        </div>
      </section>

      {job.room_id && (
        <section aria-label="Room nearby" className="rounded-2xl border border-neutral-900 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Work + Stay</p>
          <p className="mt-1 font-semibold">{job.room_title}</p>
          <p className="text-sm text-neutral-700">
            {job.room_price !== null ? `$${Number(job.room_price).toFixed(0)} a week` : ""}
            {job.room_km !== null ? ` · ${job.room_km} km from this job` : ""}
          </p>
          <Link href={`/listings/${job.room_id}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2">
            See the room
          </Link>
        </section>
      )}
    </div>
  );
}
