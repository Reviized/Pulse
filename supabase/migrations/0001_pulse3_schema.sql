-- Pulse 3.0 schema, per PULSE3CLAUDECODEMASTERPROMPT Section 5.
-- Applied to a new project under the JMC-linked Supabase account (interim home;
-- migrates to the REViiZED org once ownership is sorted — see build plan).

create extension if not exists "pgcrypto";

-- workspaces: one per Pulse customer org
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- profiles: detected leadership + Pulse team users
create table profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  experience_id uuid,
  name text not null,
  title text,
  bio text,
  headshot_url text,                 -- ALWAYS re-hosted to Supabase Storage, never hotlinked
  source_photo_url text,
  role text check (role in ('Owner','Admin','Editor','Viewer')) default 'Viewer',
  eleven_voice_id text,              -- ElevenLabs voice for this person
  replica_video_url text,            -- rendered REViiZED (or fal) output for this person
  reviized_project_id int,           -- REViiZED-side numeric ids, distinct from the above
  reviized_video_id int,             -- source video on file with REViiZED for this person
  reviized_voice_id int,             -- REViiZED's own voice catalog id, not the ElevenLabs id
  replica_script text,               -- what this person's Digital Replica currently says
  display_order int,
  created_at timestamptz default now()
);

-- experiences: one generated experience per source URL per mode
create table experiences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  source_url text not null,
  company_name text,
  mode text check (mode in ('inform','train','sell')) not null,
  design_spec jsonb,                 -- palette {bg,accent,text} + type {display,case} + shape {corners}
  narrator jsonb,                    -- {profileId, preferredName, name, title, voiceId, videoUrl}
  is_master boolean default false,
  parent_id uuid references experiences(id),
  access_code text default 'REV123',
  pilot_mode boolean default true,
  intro_video_url text,
  replica_path text check (replica_path in ('reviized','fal','noface')) default 'reviized',
  created_at timestamptz default now()
);

alter table profiles add constraint profiles_experience_id_fkey
  foreign key (experience_id) references experiences(id) on delete cascade;

-- slides: six locked layouts, exact order in Slide Manager 3x2 grid:
-- text_only, media_full, split, three_quarter, stats, waveform
create table slides (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid references experiences(id) on delete cascade,
  position int not null,
  label text,
  layout text check (layout in ('text_only','media_full','split','three_quarter','stats','waveform')) not null,
  special text check (special in ('video','team','spotlight','ask') or special is null),
  text_pos text check (text_pos in ('center','upper','lower') or text_pos is null),
  speaker_profile_id uuid references profiles(id),
  eyebrow text, headline text, sig text, body text, script text,
  items jsonb, chips jsonb,
  media_url text, media_kind text check (media_kind in ('image','video') or media_kind is null),
  cohesion jsonb,
  updated_at timestamptz default now()
);

-- training_modules: Train Mode curriculum, generated per experience
create table training_modules (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid references experiences(id) on delete cascade,
  position int not null,
  title text not null,
  objective text not null,
  lesson jsonb,
  key_points jsonb,
  checkpoint jsonb,                  -- {q, options[4], correct: 0-3}
  speaker_profile_id uuid references profiles(id),
  script text,
  media_url text, media_kind text,
  cohesion jsonb,
  updated_at timestamptz default now()
);

-- train_sessions: one per trainee run. Route locks at creation.
create table train_sessions (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid references experiences(id) on delete cascade,
  trainee_email text not null,
  ratings jsonb not null,            -- {module_id: {self:1-5, inferred:1-5, checkpoint:bool|null, note}}
  route_order jsonb not null,        -- locked module id array, weakest inferred first
  signal text,                       -- talent intelligence, Owner/Admin read-only, see RLS below
  pre_interview_insights text,       -- the spoken preliminary read given before the live interview
  pre_interview_questions jsonb,     -- the 4 generated interview questions
  transcript jsonb,                  -- [{q, a}] from the live ElevenLabs Conversational Agent session
  eleven_conversation_id text,       -- ElevenLabs conversation id for this session, for Conversation Analysis lookup
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid references experiences(id),
  email text not null,
  unlocked_at timestamptz default now()
);

create table analytics_events (
  id bigint generated always as identity primary key,
  experience_id uuid references experiences(id),
  session_key text,
  event text not null,               -- view, complete, pp_open, dwell
  slide_ref text,                    -- slide id, or L-{module}, C-{module}, tw, tres
  value int,
  created_at timestamptz default now()
);

create table qa_messages (
  id bigint generated always as identity primary key,
  experience_id uuid references experiences(id),
  session_key text,
  speaker_profile_id uuid references profiles(id),
  role text check (role in ('visitor','replica')),
  content text,
  created_at timestamptz default now()
);

-- replica_jobs: the exact REViiZED job lifecycle, mirrored locally for status and audit
create table replica_jobs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  reviized_job_id int,                -- the id REViiZED returns from POST /v1/jobs/create/
  payload jsonb not null,             -- {project, name, script, video, voice, language, notes, favorite}
  status text check (status in ('HOLD','REQUESTED','IN_PROCESS','FINALIZING','COMPLETE','ERROR')) default 'HOLD',
  output_url text,                    -- populated once GET /v1/jobs/{id}/ reports COMPLETE, re-hosted to Storage
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table build_mocks (
  id bigint generated always as identity primary key,
  feature text not null,
  status text check (status in ('paved','gravel')) not null,
  note text,
  updated_at timestamptz default now()
);

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table workspaces enable row level security;
alter table profiles enable row level security;
alter table experiences enable row level security;
alter table slides enable row level security;
alter table training_modules enable row level security;
alter table train_sessions enable row level security;
alter table leads enable row level security;
alter table analytics_events enable row level security;
alter table qa_messages enable row level security;
alter table replica_jobs enable row level security;
alter table build_mocks enable row level security;

-- Public/anon read access to the tables the client-side experience needs directly.
-- Matches the documented data flow: client reads experiences + slides directly under RLS.
create policy "public read experiences" on experiences for select using (true);
create policy "public read slides" on slides for select using (true);
create policy "public read training_modules" on training_modules for select using (true);
create policy "public read profiles" on profiles for select using (true);
create policy "public read build_mocks" on build_mocks for select using (true);

create policy "public insert leads" on leads for insert with check (true);
create policy "public insert analytics_events" on analytics_events for insert with check (true);
create policy "public insert qa_messages" on qa_messages for insert with check (true);

-- train_sessions: trainee can create/read their own session's non-signal columns are still
-- exposed at the row level by Postgres RLS (RLS is row-level, not column-level), so the
-- signal/transcript column-level restriction is enforced in the API layer (Section 6, /api
-- routes never forward train_sessions.signal or .transcript to a trainee-facing response),
-- not by RLS alone. RLS here restricts row visibility to service-role only; the client never
-- queries train_sessions directly.
create policy "service role only" on train_sessions for all using (auth.role() = 'service_role');
create policy "service role only" on replica_jobs for all using (auth.role() = 'service_role');
create policy "service role only writes profiles" on profiles for insert with check (auth.role() = 'service_role');
create policy "service role only writes experiences" on experiences for insert with check (auth.role() = 'service_role');
create policy "service role only writes slides" on slides for insert with check (auth.role() = 'service_role');
create policy "service role only updates experiences" on experiences for update using (auth.role() = 'service_role');
create policy "service role only updates slides" on slides for update using (auth.role() = 'service_role');
