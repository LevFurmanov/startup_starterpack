---
name: orc-spec
description: How orc control writes a ticket spec that a worker can build and a reviewer can verify without asking anything. Loaded by the orc skill.
user-invocable: false
---
The spec is the only thing the worker reads. Under 60 lines. Four sections and the frontmatter.

- Goal: one paragraph, outcome in plain words, who it is for.
- Acceptance criteria: numbered `- AC1 ...` lines. Each is observable: a URL that responds, a message that appears, a command that exits 0. Never "works correctly". Three to seven criteria.
- Out of scope: what a reasonable builder might add and must not.
- How to verify: the exact commands the reviewer re-runs, one per line. If a secret is needed, name the variable and the file it goes in; never a value.
- Frontmatter `decisions:` holds every answered or defaulted question as `q`, `a`, `default_used`.

Never put history, discussion or alternatives in the spec; the log holds those. Never change acceptance criteria after dispatch; open a new ticket. If the title or files touch auth, payments, data deletion, migrations or secrets, size is L whatever the file count.
