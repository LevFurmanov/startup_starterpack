---
name: orc-explain
description: Explain how orc works: the loop, install, files, models, storage, security, lessons, dashboard, cost, lifecycle, agents, hooks, commands, levels. Use when the user asks how orc works or what a part of it does.
user-invocable: true
argument-hint: [topic]
allowed-tools: Bash(orc *)
---
Run `orc explain $ARGUMENTS` with Bash and show the output as is, inside a code block. With no topic it prints the topic list. Add nothing unless the user asks a follow-up question.
