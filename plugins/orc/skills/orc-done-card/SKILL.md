---
name: orc-done-card
description: How orc control writes the plain-words summary and "try it" steps shown on the done card and the dashboard. Loaded by the orc skill after merge.
user-invocable: false
---
The done card is what a non-engineer reads. Two fields, set with `orc ticket set T-### summary="..." try_it="[...]"`.

summary: two or three sentences. What they can now do that they could not before, in the words of the request. Name a URL, a button or a command if one exists. Never name files, functions or libraries. Never say "implemented" or "refactored".

try_it: two to four steps, each a command or a click, in order, starting from a fresh terminal. The last step says what they should see.

Add one sentence after the card in chat: one concept they could learn from this ticket, in plain words, with no link.
