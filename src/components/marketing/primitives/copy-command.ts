export type CopyResult = "copied" | "unsupported" | "failed";

// navigator.clipboard is undefined on insecure origins (e.g. a self-hosted
// install on http://<lan-ip>), and writeText rejects when permission is denied.
export async function copyText(
  text: string,
  clipboard: Pick<Clipboard, "writeText"> | undefined,
): Promise<CopyResult> {
  if (!clipboard) return "unsupported";
  try {
    await clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
