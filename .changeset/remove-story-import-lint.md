---
"@shivaedev/quality": minor
---

### Breaking

- Remove the `tests/support-imports` rule and its module allowlist. Delete the `tests/support-imports` block from your quality config; configs that still name it fail validation. Story kits may import any workspace module; how tests use those modules belongs to testing guidance and review.
