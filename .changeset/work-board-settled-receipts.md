---
"@shivaedev/work-board": patch
---

### Fixed

- A managed decision leaves Today once every receipt for its question is valid, so an applied receipt followed by a superseded one no longer keeps an answered decision under Needs you. When only some of several receipts are valid, Today shows the request with a problem naming the receipt files instead of offering an answer.
