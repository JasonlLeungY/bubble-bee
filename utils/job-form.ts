// Validation for job posts, shared by creating and editing them. The server
// actions call this and trust nothing from the form. Row Level Security also
// checks that only the poster can write a job.

export const JOB_MAX = { title: 120, employer: 80, suburb: 80, pay: 80, hours: 120, description: 5000 };

export type JobFields = {
  title: string;
  employer: string;
  suburb: string;
  pay: string;
  hours: string;
  description: string;
};

export function readJobForm(formData: FormData): { fields: JobFields; error: string | null } {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const fields: JobFields = {
    title: text("title"),
    employer: text("employer"),
    suburb: text("suburb"),
    pay: text("pay"),
    hours: text("hours"),
    description: text("description"),
  };
  const checks: [boolean, string][] = [
    [fields.title.length >= 3 && fields.title.length <= JOB_MAX.title, "Give the job a title of 3 to 120 characters."],
    [fields.employer.length >= 2 && fields.employer.length <= JOB_MAX.employer, "Enter the employer's name."],
    [fields.suburb.length >= 2 && fields.suburb.length <= JOB_MAX.suburb, "Enter the suburb where the job is."],
    [fields.pay.length >= 2 && fields.pay.length <= JOB_MAX.pay, "Enter the pay, for example $28 to $32 an hour."],
    [fields.hours.length <= JOB_MAX.hours, "Keep the hours under 120 characters."],
    [fields.description.length <= JOB_MAX.description, "Keep the description under 5,000 characters."],
  ];
  const failed = checks.find(([ok]) => !ok);
  return { fields, error: failed ? failed[1] : null };
}
