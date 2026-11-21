"use client";

import { useActionState, useState } from "react";
import { saveTenantAbout, type AboutState } from "@/app/dashboard/actions";
import { ABOUT_MAX_WORDS, countWords } from "@/utils/words";

/** The tenant's description for landlords, with a live word count. */
export default function AboutForm({ initial }: { initial: string }) {
  const [state, formAction, saving] = useActionState<AboutState, FormData>(saveTenantAbout, {});
  const [text, setText] = useState(initial);
  const words = countWords(text);
  const overLimit = words > ABOUT_MAX_WORDS;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">About you</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Tell landlords about yourself: your work and routine, what you are like at home, and what
        you are looking for. Up to {ABOUT_MAX_WORDS.toLocaleString()} words. Landlords see this once
        you message them.
      </p>

      <form action={formAction} className="mt-4 space-y-3">
        <label htmlFor="about" className="sr-only">
          About you
        </label>
        <textarea
          id="about"
          name="about"
          rows={10}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="I'm a nurse working rotating shifts, so I'm often out early or home late. I keep my room tidy and I am happy to share chores..."
          className="block w-full rounded-lg border border-neutral-400 bg-white px-3.5 py-3 text-base text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
        />
        <p
          className={`text-xs ${overLimit ? "font-semibold text-rose-700" : "text-neutral-500"}`}
          aria-live="polite"
        >
          {words.toLocaleString()} / {ABOUT_MAX_WORDS.toLocaleString()} words
          {overLimit && " — too long to save"}
        </p>

        {state.error && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
            {state.error}
          </p>
        )}
        {!saving && state.saved && !state.error && (
          <p role="status" className="text-sm font-semibold text-emerald-800">
            Saved.
          </p>
        )}

        <button
          type="submit"
          disabled={saving || overLimit}
          className="cursor-pointer rounded-lg border border-neutral-900 px-4 py-2.5 text-sm font-semibold transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save description"}
        </button>
      </form>
    </section>
  );
}
