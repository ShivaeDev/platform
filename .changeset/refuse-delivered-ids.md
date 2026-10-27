---
"@shivaedev/work-board": patch
"@shivaedev/work-fleet": patch
---

### Fixed

- Refuse new briefs that reuse a delivered id, name the earlier delivery in Board diagnostics, and leave their source untouched. Existing brief retries and follow-up dispatches retain their source identity.
- Write brief completion status only for work Fleet dispatched for that source.
