---
"@shivaedev/build": minor
---

### Breaking

- `serverCodeIn` from `@shivaedev/build/serverCode.ts` reads which names each module takes from `@shivaedev/contract/operation.ts` from the new required `BundleModule.fromOperation`, and `ServerMarkers.operation` is removed. A caller that builds the graph itself drops `operation` from its markers and passes, for each module, the names it imports or re-exports from `operation.ts`, with `"query"` and `"command"` for a namespace import, a dynamic import, a re-export of everything or an import it cannot read; `buildPlugin`, `appViteConfig` and `bundleCheck` need no change.
- An `oldFormFolders` entry whose folder holds only contracts that import `stream` and no `query` or `command` excuses nothing now, so a build that passed fails and names the entry. Remove that entry: the bundle check accepts those contracts without it.

### Fixed

- The bundle check calls a module an operation file only when it takes `query` or `command` from `@shivaedev/contract/operation.ts`, read from the module's code as the bundler holds it, so a contract that imports only `stream`, such as the host's own `HostVersion`, is no longer one, and a browser bundle that uses `@shivaedev/react`'s `deployUpdate` builds with the check on. A namespace import, a dynamic import or a re-export of `operation.ts` still counts as taking `query` and `command`, and a file that re-exports either is an operation file itself. A module whose code names `operation.ts` in no import or export statement, such as a CommonJS `require()`, counts as taking both, and one whose code the check cannot read fails the build with its name.
