---
"@shivaedev/webhooks": minor
---

### Breaking

- The webhook route Layer preserves signing-key `ConfigError` failures instead of converting them to defects. Consumers must propagate or handle this typed error at application startup; remove `Layer.orDie` when composing the route into the app host.

### Fixed

- Receipt storage and enqueue failures log a redacted cause with their error tag at error level before answering 503. The HTTP request span keeps the redacted original failure without request credentials.
