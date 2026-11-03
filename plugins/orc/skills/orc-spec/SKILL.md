---
name: orc-spec
description: How control writes a ticket spec for orc. Load before editing a file under vault/Tickets. Short, testable criteria, a Must-not block, and verification steps written as commands orc runs itself.
user-invocable: false
---
# Writing the spec

The spec is the only thing the worker, the checks and the reviewer share. Everything else is derived from it. Edit the text below the header of `vault/Tickets/T-###-*.md`; the header is rendered by orc and ignored on read.

**Goal.** One or two sentences in the user's words. What will be true when this is done.

**Acceptance criteria.** `- AC1 ...` lines, each a behavior a reviewer can check by running something. Three to six. "AC2 `greet("Ann")` returns `Hello, Ann!`" is a criterion; "code is clean" is not. Write them before the build and never loosen them to fit what got built.

**Must not.** Negative constraints work better than instructions. Keep the three defaults and add what matters for this ticket: files that must not change, behavior that must stay, dependencies that must not be added.

**Out of scope.** One line that stops the worker from wandering.

**How to verify.** Commands, one per line, prefixed with `$ `. orc runs each of them itself after the build, keeps a receipt (commit, exit code, output), and shows the receipts to the reviewer and on the done card. A step the user performs by hand goes in `try_it` on the done card, not here.

Rules: under 60 lines; no implementation detail the worker should decide; record the user's answers in `decisions:` with `orc ticket set` or by editing the file; sensitive domains (auth, payments, deletion, migrations) are size L whatever the scout said.
