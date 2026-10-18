---
"@shivaedev/work-board": patch
---

### Changed

- Today's Needs you, Answered and Later rows no longer repeat their section's state in a status chip; each row keeps its ID, age and Answer control.
- Status chips on Now, goal and item pages, search results, the All work status filter and the Library's rows and status filter show plain words such as "Needs you", "Blocked" or "In progress" instead of raw values like `needs-you`.
- The Library and All work status filters offer one option per plain name, matching every status that shares it, so **Needs you** lists both `needs-you` and `needs-human` items. `client.api.library.query({ status })` matches the same way and returns one entry per name in `statuses`.
