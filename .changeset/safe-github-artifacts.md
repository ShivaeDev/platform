---
"@shivaedev/github": minor
---

### Breaking

- `downloadArtifactArchive` now returns an array of `{ path, bytes }` files instead of raw ZIP bytes. Install the optional `@zip.js/zip.js` peer and consume these validated files instead of passing the result to an application ZIP reader. Extraction refuses unsafe paths, symlinks, duplicate paths and file/directory conflicts, with distinct typed errors. The default caps are 100 MiB of extracted contents and a per-entry compression ratio of 100:1; set `totalSizeLimit` and `compressionRatioLimit` to change them. The existing `byteLimit` still caps the downloaded ZIP.
- The low-level `artifacts` constructor now takes `(apiUrl, rates)` and returns an Effect. Yield it with `HttpClient`, `GitHubToken` and `TokenRefresh` provided instead of passing those services as arguments.
