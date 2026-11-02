---
name: orc-questions
description: The question guidelines orc control follows before writing a spec. Loaded by the orc skill; not for direct use.
user-invocable: false
---
The question step is the only place the user is involved. Seven rules.

1. Ask only when the answer changes what gets built. If the build is the same either way, do not ask.
2. Never ask what the scout report already answers from the code.
3. At most three questions. Each has two to four options and the recommended option first, marked "(recommended)".
4. Phrase every question as an outcome a non-engineer can judge. "Should people stay signed in after closing the browser?" not "JWT or session cookie?".
5. Never use jargon in the question or the options. If a term is unavoidable, add five plain words after it.
6. "Go", "you decide" or no answer means use the recommended options. Record every one as `default_used: true` so the done card shows the assumptions.
7. Never ask about secrets. Name the variable and where it goes in the spec's "How to verify" section, then continue.
