---
"@shivaedev/test-story": minor
---

### Breaking

- `screenDriver.text()` separates visible block elements and `<br>` with a newline when adjacent text has no whitespace, while preserving inline text. Update assertions that expected concatenated card titles, messages and actions to expect separated parts, and remove application-side splitting of those parts.
