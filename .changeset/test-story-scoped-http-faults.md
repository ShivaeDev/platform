---
"@shivaedev/test-story": minor
---

### Added

- Scope `fakeHttpService` stalls, immediate faults and one-shot replies by decoded path parameters with `FakeHttpScope`.
- Script future status, drop and reset faults with `scriptFault` and `FakeHttpScriptOptions`, optionally repeat until the returned `FakeHttpScript.lift` control or strike after the route's reply applies its effects.
- Declare per-route guards alongside the service guard; rejected requests receive 401 before holds, arrival scripts or faults are consumed.
