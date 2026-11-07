---
"@shivaedev/quality": minor
---

### Breaking

- Remove `baseline write --first-adoption` and the changed-file `--file` selection. Run `quality baseline write` to record every current finding, including findings in untouched files and with an existing baseline. Use repeated `--rule <id>` options to record only selected rules; remove `--first-adoption` and `--file <path>` from existing commands.

### Changed

- Print repair and review guidance after every baseline write, with recorded rule counts and rules new since the previous baseline marked for case-by-case review. Report rule misreads to Platform with the file, lines and what Quality needs instead of retaining them as debt. Commit and CI checks still reject unwritten findings.
