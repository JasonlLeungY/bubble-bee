// The three behavioural rules a landlord sets on a listing, with the wording
// and icon used on listing cards and on the listing detail page.

export type LifestyleFlags = {
  is_smoker_allowed: boolean;
  is_shift_worker_friendly: boolean;
  tolerates_noise: boolean;
};

export const LIFESTYLE_RULES = [
  {
    key: "is_smoker_allowed",
    badge: "Smoker friendly",
    title: "Smoking",
    yes: { label: "Allowed", text: "Housemates who smoke are welcome here." },
    no: { label: "Not allowed", text: "This is a non-smoking house." },
    // Cigarette
    icon: "M17 12H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h14M18 8c0-2.5-2-2.5-2-5M21 16a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1M22 8c0-2.5-2-2.5-2-5M7 12v4",
  },
  {
    key: "is_shift_worker_friendly",
    badge: "Shift-worker",
    title: "Shift workers",
    yes: {
      label: "Welcome",
      text: "Comings and goings at odd hours are fine with the house.",
    },
    no: {
      label: "Not ideal",
      text: "The house keeps regular hours, so it may not suit shift work.",
    },
    // Moon
    icon: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z",
  },
  {
    key: "tolerates_noise",
    badge: "Late noise OK",
    title: "Late noise",
    yes: {
      label: "Tolerated",
      text: "Music or guests in the evening are okay.",
    },
    no: { label: "Quiet house", text: "The house prefers quiet evenings." },
    // Speaker
    icon: "M11 5 6 9H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3l5 4zM15.5 9a4.5 4.5 0 0 1 0 6M18.5 6a9 9 0 0 1 0 12",
  },
] as const satisfies readonly {
  key: keyof LifestyleFlags;
  badge: string;
  title: string;
  yes: { label: string; text: string };
  no: { label: string; text: string };
  icon: string;
}[];

export function LifestyleIcon({
  path,
  className = "h-4 w-4",
}: {
  path: string;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`shrink-0 fill-none stroke-current stroke-[1.75] ${className}`}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

/** Compact pills for a listing card: only the rules that are switched on. */
export function LifestyleBadges({ listing }: { listing: LifestyleFlags }) {
  const active = LIFESTYLE_RULES.filter((rule) => listing[rule.key]);
  if (active.length === 0) return null;

  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {active.map((rule) => (
        <li
          key={rule.key}
          className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-xs text-neutral-700"
        >
          <LifestyleIcon path={rule.icon} className="h-3.5 w-3.5" />
          {rule.badge}
        </li>
      ))}
    </ul>
  );
}
