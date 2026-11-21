---
"@shivaedev/build": patch
---

### Fixed

- The bundle check calls a module an operation file only when it takes `query` or `command` from `@shivaedev/contract/operation.ts`, read from the module's code as the bundler holds it, so a contract that imports only `stream`, such as the host's own `HostVersion`, is no longer one, and a browser bundle that uses `@shivaedev/react`'s `deployUpdate` builds with the check on. A namespace import, a dynamic import or a re-export of `operation.ts` still counts as taking `query` and `command`, and a file that re-exports either is an operation file itself.
