"use client";

import { useState } from "react";
import JobCard, { type ApplyMode, type JobCardData } from "./JobCard";
import JobDetailDrawer from "./JobDetailDrawer";

/** A list of job cards that opens the details panel for the one chosen. */
export default function JobBoard({ jobs, mode }: { jobs: JobCardData[]; mode: ApplyMode }) {
  const [open, setOpen] = useState<JobCardData | null>(null);
  return (
    <>
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {jobs.map((job) => (
          <li key={job.id}>
            <JobCard job={job} mode={mode} onOpen={setOpen} />
          </li>
        ))}
      </ul>
      <JobDetailDrawer job={open} mode={mode} onClose={() => setOpen(null)} />
    </>
  );
}
