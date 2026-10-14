### Fixed

- Fleet notices when a human merges its PR or closes its Board task as done, superseded or deferred. It releases the item, supersedes the open Board request and frees the PR reservation, instead of waiting for an orchestrator or starting a repair. Reviewed work with passing checks still completes at the accepted head.
