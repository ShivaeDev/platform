---
"@shivaedev/work-board": patch
---

### Changed

- While a page waits for its data, the Board shows a skeleton shaped like that page (lanes, table, cards, rows or document) instead of "Opening view…" or a blank page. Sections that load on their own, such as Fleet work, linked work and folders, show row skeletons.
- Empty lists, lanes, tables, search results and sidebar sections show an empty state that says what is empty, what fills it and, where one exists, a next step such as All goals, All work, Clear filters, Show all documents or Include files Fleet writes. A workspace with no work shows one empty state instead of six empty lanes, and a filtered table with no matches no longer shows a header-only table.
- System uses plain labels: "Codex usage", "GitHub request limits", "5-hour limit", "Weekly limit", "REST API", "4321 of 5000 requests left", "Files with problems" and stage names such as "Executing" instead of raw keys.
- Library says what each control does: "By title", "By folder", "Recently changed", "Include files Fleet writes (N)", and shows kinds in plain words.
