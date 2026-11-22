"use client";

import Image from "next/image";
import { useRef } from "react";

/**
 * A listing's photos. Shows `shown` in the page, and opens every photo in a
 * window when a photo or "More photos" is chosen.
 */
export default function PhotoGallery({
  shown,
  all,
  title,
}: {
  shown: string[];
  all: string[];
  title: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const hidden = all.length - shown.length;
  const single = shown.length === 1;
  const open = () => dialogRef.current?.showModal();

  return (
    <>
      {/* Phones: swipe through the photos shown. */}
      <ul className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-2xl [scrollbar-width:none] md:hidden">
        {shown.map((url, index) => (
          <li
            key={url}
            className={`relative aspect-[4/3] shrink-0 snap-center overflow-hidden bg-neutral-100 ${
              single ? "w-full" : "w-[88%]"
            }`}
          >
            <button type="button" onClick={open} className="relative block h-full w-full focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-neutral-900">
              <Image
                src={url}
                alt={`${title}, photo ${index + 1} of ${all.length}`}
                fill
                sizes="88vw"
                loading={index === 0 ? "eager" : "lazy"}
                className="object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      {/* Desktop: the first photo is the large one. */}
      <ul className="hidden grid-cols-4 gap-2 rounded-2xl md:grid">
        {shown.map((url, index) => (
          <li
            key={url}
            className={`relative overflow-hidden bg-neutral-100 ${
              index === 0 && shown.length > 1 ? "col-span-2 row-span-2" : "aspect-[4/3]"
            } ${single ? "col-span-4" : ""} ${shown.length === 4 && index === 3 ? "col-span-2 aspect-[2/1]" : ""}`}
          >
            <button type="button" onClick={open} className="relative block h-full w-full focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-neutral-900">
              <Image
                src={url}
                alt={`${title}, photo ${index + 1} of ${all.length}`}
                fill
                sizes={index === 0 ? "(min-width: 1152px) 544px, 50vw" : "(min-width: 1152px) 272px, 25vw"}
                loading={index === 0 ? "eager" : "lazy"}
                className="object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      {hidden > 0 && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={open}
            className="inline-flex min-h-11 items-center rounded-lg border border-neutral-900 px-4 text-sm font-semibold transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            More photos ({hidden} more)
          </button>
        </div>
      )}

      {/* Every photo, in a window. Escape closes it. */}
      <dialog
        ref={dialogRef}
        aria-label={`All photos of ${title}`}
        className="m-auto max-h-[90vh] w-[min(96vw,1100px)] rounded-2xl bg-white p-0 text-neutral-900 backdrop:bg-black/80"
      >
        <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-5 py-3">
          <p className="font-semibold">
            {title} · {all.length} photos
          </p>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="inline-flex min-h-11 items-center rounded-lg border border-neutral-900 px-4 text-sm font-semibold hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            Close
          </button>
        </div>
        <ul className="grid max-h-[calc(90vh-4rem)] grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3">
          {all.map((url, index) => (
            <li key={url} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-neutral-100">
              <Image
                src={url}
                alt={`${title}, photo ${index + 1} of ${all.length}`}
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                loading="lazy"
                className="object-cover"
              />
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
