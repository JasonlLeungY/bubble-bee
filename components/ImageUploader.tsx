"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

const BUCKET = "listing-images";
const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type ImageUploaderProps = {
  /** Public URLs of the images uploaded so far. */
  value: string[];
  /** Called with the full, updated list of public URLs after every change. */
  onChange: (urls: string[]) => void;
  /** Called when uploads start and finish, so a form can hold its submit. */
  onUploadingChange?: (uploading: boolean) => void;
  /** When set, each URL is also rendered as a hidden input with this name. */
  name?: string;
  maxImages?: number;
  /** Photos already saved on the listing. Removing one here does not delete the file; saving does. */
  savedUrls?: string[];
};

export default function ImageUploader({
  value,
  onChange,
  onUploadingChange,
  name,
  maxImages = 9,
  savedUrls = [],
}: ImageUploaderProps) {
  const [pending, setPending] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const uploading = pending > 0;
  const remaining = maxImages - value.length;
  const disabled = uploading || remaining <= 0;

  async function addFiles(files: File[]) {
    if (disabled || files.length === 0) return;
    const problems: string[] = [];

    let accepted = files.filter((file) => {
      if (!EXTENSIONS[file.type]) {
        problems.push(`${file.name}: use a JPEG, PNG or WebP image.`);
        return false;
      }
      if (file.size > MAX_BYTES) {
        problems.push(`${file.name}: larger than 5 MB.`);
        return false;
      }
      return true;
    });
    if (accepted.length > remaining) {
      problems.push(`You can add up to ${maxImages} photos.`);
      accepted = accepted.slice(0, remaining);
    }
    if (accepted.length === 0) {
      setErrors(problems);
      return;
    }

    setPending(accepted.length);
    onUploadingChange?.(true);

    const supabase = createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    const uploaded: string[] = [];

    if (!userId) {
      problems.push("Your session has expired. Log in again to add photos.");
    } else {
      const results = await Promise.all(
        accepted.map(async (file) => {
          // {user_id}/{random}.{ext}: the storage policy only allows writes
          // inside the uploader's own folder.
          const path = `${userId}/${randomId()}.${EXTENSIONS[file.type]}`;
          const { error } = await supabase.storage
            .from(BUCKET)
            .upload(path, file, {
              contentType: file.type,
              cacheControl: "31536000",
              upsert: false,
            });
          if (error) return { file, error };
          return {
            file,
            url: supabase.storage.from(BUCKET).getPublicUrl(path).data
              .publicUrl,
          };
        }),
      );
      for (const result of results) {
        if (result.url) uploaded.push(result.url);
        else problems.push(`${result.file.name}: upload failed. Try again.`);
      }
    }

    // Picking and removing are disabled while uploads run, so `value` cannot
    // have changed underneath us.
    if (uploaded.length > 0) onChange([...value, ...uploaded]);
    setErrors(problems);
    setPending(0);
    onUploadingChange?.(false);
  }

  // The first photo is the cover. Moving a photo to the front keeps the
  // order of the others.
  function makeCover(url: string) {
    onChange([url, ...value.filter((item) => item !== url)]);
  }

  async function removeImage(url: string) {
    onChange(value.filter((item) => item !== url));
    setErrors([]);
    if (savedUrls.includes(url)) return;
    // Best effort: also delete the file so it does not linger in the bucket.
    const path = url.split(`/object/public/${BUCKET}/`)[1];
    if (path) {
      await createClient()
        .storage.from(BUCKET)
        .remove([decodeURIComponent(path)]);
    }
  }

  return (
    <div>
      {name &&
        value.map((url) => (
          <input key={url} type="hidden" name={name} value={url} />
        ))}

      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(Array.from(event.dataTransfer.files));
        }}
        className={`flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-7 text-center transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900 ${
          disabled
            ? "cursor-not-allowed border-neutral-300 bg-neutral-50 text-neutral-400"
            : dragging
              ? "cursor-pointer border-neutral-900 bg-neutral-50"
              : "cursor-pointer border-neutral-400 hover:border-neutral-900 hover:bg-neutral-50"
        }`}
      >
        <input
          type="file"
          className="sr-only"
          accept={Object.keys(EXTENSIONS).join(",")}
          multiple
          disabled={disabled}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            // Clear the input so picking the same file again still fires.
            event.target.value = "";
            addFiles(files);
          }}
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-7 w-7 fill-none stroke-current stroke-[1.5]"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 16.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2.5M12 15V4m0 0L8 8m4-4 4 4" />
        </svg>
        <span className="text-sm font-semibold">
          {uploading
            ? "Uploading…"
            : remaining <= 0
              ? `${maxImages} of ${maxImages} photos added`
              : "Add photos"}
        </span>
        <span className="text-xs text-neutral-500">
          Up to {maxImages} photos. JPEG, PNG or WebP, 5 MB each.
        </span>
      </label>

      {(value.length > 0 || uploading) && (
        <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {value.map((url, index) => (
            <li
              key={url}
              className="relative aspect-square overflow-hidden rounded-xl bg-neutral-100"
            >
              {/* Plain <img>: these are user uploads on the Supabase CDN, so
                  next/image would need per-project remote host config. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Photo ${index + 1}`}
                className="h-full w-full object-cover"
              />
              {index === 0 && (
                <span className="absolute bottom-1.5 left-1.5 rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold text-neutral-900 shadow">
                  Cover
                </span>
              )}
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => makeCover(url)}
                  disabled={uploading}
                  className="absolute bottom-1.5 left-1.5 cursor-pointer rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold text-neutral-900 shadow transition hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Set cover
                </button>
              )}
              <button
                type="button"
                onClick={() => removeImage(url)}
                disabled={uploading}
                aria-label={`Remove photo ${index + 1}`}
                className="absolute top-1.5 right-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-white text-neutral-900 shadow transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5 fill-none stroke-current stroke-[2.5]"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </li>
          ))}
          {Array.from({ length: pending }, (_, index) => (
            <li
              key={`pending-${index}`}
              className="aspect-square animate-pulse rounded-xl bg-neutral-200"
            />
          ))}
        </ul>
      )}

      {errors.length > 0 && (
        <ul role="alert" className="mt-3 space-y-1 text-sm text-rose-800">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// crypto.randomUUID() only exists on https and localhost; this also works
// when testing from a phone over a plain-http LAN address.
function randomId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
