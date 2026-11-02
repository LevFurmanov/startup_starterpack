---
id: L-008
tier: reference
scope: any
confidence: 0.8
trigger_count: 0
last_triggered: null
check: null
origin: vectornews
---
Never pass a path starting with `/` to a Windows program from Git Bash without `MSYS_NO_PATHCONV=1`; MSYS rewrites it to `C:\Program Files\Git\...` and the file is "not found".
