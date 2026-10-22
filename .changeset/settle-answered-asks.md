---
"@shivaedev/work-fleet": patch
"@shivaedev/work-board": patch
---

### Fixed

- Fleet's close-finished-decisions command settles asks whose current answers were already applied, closing their attention and marking their questions done. Unconsumed answers to earlier revisions stay open.
- Board migration stops reading successor lists at comma-separated prose, preserving item links without reporting ordinary words as unresolved successors or linking them to unrelated items.
