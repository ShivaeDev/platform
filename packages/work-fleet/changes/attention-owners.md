### Breaking

- Replace the single waiting view with `waiting.maintainer`, `waiting.orchestrator` and `waiting.automation`. Persist `attentionOwner` on waiting records; group status and generated Board views by owner and change wait/watch summaries to name the owner. Stage values and wait exit codes are unchanged.
- Publish version 2 Fleet health snapshots with waiting counts per owner. Area, capacity and quota waits belong to automation.

### Changed

- Route routine worker questions, result inspection, report limits and terminal reviewer failures to the orchestrator. Explicit maintainer questions and reviewed PRs ready to merge wait on the maintainer; missing integrations and pending checks wait on automation. Dependency qualification waits on the orchestrator. Reassign an exact waiting decision through Fleet, native RPC or the CLI while preserving reviewed sources and superseding the old question durably.
- Notable: no-change validation without a configured host validator waits on automation with `No-change validation is not configured` instead of a generic GitHub-check failure.
- Keep terminal work visible while Board acknowledgements are pending.

### Fixed

- Migrate legacy published questions and ready-to-merge decisions to the maintainer on both the record and decision. Recover publication receipts and read recorded Board answers before changing an owner, preserving answers during upgrade.
- Retry a committed reassignment by its original decision ID after a lost acknowledgement without publishing again. Competing reassignment and resolution writes fail with a typed stale decision.
- Archive owners and supersession receipts when work continues without carrying those receipts into the new cycle or acknowledging them twice.
