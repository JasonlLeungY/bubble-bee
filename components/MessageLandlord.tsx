"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { initiateContact, type ContactState } from "@/app/listings/[id]/actions";

const MESSAGE_MAX = 2000;

/**
 * Tenant's first message to the listing's landlord, shown on the listing page
 * without any extra click. `compact` is the sidebar version on desktop.
 */
export default function MessageLandlord({
  listingId,
  compact = false,
  id,
  conversationHref,
}: {
  listingId: string;
  compact?: boolean;
  id?: string;
  conversationHref?: string;
}) {
  const [state, formAction, sending] = useActionState<ContactState, FormData>(
    (prevState, formData) => initiateContact(listingId, prevState, formData),
    {},
  );
  const [text, setText] = useState(state.message ?? "");
  const fieldId = useId();

  return (
    <section id={id} className={compact ? "" : "scroll-mt-24"}>
      <h2 className={compact ? "text-base font-semibold" : "text-xl font-semibold"}>Introduce yourself</h2>
      {!compact && (
        <p className="mt-1 text-sm text-neutral-500">
          Say who you are and ask what you need to know. Your description is shared with the landlord
          once you message them.
        </p>
      )}

      <form action={formAction} className={compact ? "mt-3 space-y-3" : "mt-4 space-y-3"}>
        <label htmlFor={fieldId} className="sr-only">
          Your message to the landlord
        </label>
        <textarea
          id={fieldId}
          name="message"
          rows={compact ? 4 : 3}
          maxLength={MESSAGE_MAX}
          required
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Hi, I'm a quiet, tidy tenant who works full time. Is the room still available?"
          className="block w-full rounded-lg border border-neutral-400 bg-white px-3.5 py-3 text-base text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
        />
        <p className="text-xs text-neutral-500">
          {text.length.toLocaleString()} / {MESSAGE_MAX.toLocaleString()} characters
        </p>

        {state.error && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={sending}
          className="w-full cursor-pointer rounded-lg bg-rose-600 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send message"}
        </button>
      </form>

      {conversationHref && (
        <Link href={conversationHref} className="mt-3 inline-block text-sm font-semibold underline underline-offset-2">
          Open your conversation
        </Link>
      )}
    </section>
  );
}
