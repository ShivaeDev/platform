---
"@shivaedev/form": minor
"@shivaedev/react": minor
---

### Added

- `@shivaedev/form`: The `draftPersistence` Effect from `@shivaedev/form/adapters/draftPersistence.ts` acquires `DraftStorageProvider` and the Clock for draft storage, timestamps and expiry. Provide `browserDraftStorage` from `@shivaedev/form/adapters/browserDraftStorage.ts` for best-effort localStorage persistence.

### Breaking

- `@shivaedev/form`: Import React hooks and `DraftSessionContext` from `@shivaedev/form/adapters/react.ts` instead of `@shivaedev/form/client/react.ts`. Import the low-level `persistence` bridge from `@shivaedev/form/adapters/persistence.ts` instead of `@shivaedev/form/persistence.ts`.
- `@shivaedev/form`: `usePersistedDraft` requires explicit storage alongside time. Replace `BrowserDraftConfig` with `PersistedDraftConfig` from `@shivaedev/form/persistence.ts`, acquire `persistence` with `yield* draftPersistence.pipe(Effect.provide(browserDraftStorage))` during Effect setup, and pass `persistedDraft: { key, ...persistence }`.
- `@shivaedev/react`: `useEditor` and `useCreate` require explicit draft storage alongside time. Acquire `persistence` with form's `draftPersistence` Effect from `@shivaedev/form/adapters/draftPersistence.ts`, provide `browserDraftStorage` from `@shivaedev/form/adapters/browserDraftStorage.ts`, and pass `persistedDraft: { key, ...persistence }`.
