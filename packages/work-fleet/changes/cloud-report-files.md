### Fixed

- Reconstruct private report attachments from the exact completed Cloud turn’s paginated app-server `fileChange` items, replaying adds, updates, moves and deletes under `/tmp/fleet-report/attachments/`. Require file-edit/apply_patch writes and explicit attachment declarations in report prompts; binary evidence uses base64 text. Publish report text and unavailable-file reasons when retrieval, reconstruction or collection limits fail, while retaining retrievable files after per-file failures.

### Added

- Add `ReportAttachments`, `UnavailableAttachment`, attachment directory/marker constants and `declaredAttachments` in `reportAttachments.ts`; `codexReportAttachments` and `makeCodexReportAttachments` fetch turn files, `reportFileChanges` and `reportFileReplay` reconstruct them, and `applyReportPatch` validates update hunks.

### Breaking

- `reportBoard` collectors now receive `SessionObservation` and return `ReportAttachments` with `files` and `unavailable`; `ReportFile` moves to `reportAttachments.ts`. Remove the obsolete `codexTaskDiff`, `makeCodexTaskDiff`, `readTaskResponse` and `reportDiffFiles` exports and their REST/Git-patch modules. `codexTurns` exposes shared bounded `readItems` pagination in addition to `readOutput`; `reportLinks` accepts optional unavailable-file records.
