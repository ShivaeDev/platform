---
"@shivaedev/webhooks": patch
---

### Fixed

- Keep payload content out of receipt failure logs and exported transaction and receive spans by retaining only error tags. Original error messages, properties, stacks and nested causes are no longer included. Document receipt metadata, explicitly mapped job payloads and application-owned diagnostics as the privacy boundary.
