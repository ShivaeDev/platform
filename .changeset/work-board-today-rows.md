---
"@shivaedev/work-board": patch
---

### Changed

- Today's Needs you rows drop the item ID, which the item page still shows. Each row has one primary button: **Answer** opens a popover with the request's options or a text answer and an **Open question** link, and **Open** links to the item page when a request can't be answered inline. On a phone the reason gets its own full-width line.
- Needs you reasons read as plain sentences. Fleet decisions start with "Fleet asks:" and their question, and a person's note drops the raw `owner:` and status prefixes.
- The Today popover says "Answering is turned off on this Board." when the Board runs without `--responses`.
