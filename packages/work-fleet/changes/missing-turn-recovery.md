### Fixed
- Lost accepted Codex turns check remote branches and open PRs before recovery. Unpublished work releases its lost execution and relaunches automatically; published work starts a repair turn on the existing branch or PR. Answers to lost-turn decisions reach the replacement turn.
- Publication-backed repairs retain recovery eligibility when a replacement turn is rejected by provider capacity, so scheduled retries resume without human intervention.

### Added
- Optional `FleetIntegrations.publication(work)` returns `WorkPublication` (`branch`, `remoteBranch`, optional `pullRequest`) so hosts can supply publication evidence for lost-turn recovery. Missing or inconclusive evidence still needs a decision.
- Optional `Attempt.publishedRecovery` records that publication evidence authorized replacement of a lost turn.
