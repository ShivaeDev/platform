# North star

## The problem

A feature crosses several boundaries. A service knows its input, result and expected failures. An RPC operation repeats them. A client needs the same types, then separately needs to know which queries a successful write should refresh. When those descriptions live apart, they drift: a failure becomes an untyped message, a newly created item does not refresh, or a broad invalidation replaces unrelated views.

Effect already provides the underlying pieces: Schema, typed Effects, Rpc, RpcGroup, middleware, AtomRpc, Reactivity and Streams. The missing piece is a small declaration that ties the feature's boundary and read/write dependencies together. Replacing those native pieces would introduce another model to learn and another owner for errors, interruption and resource lifetime.

## The ideal

A feature declares its boundary once. Its payload and success come from Schema. Its expected failures are tagged rejection classes that handlers and clients share. Queries name the dependencies they read. Commands name the dependencies their successful results change, including IDs returned by a create operation.

That declaration is an ordinary native RPC group. Implementing, securing, hosting and calling it uses the APIs an Effect engineer already knows. The client binding adds only the mechanical work: register declared read keys on native query atoms and invalidate declared change keys after a successful call.

Freshness has one vocabulary. An item change invalidates that item and its collection list. A reconciliation request uses an explicit read scope, rather than guessing that a list key covers all item queries. Optional live hints and resume signals request those same reads again. They do not hold replacement data; the successful query remains authoritative.

## What good looks like

- A reader finds the input, result, rejection and dependency rule together, and an agent can infer the types without repeating them at call sites.
- A domain service can raise a rejection class that several operations reuse. Generated field rejections name the form fields they describe.
- An ordinary query/command feature needs no subscription. A feature needing live freshness composes a native Stream with the same registry and keys.
- A successful command refreshes affected views. A rejected command leaves those reads alone. A reconnect reconciles the caller's explicit scope, including changes missed while disconnected.
- Native atoms retain query state and own stale-request interruption. The helper never becomes another cache or a parallel resource owner.
- Browser code can import declarations, bindings and resume signals without bringing in React or server implementation packages.
- Type tests, native client tests and real HTTP tests make different claims. Each claim stops at the boundary its evidence actually exercises.

## Trade-offs

- **Native composition over a shorter host setup.** Applications choose their native middleware, server host, serialization and AtomRpc service. The package removes repeated declarations without concealing those decisions.
- **Precise dependency keys over convenient broad refresh.** A feature must name its reads and changes. Reconciliation must name a common scope when it needs one. Incorrect dependency discovery is an application error the library cannot infer away.
- **Ordinary calls over mandatory streaming.** Live invalidation is optional. No query waits for a journal sequence, subscription cursor or change acknowledgment to return its domain value.
- **Bounded observations over replay.** Paused live coordination records a bounded observation count and asks for current values on resume. It does not retain an unbounded list of events or promise recovery of each source change.
- **Typed expected failures over transport-owned business wording.** Rejection schemas describe domain failures. Authentication policy, user-facing text and error presentation remain with the application and neighbouring packages.
- **Consumer evidence over speculative helpers.** Add an abstraction after a consuming feature demonstrates repeated work. Preserve the native route for cases the helper does not cover.

## What it deliberately leaves out

- Service implementations, repositories, SQL transactions and commit-bound publication. These belong to `effect-service`, `effect-sql` and `effect-changes`.
- Authentication policy, session resolution and request identity implementation. The shared server boundary belongs to `platform`; the application's host supplies its policy.
- React hooks, rendering, editable drafts and form submission state. These belong to `effect-react` and `effect-form`.
- A second client cache, a custom RPC transport or a required mutation atom.
- An event journal, replay cursor, authoritative data stream, offline writes or cross-process delivery policy.
- Claims of SSR, authenticated live delivery, physical browser lifecycle or native-device behavior based only on a local library fixture.

Package status belongs in [roadmap.md](roadmap.md). Framework composition and deployment decisions belong in the [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md).
