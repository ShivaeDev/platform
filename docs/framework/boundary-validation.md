# Application-boundary validation

These fixtures test the native framework against database and application lifecycle behavior. Each establishes the particular boundaries it executes; application and deployment acceptance is tracked in the [roadmap](./roadmap.md).

| Area | Evidence | Boundary still open |
| --- | --- | --- |
| Reference order fixture (use the [starter](./quickstart.md) to create an app) | [PostgreSQL order feature](./composed-example.md): authenticated HTTP writes, commit-bound live hints, second-client query/editor refresh, two server processes, pg-boss commits, rollback silence and listener recovery | Browser networking, production auth, deployment proxies and durable delivery |
| PostgreSQL codecs | [Codec guide](./postgres-codecs.md): precise decimals, `int8` as `bigint`, dates and UTC timestamps, unsupported JSON/JSONB, nulls, generated values and decoding failures | Sub-millisecond precision policy; broader driver types |
| Constraint errors | [Known-constraint mapping](./constraint-errors.md): domain failure after rollback, unrelated errors preserved | Application-specific error names and UI text |
| Migrations | [PostgreSQL guide](./postgres-migrations.md): upgrade, rerun, failed batch and concurrent runners on new and existing ledgers | Deployment timeouts and authoring conventions; every runner must use the same helper and ledger spelling |
| Authentication | [Package session middleware](./auth-boundary.md): BetterAuth-issued cookies, typed expiry and revocation rejection, and request-local identity isolation through injected HTTP with SQLite | Application storage/host adoption, browser cookies and mobile policy |
| Cancellation | [Cancellation guide](./cancellation.md): overlapping action dispatches interrupt earlier work; Node abort signals follow connection lifetimes | HTTP host/proxy propagation, server interruption and already committed work |
| Client lifetime | [Session guide](./client-lifecycle.md): new session resets cache and drafts; refresh retains edits | Deployed auth lifecycle, SSR and Capacitor |
| Entry forms | [Expense-entry fixture](../../packages/effect-form/src/entryForm.spec.ts): decoded numeric submissions and optional date edits survive save/refresh races; [submission tests](../../packages/effect-form/src/form.test.ts) cover validation and failed-save retry | Component adoption in an application and product-native checks |

Native SQL reasons and Migrator cover the demonstrated needs. Better Auth can own sessions while application repositories use Effect SQL, as the [starter host tests](../../examples/starter/src/server/notesHost.test.ts) exercise. The authenticated shell supplies `SessionBoundary`, which owns session-scoped registry and subtree teardown; the [session guide](./client-lifecycle.md) links its cache and draft reset tests. A query refresh failure with a tagged `Unauthorized` error asks the auth owner to recheck rather than automatically ending the session.
