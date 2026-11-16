const priceFormat = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  trailingZeroDisplay: "stripIfInteger",
});

export function formatPrice(amount: number) {
  return priceFormat.format(amount);
}

const BUCKET_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-images/`;

/**
 * Keeps only URLs that point into our own listing-images bucket.
 *
 * image_urls is plain text in the database, so a row written straight through
 * the API could hold any URL. next/image throws on a host it is not configured
 * for, which would take the whole page down, so anything else is dropped.
 */
export function listingImages(urls: string[] | null | undefined) {
  return (urls ?? []).filter(
    (url) => typeof url === "string" && url.startsWith(BUCKET_PREFIX),
  );
}
