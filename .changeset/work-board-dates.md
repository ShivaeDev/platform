---
"@shivaedev/work-board": patch
---

### Changed

- Every time on the Board reads the same way: "just now" under a minute, relative under a week, such as "4m ago", and a short local date after, such as "Oct 13, 09:35", with the year only when it differs. This covers Today rows, Now cards, Library, the Source tab, response history, workspace notes and System, which used to mix raw ISO timestamps, UTC strings and their own relative formats.
- Times use the regular sans font. On the Source tab records, System and the document context panel, pointing at, tapping or pressing Enter on a time shows its exact date, time and time zone, so keyboard and touch readers can reach it too. In list rows a time stays plain text, so each row keeps its link as its only Tab stop.
- Fleet card stages read "Executing, started 4h ago" instead of "Executing for 4h", and finished stages read "Done 4h ago".
