### Added

- Board publication helpers `publishedDecision`, `closePublishedDecision` and `upgradeDecisionClosure` identify generated Fleet decisions, close superseded requests and apply the one-time closure upgrade.

### Fixed

- Merge-ready PRs and changed Board briefs ask the orchestrator for a decision. Superseded Fleet decision publications close on the Board, including older publications found during upgrade. Explicit maintainer reassignments survive the routing upgrade.
