"use client";

import { useActionState } from "react";
import { updateLifestyle, type LifestyleState } from "./actions";

type Values = NonNullable<LifestyleState["values"]>;

const TRAITS = [
  {
    name: "is_smoker",
    field: "isSmoker",
    title: "I smoke",
    hint: "You will only be able to contact smoker-friendly houses.",
  },
  {
    name: "is_shift_worker",
    field: "isShiftWorker",
    title: "I work shifts",
    hint: "You come and go at odd hours.",
  },
  {
    name: "tolerates_noise",
    field: "toleratesNoise",
    title: "I make late noise",
    hint: "Music, calls or guests in the evening.",
  },
] as const;

export default function LifestyleForm({ initial }: { initial: Values }) {
  const [state, formAction, saving] = useActionState(updateLifestyle, {});
  const values = state.values ?? initial;

  return (
    <form action={formAction}>
      <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-300">
        {TRAITS.map((trait) => (
          <label
            key={trait.name}
            className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5"
          >
            <span>
              <span className="block text-sm font-medium">{trait.title}</span>
              <span className="block text-xs text-neutral-500">
                {trait.hint}
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              name={trait.name}
              className="peer sr-only"
              defaultChecked={values[trait.field]}
            />
            <span
              aria-hidden="true"
              className="relative h-8 w-[52px] shrink-0 rounded-full bg-neutral-300 transition-colors peer-checked:bg-neutral-900 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-neutral-900 after:absolute after:top-0.5 after:left-0.5 after:h-7 after:w-7 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="hive cursor-pointer rounded-lg border border-neutral-900 px-4 py-2.5 text-sm font-semibold transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save lifestyle"}
        </button>
        <p role="status" className="text-sm text-neutral-600">
          {!saving && state.saved && "Saved."}
        </p>
        {state.error && (
          <p role="alert" className="text-sm text-rose-800">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
