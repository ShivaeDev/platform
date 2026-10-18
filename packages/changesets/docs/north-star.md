# Reproducible workspace releases

A release should preserve what its authors asked for. A changeset names packages, explicit bumps and human release notes. One plan includes the highest requested bumps and every published dependent that must ship with them. Applying that plan produces a diff a maintainer can review without reconstructing intermediate commits.

The release manifest preserves filenames and exact source text. Validation reproduces versions and changelog entries from those inputs and protects already released history. Files added after collection stay pending. A squash merge does not discard the evidence needed to validate a release.

Explicit intent wins over inference, and preserving history wins over convenient edits. Repository policy stays in typed Effect hooks: starter pins and embedded version constants belong to the repository that owns them. npm publishing, release scheduling and approval policy stay outside this package.
