"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { signUp, type AuthState } from "../login/actions";

const ROLE_OPTIONS = [
  {
    value: "tenant",
    title: "I am looking for a room",
    hint: "Browse share houses and contact landlords.",
    // Magnifying glass
    icon: "M21 21l-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z",
  },
  {
    value: "landlord",
    title: "I am renting out a room",
    hint: "List a room and receive enquiries.",
    // House
    icon: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M9.5 21v-6h5v6",
  },
];

const initialState: AuthState = {};

// Why the visitor was sent here, when they tried to open a listing or post one.
const REASONS: Record<string, string> = {
  details: "Create a free account to see the full listing and contact the landlord.",
  post: "Create an account to list a room.",
};

// Reads the query string, so it sits behind its own Suspense boundary.
function SignupNotice() {
  const reason = REASONS[useSearchParams().get("reason") ?? ""];
  if (!reason) return null;
  return (
    <p role="status" className="mt-4 rounded-lg border border-neutral-300 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-800">
      {reason}
    </p>
  );
}

const fieldClass =
  "block cursor-text px-4 py-2.5 focus-within:relative focus-within:z-10 focus-within:outline-2 focus-within:outline-neutral-900";
const fieldLabelClass = "block text-xs text-neutral-500";
const inputClass =
  "block w-full bg-transparent text-base text-neutral-900 outline-none placeholder:text-neutral-400";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-white px-4 py-12 font-sans text-neutral-900">
      <title>Sign up</title>

      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_8px_28px_rgba(0,0,0,0.08)]">
        <header className="border-b border-neutral-200 px-6 py-4 text-center text-base font-semibold">
          Sign up
        </header>

        {state.confirmEmail ? (
          <div className="px-6 pt-8 pb-10 text-center">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="mx-auto h-10 w-10 fill-none stroke-rose-600 stroke-[1.5]"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6.5h18v11H3zM3 7l9 6.5L21 7" />
            </svg>
            <h1 className="mt-4 text-[22px] leading-7 font-semibold tracking-tight">
              Check your inbox
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              We sent a confirmation link to{" "}
              <span className="font-semibold text-neutral-900">
                {state.confirmEmail}
              </span>
              . Open it to finish creating your account.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block text-sm font-semibold text-neutral-900 underline underline-offset-2"
            >
              Back to log in
            </Link>
          </div>
        ) : (
          <div className="px-6 pt-6 pb-8">
            <h1 className="text-[22px] leading-7 font-semibold tracking-tight">
              Create your account
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Find a share house, or fill a room in yours.
            </p>
            <Suspense fallback={null}>
              <SignupNotice />
            </Suspense>

            <form action={formAction} className="mt-6 space-y-5">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">
                  What brings you here?
                </legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {ROLE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="relative flex cursor-pointer flex-col gap-2 rounded-xl border border-neutral-300 p-4 transition hover:border-neutral-900 has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-50 has-[:checked]:shadow-[inset_0_0_0_1px_#171717] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900"
                    >
                      <input
                        className="peer sr-only"
                        type="radio"
                        name="role"
                        value={option.value}
                        defaultChecked={
                          (state.fields?.role ?? "tenant") === option.value
                        }
                        required
                      />
                      <span
                        aria-hidden="true"
                        className="absolute top-3 right-3 h-4 w-4 rounded-full border border-neutral-400 peer-checked:border-[5px] peer-checked:border-neutral-900"
                      />
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-6 w-6 fill-none stroke-neutral-900 stroke-[1.5]"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d={option.icon} />
                      </svg>
                      <span className="text-sm leading-5 font-semibold">
                        {option.title}
                      </span>
                      <span className="text-xs leading-4 text-neutral-500">
                        {option.hint}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="divide-y divide-neutral-400 rounded-xl border border-neutral-400">
                <div className="grid grid-cols-2 divide-x divide-neutral-400">
                  <label className={`${fieldClass} rounded-tl-xl`}>
                    <span className={fieldLabelClass}>First name</span>
                    <input
                      className={inputClass}
                      type="text"
                      name="first_name"
                      autoComplete="given-name"
                      maxLength={80}
                      defaultValue={state.fields?.firstName}
                      required
                    />
                  </label>
                  <label className={`${fieldClass} rounded-tr-xl`}>
                    <span className={fieldLabelClass}>Last name</span>
                    <input
                      className={inputClass}
                      type="text"
                      name="last_name"
                      autoComplete="family-name"
                      maxLength={80}
                      defaultValue={state.fields?.lastName}
                      required
                    />
                  </label>
                </div>
                <label className={fieldClass}>
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
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>
              </div>
              <p className="-mt-3 text-xs text-neutral-500">
                Use at least 8 characters.
              </p>

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
                className="hive w-full cursor-pointer rounded-lg bg-rose-600 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Creating account…" : "Agree and continue"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-neutral-600">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-neutral-900 underline underline-offset-2"
              >
                Log in
              </Link>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
