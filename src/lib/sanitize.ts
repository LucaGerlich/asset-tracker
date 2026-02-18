/**
 * Input sanitization utilities.
 *
 * Provides lightweight, regex-based helpers to strip HTML tags and entities
 * from user-supplied text.  No external dependencies are required.
 *
 * These functions are designed to be applied to user-provided text fields
 * *before* they are persisted or rendered, as an additional XSS defence layer.
 */

/**
 * Strip HTML tags and decode/remove common HTML entities from `input`.
 *
 * The function:
 *  1. Removes all HTML/XML tags (including self-closing ones).
 *  2. Replaces the most common named HTML entities with their plain-text
 *     equivalents.
 *  3. Strips numeric character references (&#123; / &#x1A;).
 *  4. Removes any remaining `&...;` sequences that might slip through.
 *  5. Trims leading/trailing whitespace.
 */
export function sanitizeHtml(input: string): string {
  if (!input) return input;

  let result = input;

  // 1. Strip all HTML tags
  result = result.replace(/<[^>]*>/g, "");

  // 2. Decode common named HTML entities
  const entityMap: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
  };

  for (const [entity, replacement] of Object.entries(entityMap)) {
    result = result.replaceAll(entity, replacement);
  }

  // 3. Strip numeric character references (decimal & hex)
  result = result.replace(/&#x?[0-9a-fA-F]+;/g, "");

  // 4. Remove any remaining HTML entity-like sequences
  result = result.replace(/&[a-zA-Z]+;/g, "");

  // 5. Trim whitespace
  result = result.trim();

  return result;
}

/**
 * Sanitize specific string fields on an object.
 *
 * Returns a shallow copy of `obj` with every field listed in `fields`
 * passed through `sanitizeHtml`.  Non-string fields and fields not present
 * on the object are left untouched.
 *
 * @example
 * ```ts
 * const clean = sanitizeObject(body, ["name", "description"]);
 * ```
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  fields: string[],
): T {
  const copy = { ...obj };

  for (const field of fields) {
    if (field in copy && typeof copy[field] === "string") {
      (copy as Record<string, unknown>)[field] = sanitizeHtml(
        copy[field] as string,
      );
    }
  }

  return copy;
}
