---
"@shivaedev/work-board": minor
---

### Added

- An item page leads with the open asks in other files that name it: "Waiting on you: <title>" in amber with an **Answer** button when the ask waits on you, and "Waiting on agents: <title>" in neutral colours when only agents can answer it.
- On a phone, a question page shows an **Answer** button at the top that moves to the answer box and focuses it.
- Item IDs and workspace paths in a next action show the named document's title as a link with its status chip. Words that name no document stay plain.
- `#123` and `PR 123` in a next action link to the pull request when the workspace's `package.json` names a GitHub repository or its git checkout's `origin` remote is on GitHub, without Fleet running.
