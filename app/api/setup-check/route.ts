// TEMPORARY diagnostic for the "Invalid API key" error on the deployed site.
// Open /api/setup-check to see which Supabase URL and key this deployment
// was built with, and whether Supabase accepts them. Delete this file once
// sign-up works.
//
// It never prints a secret key. The URL and publishable key it shows are
// already public: they are built into the site's browser JavaScript.

import { connection } from "next/server";

const URL_NAME = "NEXT_PUBLIC_SUPABASE_URL";
const KEY_NAME = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

// Baked into the code when the site was built. This is what the app uses.
const BUILT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const BUILT_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

type KeyInfo = { kind: string; preview: string; problems: string[]; jwtRef?: string };

function describeKey(raw: string | undefined): KeyInfo {
  if (raw === undefined) return { kind: "missing", preview: "(not set)", problems: ["is not set"] };
  const problems: string[] = [];
  if (raw !== raw.trim()) problems.push("has spaces or a line break at the start or end");
  if (/^["']|["']$/.test(raw.trim())) problems.push("is wrapped in quote marks");
  if (/\s/.test(raw.trim())) problems.push("has a space or line break inside it");
  const key = raw.trim().replace(/^["']|["']$/g, "");

  if (key.startsWith("sb_publishable_")) {
    return { kind: "publishable key (correct type)", preview: `${key.slice(0, 22)}… (${key.length} characters)`, problems };
  }
  if (key.startsWith("sb_secret_")) {
    problems.push("is the SECRET key, which must never be used in the website. Rotate it in Supabase (API Keys) and use the publishable key instead");
    return { kind: "SECRET key (wrong type)", preview: "(hidden)", problems };
  }
  if (key.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString());
      if (payload.role === "service_role") {
        problems.push("is the legacy service_role key, which must never be used in the website. Use the publishable key instead");
        return { kind: "legacy service_role key (wrong type)", preview: "(hidden)", problems, jwtRef: payload.ref };
      }
      return { kind: `legacy ${payload.role ?? "unknown"} key`, preview: `${key.slice(0, 12)}… (${key.length} characters)`, problems, jwtRef: payload.ref };
    } catch {
      problems.push("starts like a legacy key but is incomplete (cut off when copying?)");
      return { kind: "damaged legacy key", preview: `${key.slice(0, 12)}…`, problems };
    }
  }
  if (key === "") problems.push("is empty");
  else problems.push("does not look like a Supabase key at all");
  return { kind: "unrecognised", preview: key ? `${key.slice(0, 6)}… (${key.length} characters)` : "(empty)", problems };
}

function describeUrl(raw: string | undefined) {
  if (raw === undefined) return { ref: undefined, problems: ["is not set"] };
  const problems: string[] = [];
  if (raw !== raw.trim()) problems.push("has spaces or a line break at the start or end");
  let parsed: URL | null = null;
  try {
    parsed = new URL(raw.trim());
  } catch {
    problems.push("is not a valid web address");
  }
  if (parsed) {
    if (parsed.protocol !== "https:" && !["127.0.0.1", "localhost"].includes(parsed.hostname)) problems.push("should start with https://");
    if (parsed.pathname !== "/" || parsed.search) problems.push(`should end at the domain; remove "${parsed.pathname}${parsed.search}"`);
    if (!parsed.hostname.endsWith(".supabase.co") && !["127.0.0.1", "localhost"].includes(parsed.hostname)) problems.push("should look like https://<project-id>.supabase.co");
  }
  const ref = parsed?.hostname.endsWith(".supabase.co") ? parsed.hostname.split(".")[0] : undefined;
  return { ref, problems };
}

async function askSupabase(url: string | undefined, key: string | undefined) {
  if (!url || !key) return "skipped (URL or key missing)";
  try {
    const response = await fetch(`${url.trim().replace(/\/+$/, "")}/auth/v1/settings`, {
      headers: { apikey: key.trim() },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) return "ACCEPTED: Supabase accepts this URL and key";
    const body = (await response.text()).slice(0, 160).replace(/\s+/g, " ");
    return `REJECTED (HTTP ${response.status}): ${body}`;
  } catch (error) {
    return `could not reach Supabase at that URL (${error instanceof Error ? error.message : "unknown error"})`;
  }
}

export async function GET() {
  await connection(); // always run live, never prerendered

  // The values saved in Vercel right now, which can differ from the built
  // ones if they were changed without a redeploy. Looked up by scanning the
  // environment, because the build replaces any direct process.env read of a
  // NEXT_PUBLIC_ name with the built value.
  const runtime = new Map(Object.entries(process.env));
  const liveUrl = runtime.get(URL_NAME);
  const liveKey = runtime.get(KEY_NAME);

  const url = describeUrl(BUILT_URL);
  const key = describeKey(BUILT_KEY);
  const verdict = await askSupabase(BUILT_URL, BUILT_KEY);

  const findings: string[] = [];
  for (const problem of url.problems) findings.push(`- ${URL_NAME} ${problem}.`);
  for (const problem of key.problems) findings.push(`- ${KEY_NAME} ${problem}.`);
  if (key.jwtRef && url.ref && key.jwtRef !== url.ref) {
    findings.push(`- The key belongs to project "${key.jwtRef}" but the URL points at project "${url.ref}". Copy both from the same project.`);
  }
  const changedSinceBuild =
    (liveUrl !== undefined && liveUrl !== BUILT_URL) || (liveKey !== undefined && liveKey !== BUILT_KEY);
  if (changedSinceBuild) {
    findings.push("- The values saved in Vercel have changed since this deployment was built. Redeploy so the site picks them up.");
  }
  if (verdict.startsWith("REJECTED") && findings.length === 0) {
    findings.push("- Supabase rejects this key even though it looks well formed. The key is probably from a different Supabase project than the URL, or it was deleted or rotated. Copy both again from the same project's Connect page.");
  }

  const report = [
    "SETUP CHECK (temporary page)",
    "",
    `Deployment:      ${process.env.VERCEL_ENV ?? "local"}${process.env.VERCEL_GIT_COMMIT_SHA ? `, commit ${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}` : ""}`,
    `Supabase URL:    ${BUILT_URL === undefined ? "(not set)" : BUILT_URL.trim()}`,
    `Key type:        ${key.kind}`,
    `Key starts with: ${key.preview}`,
    `Supabase says:   ${verdict}`,
    "",
    findings.length > 0 ? "WHAT TO FIX" : "Nothing to fix: the URL and key are correct.",
    ...findings,
  ].join("\n");

  return new Response(`${report}\n`, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
