/**
 * Every shared lib/data/* read helper this Admin surface calls into throws
 * on a real Supabase error, by documented convention ("throw on real
 * errors, return [] on empty"). A real error here can legitimately include
 * the Supabase host itself being outside this sandbox's network egress
 * allowlist (observed directly in this environment: "Host not in
 * allowlist: <project>.supabase.co"). Per the gravel road philosophy
 * (Section 4 / CLAUDE.md), that must degrade to an honest inline message,
 * never a crashed page — this wraps any such call site-by-site so each page
 * can render DataUnavailable instead of hitting Next's generic 500.
 */
/**
 * Not every thrown value here is an Error instance — supabase-js can throw
 * (or reject with) a plain PostgrestError-shaped object, and the sandbox's
 * network proxy has been observed throwing its own plain object on a
 * disallowed host. Fall through to any string .message before giving up.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return "unknown error";
}

export async function safeLoad<T>(fn: () => Promise<T>): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (err) {
    return { data: null, error: errorMessage(err) };
  }
}
