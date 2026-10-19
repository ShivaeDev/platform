---
"@shivaedev/work-board": patch
---

### Changed

- On a phone, Answer on Today opens a bottom sheet instead of a small popover, and its Answer and Record answer buttons are touch-sized. The phone navigation bar hides while you type in any text field, and the page fits above the on-screen keyboard.
- Opening Answer on Today puts focus in the text box, or on the first option, instead of the question's context.

### Fixed

- Today's answer keeps what you typed after you close it, and shares one draft with the item page for the same question: start on Today, finish on the item page, or the other way round.
- An option chosen on Today records the same response body as the item page, without a nested second copy of the recorded response.
- An answer recorded on Today includes everything in the shared draft, such as a note, reply kind or replaced answer set on the item page. Today says when it sends any of those and links to the item page to review them.
