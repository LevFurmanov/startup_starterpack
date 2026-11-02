---
name: orc-smoke
description: How to add a smoke check to a project that has no test command, so orc can verify builds. Use when orc.yaml has check: null or a worker needs a first check.
user-invocable: false
---
A smoke check is one command that exits 0 when the thing you built works and non-zero when it does not. It runs in under thirty seconds and needs no secrets.

Pick the smallest form that fits the project:
- Node: a `scripts/smoke.mjs` that imports the module or fetches the dev server and asserts one thing; `"test": "node scripts/smoke.mjs"` in package.json.
- Python: a `tests/test_smoke.py` with one assertion; check command `pytest -q`.
- Static site or HTML: `node -e` that reads the file and asserts the string that must appear.
- Shell tool: `sh scripts/smoke.sh` that runs the tool with a fixture and greps the output.

Then set `check:` in orc.yaml to that command. Every later ticket adds one assertion to the same file for the behavior it built; never a second framework.

Never write a check that passes without the code (always-true assertions). Watch it fail once.
