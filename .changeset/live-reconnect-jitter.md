---
"@shivaedev/contract": patch
---

### Fixed

- Jitter live subscription retries and the shared WebSocket reconnect backoff so clients recovering from the same host restart spread their query reruns over time.
