// Job filters from the address bar, the searched suburb, and the job query.
// Shared by the home page, the local jobs page and the Work + Stay page.

import { SUBURB_PATTERN, knownSuburb, verifyAustralianSuburb, type SuburbPoint } from "@/utils/suburb-lookup";
import type { ViewerAccess } from "@/utils/tenant-gate";
import type { ApplyMode, JobCardData } from "@/components/JobCard";
import type { createClient } from "@/utils/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const RADIUS_OPTIONS = [5, 10, 25, 50] as const;
const DEFAULT_RADIUS = 10;
export const MIN_RATE_OPTIONS = [25, 28, 30, 35] as const;
/** Pages beyond this are treated as the last one, which keeps the database offset in range. */
const MAX_PAGE = 1000;

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

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function many(value: string | string[] | undefined) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

/** Reads the filters, ignoring anything that is not on the list. */
export function readJobFilters(params: Params): JobFilters {
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

/** The page number from the address bar: 1 or more, and at most MAX_PAGE. */
export function readPage(params: Params): number {
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  return Number.isFinite(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1;
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

type JobQuery = {
  search: JobSearch | null;
  types?: string[];
  minRate?: number | null;
  immediate?: boolean;
  shifts?: string[];
  /** Only jobs whose employer also has a room nearby (Work + Stay). */
  bundle?: boolean;
  offset?: number;
  limit: number;
};

/**
 * Runs the job search and marks which jobs the signed-in tenant has applied to.
 * Returns null if the search fails. Guests and employers get nothing marked:
 * Row Level Security returns only a tenant's own applications.
 */
export async function loadJobs(supabase: Supabase, applyMode: ApplyMode, query: JobQuery): Promise<JobCardData[] | null> {
  const { data, error } = await supabase.rpc("find_jobs", {
    p_lat: query.search?.lat ?? null,
    p_lng: query.search?.lng ?? null,
    p_km: query.search?.km ?? null,
    p_types: query.types?.length ? query.types : null,
    p_min_rate: query.minRate ?? null,
    p_immediate: query.immediate ?? false,
    p_shifts: query.shifts?.length ? query.shifts : null,
    p_bundle: query.bundle ?? false,
    p_offset: query.offset ?? 0,
    p_limit: query.limit,
  });
  if (error || !data) return null;

  const jobs = data as JobCardData[];
  if (applyMode !== "apply" || jobs.length === 0) return jobs;
  const { data: applications } = await supabase
    .from("job_applications")
    .select("job_id")
    .in("job_id", jobs.map((job) => job.id));
  const applied = new Set((applications ?? []).map((row: { job_id: string }) => row.job_id));
  return jobs.map((job) => ({ ...job, applied: applied.has(job.id) }));
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
