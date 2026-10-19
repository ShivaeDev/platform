---
"@shivaedev/work-board": patch
---

### Fixed

- When the Board server stops answering, a page now says "The Board server isn't answering" with a Retry button instead of showing `HttpError:`. Other read failures say the page couldn't be opened and offer Retry and System.
- The breadcrumb and browser title keep the page's name, file path or item ID when its data fails to load.
- An unknown `/_board/*` or other non-document URL shows the not-found page instead of the Templates page.
- A file or item link with invalid percent-encoding, such as `/notes/broken%E0.md`, shows the not-found page instead of crashing.
- A result link that names no single result, a handoff for a missing item and an item ID shared by two files now explain the problem in plain words, without error type names.
