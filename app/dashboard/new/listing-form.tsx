"use client";

import { useActionState, useLayoutEffect, useRef, useState } from "react";
import ImageUploader from "@/components/ImageUploader";
import { createListing, type ListingState } from "../actions";

const RULES = [
  {
    name: "is_smoker_allowed",
    field: "isSmokerAllowed",
    title: "Smoker friendly",
    hint: "Housemates who smoke are welcome.",
  },
  {
    name: "is_shift_worker_friendly",
    field: "isShiftWorkerFriendly",
    title: "Shift-worker friendly",
    hint: "Comings and goings at odd hours are fine.",
  },
  {
    name: "tolerates_noise",
    field: "toleratesNoise",
    title: "Tolerates late noise",
    hint: "Music or guests in the evening are okay.",
  },
] as const;

const labelClass = "block text-sm font-semibold";
const inputClass =
  "mt-1.5 block w-full rounded-lg border border-neutral-400 bg-white px-3.5 py-3 text-base text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900";

export default function ListingForm() {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const submitted = useRef(false);

  const [state, formAction, saving] = useActionState(
    async (prevState: ListingState, formData: FormData) => {
      submitted.current = true;
      const result = await createListing(prevState, formData);
      // Only reached when the action returned an error instead of redirecting.
      submitted.current = false;
      return result ?? prevState;
    },
    {},
  );

  // Next.js keeps this page mounted (hidden) after navigating away. Once a
  // listing has been saved, clear the photos so the next visit starts empty.
  useLayoutEffect(() => {
    return () => {
      if (submitted.current) {
        submitted.current = false;
        setImageUrls([]);
      }
    };
  }, []);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label htmlFor="title" className={labelClass}>
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          className={inputClass}
          placeholder="Sunny room in a friendly terrace"
          minLength={3}
          maxLength={120}
          defaultValue={state.fields?.title}
          required
        />
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          className={inputClass}
          placeholder="The room, the house, the housemates, what is nearby."
          maxLength={5000}
          defaultValue={state.fields?.description}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="price_per_week" className={labelClass}>
            Price per week
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 mt-1.5 flex items-center text-neutral-500">
              $
            </span>
            <input
              id="price_per_week"
              name="price_per_week"
              type="number"
              inputMode="decimal"
              min={1}
              max={100000}
              step="0.01"
              className={`${inputClass} pl-8`}
              placeholder="250"
              defaultValue={state.fields?.price}
              required
            />
          </div>
        </div>
        <div>
          <label htmlFor="suburb" className={labelClass}>
            Suburb
          </label>
          <input
            id="suburb"
            name="suburb"
            type="text"
            className={inputClass}
            placeholder="Newtown"
            maxLength={80}
            defaultValue={state.fields?.suburb}
            required
          />
        </div>
      </div>

      <div>
        <p className={`${labelClass} mb-1.5`}>Photos</p>
        <ImageUploader
          name="image_urls"
          value={imageUrls}
          onChange={setImageUrls}
          onUploadingChange={setUploading}
        />
      </div>

      <fieldset>
        <legend className={labelClass}>House rules</legend>
        <div className="mt-1.5 divide-y divide-neutral-200 rounded-xl border border-neutral-300">
          {RULES.map((rule) => (
            <label
              key={rule.name}
              className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5"
            >
              <span>
                <span className="block text-sm font-medium">{rule.title}</span>
                <span className="block text-xs text-neutral-500">
                  {rule.hint}
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                name={rule.name}
                className="peer sr-only"
                defaultChecked={state.fields?.[rule.field] ?? false}
              />
              <span
                aria-hidden="true"
                className="relative h-8 w-[52px] shrink-0 rounded-full bg-neutral-300 transition-colors peer-checked:bg-neutral-900 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-neutral-900 after:absolute after:top-0.5 after:left-0.5 after:h-7 after:w-7 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
              />
            </label>
          ))}
        </div>
      </fieldset>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || uploading}
        className="w-full cursor-pointer rounded-lg bg-rose-600 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving
          ? "Publishing…"
          : uploading
            ? "Uploading photos…"
            : "Publish listing"}
      </button>
    </form>
  );
}
