# orc

A gate-free development orchestrator for Claude Code, for people who are not engineers yet.

You describe a change. It asks up to three easy questions. It builds in an isolated copy of your project, checks its own work with an independent reviewer, merges one commit you can undo, and shows you a dashboard. It stops only for a secret, a destructive command or production.

**Status: pre-release, under construction.** The design is in [docs/DESIGN.md](docs/DESIGN.md) and the terminal walkthrough in [docs/SYSTEM-DESIGN.md](docs/SYSTEM-DESIGN.md).

## Install

```
/plugin marketplace add LevFurmanov/startup_starterpack
/plugin install orc@orc
/orc init
```

Then, in your project, describe a change:

```
/orc add a login page
```

The conversation happens in your session. The build itself is code: `orc run T-###` spawns the scout, worker and reviewer as headless Claude processes with the model, budget and security guard set by orc, then checks, reviews, merges and files lessons. From a terminal, `orc run "add a login page"` does the same with default answers.

`orc explain` prints how every part works.
