/** The longest a tenant's description may be, in words. */
export const ABOUT_MAX_WORDS = 2000;

/** Counts words the way the database does: runs of non-space characters. */
export function countWords(text: string) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
