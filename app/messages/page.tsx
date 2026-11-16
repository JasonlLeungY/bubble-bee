import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import LocalTime from "@/components/LocalTime";
import SiteHeader from "@/components/SiteHeader";
import { UUID } from "@/utils/lifestyle";
import { createClient } from "@/utils/supabase/server";
import MessageForm from "./message-form";

export const metadata: Metadata = { title: "Messages" };

type Person = { first_name: string | null; last_name: string | null } | null;

type Conversation = {
  id: string;
  listing_id: string;
  tenant_id: string;
  landlord_id: string;
  last_message_at: string;
  listing: { title: string; suburb: string } | null;
  tenant: Person;
  landlord: Person;
  // The single most recent message, for the preview line.
  messages: { content: string; sender_id: string }[];
};

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export default function MessagesPage({
  searchParams,
}: PageProps<"/messages">) {
  return (
    // Fixed to the viewport height so the chat scrolls inside its own pane.
    <div className="flex h-dvh flex-col bg-white font-sans text-neutral-900">
      <SiteHeader />
      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-[26px] leading-8 font-semibold tracking-tight">
          Messages
        </h1>
        <div className="mt-5 flex min-h-0 flex-1 flex-col">
          <Suspense
            fallback={<p className="text-sm text-neutral-500">Loading…</p>}
          >
            <Inbox searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

function displayName(person: Person) {
  return person?.first_name?.trim() || "Someone";
}

async function Inbox({
  searchParams,
}: {
  searchParams: PageProps<"/messages">["searchParams"];
}) {
  const { c } = await searchParams;
  const requestedId = typeof c === "string" && UUID.test(c) ? c : null;

  await connection();
  const supabase = await createClient();

  // proxy.ts already guards this route; re-check next to the data anyway.
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");
  const userId = auth.claims.sub;

  // Row Level Security returns only conversations this user is part of,
  // whether as the tenant or as the landlord.
  const { data, error } = await supabase
    .from("conversations")
    .select(
      `id, listing_id, tenant_id, landlord_id, last_message_at,
       listing:listings(title, suburb),
       tenant:profiles!conversations_tenant_id_fkey(first_name, last_name),
       landlord:profiles!conversations_landlord_id_fkey(first_name, last_name),
       messages(content, sender_id)`,
    )
    .order("last_message_at", { ascending: false })
    .order("created_at", { referencedTable: "messages", ascending: false })
    .limit(1, { referencedTable: "messages" });

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-8 text-sm text-rose-800"
      >
        We could not load your messages just now. Refresh the page to try
        again.
      </p>
    );
  }

  const conversations = (data ?? []) as unknown as Conversation[];

  if (conversations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-16 text-center">
        <p className="font-semibold">No conversations yet</p>
        <p className="mt-1 text-sm text-neutral-500">
          Conversations start when a tenant contacts a landlord from a listing.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block text-sm font-semibold underline underline-offset-2"
        >
          Browse rooms
        </Link>
      </div>
    );
  }

  // Only ever open a conversation that is in this user's own list.
  const selected =
    conversations.find((conversation) => conversation.id === requestedId) ??
    null;

  let messages: Message[] = [];
  if (selected) {
    // Newest first: the chat pane is a reversed column, so the newest message
    // sits at the bottom and the pane starts scrolled to it without any script.
    const { data: rows } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .eq("conversation_id", selected.id)
      .order("created_at", { ascending: false })
      .limit(200);
    messages = rows ?? [];
  }

  const otherParty = (conversation: Conversation) =>
    conversation.tenant_id === userId
      ? { name: displayName(conversation.landlord), role: "Landlord" }
      : { name: displayName(conversation.tenant), role: "Tenant" };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-2xl border border-neutral-200 md:grid-cols-[300px_minmax(0,1fr)]">
      {/* Left: conversations. On small screens it gives way to the open chat. */}
      <nav
        aria-label="Conversations"
        className={`min-h-0 overflow-y-auto md:block md:border-r md:border-neutral-200 ${
          selected ? "hidden" : "block"
        }`}
      >
        <ul className="divide-y divide-neutral-200">
          {conversations.map((conversation) => {
            const other = otherParty(conversation);
            const last = conversation.messages[0];
            const active = conversation.id === selected?.id;
            return (
              <li key={conversation.id}>
                <Link
                  href={`/messages?c=${conversation.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`block px-4 py-3.5 transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-900 ${
                    active ? "bg-neutral-100" : "hover:bg-neutral-50"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-semibold">
                      {other.name}
                      <span className="font-normal text-neutral-500">
                        {" "}
                        · {other.role}
                      </span>
                    </p>
                    <span className="shrink-0 text-xs text-neutral-500">
                      <LocalTime iso={conversation.last_message_at} />
                    </span>
                  </div>
                  <p className="truncate text-sm text-neutral-600">
                    {conversation.listing?.title ?? "Listing removed"}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-neutral-500">
                    {last
                      ? `${last.sender_id === userId ? "You: " : ""}${last.content}`
                      : "No messages yet"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Right: the open chat. */}
      <section
        className={`min-h-0 flex-col md:flex ${selected ? "flex" : "hidden"}`}
      >
        {selected ? (
          <>
            <header className="border-b border-neutral-200 px-4 py-3">
              <Link
                href="/messages"
                className="mb-1 inline-block text-sm font-semibold underline underline-offset-2 md:hidden"
              >
                <span aria-hidden="true">←</span> All conversations
              </Link>
              <p className="font-semibold">
                {otherParty(selected).name}
                <span className="font-normal text-neutral-500">
                  {" "}
                  · {otherParty(selected).role}
                </span>
              </p>
              <Link
                href={`/listings/${selected.listing_id}`}
                className="block truncate text-sm text-neutral-600 underline underline-offset-2"
              >
                {selected.listing
                  ? `${selected.listing.title}, ${selected.listing.suburb}`
                  : "View listing"}
              </Link>
            </header>

            <ol className="flex min-h-0 flex-1 flex-col-reverse gap-2 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <li className="my-auto text-center text-sm text-neutral-500">
                  No messages yet. Say hello.
                </li>
              )}
              {messages.map((message) => {
                const mine = message.sender_id === userId;
                return (
                  <li
                    key={message.id}
                    className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                  >
                    <p
                      className={`max-w-[80%] rounded-2xl px-4 py-2 break-words whitespace-pre-line ${
                        mine
                          ? "rounded-br-md bg-neutral-900 text-white"
                          : "rounded-bl-md bg-neutral-100 text-neutral-900"
                      }`}
                    >
                      <span className="sr-only">
                        {mine ? "You: " : `${otherParty(selected).name}: `}
                      </span>
                      {message.content}
                    </p>
                    <span className="mt-1 px-1 text-xs text-neutral-500">
                      <LocalTime iso={message.created_at} />
                    </span>
                  </li>
                );
              })}
            </ol>

            <MessageForm key={selected.id} conversationId={selected.id} />
          </>
        ) : (
          <p className="m-auto px-6 text-center text-sm text-neutral-500">
            Choose a conversation to read it.
          </p>
        )}
      </section>
    </div>
  );
}
