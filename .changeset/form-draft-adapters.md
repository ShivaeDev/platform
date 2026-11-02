---
"@shivaedev/form": minor
"@shivaedev/react": minor
---

### Added

- Form's `draftPersistence` Effect from `@shivaedev/form/adapters/draftPersistence.ts` acquires `DraftStorageProvider` and the Clock for draft storage, timestamps and expiry. Provide `browserDraftStorage` from `@shivaedev/form/adapters/browserDraftStorage.ts` for best-effort localStorage persistence.

### Breaking

- Import form's React hooks and `DraftSessionContext` from `@shivaedev/form/adapters/react.ts` instead of `@shivaedev/form/client/react.ts`. Import the low-level `persistence` bridge from `@shivaedev/form/adapters/persistence.ts` instead of `@shivaedev/form/persistence.ts`.
- `usePersistedDraft`, `useEditor` and `useCreate` require explicit storage alongside time. Replace `BrowserDraftConfig` with `PersistedDraftConfig` from `@shivaedev/form/persistence.ts`, acquire `persistence` with `yield* draftPersistence.pipe(Effect.provide(browserDraftStorage))` during Effect setup, and pass `persistedDraft: { key, ...persistence }`.
