// The lifestyle gate: can this tenant contact this listing?
//
// A tenant trait that is switched on needs the matching house rule to be
// switched on too. A tenant with a trait switched off fits any house.
//
// The same rule is enforced in the database by the insert policy on
// public.conversations (supabase/migrations/20261115020000_messaging.sql).
// If you change one, change the other.

export type TenantLifestyle = {
  is_smoker: boolean;
  is_shift_worker: boolean;
  tolerates_noise: boolean;
};

export type HouseRules = {
  is_smoker_allowed: boolean;
  is_shift_worker_friendly: boolean;
  tolerates_noise: boolean;
};

export const MISMATCH_ERROR =
  "Lifestyle mismatch: You do not meet the house rules for this listing.";

const PAIRS = [
  {
    trait: "is_smoker",
    rule: "is_smoker_allowed",
    reason: "You smoke, and this is a non-smoking house.",
  },
  {
    trait: "is_shift_worker",
    rule: "is_shift_worker_friendly",
    reason: "You work shifts, and this house keeps regular hours.",
  },
  {
    trait: "tolerates_noise",
    rule: "tolerates_noise",
    reason: "You make late noise, and this house prefers quiet evenings.",
  },
] as const satisfies readonly {
  trait: keyof TenantLifestyle;
  rule: keyof HouseRules;
  reason: string;
}[];

/** Every house rule this tenant breaks. An empty list means they match. */
export function lifestyleConflicts(tenant: TenantLifestyle, house: HouseRules) {
  return PAIRS.filter((pair) => tenant[pair.trait] && !house[pair.rule]);
}

export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
