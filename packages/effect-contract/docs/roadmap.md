# Roadmap

This file owns effect-contract's implementation status and package questions. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns application composition, adoption and deployment validation; it links here instead of repeating these package milestones.

## Built

- [x] `query`, `command` and `contract`: Schema payloads/results, namespaced native RPC groups, inline declarations, typed defaults, native handler layers and middleware. Compiler fixtures and native client round-trips cover the declared types and failures.
- [x] Shared tagged rejection classes, generated operation-specific rejection classes and typed `reject` helpers. Field rejections derive and optionally narrow a struct's field names.
- [x] Unique operation names checked in literal declarations and at construction when arrays conceal them.
- [x] Collection item/list keys with native read hashing, deduplication and item-to-list mutation invalidation. Native Reactivity tests distinguish affected and unrelated items.
- [x] Native AtomRpc binding with query atoms and per-call Effects. Successful commands invalidate their declared keys, including keys derived from results; rejected commands do not invalidate. Client type checks cover matching, larger, incomplete and incompatible RPC groups.
- [x] Optional `LiveHint`/`Key` schemas and native live coordination: precise refresh, explicit first/reconnected scope reconciliation, a paused count capped at 256, typed stream failures and registry teardown. The framework guide owns the composed HTTP fixture evidence.
- [x] Shared browser/native `resumeSignal`. Synthetic event tests cover visible versus hidden browser events, injected native callbacks, native SWR composition and listener disposal. The installed consumer checks an otherwise unobserved source's initialization and cleanup through `live`.
- [x] Installed-package runtime and type fixtures for contracts, keys, rejection fields and live pause/resume composition.

## Next

No additional declaration or live helper is selected. A concrete consuming feature should establish the next repeated task before this package adds an abstraction. Host/proxy behavior, authenticated subscriptions, SSR and physical browser/mobile lifecycle remain framework or application validation work.

## Open questions

- Should query freshness, including live coordination and resume, remain this package's long-term scope? The APIs live here and public package consumers use them; the original declaration boundary does not by itself decide every future lifecycle helper.
- Is the exported lower-level `rejectionSet` intended for application authors as well as operation construction? It is public and the operation tests exercise its implementation; direct standalone use has no dedicated regression fixture.
- Which concrete consumer requirement should select the next package helper? There is no package-specific committed API backlog beyond the existing declarations, binding and freshness composition.
