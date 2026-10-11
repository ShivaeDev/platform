### Added

- Schedule exact Board `areas` under PostgreSQL admission, keep eligible overlapping tasks in durable order, and expose area and dependency wait reasons in status, wait and Board views. Free held areas on completion, safe release or a reviewed, green PR’s merge wait. Add `areaMergeWaitMs` to Fleet policy and host configuration with a 30-minute default from readiness; delivery observation continues after that wait.
- Admit `depends_on` targets without Fleet records when their Board status is `done`; targets with Fleet records still require accepted completion for the current Board revision.
