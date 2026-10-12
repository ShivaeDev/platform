### Added

- Discover `quality.fences.config.ts` beside the repository root and each workspace package manifest, combining its default array of import fences with existing config-supplied fences in the shared quality report. Invalid boundary files stop the gate.

### Fixed

- Reject empty import graphs even when no fences are configured, keeping source selection errors visible.
