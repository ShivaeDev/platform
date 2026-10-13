### Added

- Opt-in `Config.persistedDraft` stores encoded input and its baseline under an application key, bounded by age and size, while storage failures leave editing usable. Reload and refresh preserve edits, revert and successful submission clear accepted input, and later edits remain persisted.
- `persistence.ts` exports `PersistedDraftConfig`, `DraftStorage`, `Persistence` and `persistence`; `draftSession.ts` exports `DraftSession` and `draftSession`. React exports `usePersistedDraft`, `BrowserDraftConfig` and `DraftSessionContext` to bind browser storage and session ownership.
