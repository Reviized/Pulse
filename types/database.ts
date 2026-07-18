/**
 * Pulse 3.0 schema types, hand-authored to match
 * supabase/migrations/0001_pulse3_schema.sql exactly. Replace with a real
 * `supabase gen types typescript` output once CLI/MCP access to the live
 * project is available — until then, keep this file and the migration in
 * lockstep by hand.
 *
 * Uses `type` (not `interface`) throughout: postgrest-js's generic inference
 * for `.insert()`/`.update()` breaks across a multi-table Database when any
 * Row/Insert/Update shape is declared as a nominal `interface` instead of a
 * structural `type` alias. Real `supabase gen types` output uses `type` for
 * the same reason.
 */

export type ExperienceMode = "inform" | "train" | "sell";
export type ReplicaPath = "reviized" | "fal" | "noface";
export type ProfileRole = "Owner" | "Admin" | "Editor" | "Viewer";
export type SlideLayout =
  | "text_only"
  | "media_full"
  | "split"
  | "three_quarter"
  | "stats"
  | "waveform";
export type SlideSpecial = "video" | "team" | "spotlight" | "ask" | null;
export type SlideTextPos = "center" | "upper" | "lower" | null;
export type MediaKind = "image" | "video" | null;
export type ReplicaJobStatus =
  | "HOLD"
  | "REQUESTED"
  | "IN_PROCESS"
  | "FINALIZING"
  | "COMPLETE"
  | "ERROR";
export type BuildMockStatus = "paved" | "gravel";
export type QaRole = "visitor" | "replica";
export type AnalyticsEventName = "view" | "complete" | "pp_open" | "dwell";

export type DesignSpec = {
  palette: { bg: string; accent: string; text: string };
  type: {
    display:
      | "condensed-impact"
      | "geometric-sans"
      | "humanist-sans"
      | "elegant-serif"
      | "mono-tech";
    case: "uppercase" | "title" | "sentence";
    font_family?: string;
  };
  shape: { corners: "pill" | "rounded" | "square" };
};

export type Narrator = {
  profileId: string | null;
  preferredName: string;
  name: string;
  title: string;
  voiceId: string | null;
  videoUrl: string | null;
};

/** Makes K optional (keeping its original, possibly-nullable type) instead of Omit-ing it —
 *  matches real Postgres Insert semantics: nullable columns and columns with a DEFAULT don't
 *  need to be provided, but callers may still pass an explicit null for a nullable one. */
type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Workspace = {
  id: string;
  name: string;
  created_at: string;
};
export type WorkspaceInsert = OptionalKeys<Workspace, "id" | "created_at">;

export type Profile = {
  id: string;
  workspace_id: string | null;
  experience_id: string | null;
  name: string;
  title: string | null;
  bio: string | null;
  headshot_url: string | null;
  source_photo_url: string | null;
  role: ProfileRole;
  eleven_voice_id: string | null;
  replica_video_url: string | null;
  reviized_project_id: number | null;
  reviized_video_id: number | null;
  reviized_voice_id: number | null;
  replica_script: string | null;
  display_order: number | null;
  created_at: string;
};
export type ProfileInsert = OptionalKeys<
  Profile,
  | "id"
  | "created_at"
  | "role"
  | "workspace_id"
  | "experience_id"
  | "title"
  | "bio"
  | "headshot_url"
  | "source_photo_url"
  | "eleven_voice_id"
  | "replica_video_url"
  | "reviized_project_id"
  | "reviized_video_id"
  | "reviized_voice_id"
  | "replica_script"
  | "display_order"
>;

export type Experience = {
  id: string;
  workspace_id: string | null;
  source_url: string;
  company_name: string | null;
  mode: ExperienceMode;
  design_spec: DesignSpec | null;
  narrator: Narrator | null;
  is_master: boolean;
  parent_id: string | null;
  access_code: string;
  pilot_mode: boolean;
  intro_video_url: string | null;
  replica_path: ReplicaPath;
  created_at: string;
};
export type ExperienceInsert = OptionalKeys<
  Experience,
  | "id"
  | "created_at"
  | "is_master"
  | "access_code"
  | "pilot_mode"
  | "replica_path"
  | "workspace_id"
  | "company_name"
  | "design_spec"
  | "narrator"
  | "parent_id"
  | "intro_video_url"
>;

export type Slide = {
  id: string;
  experience_id: string;
  position: number;
  label: string | null;
  layout: SlideLayout;
  special: SlideSpecial;
  text_pos: SlideTextPos;
  speaker_profile_id: string | null;
  eyebrow: string | null;
  headline: string | null;
  sig: string | null;
  body: string | null;
  script: string | null;
  items: unknown[] | null;
  chips: string[] | null;
  media_url: string | null;
  media_kind: MediaKind;
  cohesion: Record<string, unknown> | null;
  updated_at: string;
};
export type SlideInsert = OptionalKeys<
  Slide,
  | "id"
  | "updated_at"
  | "label"
  | "special"
  | "text_pos"
  | "speaker_profile_id"
  | "eyebrow"
  | "headline"
  | "sig"
  | "body"
  | "script"
  | "items"
  | "chips"
  | "media_url"
  | "media_kind"
  | "cohesion"
>;

export type TrainingModuleCheckpoint = {
  q: string;
  options: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
};

export type TrainingModule = {
  id: string;
  experience_id: string;
  position: number;
  title: string;
  objective: string;
  lesson: string[] | null;
  key_points: string[] | null;
  checkpoint: TrainingModuleCheckpoint | null;
  speaker_profile_id: string | null;
  script: string | null;
  media_url: string | null;
  media_kind: string | null;
  cohesion: Record<string, unknown> | null;
  updated_at: string;
};
export type TrainingModuleInsert = OptionalKeys<
  TrainingModule,
  | "id"
  | "updated_at"
  | "lesson"
  | "key_points"
  | "checkpoint"
  | "speaker_profile_id"
  | "script"
  | "media_url"
  | "media_kind"
  | "cohesion"
>;

export type TrainSessionRating = {
  self: number;
  inferred: number | null;
  checkpoint: boolean | null;
  note: string | null;
};

export type TrainSession = {
  id: string;
  experience_id: string;
  trainee_email: string;
  ratings: Record<string, TrainSessionRating>;
  route_order: string[];
  signal: string | null;
  pre_interview_insights: string | null;
  pre_interview_questions: string[] | null;
  transcript: { q: string; a: string }[] | null;
  eleven_conversation_id: string | null;
  completed_at: string | null;
  created_at: string;
};
export type TrainSessionInsert = OptionalKeys<
  TrainSession,
  | "id"
  | "created_at"
  | "signal"
  | "pre_interview_insights"
  | "pre_interview_questions"
  | "transcript"
  | "eleven_conversation_id"
  | "completed_at"
>;

export type Lead = {
  id: string;
  experience_id: string | null;
  email: string;
  unlocked_at: string;
};
export type LeadInsert = OptionalKeys<Lead, "id" | "unlocked_at" | "experience_id">;

export type AnalyticsEvent = {
  id: number;
  experience_id: string | null;
  session_key: string | null;
  event: AnalyticsEventName;
  slide_ref: string | null;
  value: number | null;
  created_at: string;
};
export type AnalyticsEventInsert = OptionalKeys<
  AnalyticsEvent,
  "id" | "created_at" | "experience_id" | "session_key" | "slide_ref" | "value"
>;

export type QaMessage = {
  id: number;
  experience_id: string | null;
  session_key: string | null;
  speaker_profile_id: string | null;
  role: QaRole;
  content: string | null;
  created_at: string;
};
export type QaMessageInsert = OptionalKeys<
  QaMessage,
  "id" | "created_at" | "experience_id" | "session_key" | "speaker_profile_id" | "role" | "content"
>;

export type ReplicaJobPayload = {
  project: number | null;
  name: string;
  script: string;
  video: number | null;
  voice: number | null;
  language?: string;
  notes?: string;
  favorite?: boolean;
};

export type ReplicaJob = {
  id: string;
  profile_id: string | null;
  reviized_job_id: number | null;
  payload: ReplicaJobPayload;
  status: ReplicaJobStatus;
  output_url: string | null;
  created_at: string;
  updated_at: string;
};
export type ReplicaJobInsert = OptionalKeys<
  ReplicaJob,
  "id" | "created_at" | "updated_at" | "status" | "profile_id" | "reviized_job_id" | "output_url"
>;

export type BuildMock = {
  id: number;
  feature: string;
  status: BuildMockStatus;
  note: string | null;
  updated_at: string;
};
export type BuildMockInsert = OptionalKeys<BuildMock, "id" | "updated_at" | "note">;

export type Database = {
  public: {
    Tables: {
      workspaces: { Row: Workspace; Insert: WorkspaceInsert; Update: Partial<WorkspaceInsert>; Relationships: [] };
      profiles: { Row: Profile; Insert: ProfileInsert; Update: Partial<ProfileInsert>; Relationships: [] };
      experiences: { Row: Experience; Insert: ExperienceInsert; Update: Partial<ExperienceInsert>; Relationships: [] };
      slides: { Row: Slide; Insert: SlideInsert; Update: Partial<SlideInsert>; Relationships: [] };
      training_modules: { Row: TrainingModule; Insert: TrainingModuleInsert; Update: Partial<TrainingModuleInsert>; Relationships: [] };
      train_sessions: { Row: TrainSession; Insert: TrainSessionInsert; Update: Partial<TrainSessionInsert>; Relationships: [] };
      leads: { Row: Lead; Insert: LeadInsert; Update: Partial<LeadInsert>; Relationships: [] };
      analytics_events: { Row: AnalyticsEvent; Insert: AnalyticsEventInsert; Update: Partial<AnalyticsEventInsert>; Relationships: [] };
      qa_messages: { Row: QaMessage; Insert: QaMessageInsert; Update: Partial<QaMessageInsert>; Relationships: [] };
      replica_jobs: { Row: ReplicaJob; Insert: ReplicaJobInsert; Update: Partial<ReplicaJobInsert>; Relationships: [] };
      build_mocks: { Row: BuildMock; Insert: BuildMockInsert; Update: Partial<BuildMockInsert>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
