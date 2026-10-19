---
"@shivaedev/work-board": patch
---

### Changed

- Table and All work on Now scroll with the page instead of inside fixed-height boxes, and so does the phone's Now lane. The table header sticks below the workspace header.
- Switching between Now, All work and Table keeps the page still while the results already start in the top three quarters of the view, and the focused results show the Board's control focus ring instead of the browser outline.

### Fixed

- A task with an open ask for you, linked through `attention.unblocks`, sits in **Waiting on a person** and its card reads "Waiting on your answer". Asks only for agents and questions that only relate to a task leave it where it was.
- An item's header says "Needs you" only when an open ask is for you, and "Waiting on agents" when only agents can answer it, matching Now and Today.
- All work cards and the table's Kind column name a goal's kind "Goal" instead of "PROJECT" or "project".
