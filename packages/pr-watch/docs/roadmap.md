# Roadmap

## Built

- A REST executable for explicit PRs or repository-wide fleet discovery, using effect-service services.
- ETag response reuse, quota pacing, queue-ref observations and eight transition events, distinguishing queue entry from disabled auto-merge.
- Startup events for already-stuck auto-merges, terminal PR pruning and GraphQL confirmation of suspected queue drops.
- Native Effect filesystem and HTTP services with typed failures.
- Atomic snapshot persistence and comparison across clean restarts.
- Synthetic HTTP tests and packed executable consumer scenarios.

## Next

Work Fleet checks and delivery integrations can consume the event lines. Application adoption needs its own evidence.

## Maintainer decisions

No additional delivery protocol or event history is part of this package.
