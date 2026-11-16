"use client";

import Link from "next/link";
import { useActionState } from "react";
import { initiateContact, type ContactState } from "./actions";

/** Worked out on the server for whoever is viewing the listing. */
export type ContactStatus =
  | { kind: "guest"; loginHref: string }
  | { kind: "can-contact"; listingId: string }
  | { kind: "existing"; href: string }
  | { kind: "mismatch" }
  | { kind: "own-listing" }
  | { kind: "landlord" };

const baseClass =
  "block rounded-lg px-6 py-3.5 text-center text-base font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";
const primaryClass = `${baseClass} cursor-pointer bg-rose-600 text-white hover:bg-rose-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60`;
const disabledClass = `${baseClass} cursor-not-allowed bg-neutral-200 text-neutral-500`;

const DISABLED_LABELS = {
  mismatch: "Not a Lifestyle Match",
  "own-listing": "This is your listing",
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
  if (status.kind === "existing") {
    return (
      <Link href={status.href} className={`${primaryClass} ${width}`}>
        Open conversation
      </Link>
    );
  }
  if (status.kind === "can-contact") {
    return <ContactForm listingId={status.listingId} width={width} />;
  }
  return (
    <button type="button" disabled className={`${disabledClass} ${width}`}>
      {DISABLED_LABELS[status.kind]}
    </button>
  );
}

function ContactForm({ listingId, width }: { listingId: string; width: string }) {
  // The listing id is fixed here on purpose: it never comes from form input.
  const [state, formAction, pending] = useActionState<ContactState>(
    () => initiateContact(listingId),
    {},
  );

  return (
    <form action={formAction} className={width}>
      {state.error && (
        <p
          role="alert"
          className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${primaryClass} ${width}`}>
        {pending ? "Opening…" : "Contact Landlord"}
      </button>
    </form>
  );
}
