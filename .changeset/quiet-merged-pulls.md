---
"@shivaedev/pr-watch": patch
---

### Fixed

- Treat merged pull requests as terminal so cleared auto-merge requests and queue entries do not raise alerts, even when the reported state is still open. Auto-merge disabled on an open pull request still raises one alert.
