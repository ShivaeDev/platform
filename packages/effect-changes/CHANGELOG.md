# Changelog

## 0.1.0 - 2026-09-26

### Added

- Add `makeChannel`: record changes inside a transaction and publish them once,
  deduplicated by key, only after the outermost frame for their owner commits.
  Nested frames merge on commit and are discarded on rollback; frames are kept
  per transaction owner.
- Wrap exit-reporting native transactions with `within`, Promise-committing
  drivers with `open` and `settle`, and non-transactional work with `batch`.
- Publish exactly when the database committed, including when the caller is
  interrupted while `COMMIT` is in flight.
- Log a sink failure after commit, whether a failed Effect, a defect or a
  synchronous throw, and keep the committed result by default;
  `onPublishFailure: "die"` raises a defect instead.
- Expose `channel.Sink` and `channel.Observer` as `Context.Reference`s: tests
  can swap the sink for a scope and observe every recorded, published and
  discarded change.
