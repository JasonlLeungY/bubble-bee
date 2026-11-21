"use client";

import { useActionState, useState } from "react";
import { initiateContact, type ContactState } from "@/app/listings/[id]/actions";

const MESSAGE_MAX = 2000;

/** First message from a tenant to the landlord of a listing. */
export default function MessageLandlord({ listingId }: { listingId: string }) {
  const [state, formAction, sending] = useActionState<ContactState, FormData>(
    (prevState, formData) => initiateContact(listingId, prevState, formData),
    {},
  );
  const [text, setText] = useState(state.message ?? "");

  return (
    <section id="message-landlord" className="mt-10 scroll-mt-24 border-t border-neutral-200 pt-8">
      <h2 className="text-xl font-semibold">Message the landlord</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Introduce yourself and ask what you need to know. Your description is shared with the
        landlord once you message them.
      </p>

      <form action={formAction} className="mt-5 space-y-3">
        <label htmlFor="message" className="sr-only">
          Your message
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          maxLength={MESSAGE_MAX}
          required
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Hi, is the room still available? I'm a quiet, tidy tenant who works full time."
          className="block w-full rounded-lg border border-neutral-400 bg-white px-3.5 py-3 text-base text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
        />
        <div className="flex items-center justify-between gap-3 text-xs text-neutral-500">
          <span>
            {text.length.toLocaleString()} / {MESSAGE_MAX.toLocaleString()} characters
          </span>
        </div>

        {state.error && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={sending}
          className="w-full cursor-pointer rounded-lg bg-rose-600 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {sending ? "Sending…" : "Send message"}
        </button>
      </form>
    </section>
  );
}
