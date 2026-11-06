---
"@shivaedev/quality": patch
---

### Fixed

- Distinguish owned service state and adapter resources from captured environment dependencies, check local service plumbing, and accept environments assembled from Layers at composition roots.
- Reuse service analysis across parameter checks to avoid repeated traversal of shared types and declarations.
