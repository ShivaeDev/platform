### Added

- The command palette offers navigation to Today, Goals, Now, Library, System and active goals alongside appearance commands. Search results show item IDs, kinds and status chips.

### Fixed

- Search ranks items before headings and passages, open work before closed and deferred work, then title and ID matches before body matches and recently changed sources before older ones. Fleet records, including `fleet/status.md` and `responses/fleet-report.*`, require `records:`. Snippets omit structured metadata, each anchor appears once, and rows without a recorded status omit the status chip.
- With `records:`, Fleet item results follow ordinary work and precede all heading and passage hits, including when only the item's body matches.
