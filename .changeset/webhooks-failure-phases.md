---
"@shivaedev/webhooks": minor
---

### Fixed

- Classify webhook failures at the receiving phase: invalid payloads return 400, while application schema errors return a logged 503. Preserve frozen application failures and their tags without mutating them when attaching the retry response.

### Breaking

- `WebhookEvent.decode` reports payload decoding failures as `WebhookPayloadError` from `@shivaedev/webhooks/server/WebhookPayloadError.ts`, with the original `SchemaError` in `cause`. Direct callers must catch `WebhookPayloadError` instead of `SchemaError` for invalid payloads. Custom event decoders must wrap payload schema failures in `new WebhookPayloadError({ cause })`, or use `webhookEvent` to separate decoding from application mapping. Application failures keep their original error types.
