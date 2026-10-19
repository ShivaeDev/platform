---
"@shivaedev/work-board": patch
---

### Changed

- A returned result is reviewed on its own item page: its review request, checks and evidence, and feedback sit above the report, and whatever is missing is said in one line. `/_board/result?item=<id>` links redirect to the item page, and the item no longer offers a separate **Review returned result** button.
- Feedback says when the reviewed report version was received or reviewed instead of showing a shortened hash; the full SHA-256 stays under **Report as reviewed**.

### Fixed

- When feedback can't be read, the Board names each file and the reason, and links to System's source problems.
- A broken question or response about other work no longer hides a result's feedback, and an authored question about a result no longer counts as a broken record.
