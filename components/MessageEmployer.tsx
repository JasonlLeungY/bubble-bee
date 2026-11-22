"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { messageEmployer, type JobMessageState } from "@/app/jobs/[id]/actions";

const MESSAGE_MAX = 2000;

/**
 * A tenant's message to the employer who posted this job. Shown on the job page.
 */
export default function MessageEmployer({
  jobId,
  conversationHref,
}: {
  jobId: string;
  conversationHref?: string;
}) {
  const [state, formAction, sending] = useActionState<JobMessageState, FormData>(
    (prevState, formData) => messageEmployer(jobId, prevState, formData),
    {},
  );
  const [text, setText] = useState(state.message ?? "");
  const fieldId = useId();

  return (
    <div>
      <h2 className="text-xl font-semibold">Message the employer</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Ask about the role, hours or start date. Your profile intro is shared with the employer once you
        message them.
      </p>

      <form action={formAction} className="mt-4 space-y-3">
        <label htmlFor={fieldId} className="sr-only">
          Your message to the employer
        </label>
        <textarea
          id={fieldId}
          name="message"
          rows={3}
          maxLength={MESSAGE_MAX}
          required
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Hi, I'm available weekends and have no experience but I learn fast. Is the role still open?"
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
        <Link href={conversationHref} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2">
          Open your conversation
        </Link>
      )}
    </div>
  );
}
