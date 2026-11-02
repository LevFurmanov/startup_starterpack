# Multi-agent orchestration runtimes on/around Claude Code — landscape as of 2026-10-29

Research by a subagent on 2026-10-29.

## 1. Claude Code native
Five official parallel modes (code.claude.com/docs/en/agents):
- **Subagents** `.claude/agents/*.md`: frontmatter `model`, `tools`, `permissionMode`, `isolation: worktree`, `background`, `maxTurns`, `effort`, `hooks`, `memory`; 20 concurrent default; nesting depth 3; fresh context per spawn; `/batch` splits one change into 5–30 worktree-isolated subagents.
- **Agent Teams** (experimental, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`): lead + peers with shared task list and JSON mailboxes under `~/.claude/teams/`; no worktree isolation; no nested teams; `/resume` loses in-process teammates; `TeammateIdle`/`TaskCompleted` hooks. Issue #23620 (lead forgets team after compaction) open since Feb 2026. Reports of 73–124% more tokens than sequential.
- **Dynamic workflows / ultracode** (GA May 2026): Claude writes a JS script (`agent()`, `pipeline()`, `parallel()`, `phase()`), runtime executes outside the conversation; 16 concurrent default; per-run approval; `/workflows` TUI shows per-agent token usage, pause/stop/resume with memoized results; "Large workflow" warning at >25 agents or >1.5M tokens; per-stage model selection; ship in plugins.
- **Agent view** (`claude agents`, preview): background sessions under a supervisor daemon; each moves into its own worktree; never pushes main, force-pushes or merges; `--json` for scripting.
- **Projects** (beta, Pro/Max): coordinator conversation spawning cloud threads, one branch + PR each; "Waiting on you / Ready for review".
- Primitives: `--worktree` with enforced isolation checks; hooks incl. `WorktreeCreate`, `SubagentStop`, `PreToolUse`; plugins with marketplace "Context cost" estimates; cloud sessions; routines (cron ≥1h); `/code-review ultra` ($5–25 after 3 free).
- Human control: permission modes, per-run workflow approval, `--max-budget-usd`, `/usage` attribution by subagent/plugin, org `disableWorkflows`. Model routing: explicit per frontmatter, not automatic. Git: worktree per agent, humans merge.

## 2. Ruflo (ex Claude Flow, ruvnet)
~80k stars claimed; queen-led "hive-mind" swarms, "100+ agents", AgentDB. Severe criticisms: issues report swarms that mark tasks in_progress but spawn nothing; audit gist "300+ MCP Tools — 99% Theater, 1% Real, 5x Token Waste"; 3–4 GB RAM with 8+ agents; unverified benchmarks. API-only since Anthropic's April 4 2026 ban on subscription OAuth in third-party harnesses.

## 3. Gas Town (Steve Yegge → gastownhall)
18.6k stars, Go; `brew install gastown` + Dolt + tmux + Beads. Mayor (Claude session) + Go daemons: Polecats (one worktree each), Witness (stuck-agent recovery), Refinery (bisecting merge queue, polecats never push main), `gt escalate` P0–P2; 20–30 agents. HN: "flaky and scorches tokens" (~10x), Beads/Dolt failures, roles mostly naming, agents closing tasks without validation; author admits "100% vibe coded". Windows CLI-only.

## 4. OpenAI Symphony
27.9k stars, Apache-2.0, "engineering preview". Issue-tracker-as-control-plane: polls Linear/GitHub/Jira every 30s, one workspace per issue, `max_concurrent_agents`, backoff retries, 5-min stall kill, 20 turns max; `WORKFLOW.md` hot-reloads. Tracker states are the gate ("Human Review"); agents provide proof of work (CI, PR, video). Scheduler state in-memory only. Codex-only out of the box.

## 5. Google Conductor
3.8k stars; spec-driven tracks (spec.md/plan.md), human approves plan, `conductor-revert` by track/phase/task via git. Not multi-agent.

## 6. Claude Squad
8.7k stars, AGPL, Go; tmux session + worktree per agent; you review and merge. No specialization, cost, or merge logic.

## 7. Vibe Kanban
28.5k stars; bloop shut down 2026-04-10; community-maintained; 388 open issues.

## 8. Conductor (conductor.build)
Mac app; worktree per workspace; Pro $50/mo cloud; no lifecycle/review gates.

## 9. Ralph Wiggum loops
`while true` feeding one prompt to a fresh agent; official plugin `ralph-loop` uses a Stop hook; `--max-iterations` default unlimited; 50 iterations ≈ $50–100; "hallucinated done", placeholder implementations; greenfield only.

## 10. oh-my-claudecode
40.4k stars; team-plan→prd→exec→verify→fix; 19 agents with tiers, routes simple→Haiku, complex→Opus (claims 30–50% savings); HUD statusline, cost analytics; needs tmux; depends on experimental Agent Teams; README suggests a lighter alternative for "overkill".

## 11. SuperClaude
23.9k stars; 20 personas, 30 commands; opinionated prompt layer, not an orchestrator.

## 12. Superpowers
~307k stars; methodology: brainstorm → worktree → 2–5-minute tasks → subagent-per-task with review → TDD → finish. HN: praised adversarial spec/plan review; criticized rigid, "more mistakes than without", LLM-executed install = "curl|bash".

## 13–16. Cursor cloud agents, Codex cloud, Devin, OpenHands
Cloud VM per agent, branch + PR, human merges; spend limits at account level; a 33,596-PR study found 4 in 5 agent PRs compete for the same merge target; OpenHands "Agent Control Plane" for spend/audit.

## 17. awesome-claude-code
56.8k stars; ~19 orchestration tools listed (HCOM hook messaging, Claude Code PM, ralph-harness with fresh process per iteration, ccpm using GitHub Issues, mission-control dashboard).

## Synthesis
**Table stakes:** worktree per agent; branch + PR with a human merging; a board with "needs input" state; iteration/agent caps; approval before edits; per-session diff review.

**Rare but praised:** codified re-runnable orchestration with memoized resume and per-agent token view (Claude Code workflows); a merge queue with bisection (Gas Town only); issue tracker as state machine with human-review state and crash restart (Symphony); adversarial cross-verification before reporting (workflows, ultrareview, Superpowers); proof-of-work artifacts (Symphony, Cursor); explicit tier routing (OMC, Claude Code per-stage); plan sign-off gates and revert-by-task (Conductor, Superpowers); spend governance per user.

**Common failure modes:** cost blowups (teams 3–7x, Gas Town 10x, Ralph $50–100/50 iterations); context loss (lead forgets team after compaction); "theater" (agents marked running that do nothing, tasks closed without validation, always-pass tests); merge/semantic conflicts despite worktrees; runaway loops / hallucinated "done"; fragile state stores; permission-prompt floods; policy risk (OAuth ban killed subscription billing for third-party harnesses); platform gaps (tmux-only, no Windows).

**What no system does well:** semantic conflict detection before merge; durable coordinator state that survives compaction/restart; honest per-task cost accounting with budgets enforced at dispatch; model routing that is measured rather than asserted; verifying "done" independently of the agent's own claim; cross-vendor portability without API-only billing.
