---
"@shivaedev/work-fleet": patch
---

### Fixed

- When a prepared task is edited on the Board in a way Fleet cannot accept by itself, for example handed to a person, the decision card now says so and asks to undo the edit and try again, or hand the task back. It replaced the generic "Something changed" card, whose retry kept failing while the edit stayed.
