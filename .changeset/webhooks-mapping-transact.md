---
"@shivaedev/webhooks": minor
---

### Breaking

- `webhookRoute`'s Layer requires `Reactivity.Reactivity` from `effect/reactivity/Reactivity`, because the route opens the receipt transaction with `transact`. A route passed to `appHost` with `migrations` needs no change: the host supplies its own. A route composed anywhere else is given the `Reactivity` its readers listen on, such as `Layer.provide(Reactivity.layer)`.

### Fixed

- A `webhookEvent` mapping can call a service that writes through `transact` or records change keys with `invalidateOnCommit`. The write commits with the receipt and its jobs and announces its keys, and rolls back with the receipt when the mapping fails afterwards. Such a mapping used to die inside the receipt transaction and answer 500.
