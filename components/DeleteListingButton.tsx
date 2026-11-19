"use client";

import { useActionState, useId, useRef } from "react";
import { deleteListing, type ListingState } from "@/app/dashboard/actions";

/**
 * Delete button with a confirmation step. The first click only opens the
 * confirmation, which says what will be removed. Nothing is deleted until
 * "Yes, delete listing" is pressed.
 */
export default function DeleteListingButton({
  listingId,
  title,
  className = "",
}: {
  listingId: string;
  title: string;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [state, formAction, deleting] = useActionState<ListingState>(
    () => deleteListing(listingId),
    {},
  );

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={`cursor-pointer rounded-lg border border-rose-300 px-3.5 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 ${className}`}
      >
        Delete
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={headingId}
        onClick={(event) => {
          // A click on the dimmed backdrop lands on the dialog itself.
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
        className="m-auto w-[min(92vw,28rem)] overflow-hidden rounded-2xl bg-white p-0 text-neutral-900 shadow-2xl backdrop:bg-neutral-900/50 open:flex open:flex-col"
      >
        <div className="p-6">
          <h2 id={headingId} className="text-lg font-semibold">
            Delete this listing?
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            &ldquo;{title}&rdquo; and its photos will be removed. Its enquiries and
            messages are deleted too. This cannot be undone.
          </p>

          {state.error && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"
            >
              {state.error}
            </p>
          )}

          <form action={formAction} className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              autoFocus
              className="cursor-pointer rounded-lg border border-neutral-300 px-4 py-3 text-base font-semibold transition hover:border-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              Keep listing
            </button>
            <button
              type="submit"
              disabled={deleting}
              className="cursor-pointer rounded-lg bg-rose-700 px-4 py-3 text-base font-semibold text-white transition hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Yes, delete listing"}
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
