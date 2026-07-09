import { createClient } from "@/lib/supabase/client";
import type { AnalyticsEventType } from "@/types/database";

/**
 * Best-effort engagement write. PROVISIONAL: analytics_events' exact column
 * set beyond event_type is not confirmed against the live schema yet.
 * Never throws — a failed analytics write must not break slide viewing.
 */
export async function logAnalyticsEvent(
  experienceId: string,
  eventType: AnalyticsEventType,
  slideId?: string
) {
  try {
    const supabase = createClient();
    await supabase.from("analytics_events").insert({
      experience_id: experienceId,
      slide_id: slideId ?? null,
      event_type: eventType,
    });
  } catch {
    // non-blocking
  }
}
