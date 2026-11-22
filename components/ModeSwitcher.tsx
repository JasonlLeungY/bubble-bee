import Link from "next/link";

const MODES = [
  { key: "rooms", label: "Rooms & Houses", href: "/" },
  { key: "jobs", label: "Local Jobs", href: "/jobs" },
  { key: "bundle", label: "Work + Stay", href: "/work-and-stay" },
] as const;

/** Segmented switch between the three parts of the site. */
export default function ModeSwitcher({ active }: { active: (typeof MODES)[number]["key"] }) {
  return (
    <nav aria-label="Browse by" className="inline-flex w-full flex-wrap gap-1 rounded-2xl bg-neutral-100 p-1 sm:w-auto">
      {MODES.map((mode) => {
        const isActive = mode.key === active;
        return (
          <Link
            key={mode.key}
            href={mode.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 sm:flex-none ${
              isActive ? "bg-neutral-900 text-white shadow-sm" : "text-neutral-700 hover:bg-white"
            }`}
          >
            {mode.label}
          </Link>
        );
      })}
    </nav>
  );
}
