---
name: orc-undo
description: Revert a merged orc ticket in one step. Use when the user says "undo that", "roll back the login change", "that broke things".
user-invocable: true
argument-hint: <ticket id or what to undo>
allowed-tools: Bash(orc *)
---
If $ARGUMENTS is not a ticket id, run `orc ticket list` and pick the merged ticket whose title matches; confirm the id in one line. Then run `orc undo T-###` and `orc board`. Tell the user what was reverted and that a redo ticket exists if they want the change done differently. Never undo more than one ticket per request.
