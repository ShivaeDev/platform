---
"@shivaedev/test-story": patch
---

### Fixed

- Compose outbound routes acquired in separate scopes. Each scope removes only its own registrations; the newest active route for a shared hostname wins, and closing it restores the earlier route.
