---
"@shivaedev/create-app": minor
---

### Breaking

- Resource generation emits `server/service.ts` and `server/Repository.ts` with separate traced operations that yield the repository and session caller. Migrate custom resource tooling from `server/Service.ts`, `server/makeRepository.ts` and PascalCase service exports to `server/service.ts`, `server/Repository.ts` and lower-camel exports such as `bookmarksService`. Then declare repositories with `defineRepository`, register caller-dependent service Layers in `requestServices`, and remove acting-user arguments from operations and handlers. Single writes commit without `transact`; keep transactions for writes that must commit together, including job enqueue.

### Changed

- The bundled starter follows the same request service model for notes, including private item reads and transactional job enqueue.
