# Spec- and ticket-driven AI coding systems — landscape as of 2026-10-29

Research by a subagent on 2026-10-29. Star counts move fast; treat as approximate.

## 1. BMAD Method — github.com/bmad-code-org/BMAD-METHOD
- "Agile AI team" framework; ~54.7k stars; v6.12 stable, V7 alpha. Install `npx bmad-method install` or plugin marketplaces. Needs Node 20+, Python 3.10+, uv.
- Work units: v6 brief → PRD → architecture → epics → story markdown; `sprint-status.yaml` tracks status. V7: `tickets/tickets.toml` per epic, `backlog/` files, `story-<slug>-plan.md` with status + baseline. Prerequisites gate `ready_to_start`.
- Human gates: accept epic→story breakdown; resolve open points; mark build `done` (worker never does); `plan_checkpoint`/`done_checkpoint` fields per ticket. Review appends a dated block, never changes status.
- Lessons: retrospective writes evidence/verdict in the epic folder; docs admit learnings do NOT flow back automatically.
- Multi-agent: 12–21 personas; `bmad-build-auto` single-ticket worker; no worktrees; no model routing. Cost tracking: none.
- Praised: right-sized planning, greenfield/regulated. Criticized: "sledgehammer" for small changes, ~2 months to master, high token cost (5.5h BMAD vs 12 min OpenSpec on a benchmark), marked broken auth "complete".
- Onboarding: slowest of the group.

## 2. GitHub Spec Kit — github.com/github/spec-kit
- Agent-agnostic SDD toolkit; ~143.7k stars; v1.0 Oct 2026. `uv tool install specify-cli; specify init`.
- Work units: `specs/NNN-feature/` with spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md, tasks.md; constitution in `memory/constitution.md`; `[NEEDS CLARIFICATION]` markers; tasks are checkboxes with `[P]` parallel markers. No cross-feature dependency graph.
- Human gates: each slash command run one at a time, user reviews output; tests approved before implementation; `/speckit-converge` classifies gaps missing/partial/contradicts/unrequested.
- Lessons: constitution only. Multi-agent: none (community fork Spec Kitty adds worktrees + kanban). Cost: community extension only.
- Criticized: verbosity ("2,000+ lines of markdown per plan phase"), 7+ files/feature, "illusion of work", auditing prose, 1–3h/feature overhead.
- Onboarding: ~30 min to first spec.

## 3. AWS Kiro specs — kiro.dev/docs/specs
- Proprietary IDE + CLI; credit pricing. Not open source.
- Work units: `.kiro/specs/<name>/requirements.md` (EARS: "WHEN … THE SYSTEM SHALL …"), design.md, tasks.md with tasks referencing requirement IDs; dependency graph built automatically; executes in parallel "waves".
- Human gates: approval checkpoint after each artifact; Markdown Review comments; Autopilot vs supervised.
- Lessons: steering files only. Praised: EARS traceability, cleanest beginner UX. Criticized: lock-in, pricing churn, sledgehammer for tiny changes.
- Onboarding: fastest to first result.

## 4. Beads — github.com/steveyegge/beads
- Graph issue tracker for agents on embedded Dolt; ~28.3k stars; v1.3.2 Oct 2026; ~1.1k open issues.
- Work units: issues in Dolt DB; hash IDs (`bd-a1b2`, hierarchical `bd-a3f8.1.1`); open → claimed → closed; `bd ready` lists unblocked work; dependency types blocks, parent-child, relates-to, duplicates, supersedes.
- Human gates: none. Lessons: `bd remember`, `bd prime`, memory decay compacts old issues.
- Multi-agent: claim leases with heartbeats, compare-and-set, HTTP API.
- Praised: dependency graph + `ready`, persistence, versioned with repo. Criticized: invasive (auto git hooks, daemon, unasked commits, `.beads/` PR noise), slower every release, Dolt dependency, migrations; spawned simpler replacements (wedow/ticket, beads_rust).
- Gas Town layers Mayor/polecats/refinery merge-queue on Beads; author wrote in Aug 2026 it "effectively burned down".

## 5. Claude Task Master — github.com/eyaltoledano/claude-task-master
- PRD → task graph via CLI + MCP; ~28.3k stars; last commit Apr 2026, authors moved to a hosted product.
- Work units: `.taskmaster/tasks/tasks.json` with id/status/dependencies/priority/testStrategy/subtasks; cycle detection; `next` picks by deps; tagged lists.
- Human gates: none formal. Lessons: none. Models: main/research/fallback roles.
- Cost tracking: YES — per-command telemetry (provider, tokens, cost). The only tool with it.
- Criticized: tasks.json corruption, security findings, stalled, agent "ignored it as the project grew".

## 6. Backlog.md — github.com/MrLesk/Backlog.md
- Markdown-native kanban; ~7.2k stars; `backlog init` writes AGENTS.md/CLAUDE.md; optional MCP.
- Work units: one `.md` per task with YAML frontmatter; `TASK-1` IDs; configurable statuses; `--dep`; milestones; acceptance-criteria checklists; project-wide Definition of Done appended to every task; decisions folder.
- Human gates: agent writes plan into task before coding; reviewer approves. "You review the tasks: before, during, and after."
- Praised: zero infra, human-readable, web + TUI board. Criticized: no spec/design phase.
- Onboarding: ~5 min.

## 7. Agent OS — github.com/buildermethods/agent-os
- Standards-injection + spec shaping; ~5.6k stars; v3.0 Jan 2026 dropped task orchestration ("frontier models now manage delegation").
- Lessons: standards files are the memory; `/discover-standards`. No per-task learnings.

## 8. PRPs — github.com/Wirasm/PRPs-agentic-eng
- "PRD + codebase intelligence + agent runbook"; ~2.3k stars. Artifacts stored OUTSIDE the repo in `~/.prp/`. Validation sections hold executable commands. `/prp-orchestrate` runs parallel worktrees with review gates. Criticized: artifacts outside repo hard to share.

## 9. Compound Engineering (Every) — github.com/EveryInc/compound-engineering-plugin
- 36-skill plugin; ~25.8k stars. `/ce-brainstorm` → `/ce-plan` → `/ce-work` → `/ce-simplify-code` → `/ce-code-review` → `/ce-compound`.
- Signature feature: `/ce-compound` writes one markdown per solved problem into `docs/solutions/<category>/[symptom]-[module]-[date].md` with frontmatter (symptoms, root_cause, resolution_type, applies_when); later brainstorm/plan read them as grounding. No bloat control; no measured evidence.
- Criticized: 7-step loop overkill for quick fixes, parallel reviewers eat context, docs churn.

## 10. Others
- OpenSpec (~73k stars): brownfield delta specs; `openspec/changes/<name>/{proposal,design,tasks}` with ADDED/MODIFIED/REMOVED; archive updates living specs.
- Superpowers (~307k stars): methodology; brainstorm → worktree → plan of 2–5-minute tasks → fresh subagent per task with two-stage review → TDD; no tracker, cost, or learnings.
- GSD Core: `.planning/` STATE.md/CONTEXT.md; wave-based execution; fresh executor per plan.
- Comparison matrices: cameronsjo.github.io/spec-compare, specs.md/compare.

## Synthesis
**Table stakes:** markdown artifacts in-repo (spec/plan/tasks), a constitution injected every session, slash-command phases with the human reading between them, checkbox task lists, plugin/npx install, some "ready/next" selection, archive-on-done.

**Rare but praised:** dependency graph with `ready` and atomic claiming (Beads, Task Master); learnings capture that planning actually reads (Compound, Beads remember, Agent OS standards); delta specs (OpenSpec); requirement→task traceability (Kiro EARS, Spec Kit converge); fresh-context subagent per task with two-stage review (Superpowers, GSD); worktree-isolated workers with a merge queue (Gas Town, PRPs); per-command token/cost telemetry (only Task Master).

**What no system does well:** cost/time accounting per ticket; right-sizing ceremony automatically; closing the loop from retrospectives back into planning without manual steps; model routing by task type; durable declarative human gates that survive unattended loops (BMAD V7 checkpoints are the only one); non-invasive multi-agent coordination. A Claude Code orchestrator combining markdown-in-repo tickets, a real dependency graph, declarative checkpoints, per-ticket cost rollups and automatic lessons capture would occupy unclaimed ground.
