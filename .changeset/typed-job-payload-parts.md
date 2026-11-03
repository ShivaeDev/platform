---
"@shivaedev/jobs": minor
"@shivaedev/webhooks": minor
---

### Added

- `@shivaedev/jobs`: Queues accept `id: ["field", ...]` to derive deterministic UUIDs from the queue name and typed scalar payload parts. Repeated parts deduplicate while pg-boss retains the job. Enqueueing rejects conflicting IDs owned by a queue definition.
- `@shivaedev/webhooks`: Webhook producers reject conflicting enqueue IDs owned by a queue definition.

### Breaking

- `@shivaedev/jobs`: Replace singleton `key: (payload) => string` callbacks with `key: ["field", ...]`, naming required string, number, boolean or null fields in the decoded payload schema. Use `key: []` for a queue-wide singleton key. To preserve application-specific normalization, put the normalized value in a payload field and name it as a part. Derived singleton key strings use typed tuples; drain existing singleton work before switching producers and workers together so old and new keys do not run concurrently.
