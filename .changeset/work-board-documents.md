---
"@shivaedev/work-board": patch
---

### Changed

- Markdown tables in documents use the Board's table styling, wrap at word boundaries and scroll sideways inside their own box when they are wider than the page.
- Workspace notes show the board's introduction and its heading columns as readable text in the main column, with item cards under each column and the counts and last update in the header.
- Hovering an age such as "3h" shows the exact date and time.
- Item headers lead with the title, kind and status; the item ID follows in small muted type with a button that copies it.
- A missing file or unknown item ID shows an empty state with links back to Today and the Library.
- On a Board started without `--responses`, answer cards list the question and its options as text and say "Answering is turned off on this Board." with no form controls.
