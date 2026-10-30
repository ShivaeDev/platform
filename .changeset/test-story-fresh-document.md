---
"@shivaedev/test-story": patch
---

### Fixed

- Every story in the DOM environment starts with no cookies, `localStorage` or `sessionStorage`, so a story no longer passes or fails because of what an earlier story in the same file stored.
