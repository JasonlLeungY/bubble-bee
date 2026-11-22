// Reads the job filters from the address bar and resolves the searched suburb.
// Shared by the local jobs page, the Work + Stay page and the home page.

import { SUBURB_PATTERN, knownSuburb, verifyAustralianSuburb, type SuburbPoint } from "@/utils/suburb-lookup";
import type { ViewerAccess } from "@/utils/tenant-gate";
import type { ApplyMode } from "@/components/JobCard";
import type { createClient } from "@/utils/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const RADIUS_OPTIONS = [5, 10, 25, 50] as const;
export const DEFAULT_RADIUS = 10;
export const MIN_RATE_OPTIONS = [25, 28, 30, 35] as const;

export type JobFilters = {
  suburb: string;
  km: number;
  types: string[];
  minRate: number | null;
  immediate: boolean;
  shifts: string[];
};

export type JobSearch = { suburb: string; km: number; lat: number; lng: number };

const ALL_TYPES = ["casual", "part_time", "full_time"];
const ALL_SHIFTS = ["day", "evening", "weekends"];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function many(value: string | string[] | undefined) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

/** Reads the filters, ignoring anything that is not on the list. */
export function readJobFilters(params: Record<string, string | string[] | undefined>): JobFilters {
  const typed = (first(params.suburb) ?? "").trim();
  const radius = Number.parseInt(first(params.radius) ?? "", 10);
  const rate = Number.parseInt(first(params.rate) ?? "", 10);
  return {
    suburb: SUBURB_PATTERN.test(typed) ? typed : "",
    km: (RADIUS_OPTIONS as readonly number[]).includes(radius) ? radius : DEFAULT_RADIUS,
    types: many(params.type).filter((value) => ALL_TYPES.includes(value)),
    minRate: (MIN_RATE_OPTIONS as readonly number[]).includes(rate) ? rate : null,
    immediate: first(params.now) === "1",
    shifts: many(params.shift).filter((value) => ALL_SHIFTS.includes(value)),
  };
}

/** The address of the same page with some filters changed. */
export function jobHref(base: string, filters: JobFilters, extra: Record<string, string> = {}) {
  const query = new URLSearchParams();
  if (filters.suburb) {
    query.set("suburb", filters.suburb);
    query.set("radius", String(filters.km));
  }
  for (const type of filters.types) query.append("type", type);
  if (filters.minRate !== null) query.set("rate", String(filters.minRate));
  if (filters.immediate) query.set("now", "1");
  for (const shift of filters.shifts) query.append("shift", shift);
  for (const [key, value] of Object.entries(extra)) query.set(key, value);
  const text = query.toString();
  return text ? `${base}?${text}` : base;
}

/**
 * The centre of the searched suburb. Guests may search only suburbs already on
 * the map (no paid lookup); everyone else may add a new one.
 */
export async function resolveSearch(
  filters: JobFilters,
  access: ViewerAccess,
): Promise<{ search: JobSearch | null; problem: string | null }> {
  if (!filters.suburb) return { search: null, problem: null };
  try {
    const point: SuburbPoint | null =
      access === "guest" ? await knownSuburb(filters.suburb) : await verifyAustralianSuburb(filters.suburb);
    if (point) {
      return { search: { suburb: filters.suburb, km: filters.km, lat: point.latitude, lng: point.longitude }, problem: null };
    }
    return {
      search: null,
      problem:
        access === "guest"
          ? `Create an account to search for "${filters.suburb}", or pick a suburb that is already listed.`
          : `We could not find "${filters.suburb}" in Australia. Check the suburb name.`,
    };
  } catch (error) {
    console.error("Job search failed", error);
    return { search: null, problem: "We could not check that suburb just now. Try again in a moment." };
  }
}

/** What the viewer can do with a job, from their account. */
export async function applyModeFor(supabase: Supabase, access: ViewerAccess): Promise<ApplyMode> {
  if (access === "guest") return "signin";
  if (access === "profile-incomplete") return "profile";
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return "signin";
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return profile?.role === "tenant" ? "apply" : "none";
}
