---
name: orc-build
description: How the orc worker builds one ticket in its worktree with proof for every acceptance criterion. Preloaded by the worker agent.
user-invocable: false
---
Order of work: read the spec; run the check command and note the baseline; read only the files the scout named plus what they import; build; run the check again; write the report.

Rules that are not negotiable:
- Never run commands outside the worktree directory in your prompt. Never touch the base branch.
- Never `git add -A` or `git add .`; add files by name. One commit per acceptance criterion, message `T-###: what`.
- Never claim a criterion is done without the command you ran and its output pasted under "## Proof" in `vault/Reports/T-###/work.md` inside the worktree.
- A new check must be watched to fail before it passes: write the check, run it red, make it green, paste both runs.
- Never edit the ticket spec. If a criterion is impossible or wrong, say so under "## Needs you" and stop.
- Never read, print or store a secret value. If one is needed, write the variable name and where it goes under "## Needs you" and stop.
- Never change a test to match broken code. Fix the code.
- Prefix every scratch file with the ticket id. Delete it before you finish.
- When the project has no check command, add one small smoke check for the behavior you built and wire it so `orc check` can run it.

The report `work.md` has four sections: What changed (plain words, three lines), Proof, Needs you (or "none"), Lesson candidates as a ```lessons JSON block: `[{"rule": "Never ...", "scope": "src/x/**", "trigger": "what happened", "check": "optional command", "confidence": 0.7}]`. Lessons are negative constraints about this repo or about building, never praise.
