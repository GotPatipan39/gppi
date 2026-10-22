---
type: llm
criteria: >
  This is a large multi-stage job. Pass only if the reply does NOT jump straight into
  writing code or a full design, and instead proposes starting by questioning/grilling
  the plan (or asks the user's permission to do so), mentions or implies the later
  stages (spec, tickets, implementation), and waits for the user's answer. Fail if it
  writes implementation code or a finished spec without asking.
---
