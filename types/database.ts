/**
 * PROVISIONAL types, hand-derived from the Bolt backend report (2026-07-04) since
 * this sandbox cannot reach vcyyyaannoeuuswohlvf.supabase.co to run
 * `supabase gen types typescript`. Only the two v3 pipeline tables this phase
 * touches are modeled; legacy v1 pulse_* tables are intentionally omitted.
 *
 * Replace this file with a real CLI-generated one as soon as network/CLI
 * access to the Supabase project is available — column types and nullability
 * here are best-effort guesses, not verified against the live schema.
 *
 * Uses `type` (not `interface`) throughout: postgrest-js 2.110's generic
 * inference for `.insert()`/`.update()` breaks across a multi-table Database
 * when any Row/Insert/Update shape is declared as a nominal `interface`
 * instead of a structural `type` alias (reproduced in isolation; not
 * specific to this schema). Real `supabase gen types` output uses `type` for
 * the same reason.
 */

export type ExperienceMode = "inform" | "train" | "sell";
export type ExperienceStatus = "draft" | "active" | "master";

export type SlideLayoutType =
  | "text_only"
  | "media_full"
  | "split"
  | "three_quarter"
  | "stats"
  | "waveform";

export type TalkingHeadPath = "reviized" | "fal_generate" | "no_face";

export type Experience = {
  id: string;
  name: string | null;
  company_name: string | null;
  source_url: string | null;
  mode: ExperienceMode;
  status: ExperienceStatus;
  scrape_data: Record<string, unknown> | null;
  content_categories: string[] | null;
  executives: Record<string, unknown> | null;
  enriched_content: Record<string, unknown> | null;
  brand_logo_url: string | null;
  brand_colors: Record<string, unknown> | null;
  design_spec: Record<string, unknown> | null;
  creative_brief: Record<string, unknown> | null;
  intro_video_url: string | null;
  scrape_completed_at: string | null;
  brief_generated_at: string | null;
  slides_generated_at: string | null;
  created_at: string;
};

export type Slide = {
  id: string;
  experience_id: string;
  layout_type: SlideLayoutType;
  eyebrow: string | null;
  headline: string | null;
  body: string | null;
  sig: string | null;
  items: Record<string, unknown> | null;
  chips: string[] | null;
  script_text: string | null;
  audio_url: string | null;
  talking_head_path: TalkingHeadPath | null;
  talking_head_status: string | null;
  video_url: string | null;
  reviized_job_id: string | null;
  assigned_exec_id: string | null;
  content_source_category: string | null;
  cohesion: Record<string, unknown> | null;
  created_at: string;
};

export type AnalyticsEventType = "view" | "complete" | "pp_open" | "dwell";

export type AnalyticsEvent = {
  id: string;
  experience_id: string;
  slide_id: string | null;
  event_type: AnalyticsEventType;
  created_at: string;
};

export type ExperienceInsert = {
  id?: string;
  name?: string | null;
  company_name?: string | null;
  source_url?: string | null;
  mode: ExperienceMode;
  status: ExperienceStatus;
  scrape_data?: Record<string, unknown> | null;
  content_categories?: string[] | null;
  executives?: Record<string, unknown> | null;
  enriched_content?: Record<string, unknown> | null;
  brand_logo_url?: string | null;
  brand_colors?: Record<string, unknown> | null;
  design_spec?: Record<string, unknown> | null;
  creative_brief?: Record<string, unknown> | null;
  intro_video_url?: string | null;
  scrape_completed_at?: string | null;
  brief_generated_at?: string | null;
  slides_generated_at?: string | null;
  created_at?: string;
};

export type SlideInsert = {
  id?: string;
  experience_id: string;
  layout_type: SlideLayoutType;
  eyebrow?: string | null;
  headline?: string | null;
  body?: string | null;
  sig?: string | null;
  items?: Record<string, unknown> | null;
  chips?: string[] | null;
  script_text?: string | null;
  audio_url?: string | null;
  talking_head_path?: TalkingHeadPath | null;
  talking_head_status?: string | null;
  video_url?: string | null;
  reviized_job_id?: string | null;
  assigned_exec_id?: string | null;
  content_source_category?: string | null;
  cohesion?: Record<string, unknown> | null;
  created_at?: string;
};

export type AnalyticsEventInsert = {
  id?: string;
  experience_id: string;
  slide_id?: string | null;
  event_type: AnalyticsEventType;
  created_at?: string;
};

export type Database = {
  public: {
    Tables: {
      experiences: {
        Row: Experience;
        Insert: ExperienceInsert;
        Update: Partial<ExperienceInsert>;
        Relationships: [];
      };
      slides: {
        Row: Slide;
        Insert: SlideInsert;
        Update: Partial<SlideInsert>;
        Relationships: [];
      };
      analytics_events: {
        Row: AnalyticsEvent;
        Insert: AnalyticsEventInsert;
        Update: Partial<AnalyticsEventInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
