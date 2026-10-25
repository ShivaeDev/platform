---
"@shivaedev/effect-react": minor
---

### Added

- Add an optional session notice host with application-rendered controls, dismissal, expiry and native action status. Queries, command Effects and form submissions can supply notice descriptors; Undo runs an application Effect with its own payload and expected version, keeps conflicts on that action, and releases entries and pending actions when their notice or session ends.
