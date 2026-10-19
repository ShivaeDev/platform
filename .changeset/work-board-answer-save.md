---
"@shivaedev/work-board": patch
---

### Changed

- Answering from Today closes the popover as soon as the server saves the answer. The row leaves Needs you at once and "Answer saved" appears beside the heading while the Board refreshes in the background. The popover says "Saving your answer…" while it waits.
- The Today popover shows the options or recommendation from the question's body in a collapsed section, and its link reads "Read the full question".
- Today and the item page use the same words: "Your answer", "Answers so far" and "More options".
- The Today popover disables its answer controls while the Board's live connection is reconnecting, and says why.
- Screen readers name the popover's answer group after the question's title instead of its IDs.
- The browser saves an answer with one `answerQuestion` command that registers the question and records the response together.

### Fixed

- An answer whose browser closes mid-save is still saved in full, so a registered question never lands without its response.
