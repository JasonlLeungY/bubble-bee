"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UUID } from "@/utils/lifestyle";
import { createClient } from "@/utils/supabase/server";

export type MessageState = { error?: string };

const MAX_LENGTH = 2000;

export async function sendMessage(
  conversationId: string,
  _prevState: MessageState,
  formData: FormData,
): Promise<MessageState> {
  const raw = formData.get("content");
  const content = typeof raw === "string" ? raw.trim() : "";

  if (!UUID.test(conversationId)) {
    return { error: "This conversation is not available." };
  }
  if (!content) {
    return { error: "Write a message first." };
  }
  if (content.length > MAX_LENGTH) {
    return { error: `Keep messages under ${MAX_LENGTH} characters.` };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  // Row Level Security only accepts this if the sender is the signed-in user
  // and is one of the two people in the conversation.
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: userId,
    content,
  });

  if (error) {
    return {
      error:
        error.code === "42501"
          ? "You are not part of this conversation."
          : "We could not send that. Try again.",
    };
  }

  revalidatePath("/messages");
  return {};
}
