"use client";

import dynamic from "next/dynamic";
import { useId, useRef, useState } from "react";

// Loaded only in the browser, and only once the map is opened.
const SuburbMap = dynamic(() => import("./SuburbMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-neutral-100" />,
});

type Props = {
  suburb: string;
  latitude: number | null;
  longitude: number | null;
  className?: string;
};

/**
 * "Room in <suburb>" that opens an approximate map of the suburb. Uses the
 * native <dialog>, so Esc, focus handling and the backdrop come from the browser.
 */
export default function SuburbMapButton({
  suburb,
  latitude,
  longitude,
  className = "",
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [showMap, setShowMap] = useState(false);

  // Not mapped yet: plain text, no button.
  if (latitude === null || longitude === null) {
    return <span className={className}>Room in {suburb}</span>;
  }

  function open() {
    setShowMap(true);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className={`group cursor-pointer rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${className}`}
      >
        <span className="underline-offset-4 group-hover:underline">
          Room in {suburb}
        </span>
        <span className="ml-1.5 text-xs text-neutral-400 group-hover:text-neutral-900">
          View on map
        </span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => setShowMap(false)}
        onClick={(event) => {
          // A click on the dimmed backdrop lands on the dialog itself.
          if (event.target === event.currentTarget) close();
        }}
        className="m-auto w-[min(92vw,40rem)] overflow-hidden rounded-2xl bg-white p-0 text-neutral-900 shadow-2xl backdrop:bg-neutral-900/50 open:flex open:flex-col"
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              Room in {suburb}
            </h2>
            <p className="text-sm text-neutral-500">Approximate area</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close map"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-700 transition hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5 fill-none stroke-current stroke-2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="relative h-[360px] bg-neutral-100 sm:h-[440px]">
          {showMap && (
            <SuburbMap latitude={latitude} longitude={longitude} />
          )}
        </div>

        <p className="px-5 py-3 text-sm text-neutral-600">
          Approximate location: the shaded circle covers the general area of
          the suburb. The exact address is shared once you message the
          landlord.
        </p>
      </dialog>
    </div>
  );
}
