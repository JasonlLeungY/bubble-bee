"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type AuthState = {
  error?: string;
  /** Set when sign-up succeeded but the email still has to be confirmed. */
  confirmEmail?: string;
  /** Non-secret values echoed back so the form is not wiped on an error. */
  fields?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
  };
};

const ROLES = ["tenant", "landlord"];
const MIN_PASSWORD_LENGTH = 8;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function signIn(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = text(formData, "email");
  const password = String(formData.get("password") ?? "");
  const fields = { email };

  if (!email || !password) {
    return { error: "Enter your email and password.", fields };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      error:
        error.code === "email_not_confirmed"
          ? "Confirm your email first. Check your inbox for the link."
          : "Incorrect email or password.",
      fields,
    };
  }

  // Only ever follow a path on this site. Parsing against a placeholder origin
  // catches tricks like "/<tab>/evil.example", which browsers read as "//evil.example".
  const next = text(formData, "next");
  let destination = "/dashboard";
  if (next.startsWith("/")) {
    const parsed = new URL(next, "https://placeholder.invalid");
    if (parsed.origin === "https://placeholder.invalid") {
      destination = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  }
  redirect(destination);
}

export async function signUp(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const firstName = text(formData, "first_name");
  const lastName = text(formData, "last_name");
  const email = text(formData, "email");
  const password = String(formData.get("password") ?? "");
  const role = text(formData, "role");
  const fields = { firstName, lastName, email, role };

  if (!firstName || !lastName) {
    return { error: "Enter your first and last name.", fields };
  }
  if (!email) {
    return { error: "Enter your email address.", fields };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      fields,
    };
  }
  if (!ROLES.includes(role)) {
    return { error: "Choose what brings you here.", fields };
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
      // Read by the on_auth_user_created trigger to populate public.profiles.
      data: { first_name: firstName, last_name: lastName, role },
    },
  });

  if (error) {
    // Do not reveal whether an address already has an account.
    if (error.code === "user_already_exists") return { confirmEmail: email };
    return { error: error.message, fields };
  }

  // No session means the project requires email confirmation.
  if (!data.session) {
    return { confirmEmail: email };
  }

  redirect(role === "tenant" ? "/dashboard/profile" : "/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
