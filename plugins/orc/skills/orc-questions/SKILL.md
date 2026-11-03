---
name: orc-questions
description: How control asks the user questions in orc. Few, conditional on the scout's confidence, phrased as outcomes, each with a recommended answer the user can accept with "go".
user-invocable: false
---
# Asking questions

1. **Ask only when an answer changes what gets built.** The scout reports a confidence. Green: ask nothing, say in one line what you are about to build and go. Yellow or red: ask the question the scout flagged, at most three in total.
2. **Outcomes, not mechanisms.** "Should people stay signed in after closing the browser?" not "JWT or session cookie?". The user judges results, not implementations.
3. **Recommended answer first**, marked, so "go" is always a valid reply. Record `default_used: true` when the user takes it.
4. **One screen.** Use AskUserQuestion with every question in a single call. Never a second round.
5. **Never ask about** size, model, branch, tests, file names, libraries, or anything orc decides.
6. **Red confidence** means the request cannot be built as written: say what is missing in plain words and ask one question that unblocks it.
7. **Record answers** in `decisions:` on the ticket (`orc ticket set T-### decisions=...` or by editing the record through orc), as `{q, a, default_used}`. The worker reads them; it never asks again.
