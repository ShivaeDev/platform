---
"@shivaedev/webhooks": minor
---

### Added

- Event mappings receive normalized delivery metadata (`id`, `source`, `event`) as their second argument. Existing payload-only mappings remain valid.
- `webhookJob` accepts native jobs enqueue options, including `id`, so applications can choose a stable job identity across deliveries.

### Breaking

- Direct callers of `WebhookEvent.decode` must pass delivery metadata as the second argument: `event.decode(body, { id, source, event })`. Custom decoders can accept the same argument to read the delivery identity.
