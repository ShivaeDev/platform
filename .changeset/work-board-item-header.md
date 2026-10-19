---
"@shivaedev/work-board": patch
---

### Fixed

- An item page's status chip shows **Needs you** whenever a request on that item is open and unanswered, for every kind of item. Before, only decisions and questions did, so a task waiting on you said **Active**. Once someone answers, the chip shows **Waiting on agents**.
- Decisions and questions with no open request show **Answered** or **Closed** instead of no status.
- The item header on goal pages names the kind **Goal** instead of "project".
- **Prepare an agent handoff** is no longer offered on finished or dropped items or on goals.

### Added

- The item header shows when the item last changed, after its ID.
- When the file changes while the page is open and the status changes with it, the header says so, for example "Status changed: Active → In review". Screen readers announce it politely. The first load is not announced.
- An item that implements a goal links to it from the header as "Part of <goal title>".
- Header controls (the ID link, the copy button, the goal link, the PR chip, **On this page**, **Pin** and the page actions) are at least 44px tall on touch screens. The desktop header keeps its height.
