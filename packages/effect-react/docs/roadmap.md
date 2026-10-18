# Roadmap

This roadmap owns the package's hooks, form coordination and session-registry implementation. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns composed feature fixtures, adoption and host/deployment validation. A local hook test is evidence for its own runtime and scenario.

## Built

- [x] Opt-in `keepPreviousData` retains the last successful query value across payload changes, pending requests and failures; the default resets it. Registry replacement clears retained data, superseded responses do not replace the latest result, and disabling retention drops an inherited value. [Rendered query evidence](https://github.com/ShivaeDev/platform/blob/main/packages/effect-react/src/queryPayload.dom.spec.ts).
- [x] Public `client/testing.ts` render helpers supply an isolated native registry per mount, retain it on rerender, and dispose native resources and remove the container on idempotent unmount. [DOM evidence](https://github.com/ShivaeDev/platform/blob/main/packages/effect-react/src/client/testing.dom.test.tsx) also exercises query refetch after a command through a test RPC Layer; it does not establish browser networking.
- [x] Native query and action hooks with inferred input/success/failure types, retained data, pending/refresh state and explicit refresh/dispatch methods. DOM tests cover query identity changes, shared query execution and latest-dispatch interruption; compiler fixtures cover types.
- [x] A session generation owning its client, registry and subtree, with replacement/sign-out cleanup, query Unauthorized rechecking and retained screens until the auth owner changes the session.
- [x] Unauthorized saves in `useCreate` and `useEditor` invoke the session callback exactly once and retain the draft and typed failure, including after rerendering and further edits. [Rendered save evidence](https://github.com/ShivaeDev/platform/blob/main/packages/effect-react/src/client/saveState.dom.test.tsx).
- [x] Unauthorized action failures invoke the session callback once per failed result and retain successful data and the typed cause, including after rerendering. [Rendered action evidence](https://github.com/ShivaeDev/platform/blob/main/packages/effect-react/src/client/sessionBoundary.dom.test.tsx).
- [x] Queries and actions preserve a successful `undefined` as `Option.some(undefined)` with settled pending/refreshing flags. Defect and interruption causes remain available, are not Unauthorized and do not request a session recheck. [Rendered result-state evidence](https://github.com/ShivaeDev/platform/blob/main/packages/effect-react/src/client/resultState.dom.test.ts).
- [x] `eventually` rethrows the last assertion failure after its three-second deadline; `expectNoReactWarnings` fails a test that logs to `console.error` and restores the spy even after that assertion fails. [Testing-helper evidence](https://github.com/ShivaeDev/platform/blob/main/packages/effect-react/src/client/testing.dom.test.tsx).
- [x] Session cleanup across StrictMode effect replay and Activity hiding, reveal and hidden unmount, with credential rotation tested against the chosen identity key.
- [x] `useEditor` composing query, fields and save Effect, with initial loading, per-query forms, per-field refresh/saved-result merges, normalized results and in-flight edits covered by rendered tests.
- [x] `useCreate` starting a fresh form after success while retaining fields edited during schema decoding or the request; submissions through the form API settle the hooks too.
- [x] Tagged field-rejection mapping, a typed custom mapper and compile-time requirements for rejection field types that exceed the form's names; other save failures remain separately available.
- [x] A resume module using effect-contract's shared implementation, with visible browser events, an injected native source, listener disposal and native stale-while-revalidate policy covered by tests.
- [x] TanStack Router query loaders sharing the native registry, with tagged RPC failures, refresh waiting and abort handling. Render tests cover shared query execution, the route error component and previous data during navigation.

## Next

- [ ] Verify changing hook configuration during one form lifetime before documenting any supported reconfiguration policy. Creation currently captures its initial configuration, and an editor holds submission functions per query identity.

## Open questions

- Do consumers need an independently scoped action helper, or are distinct native atoms and actual Effects enough for imperative per-invocation outcomes? Keep native shared-action semantics unless a demonstrated use case requires more.
- What per-request registry and hydration wiring does the TanStack Router host need for SSR? Client render fixtures do not establish SSR isolation.
- Which hook configuration values should be allowed to change without replacing the form? A rule for changing schemas, runtimes, save functions or initial values needs consumer evidence and explicit lifetime tests.
