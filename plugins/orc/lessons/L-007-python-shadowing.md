---
id: L-007
tier: reference
scope: "**/*.py"
confidence: 0.85
trigger_count: 0
last_triggered: null
check: null
origin: vectornews
---
Never name a script after a standard or installed module (`json.py`, `test.py`, `types.py`); Python imports the local file first and everything downstream breaks silently.
