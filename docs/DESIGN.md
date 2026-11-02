# Design: a gate-free development orchestrator for Claude Code

Status: draft v2.1, 2026-11-02. Supersedes the gated design discussed on 2026-10-29. v2.1 adds vault-first storage with a Postgres option and the `orc explain` system design in `SYSTEM-DESIGN.md`.
Working CLI name: `orc`. Product name and license are open.

## 1. What it is in one paragraph

You tell it what you want. It asks you at most three easy questions, each with a recommended answer, and you can say "go" to skip them. It then builds the change in an isolated copy of your project, checks its own work with a second, independent agent, merges one revertible commit, and shows you a dashboard with what changed, how to try it, what it cost and what it learned. It never stops to ask for approval except for three security reasons: a secret, a destructive command, or anything that touches production. It runs inside Claude Code as a plugin, so a Max or Pro subscription is enough.

## 2. The loop as the user sees it

1. `/orc add a login page` or just describe the change in plain words.
2. Up to three questions appear, phrased as outcomes, each with options and a default. Answer, or type "go".
3. A card appears: ticket id, size, what will be built, assumptions made.
4. Work happens in the background. The user can keep talking or close the terminal.
5. A done card appears and the dashboard updates: what changed in plain words, how to try it, cost, checks that ran, review verdict, one thing learned.
6. If the system needs something only the user can do, the ticket goes to `needs-you` with one plain question. That is a request, not a gate.

Undo is always one command: `orc undo T-012` reverts that ticket's merge commit.

## 3. The loop as the backend runs it

| Step | Who | Model | Output |
|---|---|---|---|
| Intake | control (the user's session, forked skill) | user's session model | ticket file created by `orc new`, status `asking` |
| Scout | scout agent | Haiku | files that matter, existing answers, matching reference lessons, proposed size class |
| Questions | control | session model | at most three, via the question tool, answers written as decisions in the ticket |
| Spec | control | session model | short spec: goal, acceptance criteria with ids, out of scope, how to verify |
| Dispatch | `orc dispatch` | none | branch, worktree, dispatch prompt, budget, turn cap, status `building` |
| Build | worker agent | Sonnet for S and M, Opus for L | commits on the ticket branch, worker log, self-check output |
| Check | `orc check` | none | the project's check command plus the smoke suite, must pass |
| Review | reviewer agent, read-only | Opus for M and L, skipped for S | findings per acceptance criterion, proof pass, lesson candidates |
| Fix | worker agent | same as build | at most two rounds, then `needs-you` |
| Merge | `orc merge` | none | rebase, check again, fast-forward, one commit, worktree removed |
| Account | hook | none | tokens and cost per agent written to the ticket by the harness |
| Learn | `orc lessons apply` | none | candidates deduped and filed, promotions applied |
| Report | `orc dashboard` | none | dashboard regenerated, done card text produced |

Control never reads the worker's log. It reads the spec and the review findings.

## 4. What replaces each human gate

| vectornews today | This design |
|---|---|
| Gate 1: Lev approves the spec | Three easy questions with defaults. Assumptions are recorded and shown. |
| Gate 2: Lev approves the merge | Independent reviewer, proof pass, checks must pass, auto-merge, one-command undo. |
| Lev approves each lesson via /lessons | Automatic tiering with dedupe and decay. The user can veto after the fact. |
| Lev types tokens into a table | A hook writes tokens and cost from the harness. |
| Control writes CURRENT.md by hand | `orc` writes `state.json` on every transition. A session restart loses nothing. |
| Lev reads a 1,000-line ticket | Spec and log are separate files. Agents load the spec only. |

## 5. The only pauses: security

All three are one hook with a pattern list the user can read and edit in `orc.yaml`.

1. **Secrets.** Deny rules on `.env*`, `*secret*`, `*credential*`, `*.pem`, `*.key`, `id_rsa*`. A deny on Read also blocks Edit and Write. When a task needs a secret, the ticket goes to `needs-you` with the variable name and where to put it. No agent ever sees the value.
2. **Destructive commands.** Force push, history rewrite, branch deletion, `reset --hard`, `clean -fdx`, `rm -rf` outside the worktree, dropping tables, migration resets. Interactive: ask. Background: deny and `needs-you`.
3. **Production.** Deploy, publish, push to a remote other than the ticket branch, SSH to a host, anything in the user's `production:` list. Same treatment.

Everything else is allowed. The worker runs with a turn cap and a budget cap, inside its own worktree, and cannot touch `main`.

## 6. Where the token savings come from

Each item is a mechanism, not advice. The vectornews evidence that motivated it is in brackets.

1. **The expensive model only thinks.** Spec and questions use the session model. Scouting is Haiku. Building is Sonnet unless the size is L. [Control was Fable doing clerical work.]
2. **Right-sized ceremony.** Size S skips the reviewer and runs checks only. M gets a bug pass. L gets bug, proof and simplify passes. [Review cost more than build on T-012, 1.79M vs 1.71M tokens.]
3. **Spec and log split.** A worker reads a spec of under 60 lines and the last findings, never the diary. [Longest ticket 1,024 lines, read in full by every agent.]
4. **Scout before build.** A Haiku pass lists the files that matter, so the worker does not explore. [Workers re-discovered the repo on every ticket.]
5. **Reviewer is read-only and bounded.** Findings only, no commits, at most two fix rounds. [Four rounds on T-012, reviewer commits caused branch divergence.]
6. **Fresh context per agent, nothing resident.** Control never carries worker context. Lessons are injected per ticket by scope, not loaded globally. [Context files cost about 20% more tokens without raising success, Gloaguen et al.]
7. **Caps.** Turn cap and budget cap per dispatch, stall kill after idle minutes. [Safe-stop at 60% budget existed only as a rule.]
8. **No model writes reports.** Board, metrics, cost, done-card skeleton and state are produced by scripts. [Build-log churn was 123 of 558 commits.]

The dashboard shows cost and review rounds per model so the routing defaults can be tuned from data rather than asserted.

## 7. Where the effectiveness comes from

1. **Proof, not claims.** The reviewer's proof pass re-runs the verification steps from the spec and quotes the output. "A new check must be watched to fail" is kept.
2. **Checks that grow.** `orc init` detects the project's check command. If there is none, every ticket must add one small smoke check. Every bug found in review adds one.
3. **Lessons that close the loop.** See section 9. No human step is required for a lesson to start helping.
4. **Dependencies and readiness.** `depends_on:` in the ticket and `orc ready` lists what can start now.
5. **Durable state.** `state.json` plus the ticket files are the whole state. Compaction and restarts cost nothing.
6. **Shipped operational lessons.** About 45 lessons from vectornews that are about running agents ship as defaults: hooks where enforceable, short negative rules where not.

## 8. The ticket

Tickets live in the vault by default, under `vault/Tickets/`, two files per ticket. With the Postgres store the same fields are rows and the vault files are a rendered mirror. See section 12.

`T-012-login-page.md` is the spec and is the only file agents load.

```yaml
---
id: T-012
title: Login page
status: queued | asking | building | checking | reviewing | fixing | merged | needs-you | failed
size: S | M | L
type: feature | fix | chore
created: 2026-10-29T14:02:00Z
merged:
depends_on: []
branch: orc/T-012
decisions:
  - q: Should people stay signed in after closing the browser?
    a: Yes, for 30 days
    default_used: false
models: { scout: haiku, worker: sonnet, reviewer: opus }
tokens: { scout: 0, worker: 0, reviewer: 0 }
cost_usd: 0
review_rounds: 0
checks: pass | fail | none
summary: ""
try_it: []
---
## Goal
## Acceptance criteria
- AC1 ...
- AC2 ...
## Out of scope
## How to verify
```

`T-012.log.md` is append-only. Hooks and agents write events there: dispatches, worker notes, review findings, fix rounds, merge, cost. Nobody loads it unless a human opens it.

## 9. Lessons

A lesson has a trigger, a rule written as a negative constraint, a scope, an optional check, a confidence, and a trigger count.

Three tiers.

- **Reference.** Never loaded globally. The scout injects lessons whose scope matches the ticket's files. Every reviewer candidate lands here automatically after dedupe.
- **Guide.** Short rules in path-scoped rules files with a hard cap per file. A reference lesson is promoted when it is triggered a second time. When the cap is hit, the least recently triggered rule falls back to reference.
- **Enforce.** A lesson with a check that was violated twice becomes a hook entry or a smoke check, generated from a template. The done card says so.

The user can veto any promotion with `orc lesson reject L-031`. Nothing waits for them.

## 10. The dashboard

`orc dashboard` writes one self-contained HTML file to `vault/Dashboard.html` and can open it. No server, no dependencies, works from a file URL, committed so it can be hosted on GitHub Pages. Regenerated by a hook after every ticket transition.

Views:

- **Board.** Columns by status. Cards show id, title, size, cost, and a `needs-you` badge when the system is waiting.
- **Ticket.** Plain-words summary, how to try it, decisions made, acceptance criteria with the review verdict per criterion, checks output, cost per agent, link to the log.
- **Cost.** Tokens and cost per ticket, per model, per week. Review rounds and reopened tickets per model.
- **Lessons.** The three tiers, trigger counts, what was promoted and when, veto instructions.
- **Health.** Last check run, open `needs-you` items, tickets merged this week, median time from prompt to merge.

## 11. The plugin

```
orc/
  .claude-plugin/plugin.json
  skills/orc/SKILL.md           # the control flow: intake, scout, questions, spec, dispatch, report
  skills/questions/SKILL.md     # the question guidelines, loaded by the control skill
  agents/scout.md               # Haiku, read-only
  agents/worker.md              # isolation worktree, maxTurns, tools limited to the worktree
  agents/reviewer.md            # read-only, findings only
  hooks/hooks.json              # security, git guards, accounting, dashboard, state
  bin/orc                       # the CLI, Node, no dependencies
  templates/                    # ticket, lesson, rules file, orc.yaml, dashboard
  lessons/                      # the shipped defaults
  storage/schema.sql            # the Postgres option, applied by `orc store migrate`
```

Install for a user: add the marketplace, install the plugin, run `/orc init`. Then describe a change.

A user's project gets:

```
orc.yaml               # project name, store, check command, models, caps, security lists
vault/                 # Obsidian-compatible, committed
  Home.md              # generated: status, needs-you list, links
  Board.md             # generated markdown board
  Dashboard.html       # generated dashboard
  Tickets/             # T-012-login-page.md and T-012-login-page.log.md
  Lessons/             # L-031-....md
  Reports/             # scout, review, proof and done-card reports per ticket
  Decisions.md         # generated index of every answered question
  _templates/
.orc/state.json        # coordinator state, written by the CLI only
.claude/rules/         # guide-tier lessons, path-scoped
.claude/settings.json  # deny rules for secret files, merged in by `orc init`
CLAUDE.md              # ten lines appended: route build requests to /orc
```

Everything in the vault is plain markdown. Obsidian opens it as is, and nothing requires it.

## 12. Storage: vault by default, Postgres as an option

The CLI owns persistence behind one store interface. Agents never talk to the store. They read a rendered markdown spec and write through `orc` commands, so the backend can change without touching a prompt.

**Vault store, the default.** The markdown files in `vault/` are the truth. Spec frontmatter is the current state, the log file is the event stream, lesson files are the knowledge entries, and `.orc/state.json` holds the sessions in flight. Zero setup, works offline, diffs in git, opens in Obsidian.

**Postgres store, opt in.** `orc store postgres` applies `plugins/orc/storage/schema.sql` and sets `store: postgres` in `orc.yaml`. Postgres becomes the truth and the vault becomes a rendered mirror, regenerated by the `mirror_vault` job, so Obsidian and git history keep working. One database is one project. The tenants table from the reference diagram is left out: the framework manages one project per repository, and running several projects from one session is not a feature. The connection string is read by the CLI from an environment variable named in `orc.yaml`, never by an agent, which keeps the secrets rule intact. The adapter talks through the `psql` client so the plugin carries no npm dependency, and uses a `pg` driver when the project already has one.

Why anyone opts in: several people or machines on one project, a hosted dashboard, SQL over cost and review data, or an inbox such as Discord, Slack or GitHub issues feeding `intake_candidates`.

The schema follows the reference diagram in five groups. It applied clean on Postgres 16 on 2026-11-02: 17 tables, 2 views.

| Group | Tables | Vault equivalent |
|---|---|---|
| Tasks | tasks, task_links, task_merges, intake_candidates | spec frontmatter, `depends_on`, duplicates, none |
| Task state, event-sourced | task_events, task_state_revisions, task_current_state, knowledge_entries | log file, git history of the spec, spec frontmatter, lesson files |
| Sessions and turns | agent_sessions, turns, turn_items, transcript_cursors | `state.json`, the cost line, none, none |
| Sources and outputs | sources, task_sources, reports, memory_jobs | links in the spec, `Reports/`, none |
| Maintenance | schema_migrations | none |

The Discord-specific candidate table in the reference becomes the channel-agnostic `intake_candidates`, so any inbox can feed tickets. Commands: `orc store status`, `orc store migrate`, `orc store import` loads an existing vault into Postgres, `orc store export` writes a vault from Postgres.

## 13. The question guidelines

The question step is the one place the user is involved, so it has its own short skill.

1. Ask only when the answer changes what gets built.
2. Never ask what the scout can answer from the code.
3. At most three questions. Each has two to four options and a recommended default.
4. Phrase every question as an outcome a non-engineer can judge. "Should people stay signed in after closing the browser?" not "JWT or session cookie?"
6. "Go" or "you decide" means use the defaults. Record every default used as an assumption and show them on the done card.
7. Never ask about secrets. Name the variable and where it goes, then continue.

## 14. Hooks and what each one enforces

| Event | Does |
|---|---|
| PreToolUse Read, Edit, Write | secret path deny, worker writes outside its worktree denied, ticket spec and `state.json` writable by the CLI only |
| PreToolUse Bash | destructive and production patterns: ask or deny, `git` on `main` from an agent denied, `git add -A` denied while worktrees exist |
| SubagentStop | parse the agent transcript for usage, write tokens and cost to the ticket, append the log, advance state |
| Stop | regenerate the dashboard if any ticket changed |
| SessionStart | inject a five-line status from `state.json` so control resumes without reading anything else |
| UserPromptSubmit | if a ticket is in `needs-you` or `asking`, remind control once |

Dispatch engine is decided on day one by a spike: subagents through the Agent tool with native worktree isolation, or headless `claude -p` runs launched by the CLI, which return usage and cost in JSON and enforce a budget flag. The headless route gives cleaner accounting and true background work. The spike checks that a nested headless run works inside a Claude Code session on Windows and macOS. Whichever loses remains available behind `engine:` in `orc.yaml`.

## 15. Levels

- **Level 0, default.** Everything above, one ticket building at a time, one worker, one reviewer, one scout.
- **Level 1.** Parallel tickets from `orc ready`, roles with write-path ownership, model routing per role.
- **Not in the first release.** Client billing and invoices, weekly reports, Obsidian pack, cloud sessions, agent teams, web server.

## 16. Week plan

| Day | Deliverable |
|---|---|
| 1 | Engine spike, transcript usage check, plugin skeleton, store interface with the vault adapter, `orc init`, `orc new`, templates, `orc.yaml` |
| 2 | End-to-end on a toy repo without review: intake, scout, questions, spec, dispatch, merge, undo |
| 3 | Reviewer, proof pass, size classes, fix rounds, check command detection, smoke growth |
| 4 | Hooks: security, git guards, accounting, state, `orc status`, `orc ready`, `needs-you` |
| 5 | Dashboard, done card, lessons tiers with dedupe and promotion, port the 45 lessons |
| 6 | README with a five-minute demo and expected output, `orc doctor`, `orc explain`, Windows and macOS run, marketplace file. Postgres adapter and migrations if the day allows, otherwise v0.2 |
| 7 | Dogfood on a real project, fix what breaks, tag v0.1 |

## 17. Decisions taken in this draft

Taken here so the build can start. Each can be reversed in `orc.yaml` or a later version.

- Tickets live in a committed `vault/` folder that Obsidian opens as is. Postgres is an opt-in store with the vault kept as a mirror.
- Size S skips review. Everything auth, payment or data-deletion related is forced to L.
- Default caps: worker 40 turns, reviewer 20 turns, budget per ticket at list price S 2, M 8, L 25 USD, stall kill at 10 idle minutes.
- Two fix rounds maximum, then `needs-you`.
- Guide tier cap: 30 lines per rules file.
- New dependency installs are allowed and logged, not asked.
- The dashboard is a static file, not a server.

Still open and parked by request: product name, license, first-user persona.
