### Added

- Gate every story in a kit with the inferred definition's `runIf` boolean option. A false condition skips every `it` variant before setup, including `fails` and `only`, while preserving per-story skips and conditions.
