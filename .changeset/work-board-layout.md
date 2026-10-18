---
"@shivaedev/work-board": patch
---

### Changed

- The Board's top bar stays in place while the page scrolls, and anchored sections land below it.
- Every page opens with the same header: title, an optional summary line and its actions. Item pages share the other pages' padding, and their actions, such as Save favorite, Prepare an agent handoff, Clear selections and Change your answer, are buttons. `DocumentView` accepts an `actions` slot for the title row.
