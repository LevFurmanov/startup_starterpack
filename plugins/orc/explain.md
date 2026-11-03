# System design, as `orc explain` prints it

This is the terminal view of the starter pack. Every block below is the planned
output of `orc explain <topic>`. The command ships in v0.1 and prints exactly
this text, so the docs and the tool cannot drift. Design draft v2.1, 2026-11-02.

```
$ orc explain

  orc 0.1  ·  a gate-free development orchestrator for Claude Code

  topics
    overview    what it is, in one screen
    loop        what happens between your prompt and the done card
    install     what gets installed, and where
    files       the vault and the ticket format
    models      how the right model is chosen for each step
    storage     vault by default, Postgres as an option
    security    the only three reasons it ever stops
    lessons     how it learns without asking you
    dashboard   what the dashboard shows
    cost        how tokens and cost are counted
    lifecycle   the ticket state machine
    agents      the four agents and what they may touch
    hooks       what is enforced by the harness, not by prose
    commands    the CLI reference
    levels      what Level 0 and Level 1 turn on

  run `orc explain <topic>`
```

```
$ orc explain overview

  You describe a change. It asks up to three easy questions. It builds, checks
  its own work, merges one revertible commit and updates a dashboard. It stops
  only for a secret, a destructive command or production.

        you ──── prompt ───▶ ┌───────────────┐ ──── ≤3 questions ───▶ you
                             │    control    │ ◀─── answers / "go" ───
                             │ your session  │
                             └───────┬───────┘
                                     │ spec (≤60 lines)
                                     ▼
  ┌─────────────────────────── orc, the CLI ────────────────────────────┐
  │ new ▸ scout ▸ dispatch ▸ check ▸ review ▸ fix ▸ merge ▸ learn ▸ report│
  │ deterministic · no model · owns all state                            │
  └───────┬──────────────┬──────────────┬──────────────┬────────────────┘
          │              │              │              │
     ┌────▼────┐    ┌────▼────┐    ┌────▼────┐    ┌────▼─────┐
     │  scout  │    │ worker  │    │reviewer │    │  store   │
     │  haiku  │    │ sonnet/ │    │  opus   │    │ vault or │
     │read-only│    │  opus   │    │read-only│    │ postgres │
     └─────────┘    │worktree │    └─────────┘    └────┬─────┘
                    └─────────┘                        │
                                              ┌────────▼────────┐
                                              │ Dashboard.html  │
                                              │ Board.md Home.md│
                                              └─────────────────┘

  three ideas carry the whole thing
    1. the expensive model only thinks; scripts and cheap models do the rest
    2. nothing is enforced by a sentence; hooks and deny rules enforce it
    3. every ticket is one commit you can undo, so no approval is needed
```

```
$ orc explain loop

  Two halves. The conversation runs in your Claude Code session. The
  engine is code: `orc run T-###` drives every step below the line and
  launches each agent as its own headless `claude -p` process with the
  model, turn cap, dollar budget, tool list and security guard set by orc.

  step        who        model        reads                  writes
  ─────────── ────────── ──────────── ────────────────────── ─────────────────────
  intake      control    session      your prompt            ticket T-###
  scout       engine     haiku        repo, ref. lessons     scout report, size
  questions   control    session      scout report           decisions in ticket
  spec        control    session      answers                spec ≤60 lines
  ───── orc run T-### ─────────────────────────────────────────────────────────
  dispatch    engine     none         spec                   branch, worktree, caps
  build       engine     sonnet|opus  spec + last findings   commits on orc/T-###
  check       engine     none         worktree               checks: pass|fail
  review      engine     opus         spec, diff, checks     findings per AC
  fix         engine     same         findings               commits, ≤2 rounds
  merge       engine     none         branch                 one commit on main
  account     engine     none         json result per agent  tokens, cost
  learn       engine     none         work + review reports  lessons, promotions
  report      engine     none         store                  done card, dashboard

  From a plain terminal, `orc run "add a login page"` does all of it with
  default answers and no questions.

  what you see, in order

    › /orc add a login page
    ┌ T-014 · Login page · size M ────────────────────────────────────────┐
    │ ? Should people stay signed in after closing the browser?           │
    │   ● Yes, for 30 days (recommended)   ○ No, sign in every visit      │
    │ ? Which sign-in methods?                                            │
    │   ● Email and password   ○ Email link   ○ Google                    │
    │ type "go" to accept the recommended answers                         │
    └─────────────────────────────────────────────────────────────────────┘
    › go
    ✓ T-014 spec written · 2 assumptions recorded · building in background

    ... later, or on your next prompt ...

    ┌ T-014 done ─────────────────────────────────────────────────────────┐
    │ What changed   A login page at /login with email and password.     │
    │                Sessions last 30 days. Wrong passwords show a note.  │
    │ Try it         1. npm run dev   2. open http://localhost:3000/login │
    │ Checks         12 passed, 1 new smoke check added                   │
    │ Review         3 of 3 acceptance criteria verified, 1 fix round     │
    │ Cost           $1.84 · worker sonnet 310k · reviewer opus 95k       │
    │ Learned        L-041 never store the session token in localStorage │
    │ Undo           orc undo T-014                                       │
    └─────────────────────────────────────────────────────────────────────┘
```

```
$ orc explain install

  three commands once per machine, then one per project

    /plugin marketplace add <org>/orc          registers the marketplace
    /plugin install orc@orc                    installs the plugin
    /orc init                                  sets up this project

  what the plugin puts under ~/.claude/plugins/orc/

    skills/
      orc/SKILL.md              /orc · the control flow: intake → scout →
                                questions → spec → dispatch → report
      orc-questions/SKILL.md    the seven question guidelines, loaded by /orc
      orc-explain/SKILL.md      /orc explain · prints this document
    agents/
      scout.md                  haiku · read-only · maxTurns 15
      worker.md                 sonnet · isolation worktree · maxTurns 40
      reviewer.md               opus · read-only · maxTurns 20
    hooks/hooks.json            security, git guards, accounting, dashboard
    bin/orc                     the CLI · Node 20+ · no dependencies
    templates/                  ticket, log, lesson, rules file, orc.yaml, Home
    lessons/                    45 default lessons about running agents
    storage/schema.sql          the Postgres option

  what `orc init` writes into the project

    orc.yaml                    config, one screen, commented
    vault/                      Home.md, Board.md, Tickets/, Lessons/,
                                Reports/, Decisions.md, _templates/
    .orc/state.json             coordinator state, CLI-owned, not committed
    .claude/settings.json       deny rules for secret files, merged in
    .claude/rules/orc-*.md      guide-tier lessons, path-scoped, start empty
    CLAUDE.md                   ten lines appended: route build requests to /orc
    .gitignore                  .orc/cache/ and worktrees

  orc init also detects the project type and proposes the check command

    detected: package.json with a "test" script
    check command: npm test            [enter to accept, or type your own]
    none found? every ticket must then add one small smoke check
```

```
$ orc explain files

  vault/
  ├── Home.md                    generated · status, needs-you, links
  ├── Board.md                   generated · markdown board
  ├── Dashboard.html             generated · the dashboard
  ├── Decisions.md               generated · every answered question
  ├── Tickets/
  │   ├── T-014-login-page.md        the spec · the only file agents load
  │   └── T-014-login-page.log.md    append-only events · nobody loads it
  ├── Reports/
  │   └── T-014/
  │       ├── scout.md
  │       ├── review-1.md
  │       ├── review-2.md
  │       ├── proof.md
  │       └── done.md
  ├── Lessons/
  │   └── L-041-session-token.md
  └── _templates/

  a spec, complete

    ---
    id: T-014
    title: Login page
    status: merged
    size: M
    type: feature
    created: 2026-11-02T09:14:00Z
    merged: 2026-11-02T09:41:00Z
    depends_on: []
    branch: orc/T-014
    decisions:
      - q: Should people stay signed in after closing the browser?
        a: Yes, for 30 days
        default_used: true
    models: { scout: haiku, worker: sonnet, reviewer: opus }
    tokens: { scout: 18000, worker: 310000, reviewer: 95000 }
    cost_usd: 1.84
    review_rounds: 1
    checks: pass
    summary: A login page at /login with email and password. Sessions last 30 days.
    try_it:
      - npm run dev
      - open http://localhost:3000/login
    ---
    ## Goal
    People can sign in with email and password and stay signed in for 30 days.
    ## Acceptance criteria
    - AC1 /login shows email and password fields and a submit button
    - AC2 a correct pair signs in and redirects to /
    - AC3 a wrong pair shows "Email or password is wrong" and stays on /login
    ## Out of scope
    Password reset. Social sign-in.
    ## How to verify
    npm test -- login
    curl -i localhost:3000/login

  the log, one line per event, written by the CLI and hooks only

    09:14  created      by control · size M proposed by scout
    09:15  answered     2 questions · 1 default used
    09:16  dispatched   worker sonnet · worktree T-014 · cap 40 turns · $8
    09:31  checked      pass · 12 tests · 1 smoke check added
    09:33  reviewed     round 1 · AC1 ✓ AC2 ✓ AC3 ✗ error text differs
    09:37  fixed        round 1 · 1 commit
    09:39  reviewed     round 2 · 3/3 ✓ · proof: commands re-run, output quoted
    09:41  merged       a41c9e2 · worktree removed
    09:41  cost         $1.84 · scout 18k · worker 310k · reviewer 95k
    09:41  lesson       L-041 filed to reference
```

```
$ orc explain models

  rule one: the expensive model only thinks. Everything else is cheaper, or
  is a script.

  role        model         effort   why
  ─────────── ───────────── ──────── ───────────────────────────────────────
  control     your session  high     spec and questions need judgment and
                                     are short
  scout       haiku         low      read-only, lists files, about 20k tokens
  worker      sonnet        medium   builds · opus when size L or escalated
  reviewer    = worker      high     fresh process, no shared context, one
                                     lens per judge · opus only on size L.
                                     no evidence says a bigger reviewer finds
                                     more; fresh eyes and reasoning do
  fixer       = worker      medium   same model as the build round
  scripts     none          -        board, cost, state, dashboard, dedupe

  rule two: ceremony follows size. The scout proposes, control confirms.

  size   definition                                   worker   review
  ────── ──────────────────────────────────────────── ──────── ───────────────
  S      ≤1 file · text, config, style · no new       sonnet   none · checks
         behavior                                               only
  M      ≤5 files · one behavior · no schema, auth,   sonnet   sonnet · bug judge
         payments or deletion
  L      anything else, or a forced domain            opus     opus · bug,
                                                                proof, simplify
  chore  type: chore · renames, formatting, deps      haiku    none · checks
                                                                only

  forced to L whatever the file count: auth, payments, data deletion,
  migrations, secrets handling, any external API that moves money.

  rule three: escalate on evidence, never on a hunch.

    checks fail twice at sonnet ──────▶ re-dispatch once at opus · logged
    an AC still fails after 2 fix rounds ──▶ needs-you · never a third model
    nothing escalates above opus by itself · fable only if you set it

  rule four: measure, then tune. The Cost view keeps, per model and size,
  tickets, average review rounds, reopen rate and cost per merged ticket.

    $ orc models suggest
    sonnet on M  ·  1.2 review rounds  ·  0 reopened of 14  ·  $1.90 avg
    opus   on M  ·  1.1 review rounds  ·  0 reopened of  6  ·  $6.40 avg
    → keep sonnet on M. No change suggested.

  where to override

    orc.yaml     models: { worker: { S: sonnet, M: sonnet, L: opus } }
    orc.yaml     models: { reviewer: { M: worker, L: opus }, reviewer_effort: high }
    per ticket   /orc --model opus add a login page
    per role     agents/*.md frontmatter · aliases sonnet | opus | haiku | inherit

  aliases resolve to the current generation. Pin full ids in orc.yaml when a
  fixed model matters: claude-opus-5-5, claude-sonnet-5-5, claude-haiku-5-5.
```

```
$ orc explain storage

  state is JSON, words are markdown. In both store modes the truth for a
  ticket is .orc/tickets/T-014.json (one record) plus T-014.events.jsonl
  (append-only), committed with the project. The vault file keeps the spec
  text people edit, under a header orc renders and never reads back.
  Every lab that used markdown as machine state moved off it; so does orc.

  store: vault        default · records in .orc/tickets · vault holds the words
  store: postgres     opt in · the same records mirrored into rows

  agents never touch the store. They read a rendered spec and write through
  orc commands, so switching stores changes no prompt.

  vault                              postgres
  ────────────────────────────────── ──────────────────────────────────────
  .orc/tickets/T-014.json            task_current_state → task_state_revisions
  .orc/tickets/T-014.events.jsonl    task_events
  .orc/tickets/T-014.receipts.json   reports (kind: receipt)
  .orc/tickets/T-014.handoff.json    reports (kind: handoff)
  Tickets/T-014.md                   the spec text, rendered header
  git history of the spec            task_state_revisions, every version
  Lessons/L-041.md                   knowledge_entries
  Reports/T-014/*.md                 reports
  .orc/state.json                    agent_sessions, turns, transcript_cursors
  depends_on:                        task_links
  links in the spec                  sources, task_sources
  (none)                             intake_candidates, memory_jobs

  the schema, five groups, as in the reference diagram, minus tenants:
  one database is one project

   tasks                  task state               sessions & turns
   ┌─────────────┐        ┌───────────────────┐    ┌──────────────────┐
   │ tasks       │───────▶│ task_events       │───▶│ turns            │
   │ task_links  │        │ task_state_revs   │    │ turn_items       │
   │ task_merges │        │ task_current_state│    │ agent_sessions   │
   │ intake_cand.│        │ knowledge_entries │    │ transcript_cursors│
   └──────┬──────┘        └───────────────────┘    └──────────────────┘
          │               sources & outputs        maintenance
          │               ┌───────────────────┐    ┌──────────────────┐
          └──────────────▶│ sources           │    │ schema_migrations│
                          │ task_sources      │    └──────────────────┘
                          │ reports           │
                          │ memory_jobs       │
                          └───────────────────┘

  full DDL: plugins/orc/storage/schema.sql · 17 tables, 2 views · applied clean on
  Postgres 16

  why opt in: several people or machines on one project · a hosted
  dashboard · SQL over cost and review data · an inbox (Discord, Slack,
  GitHub issues) feeding intake_candidates

  $ orc store postgres
  ORC_DATABASE_URL is not set. Put it in your shell, not in a file an agent
  can read. Then run again.                          ← the secrets rule holds
  $ orc store postgres
  applied 0001_initial · 14 tickets imported
  store: postgres · mirror: vault/ regenerated after every event

  commands   orc store status | migrate | import | export | postgres
  driver     psql on PATH, no npm dependency · uses pg when the project has it
```

```
$ orc explain security

  it stops for exactly three reasons. Everything else runs.

  1 secrets      never read, written or printed by an agent
                 deny  Read(**/.env*)  Read(**/*secret*)  Read(**/*credential*)
                       Read(**/*.pem)  Read(**/*.key)     Read(**/id_rsa*)
                 a Read deny also blocks Edit and Write on that path
                 needs one? the ticket goes to needs-you:
                 "Put STRIPE_SECRET_KEY in .env.local, then: orc resume T-019"

  2 destructive  git push --force · reset --hard · branch -D · clean -fdx
                 rm -rf outside the worktree · DROP TABLE · migrate reset
                 interactive → asks you · background → deny + needs-you

  3 production   deploy · publish · push to any remote but the ticket branch
                 ssh to a host · anything in orc.yaml production:
                 interactive → asks you · background → deny + needs-you

  how one hook does it

    tool call ──▶ PreToolUse hook ──▶ match orc.yaml security lists
                                            │
                           no match ◀───────┴───────▶ match
                              │                         │
                            allow          ask (interactive) / deny (background)
                                                        │
                                                        ▼
                                             turn_item blocked = true
                                             ticket → needs-you, with the reason

  the lists live in orc.yaml and fit on one screen

    security:
      secrets:     ["**/.env*", "**/*secret*", "**/*credential*",
                    "**/*.pem", "**/*.key", "**/id_rsa*"]
      destructive: ["git push --force*", "git reset --hard*", "rm -rf *",
                    "git clean -fdx*", "DROP TABLE*", "*migrate reset*"]
      production:  ["vercel --prod*", "npm publish*", "ssh *", "kubectl apply*"]

  not a pause: new dependencies (allowed, logged) · edits inside the worktree
  · tests · reading your code · commits on the ticket branch
```

```
$ orc explain proof

  the one rule the research kept repeating: nothing an agent writes is a
  result. tests, "done" claims, lessons and status are claims until orc
  has run something itself.

  receipts     orc check runs the check command, every enforce-tier lesson
               check and every "$ " line of the spec in the worktree, and
               stores {sha, command, exit, tail} per run. A receipt whose
               sha is not HEAD is stale.
  revert       with new or changed tests present, orc applies the
               production diff in reverse, runs the check, restores. Tests
               that still pass are INERT and the reviewer is told so.
  ratchet      tests and fixtures that existed before the ticket are
               read-only for the worker (hook). New test files are welcome.
  judges       each review pass is its own fresh process with one lens:
               bug, proof (audits the receipts, does not generate them),
               simplify (deletions and reuse only, never blocks). Findings
               carry a confidence; only 0.7 and above cause a fix round.
               A judge that cannot tell says unknown instead of pass.
  hack shapes  every judge is told what cheating looks like: special-cased
               inputs, hard-coded outputs, tests on mocks, edited or skipped
               tests, changed check config, process.exit(0) escapes.
  stop is ok   the worker is told that stopping and reporting a flawed
               spec, test or environment counts as success. Published
               numbers: an explicit abort path cut cheating from 54% to 9%.
  handoff      every round ends with .orc/tickets/T-014.handoff.json
               (goal, done-when, files changed, assumptions, unresolved,
               check result). The next round is a fresh process that reads
               it; orc never resumes a session into its own mistakes.
  commits      Conventional Commits everywhere: the worker's commits are
               checked by the guard (type(scope): subject, under 72 chars,
               Refs: T-### footer); the merge squashes a ticket into one
               commit built from the ticket (type from the ticket type,
               scope from the files, body = the criteria, footers = Refs,
               Reviewed-by, Receipts); undo is a revert: commit.
  stall        3 identical tool calls warn, 6 stop; the worker gets 2x its
               size's minutes as a wall-clock cap; a cap hit writes the
               handoff and re-dispatches once fresh before needs-you.

  sources: docs/research/05-orchestration-practices.md
```

```
$ orc explain lessons

  three tiers · nothing waits for you · you can veto · every lesson is
  validated, stamped and expires, because a wrong rule that persists
  measurably hurts later runs and overviews cost tokens for nothing

  reference   never loaded globally · the scout injects the ones whose scope
              matches the ticket's files · every reviewer candidate lands
              here after dedupe
  guide       short negative rules in .claude/rules/orc-<scope>.md · hard cap
              30 lines per file · promoted on the second trigger · at the cap
              the least recently triggered rule falls back to reference
  enforce     a lesson with a check, violated twice, becomes a hook entry or
              a smoke check from a template · the done card says so

    reviewer finds a bug class
         │
         ▼
    candidate { trigger, rule, scope, check?, confidence }
         │ dedupe: same normalized rule → trigger_count + 1 · else new L-###
         ▼
    ┌ reference ┐ ─ triggered again ─▶ ┌ guide ┐ ─ violated again, has check ─▶ ┌ enforce ┐
    └───────────┘                      └───────┘                                └─────────┘
         ▲                                 │ cap hit, least recently triggered
         └─────────────────────────────────┘

  a lesson file

    ---
    id: L-041
    tier: guide
    scope: "src/auth/**"
    confidence: 0.85
    trigger_count: 2
    last_triggered: 2026-11-02
    check: "! grep -rn 'localStorage.setItem(.*token' src/auth"
    ---
    Never store the session token in localStorage. Use an httpOnly cookie.
    Seen in T-014 (review round 1) and T-019.

  veto      orc lesson reject L-041       → provenance: mistake, never re-added
  demote    orc lesson tier L-041 reference
  shape     one sentence · starts with Never, Always, Do not, Only, Avoid,
            Prefer · has a scope · anything else is rejected at the door
  stamp     provenance: hypothesis (seen once) → verified (seen twice) ·
            model: the generation it was observed on
  expiry    untriggered for 60 days → kept on disk, not loaded into prompts
  budget    at most 20 rules reach one worker prompt · no failure stories,
            only the rule
  shipped   45 lessons about running agents · the enforceable ones are hooks
```

```
$ orc explain dashboard

  one file · vault/Dashboard.html · no server · regenerated by a hook after
  every ticket event · commit it and GitHub Pages hosts it

  ┌─ shop ──────────────────────────────────────── checks ✓ · $14.20 this wk ─┐
  │ Board   Tickets   Cost   Lessons   Health                                 │
  ├──────────────┬──────────────┬──────────────┬──────────────┬──────────────┤
  │ queued     2 │ building   1 │ reviewing  1 │ needs-you  1 │ merged    14 │
  │ T-021 S      │ T-019 L      │ T-020 M      │ T-018 M      │ T-014 M      │
  │ T-022 M      │ opus · 12 min│ round 1      │ put STRIPE_  │ $1.84        │
  │              │ $3.10 so far │              │ SECRET_KEY   │ T-013 S      │
  │              │              │              │ in .env.local│ $0.21  ...   │
  └──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘

  Ticket view    plain-words summary · try it · decisions · AC1..n with the
                 review verdict · checks output · cost per agent · log link
  Cost view      per ticket, per model, per week · review rounds and reopen
                 rate per model · this feeds orc models suggest
  Lessons view   tiers, trigger counts, promotions, the veto command
  Health view    last check run · open needs-you · merged this week · median
                 prompt-to-merge time
```

```
$ orc explain cost

  no agent types a number. The harness does.

    subagent engine   (fallback) SubagentStop hook → agent_transcript_path → usage per
                      assistant message → turns rows → ticket totals
    headless engine   (default) claude -p --output-format json → usage, total_cost_usd
                      → one turns row per run · --max-budget-usd enforced by
                      Claude Code itself

  list prices, orc.yaml pricing: · USD per million tokens · 2026-10

    model    input   output   cache read
    fable    10.00   50.00    -
    opus      4.00   20.00    0.20
    sonnet    2.00   10.00    0.20
    haiku     0.10    0.50    -

  on a Max or Pro plan nothing is billed per token. The number is still kept
  because it is the only honest measure of what a ticket consumed.

  caps per dispatch, orc.yaml caps:
    turns     worker 40 · reviewer 20 · scout 15
    budget    S $2 · M $8 · L $25 at list price
    stall     10 idle minutes → killed → needs-you
```

```
$ orc explain lifecycle

   queued ──▶ asking ──▶ building ──▶ checking ──▶ reviewing ──▶ merged
                │           ▲            │ fail        │ findings     │
                │           │            ▼             ▼              │
                │           └──────── fixing ◀─────────┘              │
                │                     (≤2 rounds)                     │
                │                        │                            │
                ▼                        ▼                            ▼
            needs-you ◀──── secret · destructive · production       undone
                │           cap hit · stall · third failure      (orc undo)
                │ orc resume T-###
                ▼
            building

   failed   only by orc close T-### --failed

  every transition is one task_event and one state revision. The dashboard
  and orc status read the current state only. Undo writes one revert commit
  and opens a new ticket that depends on the undone one.
```

```
$ orc explain agents

  agent     model     may read                may write                tools off
  ───────── ───────── ─────────────────────── ──────────────────────── ───────────────
  control   session   everything but secrets  the vault, via orc       Edit on code
  scout     haiku     the repo, lessons       Reports/<T>/scout.md     Edit, Write,
                                                                       Bash writes
  worker    sonnet or spec, last findings,    its own worktree only    main, secrets,
            opus      the repo                                         production
  reviewer  opus      spec, diff, checks      Reports/<T>/review-N.md  Edit, Write,
                                                                       git commit

  agents/worker.md, the frontmatter that makes it so

    ---
    name: orc-worker
    description: Builds one ticket in its own worktree. Dispatched by orc.
    model: sonnet
    effort: medium
    isolation: worktree
    maxTurns: 40
    disallowedTools: ["WebSearch"]
    ---

  the worker prompt is four things: the spec, the last review findings, the
  files the scout named, and the guide-tier rules that match. Under 3k tokens
  before it reads a single file.
```

```
$ orc explain hooks

  event             matcher          does
  ───────────────── ──────────────── ────────────────────────────────────────
  PreToolUse        Read|Edit|Write  secret paths denied · worker writes
                                     outside its worktree denied · spec,
                                     records and state writable by orc only ·
                                     test ratchet: tests and fixtures that
                                     existed before the ticket are read-only
                                     for the worker (new test files allowed)
  PreToolUse        every tool       stall detector: the same call 3 times
                                     warns, 6 times stops the run
  PreToolUse        Bash             destructive and production lists: ask or
                                     deny · git on main from an agent denied ·
                                     git add -A denied while worktrees exist
  SubagentStop      *                (subagent engine only) parse the
                                     transcript → tokens and cost · the
                                     headless engine reads the json result
  Stop              *                regenerate Dashboard.html, Board.md and
                                     Home.md if any ticket changed
  SessionStart      *                inject five lines from state.json: in
                                     flight, needs-you, last merged
  UserPromptSubmit  *                if a ticket is asking or needs-you,
                                     remind control once

  plugin hooks run inside subagents and receive agent_type, so one guard
  script branches per role. Per-agent hooks in frontmatter are ignored for
  plugin agents, which is why every guard lives in hooks/hooks.json.

  exit 2 blocks even under bypass permissions. That is the point.
```

```
$ orc explain commands

  setup     orc init [--store vault|postgres]   orc doctor   orc explain [topic]
  tickets   orc new "<title>" [--size S|M|L] [--type feature|fix|chore]
            orc ticket show|list|set T-014      orc ready     orc needs-you
  run       orc run T-014 | orc run "<request>"    the engine, start to done card
  steps     orc scout T-014 --run    orc dispatch T-014 [--model m]
            orc check T-014 runs the check command and every "$ " line of
            the spec itself, keeps receipts, and reverts the production
            change to prove the new tests fail without it
            orc ticket allow-tests T-014 <glob>   logged exception to the
            test ratchet, after a reviewer or you decided a test was wrong
            orc check T-014    orc review T-014    orc merge T-014
            orc undo T-014     orc resume T-014    orc close T-014 --failed
  see       orc status   orc dashboard [--open] [--watch]   orc cost [T-014|--week]
  learn     orc lessons list|apply    orc lesson reject|tier L-041
  models    orc models suggest
  store     orc store status|migrate|import|export|postgres
  internal  orc hook <event>   called by hooks.json, not by you

  /orc <prompt> inside Claude Code runs new → scout → questions → spec,
  then hands the ticket to `orc run`. You rarely type the step commands.
```

```
$ orc explain levels

  level 0   default · one ticket builds at a time · scout, worker, reviewer ·
            three security pauses · lessons · dashboard · vault store
  level 1   orc.yaml level: 1 · parallel tickets from orc ready · roles with
            write-path ownership · model routing per role · postgres store
  not yet   client billing and invoices · weekly reports · Obsidian pack ·
            cloud sessions · agent teams · a web server

  still a spike, decided on day one of the build
    engine      subagent (native worktree isolation) vs headless claude -p
                (exact usage, budget flag, survives a closed terminal)
    transcript  whether subagent transcripts carry usage per message
```
