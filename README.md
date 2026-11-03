# orc

A gate-free development orchestrator for Claude Code, for people who are not engineers yet.

You describe a change. It asks up to three easy questions. It builds in an isolated copy of your project, checks its own work with an independent reviewer, merges one commit you can undo, and shows you a dashboard. It stops only for a secret, a destructive command or production.

**Status: pre-release, under construction.** Start with the [user guide](docs/GUIDE.md) (also as [PDF](docs/orc-guide.pdf)). The design is in [docs/DESIGN.md](docs/DESIGN.md) and the terminal walkthrough in [docs/SYSTEM-DESIGN.md](docs/SYSTEM-DESIGN.md).

## Install

No Claude Code yet? Section 1 of the [user guide](docs/GUIDE.md#1-install) walks through installing Claude Code, Node and git first. With those in place, inside Claude Code:

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

What makes it strong, from the research in `docs/research/05-orchestration-practices.md`: orc runs every check itself and keeps receipts, reverts the change to prove new tests fail without it, keeps existing tests read-only for the worker, reviews with fresh-context judges that are told what cheating looks like, stops loops at six identical calls, hands each round to a fresh process with a ledger, and validates every lesson before it can shape a prompt.

`orc explain` prints how every part works; `orc explain proof` is the short version of the above.
