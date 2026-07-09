/**
 * Calls the deployed `pulse-experiences` edge function directly (public,
 * JWT verification off per the Bolt report). PROVISIONAL: the exact
 * request/response contract has not been confirmed against the real
 * function source yet (blocked on network access to pull it via
 * `supabase functions download`). The payload shape below is a best guess
 * from the documented data flow ("User submits URL + mode via UI which
 * calls pulse-experiences (creates row in experiences)") — verify and
 * adjust once the real source lands.
 */
export async function createExperience(input: {
  source_url: string;
  mode: "inform" | "train" | "sell";
}): Promise<{ id: string }> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/pulse-experiences`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(`pulse-experiences returned ${res.status}: ${await res.text()}`);
  }

  return res.json();
}
