"use client";

import { useActionState } from "react";
import { sendMessage, type MessageState } from "./actions";

export default function MessageForm({
  conversationId,
}: {
  conversationId: string;
}) {
  const [state, formAction, sending] = useActionState<MessageState, FormData>(
    sendMessage.bind(null, conversationId),
    {},
  );

  return (
    <form action={formAction} className="border-t border-neutral-200 p-3">
      {state.error && (
        <p role="alert" className="mb-2 px-1 text-sm text-rose-800">
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <label htmlFor="message-content" className="sr-only">
          Message
        </label>
        <input
          id="message-content"
          name="content"
          type="text"
          placeholder="Write a message"
          autoComplete="off"
          maxLength={2000}
          required
          className="min-w-0 flex-1 rounded-full border border-neutral-400 bg-white px-4 py-2.5 text-base text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
        />
        <button
          type="submit"
          disabled={sending}
          className="hive shrink-0 cursor-pointer rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
