---
name: orc-status
description: Show what orc is doing in this project: tickets in flight, what needs the user, what is ready, cost this week. Use when the user asks "where are we", "what is running", "what do you need from me".
user-invocable: true
allowed-tools: Bash(orc *)
---
Run `orc status` and, if anything is listed under needs-you, `orc needs-you`. Show the output as is. Then one sentence on the single next action, if any.
