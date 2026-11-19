"use client";

import Link from "next/link";
import { useActionState, useLayoutEffect, useRef, useState } from "react";
import { createListing, updateListing, type ListingState } from "@/app/dashboard/actions";
import ImageUploader from "@/components/ImageUploader";

/** The saved values of a listing, used to fill the form when editing. */
export type InitialListing = {
  title: string;
  description: string;
  price_per_week: number;
  suburb: string;
  image_urls: string[];
  available_from: string | null;
  bond_amount: number | null;
  bills_included: boolean;
  is_smoker_allowed: boolean;
  is_shift_worker_friendly: boolean;
  tolerates_noise: boolean;
};

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

function Switch({
  name,
  title,
  hint,
  defaultChecked,
}: {
  name: string;
  title: string;
  hint: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5">
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-neutral-500">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        name={name}
        className="peer sr-only"
        defaultChecked={defaultChecked}
      />
      <span
        aria-hidden="true"
        className="relative h-8 w-[52px] shrink-0 rounded-full bg-neutral-300 transition-colors peer-checked:bg-neutral-900 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-neutral-900 after:absolute after:top-0.5 after:left-0.5 after:h-7 after:w-7 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  );
}

/**
 * The listing form for creating and editing. Edit mode fills every field from
 * the saved listing and keeps the saved photos until the owner saves.
 */
export default function ListingForm({
  mode,
  listingId,
  initial,
}: {
  mode: "create" | "edit";
  listingId?: string;
  initial?: InitialListing;
}) {
  const isEdit = mode === "edit" && Boolean(listingId);
  const savedUrls = initial?.image_urls ?? [];
  const [imageUrls, setImageUrls] = useState<string[]>(savedUrls);
  const [uploading, setUploading] = useState(false);
  const submitted = useRef(false);

  const [state, formAction, saving] = useActionState(
    async (prevState: ListingState, formData: FormData) => {
      submitted.current = true;
      const result = isEdit
        ? await updateListing(listingId ?? "", prevState, formData)
        : await createListing(prevState, formData);
      // Only reached when the action returned an error instead of redirecting.
      submitted.current = false;
      return result ?? prevState;
    },
    {},
  );

  // Next.js keeps this page mounted (hidden) after navigating away. Once a
  // listing has been saved, clear the photos so the next visit starts fresh.
  useLayoutEffect(() => {
    return () => {
      if (submitted.current) {
        submitted.current = false;
        setImageUrls([]);
      }
    };
  }, []);

  const initialPrice = initial ? String(initial.price_per_week) : undefined;
  const initialBond = initial?.bond_amount != null ? String(initial.bond_amount) : undefined;

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label htmlFor="title" className={labelClass}>Title</label>
        <input
          id="title"
          name="title"
          type="text"
          className={inputClass}
          placeholder="Sunny room in a friendly terrace"
          minLength={3}
          maxLength={120}
          defaultValue={state.fields?.title ?? initial?.title}
          required
        />
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>Description</label>
        <textarea
          id="description"
          name="description"
          rows={5}
          className={inputClass}
          placeholder="The room, the house, the housemates, what is nearby."
          maxLength={5000}
          defaultValue={state.fields?.description ?? initial?.description}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="price_per_week" className={labelClass}>Price per week</label>
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
              defaultValue={state.fields?.price ?? initialPrice}
              required
            />
          </div>
        </div>
        <div>
          <label htmlFor="suburb" className={labelClass}>Suburb</label>
          <input
            id="suburb"
            name="suburb"
            type="text"
            className={inputClass}
            placeholder="Newtown"
            maxLength={80}
            defaultValue={state.fields?.suburb ?? initial?.suburb}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="available_from" className={labelClass}>Available from</label>
          <input
            id="available_from"
            name="available_from"
            type="date"
            className={inputClass}
            defaultValue={state.fields?.availableFrom ?? initial?.available_from ?? ""}
          />
          <p className="mt-1 text-xs text-neutral-500">Leave blank if it is available now.</p>
        </div>
        <div>
          <label htmlFor="bond" className={labelClass}>Bond</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 mt-1.5 flex items-center text-neutral-500">
              $
            </span>
            <input
              id="bond"
              name="bond"
              type="number"
              inputMode="numeric"
              min={0}
              max={100000}
              step={1}
              className={`${inputClass} pl-8`}
              placeholder="1000"
              defaultValue={state.fields?.bond ?? initialBond ?? ""}
            />
          </div>
          <p className="mt-1 text-xs text-neutral-500">Leave blank if it is not set yet.</p>
        </div>
      </div>

      <div>
        <p className={`${labelClass} mb-1.5`}>Photos</p>
        <ImageUploader
          name="image_urls"
          value={imageUrls}
          onChange={setImageUrls}
          onUploadingChange={setUploading}
          savedUrls={savedUrls}
        />
      </div>

      <fieldset>
        <legend className={labelClass}>What is included</legend>
        <div className="mt-1.5 rounded-xl border border-neutral-300">
          <Switch
            name="bills_included"
            title="Bills included in the rent"
            hint="Electricity, gas, water and internet are covered."
            defaultChecked={state.fields?.billsIncluded ?? initial?.bills_included ?? false}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className={labelClass}>House rules</legend>
        <div className="mt-1.5 divide-y divide-neutral-200 rounded-xl border border-neutral-300">
          {RULES.map((rule) => (
            <Switch
              key={rule.name}
              name={rule.name}
              title={rule.title}
              hint={rule.hint}
              defaultChecked={state.fields?.[rule.field] ?? initial?.[rule.name] ?? false}
            />
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

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <Link
          href={isEdit ? `/listings/${listingId}` : "/dashboard"}
          className="rounded-lg border border-neutral-300 px-4 py-3.5 text-center text-base font-semibold transition hover:border-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 sm:flex-1"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={saving || uploading}
          className="w-full cursor-pointer rounded-lg bg-rose-600 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
        >
          {isEdit
            ? saving
              ? "Saving…"
              : uploading
                ? "Uploading photos…"
                : "Save changes"
            : saving
              ? "Publishing…"
              : uploading
                ? "Uploading photos…"
                : "Publish listing"}
        </button>
      </div>
    </form>
  );
}
