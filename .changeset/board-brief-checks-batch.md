---
"@shivaedev/work-board": patch
"@shivaedev/work-fleet": patch
---

### Fixed

- Board overview, goals, navigation and Fleet item reads answer promptly with many open Fleet items: Board asks Fleet about every brief a view shows in one `daemon.briefProblems` request instead of one sequential request per brief. Run matching Board and Fleet versions so refused briefs keep showing.
