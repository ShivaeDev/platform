---
"@shivaedev/test-story": patch
---

### Fixed

- `fakeHttpService` no longer sends `content-type: application/json` on a reply without a `body` or `chunks`, such as `{ status: 204 }`, so a client that picks its parser from the content type no longer fails to parse the empty body as JSON. A route that names its own content type still sends it, and replies with a `body` or `chunks` keep the JSON default.
