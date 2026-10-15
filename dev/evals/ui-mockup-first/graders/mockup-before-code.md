---
type: llm
criteria: >
  Pass only if the final reply proposes making a static HTML mockup (a file the user
  opens in a browser, with fake data and no connection to the machine) for the user to
  review, and says it will wait for the user's approval before changing the real
  UI code. Fail if the reply edits or presents final production code changes as done,
  or skips the mockup, or offers only an ASCII sketch as the approval step.
---
