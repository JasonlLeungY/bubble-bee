// Tenant intake: the answers a tenant gives when they sign up, and the checks
// the server runs on every answer. The database enforces the same choice lists
// (supabase/migrations/20261128000000_tenant_intake.sql). If you change a list
// here, change it there too.

import { GENDERS, GENDER_PREFERENCES, type Gender, type GenderPreference } from "@/utils/gender";

type Option = { value: string; label: string; hint?: string };

const EMPLOYMENT = [
  { value: "full_time", label: "Full-time employed" },
  { value: "part_time", label: "Part-time / casual employed" },
  { value: "self_employed", label: "Self-employed / freelancer" },
  { value: "student", label: "Student (working / not working)" },
  { value: "looking_for_work", label: "Actively looking for work", hint: "Shows job-matching questions below." },
] as const satisfies readonly Option[];

export const INDUSTRIES = [
  "Hospitality & Kitchen", "Retail", "Construction & Trades", "Healthcare", "Tech / IT",
  "Logistics", "Admin", "Cleaning", "Education", "Other",
] as const;

const SHIFTS = ["Weekday days", "Weekday evenings", "Weekends", "Overnight"] as const;

const WORK_RIGHTS = [
  { value: "full", label: "Full work rights" },
  { value: "student_visa", label: "Student visa (24 hours a week cap)" },
  { value: "other", label: "Other" },
] as const satisfies readonly Option[];

const INCOME = [
  { value: "payslips", label: "Payslips ready" },
  { value: "savings_guarantor", label: "Savings / guarantor" },
  { value: "government_allowance", label: "Centrelink / Youth Allowance" },
] as const satisfies readonly Option[];

const WORK_SCHEDULES = [
  { value: "day_shift", label: "Standard day shift", hint: "9 AM to 5 PM; quiet after 10 PM." },
  { value: "early_riser", label: "Early riser / early shift", hint: "Leaves before 6 AM; asleep early." },
  { value: "late_night", label: "Late night / hospitality / shift work", hint: "Returns home after 11 PM; sleeps in." },
  { value: "rotating", label: "Rotating / irregular shifts" },
] as const satisfies readonly Option[];

const WFH = [
  { value: "never", label: "Never (on-site)" },
  { value: "hybrid", label: "Hybrid (1 to 3 days a week)" },
  { value: "full_time", label: "Full-time work from home", hint: "Matters for power, internet and daytime noise." },
] as const satisfies readonly Option[];

const SMOKING = [
  { value: "non_smoker", label: "Non-smoker" },
  { value: "vapes_outside", label: "Vapes / e-cigarettes (outside only)" },
  { value: "smokes_outside", label: "Smokes cigarettes (outside only)" },
  { value: "social_only", label: "Social smoker only" },
] as const satisfies readonly Option[];

const ALCOHOL = [
  { value: "rarely", label: "Rarely / never" },
  { value: "with_dinner", label: "Occasional glass with dinner" },
  { value: "socialising", label: "Social / weekend drinks" },
] as const satisfies readonly Option[];

const GUESTS = [
  { value: "rarely", label: "Rarely have guests" },
  { value: "daytime", label: "Occasional daytime guests" },
  { value: "partner_overnight", label: "Partner stays over 1 to 2 nights a week" },
] as const satisfies readonly Option[];

const CLEANLINESS = [
  { value: "strict", label: "Clean as you go (strict)" },
  { value: "weekly", label: "Tidy (weekly deep clean)" },
  { value: "relaxed", label: "Relaxed" },
] as const satisfies readonly Option[];

const DIETARY = [
  { value: "cooks_daily", label: "Cooks daily" },
  { value: "meal_preps", label: "Meal-preps on weekends" },
  { value: "vegetarian_vegan", label: "Vegetarian / vegan" },
  { value: "halal_kosher", label: "Halal / kosher" },
  { value: "none", label: "No dietary restrictions" },
] as const satisfies readonly Option[];

const ALLERGIES = [
  { value: "cats", label: "Allergic to cats" },
  { value: "dogs", label: "Allergic to dogs" },
  { value: "none", label: "No allergies" },
] as const satisfies readonly Option[];

const STAY = [
  { value: "3_months", label: "3 months" },
  { value: "6_months", label: "6 months" },
  { value: "12_plus_months", label: "12+ months" },
  { value: "flexible", label: "Flexible" },
] as const satisfies readonly Option[];

const PARKING_NEEDED = [
  { value: "no_vehicle", label: "No vehicle" },
  { value: "street_ok", label: "Street parking is okay" },
  { value: "off_street_required", label: "Off-street / garage required" },
] as const satisfies readonly Option[];

export const TENANT_OPTIONS = {
  employment: EMPLOYMENT,
  industries: INDUSTRIES.map((value) => ({ value, label: value })),
  shifts: SHIFTS.map((value) => ({ value, label: value })),
  workRights: WORK_RIGHTS,
  income: INCOME,
  workSchedule: WORK_SCHEDULES,
  wfh: WFH,
  smoking: SMOKING,
  alcohol: ALCOHOL,
  guests: GUESTS,
  cleanliness: CLEANLINESS,
  dietary: DIETARY,
  allergies: ALLERGIES,
  stay: STAY,
  parkingNeeded: PARKING_NEEDED,
} as const;

export function labelFor(options: readonly Option[], value: string | null | undefined) {
  if (!value) return "Not stated";
  return options.find((option) => option.value === value)?.label ?? value;
}

const EMPLOYED = ["full_time", "part_time", "self_employed"];
const PHONE = /^\+?[0-9 ()-]{8,20}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SELFIE_NAME = /^[^/]+\.(jpe?g|png|webp)$/i;

export type TenantProfileValues = {
  full_name: string;
  preferred_name: string | null;
  gender: Gender;
  housemate_preference: GenderPreference;
  selfie_path: string;
  bio: string | null;
  employment_status: string;
  job_title: string | null;
  industries: string[];
  open_to_job_offers: boolean;
  target_roles: string[];
  preferred_shifts: string[];
  work_rights: string | null;
  income_verification: string | null;
  work_schedule: string;
  wfh: string;
  smoking: string;
  alcohol: string;
  guests: string;
  cleanliness: string;
  dietary: string[];
  has_pets: boolean;
  pets_details: string | null;
  allergies: string[];
  move_in_date: string;
  flexible_move_in: boolean;
  stay_length: string;
  max_weekly_budget: number;
  parking_needed: string;
};

export type TenantPrivateValues = { phone: string; date_of_birth: string };

export type TenantProfileReadResult =
  | {
      ok: true;
      profile: TenantProfileValues;
      privateDetails: TenantPrivateValues;
      /** Copied onto public.profiles, which the lifestyle gate reads. */
      lifestyle: { is_smoker: boolean; is_shift_worker: boolean; tolerates_noise: boolean };
    }
  | { ok: false; errors: string[] };

/** The form's answers, as lists of strings, so a failed save can show them again. */
export function echoFields(formData: FormData): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") (out[key] ??= []).push(value);
  }
  return out;
}

function parseDate(value: string) {
  if (!DATE.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? value
    : null;
}

function isAtLeast(years: number, dob: string, today: Date) {
  const [year, month, day] = dob.split("-").map(Number);
  const cutoff = Date.UTC(today.getUTCFullYear() - years, today.getUTCMonth(), today.getUTCDate());
  return Date.UTC(year, month - 1, day) <= cutoff;
}

/** Reads and checks every answer. Returns all the problems at once. */
export function readTenantProfile(formData: FormData, userId: string, today: Date): TenantProfileReadResult {
  const errors: string[] = [];
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const many = (key: string) =>
    formData.getAll(key).filter((value): value is string => typeof value === "string");
  const choose = <T extends readonly Option[]>(options: T, value: string) =>
    options.some((option) => option.value === value) ? value : null;
  /** Every value must be on the list; returns null if one is not. */
  const chooseAll = (values: string[], options: readonly Option[]) =>
    values.every((value) => options.some((option) => option.value === value)) ? values : null;
  const need = (ok: boolean, label: string) => {
    if (!ok) errors.push(label);
    return ok;
  };

  // 1. Basic identity and verification
  const fullName = text("full_name");
  need(fullName.length >= 2 && fullName.length <= 120, "Full legal name");
  const preferredName = text("preferred_name");
  need(preferredName.length <= 40, "Preferred name (40 characters or fewer)");
  const gender = GENDERS.find((option) => option.value === text("gender"))?.value;
  need(gender !== undefined, "Gender");
  const housemate = GENDER_PREFERENCES.find((option) => option.value === text("housemate_preference"))?.value;
  need(housemate !== undefined, "Housemate preference");
  const phone = text("phone");
  need(PHONE.test(phone), "Phone number");
  const dob = parseDate(text("date_of_birth"));
  need(dob !== null && isAtLeast(18, dob, today), "Date of birth (you must be 18 or over)");
  const selfie = text("selfie_path");
  const selfieOk =
    selfie.startsWith(`${userId}/`) &&
    selfie.length <= 200 &&
    !selfie.includes("..") &&
    SELFIE_NAME.test(selfie.slice(userId.length + 1));
  need(selfieOk, "Profile selfie");
  const bio = text("bio");
  need(bio.length <= 300, "Short bio (300 characters or fewer)");

  // 2. Employment and job matching
  const employment = choose(EMPLOYMENT, text("employment_status"));
  need(employment !== null, "Current employment status");
  const jobTitle = text("job_title");
  if (employment && EMPLOYED.includes(employment)) {
    need(jobTitle.length >= 2 && jobTitle.length <= 80, "Current job title");
  }
  const industries = chooseAll(many("industries"), TENANT_OPTIONS.industries);
  need(industries !== null && industries.length >= 1 && industries.length <= 10, "Industry (at least one)");
  const openAnswer = text("open_to_job_offers");
  need(openAnswer === "yes" || openAnswer === "no", "Whether you are open to job offers");
  const openToJobs = openAnswer === "yes";
  const targetRoles = text("target_roles")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
  const shifts = chooseAll(many("preferred_shifts"), TENANT_OPTIONS.shifts);
  const workRights = choose(WORK_RIGHTS, text("work_rights"));
  if (openToJobs) {
    need(targetRoles.length >= 1 && targetRoles.length <= 10 && targetRoles.every((role) => role.length <= 40), "Target roles (up to 10, at least one)");
    need(shifts !== null && shifts.length >= 1, "Preferred days or shifts");
    need(workRights !== null, "Work availability and work rights");
  }
  const income = choose(INCOME, text("income_verification"));

  // 3. Household lifestyle
  const workSchedule = choose(WORK_SCHEDULES, text("work_schedule"));
  need(workSchedule !== null, "Work and sleep schedule");
  const wfh = choose(WFH, text("wfh"));
  need(wfh !== null, "Work from home frequency");
  const smoking = choose(SMOKING, text("smoking"));
  need(smoking !== null, "Smoking and vaping habits");
  const alcohol = choose(ALCOHOL, text("alcohol"));
  need(alcohol !== null, "Alcohol and socialising at home");
  const guests = choose(GUESTS, text("guests"));
  need(guests !== null, "Guests and overnight visitors");
  const cleanliness = choose(CLEANLINESS, text("cleanliness"));
  need(cleanliness !== null, "Cleanliness and chore style");
  const dietary = chooseAll(many("dietary"), DIETARY);
  need(dietary !== null, "Dietary notes");
  const hasPetsAnswer = text("has_pets");
  need(hasPetsAnswer === "yes" || hasPetsAnswer === "no", "Whether you have pets");
  const hasPets = hasPetsAnswer === "yes";
  const petsDetails = text("pets_details");
  if (hasPets) {
    need(petsDetails.length >= 2 && petsDetails.length <= 120, "Your pets (type and size)");
  }
  const allergies = chooseAll(many("allergies"), ALLERGIES);
  need(allergies !== null && allergies.length >= 1, "Pets and allergies (tick at least one, or no allergies)");
  const toleratesNoise = formData.get("tolerates_noise") === "on";

  // 4. Rental preferences
  const moveIn = text("move_in_date");
  const today10 = today.toISOString().slice(0, 10);
  need(DATE.test(moveIn) && parseDate(moveIn) !== null && moveIn >= today10, "Target move-in date (today or later)");
  const flexible = formData.get("flexible_move_in") === "on";
  const stay = choose(STAY, text("stay_length"));
  need(stay !== null, "Intended length of stay");
  const budget = Number(text("max_weekly_budget"));
  need(
    /^\d+(\.\d{1,2})?$/.test(text("max_weekly_budget")) && budget > 0 && budget <= 10000,
    "Maximum weekly budget (AUD, between 1 and 10,000)",
  );
  const parkingNeeded = choose(PARKING_NEEDED, text("parking_needed"));
  need(parkingNeeded !== null, "Parking needed");

  if (errors.length > 0 || !gender || !housemate || !dob || !employment || !industries || !allergies) {
    return { ok: false, errors: errors.length > 0 ? errors : ["Check your answers and try again."] };
  }

  const isSmoker = smoking !== "non_smoker";
  const isShiftWorker = workSchedule === "late_night" || workSchedule === "rotating";

  return {
    ok: true,
    profile: {
      full_name: fullName,
      preferred_name: preferredName || null,
      gender,
      housemate_preference: housemate,
      selfie_path: selfie,
      bio: bio || null,
      employment_status: employment,
      job_title: jobTitle || null,
      industries,
      open_to_job_offers: openToJobs,
      target_roles: openToJobs ? targetRoles : [],
      preferred_shifts: openToJobs && shifts ? shifts : [],
      work_rights: openToJobs ? workRights : null,
      income_verification: income,
      work_schedule: workSchedule ?? "day_shift",
      wfh: wfh ?? "never",
      smoking: smoking ?? "non_smoker",
      alcohol: alcohol ?? "rarely",
      guests: guests ?? "rarely",
      cleanliness: cleanliness ?? "relaxed",
      dietary: dietary ?? [],
      has_pets: hasPets,
      pets_details: hasPets ? petsDetails : null,
      allergies,
      move_in_date: moveIn,
      flexible_move_in: flexible,
      stay_length: stay ?? "flexible",
      max_weekly_budget: budget,
      parking_needed: parkingNeeded ?? "no_vehicle",
    },
    privateDetails: { phone, date_of_birth: dob },
    lifestyle: { is_smoker: isSmoker, is_shift_worker: isShiftWorker, tolerates_noise: toleratesNoise },
  };
}
