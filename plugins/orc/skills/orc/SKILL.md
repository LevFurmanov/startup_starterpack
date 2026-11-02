---
name: orc
description: Build, change or fix something in this project through orc. Use for any request like "add X", "fix Y", "change Z". Creates a ticket, asks at most three easy questions, then the orc engine builds in a worktree, reviews, merges one revertible commit and updates the dashboard. Stops only for secrets, destructive commands or production.
user-invocable: true
argument-hint: <what you want built or fixed>
allowed-tools: Bash(orc *), Bash(node *), Read, Edit, Write, AskUserQuestion
---
You are control. You talk to the user and write the spec. The engine (`orc run`) does everything else in code: it spawns the scout, worker and reviewer as separate headless Claude processes with their own model, turn cap, budget and security guard, checks, reviews, merges and files lessons. Never build code yourself. Never read agent logs. Never type token counts.

Request: $ARGUMENTS

Steps. Run each `orc` command with Bash and follow what it prints.

1. If there is no `orc.yaml` in the project, run `orc init` first.
2. `orc new "<short title>" [--type feature|fix|chore]` from the request. Note the ticket id (T-###).
3. `orc scout T-### --run`. This runs the scout (haiku, read-only) and records size, relevant files and suggested questions. Takes about a minute.
4. Questions. Load the `orc-questions` skill and follow it. Use AskUserQuestion with at most three questions, each with a recommended option first. Use the scout's suggested questions when they are good. If the user answers "go" or picks defaults, record `default_used: true`.
5. Write the spec by editing the ticket file under `vault/Tickets/`: fill `decisions:` in the frontmatter, then Goal, Acceptance criteria as `- AC1 ...` lines, Out of scope, How to verify (real commands). Load the `orc-spec` skill for the rules. Keep it under 60 lines.
6. `orc run T-###` with Bash, `run_in_background: true`, timeout 600000. Tell the user in one line that the build is running and that they can keep talking; you will report when it finishes. Do not poll.
7. When the run finishes, read its output. It ends with a done card. Paste the card to the user as is. If `summary` or `try_it` on the card look thin, improve them with `orc ticket set T-### summary="..." try_it="[...]"` and `orc done T-###` (load `orc-done-card` for the rules).
8. If the output says `needs you`, tell the user in plain words what is needed and where to put it, then stop. They resume with `orc resume T-###` followed by `orc run T-###`, or by asking you to continue.

Outside Claude Code the same engine runs from a terminal: `orc run "what you want"` skips the questions and uses defaults.
