// Job posts: the choice lists, the pay format, and the checks the server runs
// on every answer. The database enforces the same lists and ranges
// (supabase/migrations/20261138000000_job_cards.sql).

export const EMPLOYMENT_TYPES = [
  { value: "casual", label: "Casual" },
  { value: "part_time", label: "Part-time" },
  { value: "full_time", label: "Full-time" },
] as const;

export const SHIFT_WINDOWS = [
  { value: "day", label: "Day" },
  { value: "evening", label: "Evening / late night" },
  { value: "weekends", label: "Weekends" },
] as const;

export const JOB_MAX = { title: 120, employer: 80, suburb: 80, hours: 120, description: 5000 };

/** What the form shows again after an error. Booleans are "on" or "". */
export type JobFields = {
  title: string;
  employer: string;
  suburb: string;
  postcode: string;
  employmentType: string;
  rateMin: string;
  rateMax: string;
  rateUnit: string;
  superIncluded: string;
  startDate: string;
  immediateStart: string;
  shifts: string[];
  hoursPerWeek: string;
  noExperience: string;
  visaFriendly: string;
  hours: string;
  description: string;
};

/** The columns written to public.job_posts. */
export type JobValues = {
  title: string;
  employer: string;
  suburb: string;
  postcode: string;
  pay: string;
  pay_rate_min: number;
  pay_rate_max: number;
  pay_unit: "hour" | "year";
  super_included: boolean;
  employment_type: "casual" | "part_time" | "full_time";
  start_date: string | null;
  immediate_start: boolean;
  shift_windows: string[];
  hours_per_week: number;
  no_experience: boolean;
  visa_friendly: boolean;
  hours: string | null;
  description: string;
};

/** The pay line everyone sees: "$28–$32/hr + Super" or "$60,000–$70,000/yr". */
export function formatPay(job: {
  pay_rate_min: number | string | null;
  pay_rate_max: number | string | null;
  pay_unit: string | null;
  super_included: boolean | null;
  pay?: string | null;
}) {
  if (job.pay_rate_min === null || job.pay_rate_min === undefined) return job.pay ?? "Pay not stated";
  const min = Number(job.pay_rate_min);
  const max = Number(job.pay_rate_max ?? job.pay_rate_min);
  const unit = job.pay_unit === "year" ? "yr" : "hr";
  const money = (amount: number) =>
    `$${amount.toLocaleString("en-AU", { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
  const range = min === max ? money(min) : `${money(min)}–${money(max)}`;
  return `${range}/${unit}${job.super_included ? " + Super" : ""}`;
}

export function readJobForm(formData: FormData): { fields: JobFields; values: JobValues | null; error: string | null } {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const fields: JobFields = {
    title: text("title"),
    employer: text("employer"),
    suburb: text("suburb"),
    postcode: text("postcode"),
    employmentType: text("employment_type"),
    rateMin: text("pay_rate_min"),
    rateMax: text("pay_rate_max"),
    rateUnit: text("pay_unit"),
    superIncluded: formData.get("super_included") === "on" ? "on" : "",
    startDate: text("start_date"),
    immediateStart: formData.get("immediate_start") === "on" ? "on" : "",
    shifts: formData.getAll("shift_windows").filter((v): v is string => typeof v === "string"),
    hoursPerWeek: text("hours_per_week"),
    noExperience: formData.get("no_experience") === "on" ? "on" : "",
    visaFriendly: formData.get("visa_friendly") === "on" ? "on" : "",
    hours: text("hours"),
    description: text("description"),
  };

  const fail = (error: string) => ({ fields, values: null, error });

  if (fields.title.length < 3 || fields.title.length > JOB_MAX.title) return fail("Give the job a title of 3 to 120 characters.");
  if (fields.employer.length < 2 || fields.employer.length > JOB_MAX.employer) return fail("Enter the employer's name.");
  if (fields.suburb.length < 2 || fields.suburb.length > JOB_MAX.suburb) return fail("Enter the suburb where the job is.");
  if (!/^\d{4}$/.test(fields.postcode)) return fail("Enter the 4-digit postcode.");

  const employment = EMPLOYMENT_TYPES.find((option) => option.value === fields.employmentType);
  if (!employment) return fail("Choose casual, part-time or full-time.");

  if (fields.rateUnit !== "hour" && fields.rateUnit !== "year") return fail("Choose whether the pay is per hour or per year.");
  const hourly = fields.rateUnit === "hour";
  const min = Number(fields.rateMin);
  const minOk =
    fields.rateMin !== "" && Number.isFinite(min) && (hourly ? min >= 1 && min <= 500 : min >= 1000 && min <= 500000);
  if (!minOk) {
    return fail(hourly ? "Enter the hourly pay, between $1 and $500." : "Enter the yearly pay, between $1,000 and $500,000.");
  }
  const max = fields.rateMax === "" ? min : Number(fields.rateMax);
  if (!Number.isFinite(max) || max < min || max > 500000) {
    return fail("The highest pay must be the same as or more than the lowest.");
  }

  if (!/^[1-9]\d*$/.test(fields.hoursPerWeek) || Number(fields.hoursPerWeek) > 80) {
    return fail("Enter the hours per week, between 1 and 80.");
  }

  if (fields.shifts.some((value) => !SHIFT_WINDOWS.some((option) => option.value === value))) {
    return fail("Choose shift times from the list.");
  }

  let startDate: string | null = null;
  if (!fields.immediateStart) {
    const today = new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.startDate) || fields.startDate < today) {
      return fail("Choose a start date from today onwards, or tick Immediate start.");
    }
    startDate = fields.startDate;
  }

  if (fields.hours.length > JOB_MAX.hours) return fail("Keep the schedule note under 120 characters.");
  if (fields.description.length > JOB_MAX.description) return fail("Keep the description under 5,000 characters.");

  const values: JobValues = {
    title: fields.title,
    employer: fields.employer,
    suburb: fields.suburb,
    postcode: fields.postcode,
    pay: "",
    pay_rate_min: min,
    pay_rate_max: max,
    pay_unit: fields.rateUnit,
    super_included: fields.superIncluded === "on",
    employment_type: employment.value,
    start_date: startDate,
    immediate_start: fields.immediateStart === "on",
    shift_windows: fields.shifts,
    hours_per_week: Number(fields.hoursPerWeek),
    no_experience: fields.noExperience === "on",
    visa_friendly: fields.visaFriendly === "on",
    hours: fields.hours || null,
    description: fields.description,
  };
  // The older text column stays filled, so older screens keep working.
  values.pay = formatPay({
    pay_rate_min: values.pay_rate_min,
    pay_rate_max: values.pay_rate_max,
    pay_unit: values.pay_unit,
    super_included: values.super_included,
  });
  return { fields, values, error: null };
}

/** A saved job, as the form shows it. */
export function jobToFields(job: {
  title: string;
  employer: string;
  suburb: string;
  postcode: string | null;
  employment_type: string | null;
  pay_rate_min: number | string | null;
  pay_rate_max: number | string | null;
  pay_unit: string | null;
  super_included: boolean | null;
  start_date: string | null;
  immediate_start: boolean | null;
  shift_windows: string[] | null;
  hours_per_week: number | null;
  no_experience: boolean | null;
  visa_friendly: boolean | null;
  hours: string | null;
  description: string | null;
}): Partial<JobFields> {
  const on = (value: boolean | null | undefined) => (value ? "on" : "");
  return {
    title: job.title,
    employer: job.employer,
    suburb: job.suburb,
    postcode: job.postcode ?? "",
    employmentType: job.employment_type ?? "",
    rateMin: job.pay_rate_min === null ? "" : String(job.pay_rate_min),
    rateMax: job.pay_rate_max === null ? "" : String(job.pay_rate_max),
    rateUnit: job.pay_unit ?? "hour",
    superIncluded: on(job.super_included),
    startDate: job.start_date ?? "",
    immediateStart: on(job.immediate_start),
    shifts: job.shift_windows ?? [],
    hoursPerWeek: job.hours_per_week === null ? "" : String(job.hours_per_week),
    noExperience: on(job.no_experience),
    visaFriendly: on(job.visa_friendly),
    hours: job.hours ?? "",
    description: job.description ?? "",
  };
}
