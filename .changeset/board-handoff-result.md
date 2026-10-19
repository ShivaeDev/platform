---
"@shivaedev/work-board": patch
---

### Changed

- The handoff page is titled with the item, starts the agent name as the item's owner and keeps it after saving. A done or dropped item's next step starts empty with a placeholder instead of its old `next_action`.
- **Prepare handoff** saves directly; **Preview file** is optional. When the item changed under a draft, the first **Prepare handoff** binds the draft to the new version and a second one saves it. Preparing moves focus to the prompt, and one status line reports the save and the copy. **Prepare handoff** and **Copy prompt** use neutral buttons instead of the amber one.
- Earlier handoffs show how long ago they were prepared.
- The result page names each linked item by title with its status chip and offers **Prepare follow-up handoff**, and shows how long ago the report changed. An empty review and empty checks collapse into one line, and a feedback summary with a link to the feedback sits above the report.
