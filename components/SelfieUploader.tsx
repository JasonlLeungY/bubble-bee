"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

const BUCKET = "tenant-avatars";
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const SIDE = 800;

/** Centre-crops a photo to a square JPEG, so every selfie has the same shape. */
async function squareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(side, SIDE);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare the photo.");
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();
  return await new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not prepare the photo."))),
      "image/jpeg",
      0.9,
    ),
  );
}

/**
 * Takes a profile selfie from the camera or a file, crops it to a square and
 * uploads it to the private tenant-avatars bucket. The form submits the path.
 */
export default function SelfieUploader({
  userId,
  name,
  initialPath,
  previewUrl,
}: {
  userId: string;
  name: string;
  initialPath: string;
  previewUrl: string | null;
}) {
  const [path, setPath] = useState(initialPath);
  const [preview, setPreview] = useState(previewUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Free the temporary preview when it is replaced or the page closes.
  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!TYPES.includes(file.type)) {
      setError("Use a JPEG, PNG or WebP photo.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Use a photo under 5 MB.");
      return;
    }

    setBusy(true);
    try {
      const blob = await squareJpeg(file);
      const newPath = `${userId}/selfie-${Date.now()}.jpg`;
      const { error: uploadError } = await createClient()
        .storage.from(BUCKET)
        .upload(newPath, blob, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      setPreview(URL.createObjectURL(blob));
      setPath(newPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The photo did not upload. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <input type="hidden" name={name} value={path} />
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border border-neutral-300 bg-neutral-100">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Your profile selfie" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0">
        <label className="inline-block cursor-pointer rounded-lg border border-neutral-900 px-4 py-2.5 text-sm font-semibold transition hover:bg-neutral-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900">
          {busy ? "Uploading…" : preview ? "Replace selfie" : "Take or choose a selfie"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="user"
            disabled={busy}
            className="sr-only"
            onChange={(event) => onPick(event.target.files?.[0])}
          />
        </label>
        <p className="mt-1.5 text-xs text-neutral-500">
          A clear face photo. It is cropped to a square and shown only to landlords you message.
        </p>
        {error && <p role="alert" className="mt-1.5 text-xs text-rose-800">{error}</p>}
      </div>
    </div>
  );
}
