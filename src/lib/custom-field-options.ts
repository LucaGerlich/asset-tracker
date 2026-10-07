/**
 * Parse the stored options of a custom field into a list of choices.
 *
 * The column is plain text. The admin API writes a JSON array of strings, but
 * older rows (and hand-written ones) may hold a comma-separated list. A value
 * that is valid JSON but not an array, such as "5", is treated as a
 * comma-separated list too, and a malformed value never throws.
 */
export function parseCustomFieldOptions(
  raw: string | null | undefined,
): string[] {
  if (!raw || raw.trim() === "") return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter(
          (option): option is string | number =>
            typeof option === "string" || typeof option === "number",
        )
        .map((option) => String(option).trim())
        .filter(Boolean);
    }
  } catch {
    // Not JSON: fall through to the comma-separated format.
  }

  return raw
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean);
}
