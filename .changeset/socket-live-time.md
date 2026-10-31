---
"@shivaedev/contract": patch
---

### Fixed

- Shared RPC WebSockets measure opening, heartbeat and reconnect delays on live time, so advancing an application's TestClock does not time out a real connection. Application timers keep their own clock.
