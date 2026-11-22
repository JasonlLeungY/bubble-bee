import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import JobBoard from "@/components/JobBoard";
import JobFilterBar from "@/components/JobFilterBar";
import ModeSwitcher from "@/components/ModeSwitcher";
import SiteHeader from "@/components/SiteHeader";
import type { JobCardData } from "@/components/JobCard";
import { readJobFilters } from "@/utils/job-search";

// A design preview with sample data. It is not linked from the site, and search
// engines are asked not to index it. The real pages use the live database.
export const metadata: Metadata = {
  title: "Design preview",
  robots: { index: false, follow: false },
};

const base = {
  postcode: null,
  description: null,
  distance_km: null,
  room_id: null,
  room_title: null,
  room_price: null,
  room_km: null,
} as const;

// Realistic Adelaide sample jobs. Descriptions are shown here so the panel reads
// as it would for a signed-in tenant.
const SAMPLE_JOBS: JobCardData[] = [
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000001",
    title: "Barista",
    employer: "Corner Roast Café",
    suburb: "Woodville",
    postcode: "5011",
    pay: "$28–$32/hr + Super",
    pay_rate_min: 28,
    pay_rate_max: 32,
    pay_unit: "hour",
    super_included: true,
    employment_type: "casual",
    immediate_start: true,
    start_date: null,
    shift_windows: ["day", "weekends"],
    hours_per_week: 16,
    no_experience: true,
    visa_friendly: true,
    hours: "Weekend mornings",
    distance_km: 2.1,
    description: "Make coffee and serve regulars at a busy neighbourhood café. We train you on the machine and the till. Friendly team, free staff meal on shift.",
    room_id: "00000000-0000-4000-8000-0000000000a1",
    room_title: "Furnished room near Woodville Road",
    room_price: 260,
    room_km: 1.4,
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000002",
    title: "Warehouse picker",
    employer: "Northern Logistics Co",
    suburb: "Regency Park",
    postcode: "5010",
    pay: "$30–$34/hr + Super",
    pay_rate_min: 30,
    pay_rate_max: 34,
    pay_unit: "hour",
    super_included: true,
    employment_type: "full_time",
    immediate_start: false,
    start_date: "2027-03-03",
    shift_windows: ["evening"],
    hours_per_week: 38,
    no_experience: false,
    visa_friendly: false,
    hours: "Monday to Friday, 2 pm to 10:30 pm",
    distance_km: 6.8,
    description: "Pick and pack orders for next-day delivery. Forklift licence is a plus but not required. Overtime available during peak weeks.",
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000003",
    title: "Front of house",
    employer: "The Lantern Bistro",
    suburb: "North Adelaide",
    postcode: "5006",
    pay: "$29/hr + Super",
    pay_rate_min: 29,
    pay_rate_max: 29,
    pay_unit: "hour",
    super_included: true,
    employment_type: "part_time",
    immediate_start: true,
    start_date: null,
    shift_windows: ["evening", "weekends"],
    hours_per_week: 20,
    no_experience: true,
    visa_friendly: true,
    hours: null,
    distance_km: 3.4,
    description: "Greet guests, take bookings and run the floor on dinner services. Training provided. Great for students studying nearby.",
    room_id: "00000000-0000-4000-8000-0000000000a2",
    room_title: "Share house room, Kent Town",
    room_price: 230,
    room_km: 2.2,
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000004",
    title: "Kitchen hand",
    employer: "Harbour Street Kitchen",
    suburb: "Adelaide",
    postcode: "5000",
    pay: "$27/hr",
    pay_rate_min: 27,
    pay_rate_max: 27,
    pay_unit: "hour",
    super_included: false,
    employment_type: "casual",
    immediate_start: true,
    start_date: null,
    shift_windows: ["day", "evening"],
    hours_per_week: 12,
    no_experience: true,
    visa_friendly: true,
    hours: "Lunch and dinner shifts",
    distance_km: 0.9,
    description: "Wash up, prep vegetables and keep the kitchen clean during service. Flexible shifts that suit students.",
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000005",
    title: "Delivery driver",
    employer: "Glenelg Fresh Meals",
    suburb: "Glenelg",
    postcode: "5045",
    pay: "$32/hr + Super",
    pay_rate_min: 32,
    pay_rate_max: 32,
    pay_unit: "hour",
    super_included: true,
    employment_type: "part_time",
    immediate_start: false,
    start_date: "2027-02-24",
    shift_windows: ["evening", "weekends"],
    hours_per_week: 24,
    no_experience: false,
    visa_friendly: false,
    hours: "Evenings, Friday to Sunday",
    distance_km: 11.2,
    description: "Deliver fresh meal boxes around the western suburbs. You need a clean driver's licence and your own car.",
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000006",
    title: "Office assistant",
    employer: "Norwood Accounting Group",
    suburb: "Norwood",
    postcode: "5067",
    pay: "$62,000–$68,000/yr + Super",
    pay_rate_min: 62000,
    pay_rate_max: 68000,
    pay_unit: "year",
    super_included: true,
    employment_type: "full_time",
    immediate_start: false,
    start_date: "2027-03-17",
    shift_windows: ["day"],
    hours_per_week: 38,
    no_experience: false,
    visa_friendly: false,
    hours: "Monday to Friday, 9 am to 5 pm",
    distance_km: 4.6,
    description: "Answer phones, process invoices and keep the client files in order. Strong Excel skills and a tidy desk are essential.",
  },
];

export default function PreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-white font-sans text-neutral-900">
      <SiteHeader />
      <Suspense fallback={<p className="px-4 py-8 text-sm text-neutral-500">Loading…</p>}>
        <PreviewBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// Reads the address, so it is rendered at request time.
async function PreviewBody({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const filters = readJobFilters(await searchParams);
  return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Design preview · sample data</p>
        <h1 className="mt-1 text-[26px] leading-8 font-semibold tracking-tight">Local jobs</h1>
        <p className="mt-1 text-sm text-neutral-500">Newest first. Pick a suburb, job type or shift to narrow the list.</p>
        <div className="mt-6">
          <ModeSwitcher active="jobs" />
        </div>
        <div className="mt-6">
          <JobFilterBar base="/preview" filters={filters} suburbs={["Woodville", "Regency Park", "North Adelaide", "Adelaide", "Glenelg", "Norwood"]} />
        </div>
        <p className="mt-8 text-sm text-neutral-600">{SAMPLE_JOBS.length} jobs, sample data.</p>
        <div className="mt-4">
          <JobBoard jobs={SAMPLE_JOBS} mode="preview" />
        </div>
      </main>
  );
}
