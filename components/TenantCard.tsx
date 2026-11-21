import type { ReactNode } from "react";
import { GENDERS, GENDER_PREFERENCES, genderPreferenceLabel } from "@/utils/gender";
import { TENANT_OPTIONS, labelFor } from "@/utils/tenant-profile";

/** The tenant intake as a landlord may read it. Phone and date of birth are never selected. */
export type TenantCardProfile = {
  full_name: string | null;
  preferred_name: string | null;
  gender: string | null;
  housemate_preference: string | null;
  selfie_path: string | null;
  bio: string | null;
  about: string | null;
  employment_status: string | null;
  job_title: string | null;
  industries: string[] | null;
  open_to_job_offers: boolean | null;
  target_roles: string[] | null;
  preferred_shifts: string[] | null;
  work_rights: string | null;
  income_verification: string | null;
  work_schedule: string | null;
  wfh: string | null;
  smoking: string | null;
  alcohol: string | null;
  guests: string | null;
  cleanliness: string | null;
  dietary: string[] | null;
  has_pets: boolean | null;
  pets_details: string | null;
  allergies: string[] | null;
  move_in_date: string | null;
  flexible_move_in: boolean | null;
  stay_length: string | null;
  max_weekly_budget: number | string | null;
  parking_needed: string | null;
};

/** Columns the landlord's tenant card reads. Phone and date_of_birth are left out on purpose. */
export const TENANT_CARD_COLUMNS =
  "full_name, preferred_name, gender, housemate_preference, selfie_path, bio, about, employment_status, job_title, industries, open_to_job_offers, target_roles, preferred_shifts, work_rights, income_verification, work_schedule, wfh, smoking, alcohol, guests, cleanliness, dietary, has_pets, pets_details, allergies, move_in_date, flexible_move_in, stay_length, max_weekly_budget, parking_needed";

const dateFormat = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "UTC" });

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 py-1.5 text-sm">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="min-w-0 font-medium break-words">{children}</dd>
    </div>
  );
}

function listOrNone(values: string[] | null | undefined, options: readonly { value: string; label: string }[]) {
  if (!values || values.length === 0) return "None given";
  return values.map((value) => labelFor(options, value)).join(", ");
}

export default function TenantCard({
  profile,
  selfieUrl,
  fallbackName,
}: {
  profile: TenantCardProfile;
  selfieUrl: string | null;
  fallbackName: string;
}) {
  const displayName = profile.preferred_name?.trim() || profile.full_name?.trim() || fallbackName;
  const employed =
    profile.employment_status === "full_time" ||
    profile.employment_status === "part_time" ||
    profile.employment_status === "self_employed";
  const budget =
    profile.max_weekly_budget === null || profile.max_weekly_budget === undefined
      ? "Not stated"
      : `$${Number(profile.max_weekly_budget).toFixed(2)} a week`;

  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer font-semibold underline underline-offset-2">
        Tenant profile: {displayName}
      </summary>
      <div className="mt-3 max-h-[60vh] space-y-4 overflow-y-auto rounded-xl border border-neutral-200 p-4">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-neutral-100">
            {selfieUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selfieUrl} alt={`${displayName}'s selfie`} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold">{displayName}</p>
            {profile.full_name && profile.preferred_name && profile.full_name !== profile.preferred_name && (
              <p className="text-neutral-600">Full legal name: {profile.full_name}</p>
            )}
            <p className="text-neutral-600">
              {labelFor(GENDERS, profile.gender)} · Housemates: {labelFor(GENDER_PREFERENCES, profile.housemate_preference)}
            </p>
            <p className="text-xs text-neutral-500">Confirmed 18 or over.</p>
          </div>
        </div>

        {profile.bio && <p className="whitespace-pre-line text-neutral-700">{profile.bio}</p>}

        <p className="mt-4 mb-1 font-semibold">Work</p>
        <dl>
          <Row label="Employment">{labelFor(TENANT_OPTIONS.employment, profile.employment_status)}</Row>
          {employed && <Row label="Job">{profile.job_title || "Not stated"}</Row>}
          <Row label="Industry">{listOrNone(profile.industries, TENANT_OPTIONS.industries)}</Row>
          <Row label="Open to job offers">{profile.open_to_job_offers ? "Yes" : "No"}</Row>
          {profile.open_to_job_offers && (
            <>
              <Row label="Target roles">{profile.target_roles?.length ? profile.target_roles.join(", ") : "None given"}</Row>
              <Row label="Preferred shifts">{listOrNone(profile.preferred_shifts, TENANT_OPTIONS.shifts)}</Row>
              <Row label="Work rights">{labelFor(TENANT_OPTIONS.workRights, profile.work_rights)}</Row>
            </>
          )}
          <Row label="Income">{labelFor(TENANT_OPTIONS.income, profile.income_verification)}</Row>
        </dl>

        <p className="mt-4 mb-1 font-semibold">Household</p>
        <dl>
          <Row label="Schedule">{labelFor(TENANT_OPTIONS.workSchedule, profile.work_schedule)}</Row>
          <Row label="Work from home">{labelFor(TENANT_OPTIONS.wfh, profile.wfh)}</Row>
          <Row label="Smoking">{labelFor(TENANT_OPTIONS.smoking, profile.smoking)}</Row>
          <Row label="Alcohol">{labelFor(TENANT_OPTIONS.alcohol, profile.alcohol)}</Row>
          <Row label="Guests">{labelFor(TENANT_OPTIONS.guests, profile.guests)}</Row>
          <Row label="Cleanliness">{labelFor(TENANT_OPTIONS.cleanliness, profile.cleanliness)}</Row>
          <Row label="Dietary">{listOrNone(profile.dietary, TENANT_OPTIONS.dietary)}</Row>
          <Row label="Pets">{profile.has_pets ? profile.pets_details || "Has pets" : "No pets"}</Row>
          <Row label="Allergies">{listOrNone(profile.allergies, TENANT_OPTIONS.allergies)}</Row>
        </dl>

        <p className="mt-4 mb-1 font-semibold">Rent</p>
        <dl>
          <Row label="Move in">
            {profile.move_in_date ? dateFormat.format(new Date(`${profile.move_in_date}T00:00:00Z`)) : "Not stated"}
            {profile.flexible_move_in ? " (flexible)" : ""}
          </Row>
          <Row label="Stay">{labelFor(TENANT_OPTIONS.stay, profile.stay_length)}</Row>
          <Row label="Budget">{budget}</Row>
          <Row label="Parking">{labelFor(TENANT_OPTIONS.parkingNeeded, profile.parking_needed)}</Row>
        </dl>

        {profile.about && (
          <div>
            <p className="mb-1 font-semibold">About {displayName}</p>
            <p className="max-h-60 overflow-y-auto break-words whitespace-pre-line text-neutral-700">{profile.about}</p>
          </div>
        )}
        <p className="text-xs text-neutral-500">
          Not shown here: phone number and date of birth. Housemate preference: {genderPreferenceLabel(profile.housemate_preference ?? "")}.
        </p>
      </div>
    </details>
  );
}
