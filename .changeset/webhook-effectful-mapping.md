---
"@shivaedev/webhooks": minor
---

### Added

- Let `webhookEvent` mappings return an Effect with application services and typed failures. Existing pure mappings continue to work through `webhookRoute`. Empty job lists receive `200 ignored`; failed checks roll back the receipt and jobs and receive `503` with redacted failure reporting.
