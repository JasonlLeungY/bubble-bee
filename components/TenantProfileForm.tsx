"use client";

import { useActionState, type ReactNode } from "react";
import { saveTenantProfile, type TenantProfileState } from "@/app/dashboard/profile/actions";
import { GENDERS, GENDER_PREFERENCES } from "@/utils/gender";
import { TENANT_OPTIONS } from "@/utils/tenant-profile";
import SelfieUploader from "./SelfieUploader";

type Option = { value: string; label: string; hint?: string };

const labelClass = "block text-sm font-semibold";
const inputClass =
  "mt-1.5 block w-full rounded-lg border border-neutral-400 bg-white px-3.5 py-3 text-base text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900";
const optionClass =
  "flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-300 px-3.5 py-2.5 transition hover:border-neutral-900 has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900";

// Question groups share one layout. Radio and check groups are the choice lists
// the database also enforces.
function Question({ legend, hint, children }: { legend: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className={labelClass}>{legend}</legend>
      {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
      <div className="mt-2 space-y-2">{children}</div>
    </fieldset>
  );
}

function Choices({
  name,
  options,
  selected,
  kind = "radio",
  required = false,
}: {
  name: string;
  options: readonly Option[];
  selected: string[];
  kind?: "radio" | "checkbox";
  required?: boolean;
}) {
  return options.map((option) => (
    <label key={option.value} className={optionClass}>
      <input
        type={kind}
        name={name}
        value={option.value}
        defaultChecked={selected.includes(option.value)}
        required={required && kind === "radio"}
        className="mt-1 h-4 w-4 shrink-0 accent-neutral-900"
      />
      <span>
        <span className="block text-sm font-medium">{option.label}</span>
        {option.hint && <span className="block text-xs text-neutral-500">{option.hint}</span>}
      </span>
    </label>
  ));
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-6">
      <h2 className="border-b border-neutral-200 pb-2 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function TenantProfileForm({
  userId,
  email,
  initial,
  selfieUrl,
  completed,
}: {
  userId: string;
  email: string;
  initial: Record<string, string[]>;
  selfieUrl: string | null;
  completed: boolean;
}) {
  const [state, formAction, saving] = useActionState<TenantProfileState, FormData>(saveTenantProfile, {});

  // After a failed save, show what was typed; otherwise show what is saved.
  const one = (name: string) => (state.fields ? state.fields[name]?.[0] ?? "" : initial[name]?.[0] ?? "");
  const many = (name: string) => (state.fields ? state.fields[name] ?? [] : initial[name] ?? []);
  const gender = (value: string) => one("gender") === value;

  return (
    <form action={formAction} className="mt-6 space-y-10">
      <header>
        <h1 className="text-[26px] leading-8 font-semibold tracking-tight">
          {completed ? "Your profile" : "Tell landlords about you"}
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Landlords see this only after you message them. Phone and date of birth stay private. You need to finish
          this before you can contact a landlord.
        </p>
      </header>

      {state.errors && state.errors.length > 0 && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p className="font-semibold">Please check these answers:</p>
          <ul className="mt-1 list-disc pl-5">
            {state.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <Section title="1. Basic identity and verification">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Full legal name</span>
            <span className="block text-xs text-neutral-500">Used for screening and lease agreements.</span>
            <input className={inputClass} name="full_name" maxLength={120} required defaultValue={one("full_name")} />
          </label>
          <label className="block">
            <span className={labelClass}>Preferred name or nickname <span className="font-normal text-neutral-500">(optional)</span></span>
            <span className="block text-xs text-neutral-500">Shown on your household card.</span>
            <input className={inputClass} name="preferred_name" maxLength={40} defaultValue={one("preferred_name")} />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Email</span>
            <span className="block text-xs text-neutral-500">From your account.</span>
            <input className={`${inputClass} bg-neutral-50 text-neutral-600`} value={email} readOnly />
          </label>
          <label className="block">
            <span className={labelClass}>Phone number</span>
            <span className="block text-xs text-neutral-500">Private. Not shown to landlords.</span>
            <input className={inputClass} name="phone" type="tel" autoComplete="tel" required defaultValue={one("phone")} />
          </label>
        </div>

        <label className="block max-w-xs">
          <span className={labelClass}>Date of birth</span>
          <span className="block text-xs text-neutral-500">Private. You must be 18 or over to sign a lease.</span>
          <input className={inputClass} name="date_of_birth" type="date" required defaultValue={one("date_of_birth")} />
        </label>

        <div>
          <p className={labelClass}>Profile selfie</p>
          <p className="mt-0.5 mb-3 text-xs text-neutral-500">Required. Use a clear photo of your face.</p>
          <SelfieUploader
            userId={userId}
            name="selfie_path"
            initialPath={one("selfie_path")}
            previewUrl={selfieUrl}
          />
        </div>

        <Question legend="Gender" hint="Landlords who only take female or male housemates use this to decide who can contact them.">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {GENDERS.map((option) => (
              <label key={option.value} className={optionClass}>
                <input
                  type="radio"
                  name="gender"
                  value={option.value}
                  defaultChecked={gender(option.value)}
                  required
                  className="mt-1 h-4 w-4 shrink-0 accent-neutral-900"
                />
                <span className="text-sm font-medium">{option.label}</span>
              </label>
            ))}
          </div>
        </Question>

        <Question legend="Housemates you are happy to live with" hint="Shown to landlords with your profile.">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {GENDER_PREFERENCES.map((option) => (
              <label key={option.value} className={optionClass}>
                <input
                  type="radio"
                  name="housemate_preference"
                  value={option.value}
                  defaultChecked={one("housemate_preference") === option.value}
                  required
                  className="mt-1 h-4 w-4 shrink-0 accent-neutral-900"
                />
                <span className="text-sm font-medium">{option.label}</span>
              </label>
            ))}
          </div>
        </Question>

        <label className="block">
          <span className={labelClass}>Short bio <span className="font-normal text-neutral-500">(optional)</span></span>
          <span className="block text-xs text-neutral-500">Tell your future housemates a bit about yourself and your vibe. 300 characters.</span>
          <textarea className={`${inputClass} min-h-24`} name="bio" maxLength={300} defaultValue={one("bio")} />
        </label>
      </Section>

      <Section title="2. Employment and job matching">
        <Question legend="Current employment status">
          <Choices name="employment_status" options={TENANT_OPTIONS.employment} selected={[one("employment_status")]} required />
        </Question>

        <label className="block">
          <span className={labelClass}>Current occupation or job title</span>
          <span className="block text-xs text-neutral-500">For example Barista, Software Developer or Warehouse Supervisor. Required if employed.</span>
          <input className={inputClass} name="job_title" maxLength={80} defaultValue={one("job_title")} />
        </label>

        <Question legend="Industry" hint="Pick every one that fits. Used for job matching.">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Choices name="industries" options={TENANT_OPTIONS.industries} selected={many("industries")} kind="checkbox" />
          </div>
        </Question>

        <Question legend="Open to job opportunities?" hint="Allow landlords and verified local business owners on Bubble Bee to send you job offers?">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Choices
              name="open_to_job_offers"
              options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
              selected={many("open_to_job_offers")}
              required
            />
          </div>
        </Question>

        <label className="block">
          <span className={labelClass}>Target roles or skills</span>
          <span className="block text-xs text-neutral-500">Separate with commas, for example Front of House, Line Cook, Barista. Needed if open to job offers.</span>
          <input className={inputClass} name="target_roles" maxLength={600} defaultValue={one("target_roles")} />
        </label>

        <Question legend="Preferred days or shifts" hint="Needed if open to job offers.">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Choices name="preferred_shifts" options={TENANT_OPTIONS.shifts} selected={many("preferred_shifts")} kind="checkbox" />
          </div>
        </Question>

        <Question legend="Work availability and work rights" hint="Needed if open to job offers.">
          <Choices name="work_rights" options={TENANT_OPTIONS.workRights} selected={many("work_rights")} />
        </Question>

        <Question legend="Income or rent affordability (optional)" hint="Shows landlords you can pay without sharing bank statements.">
          <Choices name="income_verification" options={TENANT_OPTIONS.income} selected={many("income_verification")} />
        </Question>
      </Section>

      <Section title="3. Household lifestyle and compatibility">
        <Question legend="Work and sleep schedule" hint="Affects noise in the house.">
          <Choices name="work_schedule" options={TENANT_OPTIONS.workSchedule} selected={many("work_schedule")} required />
        </Question>

        <Question legend="Work from home">
          <Choices name="wfh" options={TENANT_OPTIONS.wfh} selected={many("wfh")} required />
        </Question>

        <Question legend="Smoking and vaping">
          <Choices name="smoking" options={TENANT_OPTIONS.smoking} selected={many("smoking")} required />
        </Question>

        <Question legend="Alcohol and socialising at home">
          <Choices name="alcohol" options={TENANT_OPTIONS.alcohol} selected={many("alcohol")} required />
        </Question>

        <Question legend="Guests and overnight visitors">
          <Choices name="guests" options={TENANT_OPTIONS.guests} selected={many("guests")} required />
        </Question>

        <Question legend="Cleanliness and chore style">
          <Choices name="cleanliness" options={TENANT_OPTIONS.cleanliness} selected={many("cleanliness")} required />
        </Question>

        <Question legend="Dietary and kitchen notes (optional)" hint="Helps avoid kitchen clashes.">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Choices name="dietary" options={TENANT_OPTIONS.dietary} selected={many("dietary")} kind="checkbox" />
          </div>
        </Question>

        <Question legend="Pets">
          <Choices
            name="has_pets"
            options={[{ value: "yes", label: "I have pets" }, { value: "no", label: "I have no pets" }]}
            selected={many("has_pets")}
            required
          />
          <label className="block">
            <span className={labelClass}>If you have pets, what type and size?</span>
            <input className={inputClass} name="pets_details" maxLength={120} defaultValue={one("pets_details")} />
          </label>
        </Question>

        <Question legend="Allergies">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Choices name="allergies" options={TENANT_OPTIONS.allergies} selected={many("allergies")} kind="checkbox" />
          </div>
        </Question>

        <label className={optionClass}>
          <input
            type="checkbox"
            name="tolerates_noise"
            defaultChecked={many("tolerates_noise").includes("on")}
            className="mt-1 h-4 w-4 shrink-0 accent-neutral-900"
          />
          <span>
            <span className="block text-sm font-medium">I make late noise</span>
            <span className="block text-xs text-neutral-500">Music, calls or guests in the evening. Houses that prefer quiet evenings will not show as a match.</span>
          </span>
        </label>
      </Section>

      <Section title="4. Rental preferences and logistics">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Target move-in date</span>
            <input className={inputClass} name="move_in_date" type="date" required defaultValue={one("move_in_date")} />
          </label>
          <label className={`${optionClass} self-end`}>
            <input
              type="checkbox"
              name="flexible_move_in"
              defaultChecked={many("flexible_move_in").includes("on")}
              className="mt-1 h-4 w-4 shrink-0 accent-neutral-900"
            />
            <span className="text-sm font-medium">My move-in date is flexible</span>
          </label>
        </div>

        <Question legend="Intended length of stay">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Choices name="stay_length" options={TENANT_OPTIONS.stay} selected={many("stay_length")} required />
          </div>
        </Question>

        <label className="block max-w-xs">
          <span className={labelClass}>Maximum weekly budget (AUD)</span>
          <span className="block text-xs text-neutral-500">Used to filter out houses that are too expensive.</span>
          <div className="relative">
            <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-base text-neutral-500">$</span>
            <input
              className={`${inputClass} pl-8`}
              name="max_weekly_budget"
              type="number"
              inputMode="decimal"
              min={1}
              max={10000}
              step="0.01"
              required
              defaultValue={one("max_weekly_budget")}
            />
          </div>
        </label>

        <Question legend="Parking needed">
          <Choices name="parking_needed" options={TENANT_OPTIONS.parkingNeeded} selected={many("parking_needed")} required />
        </Question>
      </Section>

      <div className="sticky bottom-0 -mx-4 border-t border-neutral-200 bg-white/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <button
          type="submit"
          disabled={saving}
          className="hive w-full cursor-pointer rounded-lg bg-rose-600 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : completed ? "Save profile" : "Save and continue"}
        </button>
      </div>
    </form>
  );
}

