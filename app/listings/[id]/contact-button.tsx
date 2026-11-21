"use client";

import Link from "next/link";
import DeleteListingButton from "@/components/DeleteListingButton";

/** Worked out on the server for whoever is viewing the listing. */
export type ContactStatus =
  | { kind: "guest"; loginHref: string }
  | { kind: "can-contact"; listingId: string }
  | { kind: "existing"; href: string }
  | { kind: "mismatch" }
  | { kind: "gender" }
  | { kind: "incomplete" }
  | { kind: "owner"; listingId: string; title: string }
  | { kind: "admin"; listingId: string }
  | { kind: "landlord" };

const baseClass =
  "hive block rounded-lg px-6 py-3.5 text-center text-base font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";
const primaryClass = `${baseClass} cursor-pointer bg-rose-600 text-white hover:bg-rose-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60`;
const disabledClass = `${baseClass} cursor-not-allowed bg-neutral-200 text-neutral-500`;

const DISABLED_LABELS = {
  mismatch: "Not a Lifestyle Match",
  gender: "Not open to your gender",
  landlord: "Tenant accounts only",
} as const;

export default function ContactButton({
  status,
  fullWidth = false,
}: {
  status: ContactStatus;
  fullWidth?: boolean;
}) {
  const width = fullWidth ? "w-full" : "";

  if (status.kind === "guest") {
    return (
      <Link href={status.loginHref} className={`${primaryClass} ${width}`}>
        Log in to Contact
      </Link>
    );
  }
  // Only ever sent to the listing's own landlord (see the listing page).
  if (status.kind === "admin") {
    return (
      <Link href={`/listings/${status.listingId}/edit`} className={`${primaryClass} ${width}`}>
        Edit listing
      </Link>
    );
  }
  if (status.kind === "owner") {
    return (
      <div className={`flex gap-2 ${width}`}>
        <Link href={`/listings/${status.listingId}/edit`} className={`${primaryClass} flex-1`}>
          Edit listing
        </Link>
        <DeleteListingButton listingId={status.listingId} title={status.title} className="px-5 py-3.5 text-base" />
      </div>
    );
  }
  if (status.kind === "existing") {
    return (
      <Link href={status.href} className={`${primaryClass} ${width}`}>
        Open conversation
      </Link>
    );
  }
  if (status.kind === "incomplete") {
    return (
      <Link href="/dashboard/profile" className={`${primaryClass} ${width}`}>
        Complete your profile to contact
      </Link>
    );
  }
  if (status.kind === "can-contact") {
    return (
      <Link href="#message-landlord" className={`${primaryClass} ${width}`}>
        Message landlord
      </Link>
    );
  }
  return (
    <button type="button" disabled className={`${disabledClass} ${width}`}>
      {DISABLED_LABELS[status.kind]}
    </button>
  );
}

