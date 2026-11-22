// Job labels and pay lines. Plain functions with no client code, so both server
// pages and client components can use them.

import { EMPLOYMENT_TYPES, SHIFT_WINDOWS, formatPay } from "@/utils/job-form";
import type { JobCardData } from "@/components/JobCard";

const dateFormat = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });

export function employmentLabel(value: string | null) {
  return EMPLOYMENT_TYPES.find((option) => option.value === value)?.label ?? "Not stated";
}

export function shiftLabels(values: string[] | null) {
  return (values ?? []).map((value) => SHIFT_WINDOWS.find((option) => option.value === value)?.label ?? value);
}

export function payLine(job: JobCardData) {
  return formatPay({
    pay_rate_min: job.pay_rate_min,
    pay_rate_max: job.pay_rate_max,
    pay_unit: job.pay_unit,
    super_included: job.super_included,
    pay: job.pay,
  });
}

export function startLabel(job: JobCardData) {
  if (job.immediate_start) return "Immediate start";
  if (!job.start_date) return "Start: to agree";
  return `Starts ${dateFormat.format(new Date(`${job.start_date}T00:00:00Z`))}`;
}
