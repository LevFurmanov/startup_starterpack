---
name: orc-fix
description: Bug-fix discipline for an orc ticket of type fix. Use when the request is "X is broken" or "Y does not work". Loaded by the worker when the ticket type is fix.
user-invocable: false
---
1. Reproduce first. Write the smallest command or check that shows the bug and run it. Paste the failing output. No reproduction, no fix.
2. Find the cause, not the symptom. Name the line where the wrong value is born, not where it is noticed.
3. Make the reproduction a permanent check. Watch it fail.
4. Fix. Watch the check pass. Run the whole check command.
5. Write one lesson candidate: the negative constraint that would have prevented the bug, scoped to the path.

Never fix by catching the error and continuing. Never widen a type or loosen a check to make it pass. Never touch unrelated code in a fix ticket, even if it is ugly; file a chore.
