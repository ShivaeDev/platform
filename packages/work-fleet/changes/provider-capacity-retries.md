### Changed

- Dispatch prepared work sequentially and keep queue-full launch rejections queued with durable exponential backoff from 30 seconds up to five minutes. Stop scheduler dispatch for the pass and show the last rejection time while waiting for provider capacity. Continuation retries keep their saved message, launch settings and existing worker thread.
