---
"@shivaedev/quality": minor
---

### Added

- Run `.unit` test and spec files in a default `pure` Node project whose runtime guard rejects file-system, network, process, worker and `fetch` calls, including I/O hidden in dependencies. Errors name the unit file and call. Ordinary Node files remain in `unit`, and `--project slow` keeps selecting slow tests alone.
