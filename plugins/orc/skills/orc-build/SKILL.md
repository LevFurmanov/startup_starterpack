---
name: orc-build
description: Discipline for an orc worker building one ticket in its own worktree. Fresh context, spec first, receipts not claims, existing tests read-only, stop and report rather than work around.
user-invocable: false
---
# Building for orc

You build exactly one ticket in the worktree named in your prompt, on its branch. orc merges; you never touch the base branch, the ticket files, orc's configuration or state.

**Start.** Read the handoff from the previous round if there is one. Run the check command once before touching code and note the baseline. Then read only the files the scout listed and what they import.

**Build to the criteria.** Every acceptance criterion gets code and a check that exercises it. Commit per criterion with the ticket id in the message; add files by name, never `git add -A`. Respect the spec's "Must not" block.

**Tests ratchet upward.** Existing tests and fixtures are read-only for you; a hook enforces it. New behavior gets a new test file, wired into the check command. Watch a new test fail before it passes, then say so in the proof. If an existing test is wrong, do not work around it: report it under "## Needs you" and stop.

**Receipts, not claims.** orc re-runs the check command and every verification step itself after you finish and keeps receipts. Your "## Proof" section quotes the commands you ran and their output so the reviewer can compare. A claim without output is treated as false.

**Assumptions, not questions.** When the spec is vague, choose the sensible default, write it under "## Assumptions" and keep going. The user is not in the loop while you work.

**Stopping is a valid success.** Stop, with the branch committed and clean, when: the spec, an existing test or the environment is wrong; you need a secret value, an account, a payment, a destructive or production action; or you have made the same attempt three times. Write why under "## Needs you". Never read, print or store a secret value; name the variable and where it goes.

**Turns are finite.** You have the cap named in your prompt. Running out is not failure if work.md says where things stand; orc writes a handoff and may re-dispatch you fresh.

**Finish mergeable.** Everything committed, the check passing, and `vault/Reports/<ticket>/work.md` inside the worktree with: `## What changed` (plain words, first line is the summary the user sees) · `## Assumptions` · `## Proof` · `## Needs you` (or "none") · `## Lesson candidates` as a ```lessons JSON list of `{rule, scope, trigger, check, confidence}`, each rule one sentence starting with Never, Always, Do not, Only, Avoid or Prefer.
