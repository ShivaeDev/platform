---
"@shivaedev/quality": minor
---

### Changed

- The `ambient-runtime` Biome plugin reports browser I/O globals (`fetch`, `localStorage`, `sessionStorage`, `indexedDB`, `WebSocket`, `EventSource`, `Worker`, `SharedWorker`) in five more forms outside `adapters/`, `test-support/` and tests: a shorthand property (`{ fetch }`), a local re-export (`export { fetch }` or `export { fetch as send }`), computed access with a string literal on `globalThis`, `window` or `self` (`window["localStorage"]`, `self?.["indexedDB"]`), optional member access on those receivers (`globalThis?.fetch`), and object destructuring from them (`const { fetch: send } = globalThis`). Move each such use into an `adapters/` module that returns an Effect, or send HTTP requests through Effect's `HttpClient`.
- A file that binds `globalThis`, `window` or `self` itself, such as a parameter named `window`, no longer gets a browser I/O finding for members of that binding, as a bare name the file binds was already exempt.
