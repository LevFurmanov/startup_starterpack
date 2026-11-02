# Claude Code mechanics relevant to an orchestrator — verified against code.claude.com docs on 2026-10-29

Items marked UNVERIFIED were not confirmed in the docs.

## Hooks (docs/en/hooks)
- 33 events incl. SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, PostToolUseFailure, SubagentStart, SubagentStop, TaskCreated, TaskCompleted, Stop, TeammateIdle, WorktreeCreate, WorktreeRemove, PreCompact, PostCompact, SessionEnd.
- PreToolUse stdin: session_id, prompt_id, transcript_path, cwd, scratchpad_dir, permission_mode, effort, hook_event_name, tool_name, tool_input, tool_use_id. **agent_id and agent_type are present when the hook fires inside a subagent**; agent_type is the frontmatter `name` of the agent definition (plugin agents `plugin:name`).
- Blocking: exit 2 blocks and sends stderr to Claude; or exit 0 with JSON `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"..."}}`; `updatedInput` can rewrite arguments. Exit 2 blocks even if JSON says allow.
- Matchers: tool name (exact, `|`, regex); `if` field filters on tool + args e.g. `"Bash(git *)"`. Hooks in settings and plugins also run inside subagents.
- SubagentStop input: agent_id, agent_type, transcript_path, **agent_transcript_path** (subagent's own JSONL), last_assistant_message. No usage fields.
- Plugin hooks: `hooks/hooks.json`; use `${CLAUDE_PLUGIN_ROOT}`.

## Permissions (docs/en/permissions, settings-reference)
- `{"permissions":{"allow":[],"ask":[],"deny":[],"defaultMode":"","additionalDirectories":[]}}`; order deny → ask → allow; a deny cannot be carved out by allow.
- Read denies: `Read(./.env)`, `Read(**/.env*)`, `Read(**/*secret*)`; bare names match at any depth. **A Read deny also blocks Edit/Write to that path.** Write/NotebookEdit/Glob path rules never match; use `Edit(...)`.
- Modes: default, acceptEdits, auto, dontAsk, bypassPermissions, plan.
- Subagent frontmatter: name, description, tools, disallowedTools, model, permissionMode, maxTurns, autoCompactWindow, skills (preloaded, up to 32), mcpServers, **hooks**, memory (user/project/local), background, omitClaudeMd, effort, isolation ("worktree"), color, initialPrompt. Plugin subagents ignore hooks, mcpServers, permissionMode.
- `--agents` JSON accepts the same keys; in `-p` also a file path.
- SKILL.md frontmatter: name, description, when_to_use, argument-hint, arguments, disable-model-invocation, user-invocable, allowed-tools, disallowed-tools, model, effort, context (fork), agent, background, hooks, paths, shell, metadata.

## Plugins (docs/en/plugins-reference, marketplace-reference)
- Layout: `.claude-plugin/plugin.json` (only `name` required); root `skills/<name>/SKILL.md`, `commands/`, `agents/*.md`, `hooks/hooks.json`, `.mcp.json`, `bin/` (added to PATH), `settings.json`, `workflows/`.
- Plugin settings.json applies only `agent` and `subagentStatusLine`; other keys dropped. **A plugin-root CLAUDE.md is NOT loaded**; ship context as a skill.
- marketplace.json at `.claude-plugin/marketplace.json`: name, owner, plugins[] each with name + source (`./plugins/x`, github repo, url, git-subdir, npm, archive).
- Install: `/plugin marketplace add <source>` then `/plugin install <name>@<marketplace>`; `claude plugin validate <path>`.

## Cost and usage
- `claude -p --output-format json`: result, session_id, usage, total_cost_usd (client-side estimate with per-model breakdown), permission_denials. With --resume the cost is the whole conversation's total.
- stream-json: final `result` message with cost; subagent messages carry parent_tool_use_id.
- OpenTelemetry: CLAUDE_CODE_ENABLE_TELEMETRY=1, OTEL_METRICS_EXPORTER, OTEL_EXPORTER_OTLP_PROTOCOL (required), endpoint, headers. Metrics claude_code.cost.usage and claude_code.token.usage (input/output/cacheRead/cacheCreation) with session.id; subagent metrics carry query_source and agent.name; events carry agent_id.
- /cost and /usage: session total at list price; on Max/Pro not billing-relevant; attribution shown for skills/subagents/plugins; per-subagent cost not exposed by /cost.
- Hooks carry no usage. Transcript JSONL format is "internal and may change"; whether assistant entries carry message.usage is UNVERIFIED — test before building on it.
- `--max-budget-usd` exists for headless; no token-budget flag.

## Agent Teams and isolation
- Teams experimental, interactive only, not in -p or SDK; lead + teammates with shared task list and mailboxes; no per-teammate worktree; passing isolation on an Agent call prevents it becoming a teammate; in-process teammates can't be resumed.
- Agent tool `isolation: "worktree"`: auto-removed when the subagent makes no changes; with changes persists until periodic sweep (cleanupPeriodDays default 30) and only if no unpushed work. Location `.claude/worktrees/<name>/` on branch `worktree-<name>`; base from worktree.baseRef.

## Headless flags that exist
--allowedTools, --disallowedTools, --permission-mode, --permission-prompts none, --max-turns, --max-budget-usd, --continue, --resume, --fork-session, --append-system-prompt(-file), --agents, --output-format, --include-partial-messages, --json-schema, --input-format, --session-id, --bare, --settings, --mcp-config, --plugin-dir, --add-dir, --no-session-persistence.
