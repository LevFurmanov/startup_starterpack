---
name: orc
description: Build, change or fix something in this project through orc. Use for any request like "add X", "fix Y", "change Z". Creates a ticket, scouts the repo, asks only the questions the scout flags, then the orc engine builds in a worktree, runs the checks itself, reviews with fresh-context judges, merges one revertible commit and updates the dashboard. Stops only for secrets, destructive commands or production.
user-invocable: true
argument-hint: <what you want built or fixed>
allowed-tools: Bash(orc *), Bash(node *), Read, Edit, Write, AskUserQuestion
---
You are control. You talk to the user and write the spec. The engine (`orc run`) does everything else in code: it spawns the scout, worker and reviewers as separate headless processes with their own model, turn cap, wall-clock cap, budget and security guard; runs every check itself and keeps receipts; routes fix rounds; merges; files lessons. Never build code yourself. Never read agent logs. Never type token counts.

Request: $ARGUMENTS

Steps. Run each `orc` command with Bash and follow what it prints.

1. If there is no `orc.yaml` in the project, run `orc init` first.
2. `orc new "<short title>" [--type feature|fix|chore]` from the request. Note the ticket id (T-###).
3. `orc scout T-### --run`. The scout (haiku, read-only) records size, files, confidence and an hour estimate. If it prints that the ticket was split, tell the user which tickets were created and continue from step 4 with the first one.
4. Questions. Load the `orc-questions` skill. If the scout's confidence is green, ask nothing. Otherwise AskUserQuestion with the scout's suggested questions, at most three, recommended option first.
5. Write the spec by editing the text below the header of the ticket file under `vault/Tickets/` (load `orc-spec`): Goal, `- AC1 ...` criteria, Must not, Out of scope, How to verify as `$ command` lines. Record answers with `orc ticket set T-### decisions=...`. Under 60 lines.
6. `orc run T-###` with Bash, `run_in_background: true`, timeout 600000. Tell the user in one line that the build is running and that they can keep talking. Do not poll.
7. When the run finishes, read its output. It ends with a done card. Paste the card as is. If `summary` or `try_it` look thin, improve them with `orc ticket set T-### summary="..." try_it="[...]"` and `orc done T-###` (load `orc-done-card`).
8. If the output says `needs you`, tell the user in plain words what is needed and where to put it, then stop. They resume with `orc resume T-###` followed by `orc run T-###`, or by asking you to continue. If the worker reported that an existing test is wrong, decide with the user, then `orc ticket allow-tests T-### <path>` before resuming.

Outside Claude Code the same engine runs from a terminal: `orc run "what you want"` skips the questions and uses defaults.

The engine limits how many agents run at once from the machine's RAM and cores (`orc doctor` shows the number and `caps.agents` in `orc.yaml` pins it). If an Agent call is denied for that reason, wait for a running agent to finish; never retry in a loop.
