---
"@shivaedev/test-story": minor
---

### Breaking

- Test-story's peers are exactly Vitest 5.0.4 and happy-dom 21.0.1. Consumers pin `vitest` to 5.0.4 and, when they run DOM stories, `happy-dom` to 21.0.1; happy-dom remains optional for applications without DOM stories.
