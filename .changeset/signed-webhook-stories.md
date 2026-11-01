---
"@shivaedev/webhooks": minor
---

### Added

- Deliver signed webhook payloads to an application's HTTP route with `deliverWebhook` from `@shivaedev/webhooks/server/testing.ts`. It resolves the source's configured secret, signs GitHub deliveries by default, accepts custom signers and header overrides for refusal stories, and returns the native Effect HTTP response without a test-story dependency.
