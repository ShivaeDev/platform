### Fixed

- Automatically start an independent review of the current PR head when delivery observation finds a push after approval. Keep the prior result and review, clear stale checks, recover before reviewer launch after restart, and route retry of a stored moved-head decision through current PR observation instead of the old worker report.
