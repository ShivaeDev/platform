---
"@shivaedev/quality": minor
---

### Quality rules

- `biome/plugin`: the `ambient-runtime` plugin reports the browser I/O globals `fetch`, `localStorage`, `sessionStorage`, `indexedDB`, `WebSocket`, `EventSource`, `Worker` and `SharedWorker` in five more forms outside `adapters/`, `test-support/` and tests: a shorthand property (`{ fetch }`), a local re-export (`export { fetch }` or `export { fetch as send }`), computed access with a string literal on `globalThis`, `window` or `self` (`window["localStorage"]`, `self?.["indexedDB"]`), optional member access on those receivers (`globalThis?.fetch`), and object destructuring from them in a variable declaration with an unquoted key (`const { fetch: send } = globalThis`). Fix each finding by moving the call behind a module in `adapters/` that returns an Effect, or by sending HTTP requests through Effect's `HttpClient`. Record existing findings with `quality baseline write --rule biome/plugin`.

### Changed

- A file that binds `globalThis`, `window` or `self` itself, such as a parameter named `window`, no longer gets a browser I/O finding for members of that binding, as a bare name the file binds was already exempt.
