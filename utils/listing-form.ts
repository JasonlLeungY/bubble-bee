// Validation shared by creating and editing listings. The server actions call
// this and trust nothing from the form: every value is checked here, and
// Row Level Security and column grants check again in the database.

export const MAX_IMAGES = 5;
const MAX_PRICE = 100_000;
const MAX_BOND = 100_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** What the form shows again after an error. */
export type ListingFields = {
  title: string;
  description: string;
  price: string;
  suburb: string;
  availableFrom: string;
  bond: string;
  billsIncluded: boolean;
  isSmokerAllowed: boolean;
  isShiftWorkerFriendly: boolean;
  toleratesNoise: boolean;
};

/** The columns written to public.listings. */
export type ListingValues = {
  title: string;
  description: string;
  price_per_week: number;
  suburb: string;
  available_from: string | null;
  bond_amount: number | null;
  bills_included: boolean;
  is_smoker_allowed: boolean;
  is_shift_worker_friendly: boolean;
  tolerates_noise: boolean;
  image_urls: string[];
};

export function readListingForm(
  formData: FormData,
  userId: string,
): { fields: ListingFields; values: ListingValues | null; error: string | null } {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  };

  const fields: ListingFields = {
    title: text("title"),
    description: text("description"),
    price: text("price_per_week"),
    suburb: text("suburb"),
    availableFrom: text("available_from"),
    bond: text("bond"),
    billsIncluded: formData.get("bills_included") === "on",
    isSmokerAllowed: formData.get("is_smoker_allowed") === "on",
    isShiftWorkerFriendly: formData.get("is_shift_worker_friendly") === "on",
    toleratesNoise: formData.get("tolerates_noise") === "on",
  };
  const imageUrls = formData
    .getAll("image_urls")
    .filter((value): value is string => typeof value === "string");

  const fail = (error: string) => ({ fields, values: null, error });

  if (fields.title.length < 3 || fields.title.length > 120) {
    return fail("Give the listing a title of 3 to 120 characters.");
  }
  if (fields.description.length > 5000) {
    return fail("Keep the description under 5,000 characters.");
  }
  const price = Number(fields.price);
  if (!fields.price || !Number.isFinite(price) || price <= 0 || price > MAX_PRICE) {
    return fail("Enter the weekly rent as a number above 0.");
  }
  if (!fields.suburb || fields.suburb.length > 80) {
    return fail("Enter the suburb.");
  }

  let availableFrom: string | null = null;
  if (fields.availableFrom) {
    const date = DATE_PATTERN.test(fields.availableFrom)
      ? new Date(`${fields.availableFrom}T00:00:00Z`)
      : null;
    if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== fields.availableFrom) {
      return fail("Enter a valid available-from date.");
    }
    availableFrom = fields.availableFrom;
  }

  let bond: number | null = null;
  if (fields.bond) {
    const amount = Number(fields.bond);
    if (!Number.isInteger(amount) || amount < 0 || amount > MAX_BOND) {
      return fail("Enter the bond as a whole dollar amount, or leave it blank.");
    }
    bond = amount;
  }

  if (imageUrls.length > MAX_IMAGES) {
    return fail(`A listing can have up to ${MAX_IMAGES} photos.`);
  }
  // Only photos this user uploaded to our own bucket, so a listing can never
  // point at an arbitrary external URL.
  if (!imageUrls.every((url) => listingImagePath(url, userId) !== null)) {
    return fail("One of the photos is not valid. Remove it and try again.");
  }

  return {
    fields,
    error: null,
    values: {
      title: fields.title,
      description: fields.description,
      price_per_week: Math.round(price * 100) / 100,
      suburb: fields.suburb,
      available_from: availableFrom,
      bond_amount: bond,
      bills_included: fields.billsIncluded,
      is_smoker_allowed: fields.isSmokerAllowed,
      is_shift_worker_friendly: fields.isShiftWorkerFriendly,
      tolerates_noise: fields.toleratesNoise,
      image_urls: imageUrls,
    },
  };
}

/** The storage path for a photo URL, only if the photo is in this user's folder. */
export function listingImagePath(url: string, userId: string): string | null {
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-images/`;
  if (!url.startsWith(prefix)) return null;
  const path = decodeURIComponent(url.slice(prefix.length));
  return path.startsWith(`${userId}/`) && !path.includes("..") ? path : null;
}
