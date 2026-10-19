---
"@shivaedev/work-board": patch
---

### Changed

- A standalone question shows its answer card after its own text, so its context reads before the answer box. The answer box grows with the answer up to most of the screen height.
- Following a link to an answer card puts focus on the first option of a choice question, or in the answer box.
- The answer card no longer shows the local author label; it records under the label the browser remembers, or `maintainer`. **More options** names the kind of reply and the choice to replace an earlier answer in plain words, and offers that choice only when an earlier answer exists.

### Fixed

- When a question closes while you write, its answer card stays with your unsent draft read-only, a **Copy draft** button and what closed it, instead of disappearing.
