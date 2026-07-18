import { createClient } from "@/lib/supabase/client";
import type { AnalyticsEventName } from "@/types/database";

/**
 * Best-effort engagement write, batched client-side per Section 6/#6 of the
 * master prompt (dwell flushed every 10s by the caller, not per-scroll).
 * Never throws — a failed analytics write must not break slide viewing.
 */
export async function logAnalyticsEvent(
  experienceId: string,
  event: AnalyticsEventName,
  slideRef?: string,
  value?: number
) {
  try {
    const supabase = createClient();
    await supabase.from("analytics_events").insert({
      experience_id: experienceId,
      slide_ref: slideRef ?? null,
      event,
      value: value ?? null,
    });
  } catch {
    // non-blocking
  }
}
