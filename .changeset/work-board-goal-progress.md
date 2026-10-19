---
"@shivaedev/work-board": patch
---

### Fixed

- Goal progress counts dropped work as done and ready work as planned, so ready items no longer inflate the in-progress count.
- Linked work that Fleet holds for a person counts as "needs you" in goal progress and gets its own group on the goal page, instead of reading as in progress.

### Changed

- Goal cards, the sidebar and Today show goal progress on the stock shadcn progress bar, and goal cards align at the top instead of stretching to the tallest card.
- The goal page charts linked work by state, overall and per criterion, with a stacked bar chart next to written counts.
- Linked work on a goal page is a table with Work, Criteria, State and PR columns, and each whole row links to its item.
- The goals query and the MCP goal summary report a `needs you` count beside `done`, `in progress` and `planned`.
