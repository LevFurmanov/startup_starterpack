-- orc ticketing store, Postgres option. Draft v0.2, 2026-11-02.
-- Applied by `orc store migrate`. The markdown vault stays the default store;
-- this schema is the optional backend for teams, hosted dashboards and SQL.
-- One database = one project. Shape follows Lev's reference diagram minus
-- tenants: tasks, event-sourced task state, agent sessions and turns,
-- sources and outputs, maintenance.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Maintenance
-- ---------------------------------------------------------------------------
create table schema_migrations (
  version     text primary key,
  applied_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table tasks (
  id              uuid primary key default gen_random_uuid(),
  external_key    text not null unique,             -- T-012, the id humans use
  merged_into_id  uuid references tasks(id),        -- set when a duplicate is folded in
  title           text not null,
  type            text not null default 'feature',  -- feature | fix | chore
  size            text,                             -- S | M | L
  status          text not null default 'queued',   -- mirrors task_current_state.status
  branch          text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  merged_at       timestamptz,
  closed_at       timestamptz
);
create index tasks_status on tasks(status);

create table task_links (                           -- depends_on, relates_to, duplicates
  task_id       uuid not null references tasks(id),
  other_task_id uuid not null references tasks(id),
  relation      text not null,                      -- blocks | relates | duplicates
  primary key (task_id, other_task_id, relation)
);

create table task_merges (                          -- audit of folding one task into another
  id                uuid primary key default gen_random_uuid(),
  parent_task_id    uuid not null references tasks(id),
  source_task_id    uuid not null references tasks(id),
  reason            text,
  merged_by_turn_id uuid,                           -- fk added after turns exists
  created_at        timestamptz not null default now()
);

create table intake_candidates (                    -- things that arrive from outside and may become a task
  id            uuid primary key default gen_random_uuid(),
  channel       text not null,                      -- cli | discord | slack | github | email
  external_id   text not null,                      -- message id, issue number, call id
  task_id       uuid references tasks(id),          -- set once linked or merged
  payload       jsonb not null default '{}',
  received_at   timestamptz not null default now(),
  resolved_at   timestamptz,
  unique (channel, external_id)
);

-- ---------------------------------------------------------------------------
-- Task state, event-sourced
-- task_events is the log file. task_state_revisions is every version of the
-- spec frontmatter. task_current_state points at the live one.
-- ---------------------------------------------------------------------------
create table task_events (
  id                  uuid primary key default gen_random_uuid(),
  task_id             uuid not null references tasks(id),
  turn_id             uuid,                         -- fk added after turns exists
  supersedes_event_id uuid references task_events(id),
  event_type          text not null,                -- created | asked | answered | dispatched | checked | reviewed | fixed | merged | undone | needs_you | failed | cost | lesson
  actor               text not null,                -- cli | human | agent:scout | agent:worker | agent:reviewer
  payload             jsonb not null default '{}',
  message             text,                         -- one plain-words line for the log and the dashboard
  created_at          timestamptz not null default now()
);
create index task_events_task_time on task_events(task_id, created_at);

create table task_state_revisions (
  id                    uuid primary key default gen_random_uuid(),
  task_id               uuid not null references tasks(id),
  version               integer not null,
  derived_from_turn_id  uuid,
  status                text not null,
  size                  text,
  type                  text,
  title                 text not null,
  branch                text,
  spec_md               text,                       -- goal, acceptance criteria, out of scope, how to verify
  acceptance            jsonb not null default '[]',-- [{id:"AC1", text, verdict}]
  decisions             jsonb not null default '[]',-- [{q, a, default_used}]
  models                jsonb not null default '{}',-- {scout, worker, reviewer}
  tokens                jsonb not null default '{}',-- {scout, worker, reviewer} input+output
  cost_usd              numeric(12,4) not null default 0,
  review_rounds         integer not null default 0,
  checks                text,                       -- pass | fail | none
  summary               text,                       -- plain words, for the done card
  try_it                jsonb not null default '[]',
  worktree              text,
  engine                text,                       -- subagent | headless
  created_by            text not null,              -- cli | human | agent:*
  created_at            timestamptz not null default now(),
  unique (task_id, version)
);

create table task_current_state (
  task_id             uuid primary key references tasks(id),
  state_revision_id   uuid not null references task_state_revisions(id),
  updated_at          timestamptz not null default now()
);

-- Lessons. key is the L-### id, version increments on every edit or promotion.
create table knowledge_entries (
  id                uuid primary key default gen_random_uuid(),
  key               text not null,                  -- L-031
  version           integer not null,
  source_id         uuid,                           -- fk to sources, added below
  tier              text not null default 'reference', -- reference | guide | enforce
  rule              text not null,                  -- negative constraint preferred
  trigger           text,                           -- what happened
  scope             text,                           -- path glob or role
  check_cmd         text,                           -- optional command or hook pattern
  confidence        numeric(3,2) not null default 0.60,
  trigger_count     integer not null default 0,
  last_triggered_at timestamptz,
  status            text not null default 'active', -- active | rejected | decayed
  created_at        timestamptz not null default now(),
  unique (key, version)
);

-- ---------------------------------------------------------------------------
-- Sessions and turns
-- One agent_session per Claude Code session or headless run. One turn per
-- assistant message. turn_items are the tool calls and messages inside it.
-- transcript_cursors lets the accounting hook read a transcript incrementally.
-- ---------------------------------------------------------------------------
create table agent_sessions (
  id                   uuid primary key default gen_random_uuid(),
  external_session_id  text not null unique,        -- Claude Code session_id or agent_id
  active_task_id       uuid references tasks(id),
  role                 text not null,               -- control | scout | worker | reviewer
  model                text,
  engine               text,                        -- interactive | subagent | headless
  worktree             text,
  max_turns            integer,
  budget_usd           numeric(12,4),
  status               text not null default 'running', -- running | done | stalled | killed | failed
  started_at           timestamptz not null default now(),
  ended_at             timestamptz
);

create table turns (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references agent_sessions(id),
  primary_task_id    uuid references tasks(id),
  turn_number        integer not null,
  model              text,
  input_tokens       bigint not null default 0,
  output_tokens      bigint not null default 0,
  cache_read_tokens  bigint not null default 0,
  cache_write_tokens bigint not null default 0,
  cost_usd           numeric(12,6) not null default 0,
  stop_reason        text,
  started_at         timestamptz,
  ended_at           timestamptz,
  unique (session_id, turn_number)
);

create table turn_items (
  id          bigint generated always as identity primary key,
  turn_id     uuid not null references turns(id),
  sequence    integer not null,
  kind        text not null,                        -- text | tool_use | tool_result | thinking
  tool_name   text,
  payload     jsonb not null default '{}',          -- tool input or a trimmed result, never a secret
  tokens      integer,
  blocked     boolean not null default false,       -- a hook denied it
  deny_reason text,
  created_at  timestamptz not null default now(),
  unique (turn_id, sequence)
);

create table transcript_cursors (
  session_id       uuid primary key references agent_sessions(id),
  transcript_path  text not null,
  byte_offset      bigint not null default 0,
  line_number      integer not null default 0,
  last_read_at     timestamptz
);

alter table task_events  add constraint task_events_turn_fk  foreign key (turn_id) references turns(id);
alter table task_merges  add constraint task_merges_turn_fk  foreign key (merged_by_turn_id) references turns(id);
alter table task_state_revisions add constraint tsr_turn_fk  foreign key (derived_from_turn_id) references turns(id);

-- ---------------------------------------------------------------------------
-- Sources and outputs
-- sources are inputs a task was built from. reports are what agents produced.
-- memory_jobs is the queue the lessons loop and the dashboard run on.
-- ---------------------------------------------------------------------------
create table sources (
  id                 uuid primary key default gen_random_uuid(),
  kind               text not null,                 -- file | url | repo_path | issue | conversation | attachment
  locator            text not null,
  title              text,
  content_hash       text,
  metadata           jsonb not null default '{}',
  created_by_turn_id uuid references turns(id),
  created_at         timestamptz not null default now()
);

alter table knowledge_entries add constraint knowledge_source_fk foreign key (source_id) references sources(id);

create table task_sources (
  task_id          uuid not null references tasks(id),
  source_id        uuid not null references sources(id),
  relation         text not null,                   -- origin | spec | evidence | attachment
  added_by_turn_id uuid references turns(id),
  note             text,
  created_at       timestamptz not null default now(),
  primary key (task_id, source_id, relation)
);

create table reports (
  id           uuid primary key default gen_random_uuid(),
  turn_id      uuid references turns(id),
  task_id      uuid references tasks(id),
  report_type  text not null,                       -- scout | review | proof | simplify | done_card | weekly
  version      integer not null default 1,
  model        text,
  body_md      text not null,
  data         jsonb not null default '{}',         -- findings per acceptance id, verdicts, commands run
  tokens       bigint,
  cost_usd     numeric(12,6),
  created_at   timestamptz not null default now(),
  unique (task_id, report_type, version)
);

create table memory_jobs (
  id           uuid primary key default gen_random_uuid(),
  turn_id      uuid references turns(id),
  task_id      uuid references tasks(id),
  job_type     text not null,                       -- extract_lessons | dedupe | promote | decay | dashboard | mirror_vault
  status       text not null default 'queued',      -- queued | running | done | failed
  attempts     integer not null default 0,
  payload      jsonb not null default '{}',
  result       jsonb,
  error        text,
  scheduled_at timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz,
  unique (turn_id, task_id, job_type)
);

-- ---------------------------------------------------------------------------
-- Views the dashboard and `orc status` read
-- ---------------------------------------------------------------------------
create view v_board as
select t.external_key, t.title, t.type, r.size, r.status,
       r.cost_usd, r.review_rounds, r.checks, r.summary, t.created_at, t.merged_at
from tasks t
join task_current_state c on c.task_id = t.id
join task_state_revisions r on r.id = c.state_revision_id;

create view v_cost_by_model as
select s.role, coalesce(tu.model, s.model) as model,
       count(distinct s.active_task_id) as tasks,
       sum(tu.input_tokens) as input_tokens, sum(tu.output_tokens) as output_tokens,
       sum(tu.cache_read_tokens) as cache_read_tokens, sum(tu.cost_usd) as cost_usd
from agent_sessions s
join turns tu on tu.session_id = s.id
group by s.role, coalesce(tu.model, s.model);

insert into schema_migrations(version) values ('0001_initial');
