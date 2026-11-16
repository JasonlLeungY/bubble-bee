"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { signIn, type AuthState } from "./actions";

const NOTICES: Record<string, string> = {
  confirmed: "Your email is confirmed. Log in to continue.",
  "link-expired":
    "That confirmation link has expired. Sign up again to get a new one.",
};

const initialState: AuthState = {};

const fieldClass =
  "block cursor-text px-4 py-2.5 focus-within:relative focus-within:z-10 focus-within:outline-2 focus-within:outline-neutral-900";
const fieldLabelClass = "block text-xs text-neutral-500";
const inputClass =
  "block w-full bg-transparent text-base text-neutral-900 outline-none placeholder:text-neutral-400";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-white px-4 py-12 font-sans text-neutral-900">
      <title>Log in</title>

      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_8px_28px_rgba(0,0,0,0.08)]">
        <header className="border-b border-neutral-200 px-6 py-4 text-center text-base font-semibold">
          Log in
        </header>

        <div className="px-6 pt-6 pb-8">
          <h1 className="text-[22px] leading-7 font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Log in to manage your rooms and enquiries.
          </p>

          <Suspense fallback={null}>
            <Notice />
          </Suspense>

          <form action={formAction} className="mt-6 space-y-4">
            <Suspense fallback={null}>
              <NextField />
            </Suspense>
            <div className="divide-y divide-neutral-400 rounded-xl border border-neutral-400">
              <label className={`${fieldClass} rounded-t-xl`}>
                <span className={fieldLabelClass}>Email</span>
                <input
                  className={inputClass}
                  type="email"
                  name="email"
                  autoComplete="email"
                  defaultValue={state.fields?.email}
                  required
                />
              </label>
              <label className={`${fieldClass} rounded-b-xl`}>
                <span className={fieldLabelClass}>Password</span>
                <input
                  className={inputClass}
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                />
              </label>
            </div>

            {state.error && (
              <p
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"
              >
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full cursor-pointer rounded-lg bg-rose-600 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Logging in…" : "Log in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-600">
            New here?{" "}
            <Link
              href="/signup"
              className="font-semibold text-neutral-900 underline underline-offset-2"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

// Carries "where to go after logging in" (set by "Log in to Contact" on a
// listing) through the form. The server action validates it.
function NextField() {
  const next = useSearchParams().get("next");
  return next ? <input type="hidden" name="next" value={next} /> : null;
}

// Reads the query string, so it sits behind its own Suspense boundary and the
// rest of the page can be prerendered.
function Notice() {
  const notice = NOTICES[useSearchParams().get("message") ?? ""];
  if (!notice) return null;

  return (
    <p
      role="status"
      className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-700"
    >
      {notice}
    </p>
  );
}
