# Application-boundary validation

This phase tests the native framework against database and application lifecycle
behavior. Most of the missing pieces need conventions and verified composition,
not additional framework engines.

| Area | Evidence | Boundary still open |
| --- | --- | --- |
| PostgreSQL codecs | [Codec guide](./postgres-codecs.md): precise decimals, native dates, JSON/JSONB, nulls, generated values and decoding failures | Time-zone and precision policy; broader driver types |
| Constraint errors | [Known-constraint mapping](./constraint-errors.md): domain failure after rollback, unrelated errors preserved | Application-specific error names and UI text |
| Migrations | [PostgreSQL guide](./postgres-migrations.md): upgrade, rerun, failed batch and concurrent existing ledger | Single bootstrap owner; deployment timeouts and authoring conventions |
| Authentication | [BetterAuth bridge](./auth-boundary.md): actual issued cookies, expiry, revocation and principal isolation | Application storage/host adoption, browser cookies and mobile policy |
| Cancellation | [HTTP cancellation](./cancellation.md): interrupted client releases scoped server work before save | Host/proxy propagation and already committed work |
| Client lifetime | [Session guide](./client-lifecycle.md): new session resets cache and drafts; refresh retains edits | Real auth-owner teardown, SSR and Capacitor |
| Entry forms | [Expense-entry fixture](../../packages/effect-form/test/entry-form.test.ts): numeric and optional-value decoding, validation, failed-save retry and refresh during edits exercised with the form package | Component adoption in an application and product-native checks |

Native SQL reasons and Migrator cover the demonstrated needs; no second error
hierarchy or migration engine was added. BetterAuth can remain a separately
supported provider while application repositories use Effect SQL. Session teardown
belongs to the authenticated application shell: a query refresh error does not
automatically log the user out or erase retained data.
