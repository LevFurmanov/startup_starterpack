---
name: orc-skill-creator
description: Turns orc lessons into a reusable skill. Use when several lessons share a scope, when the user asks to "make a skill from what we learned", or to refine a skill that `orc lessons skill` generated.
user-invocable: true
argument-hint: <scope or skill name>
allowed-tools: Bash(orc *), Read, Write, Edit, Glob
---
Lessons are single sentences. A skill is the procedure that makes them unnecessary. Build the second from the first.

1. Run `orc lessons list` and collect the lessons for the scope in $ARGUMENTS. If the user gave a skill name that exists under `.claude/skills/`, read it and its listed lesson ids.
2. If no skill exists yet, run `orc lessons skill <scope> --name <name>` to generate the draft.
3. Rewrite the draft into a procedure. Group the lessons by the moment they apply (before editing, while building, before saying done). Turn each group into numbered steps a worker follows. Keep every lesson as a "Never ..." line in the section where it bites, with its id in parentheses so orc can trace it.
4. Every lesson that has a `check` becomes a step "run `<check>`; it must exit 0". Lessons without a check get one if a command can express them; add the check to the lesson with `orc lessons add --rule "<same rule>" --scope <scope> --check "<cmd>"`.
5. Frontmatter: `name`, a `description` that says when to use it in one sentence a model can match, `paths:` with the scope glob so Claude Code loads it only for those files, `user-invocable: false` unless the user wants to call it.
6. Keep the skill under 80 lines. Negative constraints only; no praise, no history.
7. Show the user the skill path and the one-line description. Ask nothing.
