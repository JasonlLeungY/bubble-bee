// Validation shared by creating and editing listings. The server actions call
// this and trust nothing from the form: every value is checked here, and
// Row Level Security and column grants check again in the database.

export const MAX_IMAGES = 9;
const MAX_PRICE = 100_000;
const MAX_BOND = 100_000;
const MAX_ROOMS = 20;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** How long the room is available for. */
export const LEASE_TERMS = [
  { value: "1_month", label: "1 month" },
  { value: "3_months", label: "3 months" },
  { value: "6_months", label: "6 months" },
  { value: "12_months", label: "12 months" },
  { value: "ongoing", label: "Ongoing" },
] as const;

/** Parking the house has. "Other" is described by the landlord. */
export const PARKING_OPTIONS = [
  { value: "street", label: "Street" },
  { value: "garage", label: "Garage" },
  { value: "other", label: "Other" },
] as const;

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
  ladiesOnly: boolean;
  leaseTerm: string;
  bedrooms: string;
  bathrooms: string;
  parking: string;
  parkingOther: string;
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
  ladies_only: boolean;
  lease_term: string;
  bedrooms: number;
  bathrooms: number;
  parking: string;
  parking_other: string | null;
  image_urls: string[];
};

/** A whole number between min and max, or null. */
function wholeNumber(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

export function readListingForm(
  formData: FormData,
  folderIds: string[],
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
    ladiesOnly: formData.get("ladies_only") === "on",
    leaseTerm: text("lease_term"),
    bedrooms: text("bedrooms"),
    bathrooms: text("bathrooms"),
    parking: text("parking"),
    parkingOther: text("parking_other"),
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

  const bedrooms = wholeNumber(fields.bedrooms, 1, MAX_ROOMS);
  if (bedrooms === null) return fail("Enter how many bedrooms the house has (1 to 20).");
  const bathrooms = wholeNumber(fields.bathrooms, 1, MAX_ROOMS);
  if (bathrooms === null) return fail("Enter how many bathrooms the house has (1 to 20).");

  if (!LEASE_TERMS.some((term) => term.value === fields.leaseTerm)) {
    return fail("Choose how long the room is available for.");
  }
  if (!PARKING_OPTIONS.some((option) => option.value === fields.parking)) {
    return fail("Choose the parking: street, garage or other.");
  }
  if (fields.parking === "other" && !fields.parkingOther) {
    return fail("Describe the parking.");
  }
  if (fields.parkingOther.length > 80) {
    return fail("Keep the parking description under 80 characters.");
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
  // Only photos from the allowed folders, so a listing can never point at an
  // arbitrary external URL.
  if (!imageUrls.every((url) => listingImagePath(url, folderIds) !== null)) {
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
      ladies_only: fields.ladiesOnly,
      lease_term: fields.leaseTerm,
      bedrooms,
      bathrooms,
      parking: fields.parking,
      parking_other: fields.parking === "other" ? fields.parkingOther : null,
      image_urls: imageUrls,
    },
  };
}

/** The storage path for a photo URL, if it is in one of the given user folders. */
export function listingImagePath(url: string, folderIds: string[]): string | null {
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-images/`;
  if (!url.startsWith(prefix)) return null;
  const path = decodeURIComponent(url.slice(prefix.length));
  if (path.includes("..")) return null;
  return folderIds.some((id) => path.startsWith(`${id}/`)) ? path : null;
}
