---
"@shivaedev/browser-check": minor
---

### Added

- Observe a page's live socket with scoped `watchSocket` and buffered `nextMessage` waits, so local checks can await the first query result and later server pushes without sleeps or polling.

### Breaking

- Custom `BrowserPage` implementations must add `watchSocket(url)`, returning a scoped observer with a `nextMessage` Effect. The provided Playwright adapter implements it.
