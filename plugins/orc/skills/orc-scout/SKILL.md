---
name: orc-scout
description: How the orc scout agent reads a repo for one ticket and writes its report. Preloaded by the scout agent.
user-invocable: false
---
Goal: let the worker start without exploring, and let control ask only what the code cannot answer.

Do, in order: read the request; grep for the nouns in it; open only the files that match; list the files the worker must touch or read (paths, not descriptions); pick the lessons whose scope matches those paths; propose a size; propose zero to three questions a non-engineer can answer, only where the answer changes the build.

Report frontmatter: `size`, `files` (list), `lessons` (list of ids), `questions` (list). Body under 40 lines: what exists, what is missing, risks.

Never read files matching secret patterns. Never propose technical questions ("which ORM?"). Never list more than fifteen files; if more matter, the ticket is L and you say so.
