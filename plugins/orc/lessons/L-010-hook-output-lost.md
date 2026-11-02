---
id: L-010
tier: reference
scope: any
confidence: 0.8
trigger_count: 0
last_triggered: null
check: null
origin: vectornews
---
Never rely on stdout from a git hook or a background job to surface an error; write the failure into a file the next step reads, or it is lost.
