# North star

## The problem

Native Effect atoms already know how to run, refresh and share an asynchronous result. A React application still needs to decide what to display while they work, what to keep when a request fails and which lifetime owns their registry. Repeating those decisions in every screen makes them drift. One screen blanks during a refresh, another loses a draft when a response arrives, and a third keeps the previous session's state after the user changes.

Editing combines two kinds of state. A server row can change independently, while the user types encoded input values that a schema must decode before saving. The latest server response is not necessarily the user's latest intent. Whole-form replacement makes a simple screen overwrite newer edits; leaving the form alone makes untouched fields stale. A create form adds another race: clearing the successful entry must not clear what the user has already begun typing for the next one.

## The ideal

React components read state in the words they render: data, failure, pending and refreshing. An editor says which query supplies its row, which fields describe its inputs and which Effect saves the decoded values. A session root says which identity owns those screens. Each definition stays small because the package supplies repeated coordination, while native Effect and effect-form remain the owners of the underlying work.

Good client state has these properties:

- Useful data can stay on screen during refresh and after a refresh failure. Showing retained data does not hide the failed result.
- A draft belongs to one query identity and one session generation. Changing either must not transfer edits into a different record or person's screen.
- A refresh, a normalized save result and a create reset respect edits made after the operation began. Untouched fields can adopt new server values without replacing newer input.
- Failure types reach the component. A field rejection names its field; another failure remains available for application-owned wording.
- An action reports the native atom's current state honestly. An imperative caller that needs one invocation's outcome runs an Effect with that lifetime instead of guessing from a shared latest-result atom.
- A registry has an owner. Session replacement and unmount release the old generation, including work created around React's StrictMode and Activity lifecycles.

## Boundaries

The root repository's one path for client state is this package. It should add React coordination where applications repeat it, without taking a neighbouring package's job:

- Native atoms own execution, identity, cache retention, invalidation and action scheduling.
- effect-contract owns query and command declarations, declared rejections and native client bindings. Its shared resume source also works without React.
- effect-form owns encoded fields, schema decoding, validation, submission and draft merge rules. The editor and create hooks arrange those pieces around rows and command results.
- The platform request modules and the application's auth integration verify identity. The session boundary owns a client-side generation; its `recheck` callback asks the auth owner for a verdict.
- The application owns transport, loading/error wording, credential rotation policy and the point where a runtime runs a particular Effect.

## Trade-offs

1. **Native ownership before convenience.** A second query cache or parallel form model would make easy call sites look simpler while giving the application two places to understand identity and cleanup. Thin bindings keep the native state visible.
2. **Identity isolation before draft continuity.** A draft is valuable only within the record and session that created it. Switching identities starts fresh even if retaining a previous draft would save typing.
3. **Newer intent before replacing the whole form.** A response updates what it can without erasing fields the user edited meanwhile. A user who wants the server's latest values can explicitly revert.
4. **Truthful shared state before per-call ergonomics.** One atom's result cannot describe several concurrent invocations independently. The action hook preserves its native semantics rather than implying a Promise belongs to one dispatch.
5. **Observable evidence before brevity.** A helper earns its place by removing repeated application code and having tests for the races and lifetimes it claims to handle. A DOM fixture proves that fixture, not another runtime or deployment.

## What it leaves out

The package does not define another RPC contract language, replace native atom scheduling or decide an application's auth policy. It does not supply a general form language, an optimistic reconciliation strategy or an offline write queue. Server rendering and mobile host integration need their own architecture and evidence; a resume callback alone cannot establish them.

Use [README.md](../README.md) for examples and [roadmap.md](./roadmap.md) for what is implemented and which choices remain with the maintainer.
