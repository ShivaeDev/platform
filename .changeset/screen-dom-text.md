---
"@shivaedev/test-story": minor
---

### Breaking

- Screen text readouts concatenate visible HTML text nodes without CSS text transforms or layout line breaks. Update text assertions to match DOM text content; hidden descendants remain omitted.
