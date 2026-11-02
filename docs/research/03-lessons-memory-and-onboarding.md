# Lessons/memory systems for coding agents, and onboarding non-experts — as of 2026-10-29

Research by a subagent on 2026-10-29.

## Part A — how systems capture and apply lessons

### Claude Code: CLAUDE.md + auto memory + hooks (code.claude.com/docs/en/memory, /best-practices)
- Two memory systems: CLAUDE.md (instructions you write) and auto memory (notes Claude writes from corrections). Auto memory loads only the first 200 lines / 25KB of MEMORY.md; typed notes user/feedback/project/reference; "skips anything it can derive from the codebase" and "anything your CLAUDE.md already says".
- Anti-bloat built in: target under 200 lines per CLAUDE.md ("longer files consume more context and reduce adherence"); path-scoped `.claude/rules/*.md` load only when matching files are touched; periodic prompt audits recommended.
- Key framing: CLAUDE.md is "context, not enforced configuration". Non-deterministic (prompt, CLAUDE.md, skills) vs deterministic (hooks, deny rules, managed settings). Verbatim: "If you keep adding emphasis to a CLAUDE.md line and Claude still misses it, that's a sign the line belongs in a hook." And: "keep the enforced set small… at forty of them, most are probably preferences."
- Boris Cherny: every Anthropic team keeps a CLAUDE.md in git that records mistakes; his is ~2.5k tokens; "give Claude a feedback loop to check its own work" is tip #1.

### Anthropic engineering guidance
- Effective context engineering: context is "a finite resource with diminishing marginal returns"; start minimal, add instructions from observed failures.
- Building effective agents: simplest solution first; evaluator-optimizer loop needs clear criteria; for SWE-bench they spent more time on tool design than prompts; requiring absolute paths eliminated an error class — fix mistakes in the harness, not only in prose.

### Superpowers (obra)
Pre-encoded discipline validated by maintainers; no general lesson capture; `diagnosing-superpowers` reads transcripts and reports what went wrong.

### Compound Engineering (Every)
`/ce-compound` writes learnings to `docs/solutions/`, read by the next brainstorm/plan. Klaassen: preferences in CLAUDE.md, architectural rules in llms.txt, taste in a reviewer agent, recurring failures into tests/alerts/evals; "spend half the feature time capturing what it taught". No bloat control; no measured evidence.

### Cursor rules
`.cursor/rules/*.mdc` with Always / Apply Intelligently / glob / manual activation; "keep rules under 500 lines"; "add rules when Agent repeats the same mistake"; "don't copy style guides, use a linter"; team rules admin-enforced; `/create-rule` converts a conversation into a rule.

### Letta / mem0
Letta Code: memory blocks rewrite the system prompt; `/remember` triggers reflection; skill learning saves coached tasks as `.md` skills. Memory's effect not isolated in benchmarks. Mem0 is a store, not a lesson workflow.

### Community "self-improving CLAUDE.md"
- Cherny/Rhodes template: after any correction, write to `tasks/lessons.md`, reviewed at session start; keep under a page.
- aviadr1: Reflect → Abstract → Generalize → Write; rules start NEVER/ALWAYS; admitted weakness: add-only, no pruning.
- **claude-reflect**: hooks detect correction phrases; capture automatic, writing manual; `/reflect` shows a table of queued learnings with 0.60–0.95 confidence; `--dedupe`; decay status.
- CodeYam Memory: background agent reviews transcripts, generates scoped rules, "you review and approve everything".

### Research
- Gloaguen et al., ETH, ICLR 2026 (arxiv 2602.11988): context files do not generally improve success while costing >20% more tokens; instructions are followed; repository overviews not helpful; useful for non-standard practices.
- Zhang et al., "Guardrails Beat Guidance" (arxiv 2604.11088; 5,000+ Claude Code runs): rules +13.8pp, but random rules matched expert rules; every individually beneficial rule was a negative constraint, every harmful one a positive directive; no degradation 0→50 rules.
- Thoughtworks Radar "Agent instruction bloat": caution; models attend less to mid-context guidance; hand-written beats LLM-generated.
- Reflexion (Shinn 2023): ~80→91% HumanEval; later sources warn naive self-correction flips correct answers and costs 2–10x.
- Reddit "22 documented failures in 19 days": top advice — deterministic checks that block the next step, persist state, reset sessions often, put critical steps in hooks.

**Synthesis A:** every credible system converges on prose lessons for guidance, harness enforcement for must-never/always, and human approval gating what enters the prose. Bloat control that exists: hard line limits, path scoping, dedupe/decay, "only what the agent can't derive from code", prefer negative constraints.

## Part B — onboarding non-experts

- Anthropic best practices: sessions start in auto mode (classifier blocks force-push, prod deploys, mass deletes; pauses after 3 blocks). Three failure modes: didn't know (→ CLAUDE.md/spec), couldn't check (→ pass/fail check, Stop hook, `/code-review` in a fresh subagent, "ask for the command it ran and its output"), did a forbidden thing (→ deny rules/hooks). SPEC.md via brainstorming, then fresh session to build; `/clear` between tasks; `/usage`; `--max-budget-usd`.
- Checkpointing: every prompt creates a checkpoint; `/rewind`; Bash-only changes and most subagent edits are not tracked; "not a replacement for version control".
- Replit: auto checkpoints "like save points in a game", each shows billing; after the Lemkin prod-DB deletion added dev/prod separation, read-only planning mode, one-click restore.
- Lovable: Build vs Plan vs Chat modes; every change auto-versioned.
- Kiro: requirements.md → design.md → tasks.md, each a "natural pause point"; steering files generated from the codebase.
- Mitchell Hashimoto: reproduce your own past commits to learn limits; "Engineer the harness" — when an agent errs, update AGENTS.md or add scripts/tests so it can't recur; beginners try to "draw the owl" in one mega session.
- Cherny: plan mode until approved, then auto-accept; almost never `--dangerously-skip-permissions`; pre-approve safe commands; formatter hooks; slash commands for anything done many times a day.
- Karpathy: coined "vibe coding" Feb 2025; a year later proposed "agentic engineering" and reported agents "net unhelpful" on an 8k-line hand-written project.

### Beginner complaints and fixes
- Cost blowups ("$40 on a session… 12.8M input tokens"): concise CLAUDE.md, scope to files, shorter bursts, `/clear`.
- Deletions (48,000 files in 103 seconds; Replit DB wipe): deny rules + PreToolUse hooks (exit 2 blocks even under bypass), sandbox, dev/prod separation, frequent commits.
- Context/regression loss ("reverted to an older state, erasing weeks of fixes"): commit multiple times an hour; gets worse after compaction; agents change tests to match buggy code; handle git yourself.
- Losing understanding ("I just keep pressing yes hoping nothing breaks"; "never reviewed the code, can't audit security"): ask for explanations, security assessment by a second model, write PRD/TRD first.

### 5-minute first win and README conversion
">10 minutes to show value is an onboarding problem"; "README files are not onboarding"; don't ask for sign-up before value; show expected terminal output; too many choices stall users; quick start = install → minimal config → example with expected output → "what just happened"; broken examples destroy trust.

## 10 design recommendations
1. Split lessons into guidance vs enforcement from day one; a never/always lesson violated twice is promoted to a hook or deny rule.
2. Reviewer proposes, human approves, harness writes: candidate rules with confidence + evidence, accept/reject in a table.
3. Prefer negative constraints; reject repository-overview bloat.
4. Hard caps + scoping + decay: ~200 lines root, path-scoped rules, `last_triggered`, monthly audit.
5. Every lesson names a check, not just a sentence.
6. Spec → fresh session → build → independent review against the spec as the default beginner loop.
7. Safety rails installed by the one-command setup before the first prompt: deny rules, PreToolUse hook on rm -rf/force-push/migrations, auto-commit after green checks.
8. Visible budget and "evidence or it didn't happen": tokens/cost per task; agent pastes command + output for every "done".
9. Teach while doing: plain-language "what changed and why, plus one concept to learn"; a security report by a second model.
10. First win in under 5 minutes with shown output: one command, toy repo demo, expected output in README, no account, one path.

Caveat: only the two arXiv studies are controlled evidence; everything else is anecdotal.
