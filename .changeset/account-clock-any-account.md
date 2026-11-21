---
"@shivaedev/identity": minor
---

### Breaking

- `AccountClock` is a global service that answers for any account: `logicalDay(account, instant?)` and `dayRange(account, day)` take the account id first and read that account's saved timezone on each call, and the Layer requires `AccountPreferencesStore` and `AccountDayStart` instead of `Subject`. Replace `clock.logicalDay()` with `clock.logicalDay((yield* Subject).id)` and `clock.dayRange(day)` with `clock.dayRange((yield* Subject).id, day)`, and move the clock's Layer from `requestServices` to `services`, for example `AccountClock.layer.pipe(Layer.provide(Layer.succeed(AccountDayStart, 240)), Layer.provideMerge(accountPreferencesStore))`. Both methods now fail with `AuthUnavailable` when the account's preferences cannot be read, where the old clock failed its request Layer's construction, and `dayRange` keeps its `SchemaError` for a `day` that is not an ISO calendar date. A defined module's operation, a job, and a native handler whose contract declares a subject or identity middleware carry `AuthUnavailable` with nothing to add; a native contract without either adds `rejections: { AuthUnavailable }` to the query.
