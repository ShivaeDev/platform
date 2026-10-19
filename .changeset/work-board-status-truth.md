---
"@shivaedev/work-board": patch
---

### Fixed

- Items with status `dropped` count as closed: they leave Needs you and every needs-you count, and managed asks that target only dropped work resolve. One shared list of closed statuses now drives Needs you, goal progress and Now.
- Deferred goals no longer count as active. The goals query returns them in a new `deferredGoals` list, the Goals page shows them in a collapsed Deferred goals section, and Today, the sidebar and the active-goal counts leave them out. The MCP overview carries `deferredGoals` as well.
- Today's In progress falls back to the task files when Fleet is unavailable, the same way Now does. Rows say Task file, the section says the status comes from the task files and not live Fleet, and the summary reads "N in progress in task files". The `fleetItems` query carries this list as `authored` on its unavailable state.
