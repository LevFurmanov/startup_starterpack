---
name: orc
description: Build, change or fix something in this project through orc. Use for any request like "add X", "fix Y", "change Z". Creates a ticket, asks at most three easy questions, builds in a worktree, reviews, merges one revertible commit, updates the dashboard. Stops only for secrets, destructive commands or production.
user-invocable: true
argument-hint: <what you want built or fixed>
allowed-tools: Bash(orc *), Bash(node *), Read, Edit, Write, Agent, AskUserQuestion
---
You are control. Scripts and cheaper models do the work; you think, ask, and write the spec. Never read the worker's log. Never type token counts. Never edit code yourself: the worker does.

Request: $ARGUMENTS

Steps. Run each `orc` command with Bash and follow what it prints.

1. If there is no `orc.yaml` in the project, run `orc init` first.
2. `orc new "<short title>" [--type feature|fix|chore]` from the request. Note the ticket id (T-###).
3. `orc scout T-###`. Run the scout agent exactly as the command prints (Agent tool, subagent_type `orc:scout`, the prompt file's content as the prompt). Then `orc scout T-### --record`.
4. Questions. Load the `orc-questions` skill and follow it. Use AskUserQuestion with at most three questions, each with a recommended option first. If the user answers "go" or picks defaults, record `default_used: true`.
5. Write the spec by editing the ticket file under `vault/Tickets/`: fill `decisions:` in the frontmatter, then Goal, Acceptance criteria as `- AC1 ...` lines, Out of scope, How to verify (real commands). Load the `orc-spec` skill for the rules. Keep it under 60 lines.
6. `orc dispatch T-###`. Run the worker agent exactly as printed (subagent_type `orc:worker`, model as printed). Say to the user in one line that the build is running.
7. `orc check T-###`. If it fails and the command suggests a re-dispatch, dispatch again (the prompt now carries the check output). Otherwise follow the printed next step.
8. If the next step is a review: `orc review T-###`, run the reviewer agent as printed, then `orc review T-### --record`. On a fail, `orc dispatch T-###` for a fix round, then check and review again. The command stops you after the configured rounds and sets `needs-you`.
9. `orc merge T-###`.
10. Write the done card: load the `orc-done-card` skill, then `orc ticket set T-### summary="..." try_it="[step one, step two]"`, then `orc board`, then `orc done T-###` and paste its output to the user.
11. If a lesson candidate appeared in `vault/Reports/T-###/work.md`, run `orc lessons add --from vault/Reports/T-###/work.md`.

Whenever a command reports `needs-you`, tell the user in plain words what is needed and where to put it, then stop. They resume with `orc resume T-###` or by asking you to continue.
