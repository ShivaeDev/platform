---
"@shivaedev/identity": minor
---

### Breaking

- `AccountClock` is a global service that answers for any account: `logicalDay(account, instant?)` and `dayRange(account, day)` take the account id first and read that account's saved timezone on each call, and the Layer requires `AccountPreferencesStore` and `AccountDayStart` instead of `Subject`. Replace `clock.logicalDay()` with `clock.logicalDay((yield* Subject).id)` and `clock.dayRange(day)` with `clock.dayRange((yield* Subject).id, day)`, and move the clock's Layer from `requestServices` to `services`, for example `AccountClock.layer.pipe(Layer.provide(Layer.succeed(AccountDayStart, 240)), Layer.provideMerge(accountPreferencesStore))`. A failed preferences read now fails each call with `AuthUnavailable` instead of failing the request Layer's construction, so a `Layer.orDie` around the clock no longer covers it.
