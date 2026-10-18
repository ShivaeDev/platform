### Added

- `areaWaiters(state, record)` in `engine/areaWaiters.ts` computes earlier eligible area waiters for engine launch admission.

### Fixed

- Reviewers reacquiring a released area wait behind earlier eligible area waiters, including when a moved PR head needs a fresh review.
