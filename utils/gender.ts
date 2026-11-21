// Gender preferences, shared by listings (who the house is for) and tenants
// (who they are happy to live with). The database enforces the same values:
// listings.gender_preference and tenant_profiles.housemate_preference.

export const GENDER_PREFERENCES = [
  { value: "female_only", label: "Female only" },
  { value: "male_only", label: "Male only" },
  { value: "no_preference", label: "No preference" },
] as const;

export type GenderPreference = (typeof GENDER_PREFERENCES)[number]["value"];

export const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other / prefer not to say" },
] as const;

export type Gender = (typeof GENDERS)[number]["value"];

/** Can a tenant of this gender live in a house with this preference? */
export function genderFits(preference: string, gender: string | null | undefined) {
  if (preference === "no_preference") return true;
  if (preference === "female_only") return gender === "female";
  if (preference === "male_only") return gender === "male";
  return false;
}

export function genderPreferenceLabel(preference: string) {
  return GENDER_PREFERENCES.find((option) => option.value === preference)?.label ?? "Not stated";
}
