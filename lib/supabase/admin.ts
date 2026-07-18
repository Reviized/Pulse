import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role client. Bypasses RLS entirely — every write in the schema
 * (experiences, slides, training_modules, leads, analytics_events, ...) is
 * service-role-only by design (Section 5's RLS rules), so this is the only
 * client capable of performing them. Server-only: importing this from a
 * client component would leak the service key into the browser bundle.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
