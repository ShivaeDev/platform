### Fixed

- Fleet no longer exhausts the GitHub budget. PR state, checks, rulesets, PR files and report publication are read through GitHub's REST API with conditional requests, so an unchanged resource answers `304 Not Modified` and costs no rate limit. Delivery polling no longer uses GraphQL.
- The scheduler slows down as the recorded REST `core` budget drops below half and waits for the reset when it is exhausted. The configured interval is the fastest pace.
- A rate-limited GitHub response stops further calls to that resource until its reset, `retry-after` time or backoff. Affected work shows `GitHub is rate-limited until <time>` and does not escalate as a read failure.
- `fleet/health.json` and the daemon's diagnostics carry the rate-limit headers of Fleet's own GitHub responses per resource with their observation time. Release together with `@shivaedev/work-board`, whose diagnostics schema changes with it.
