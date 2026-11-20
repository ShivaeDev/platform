---
"@shivaedev/identity": minor
"@shivaedev/contract": minor
"@shivaedev/admin": patch
---

### Added

- `@shivaedev/identity`: `delegatedSubject({ service, refusal, deny })` from `@shivaedev/identity/subject.ts` declares a delegation once, and a module names it as its `subject`. On each call whose subject is not the actor, the guard asks the application's rule, the service with that id in the host's `services`, `allows({ subject, module, operation, kind })` with `CurrentViewer` set to the actor, where `kind` is `read` for queries and streams and `write` for commands; `false` fails the call with the declared refusal before the handler runs. Streams ask again at every recheck, and a delegated live query's changes stream also asks before each update it sends. A host that serves such a module without the service is rejected by the compiler and fails to start with `DelegationRuleMissing`, naming the service.
- `@shivaedev/contract`: `operationKind(rpc)` from `@shivaedev/contract/operationKind.ts` tells whether an RPC reads or writes.
- `@shivaedev/contract`: a contract's `declaration.subject` records the subject declaration it names.

### Breaking

- `@shivaedev/contract`: `SubjectDeclaration["middleware"]` may now fail, and `subjectLayers(group)` carries that failure in its error channel. A custom native RPC host that builds `subjectLayers(group)` handles or propagates the declarations' start-time failures, such as `DelegationRuleMissing`; hosts built with `appHost` need no change.
- `@shivaedev/identity`: `SubjectResolver` has a third operation, `delegated(rule, deny)`. A host that provides its own `SubjectResolver` instead of `subjectResolverLayer()` adds it, or switches to `subjectResolverLayer()`.

### Fixed

- `@shivaedev/admin`: an admin page rebuilt from a contract keeps the contract's subject and guards each operation with it once, and re-applies only the middleware applied to the whole contract instead of the first operation's.
